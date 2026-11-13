"""Idempotent merge of a ProfAsist state into another one.

The rules mirror services/grading.ts and the app's referential integrity:
- groups, students, categories and activities are matched by id first and by
  normalized name/roll second;
- grades are translated to the local ids when a match was made by name;
- local sessions, attendance and recordings are preserved by default;
- conflicts are reported and resolved according to --prefer.
"""

from __future__ import annotations

import copy
from typing import Any

from schema import normalize_roll, normalize_text

PARCIAL_IDS = ("parcial1", "parcial2", "parcial3")


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _find_by_id_or_name(
    items: list[dict[str, Any]],
    incoming: dict[str, Any],
    *,
    name_keys: tuple[str, ...] = ("name",),
    roll_key: str | None = None,
) -> dict[str, Any] | None:
    incoming_id = incoming.get("id")
    for item in items:
        if incoming_id and item.get("id") == incoming_id:
            return item

    if roll_key:
        incoming_roll = normalize_roll(incoming.get(roll_key))
        if incoming_roll:
            for item in items:
                if normalize_roll(item.get(roll_key)) == incoming_roll:
                    return item

    for name_key in name_keys:
        incoming_name = normalize_text(incoming.get(name_key))
        if not incoming_name:
            continue
        matches = [
            item for item in items if normalize_text(item.get(name_key)) == incoming_name
        ]
        if len(matches) == 1:
            return matches[0]
    return None


def _merge_students(
    local_group: dict[str, Any],
    incoming_group: dict[str, Any],
    report: dict[str, Any],
) -> dict[str, str]:
    local_students = _as_list(local_group.get("students"))
    local_group["students"] = local_students
    id_map: dict[str, str] = {}

    for incoming in _as_list(incoming_group.get("students")):
        if not isinstance(incoming, dict) or not incoming.get("id"):
            continue
        match = _find_by_id_or_name(
            local_students, incoming, name_keys=("name",), roll_key="rollNumber"
        )
        if match is None:
            new_student = copy.deepcopy(incoming)
            local_students.append(new_student)
            id_map[incoming["id"]] = new_student["id"]
            report["students_added"] += 1
            continue

        id_map[incoming["id"]] = match["id"]
        report["students_matched"] += 1
        for key in ("name", "rollNumber", "email", "phone", "tag", "birthday"):
            value = incoming.get(key)
            if value not in (None, ""):
                match[key] = value
    return id_map


def _merge_activities(
    local_category: dict[str, Any],
    incoming_category: dict[str, Any],
    report: dict[str, Any],
) -> dict[str, str]:
    local_activities = _as_list(local_category.get("activities"))
    local_category["activities"] = local_activities
    id_map: dict[str, str] = {}

    for incoming in _as_list(incoming_category.get("activities")):
        if not isinstance(incoming, dict) or not incoming.get("id"):
            continue
        match = _find_by_id_or_name(local_activities, incoming, name_keys=("name",))
        if match is None:
            new_activity = copy.deepcopy(incoming)
            local_activities.append(new_activity)
            id_map[incoming["id"]] = new_activity["id"]
            report["activities_added"] += 1
            continue
        id_map[incoming["id"]] = match["id"]
        if incoming.get("name"):
            match["name"] = incoming["name"]
    return id_map


def _merge_categories(
    local_group: dict[str, Any],
    incoming_group: dict[str, Any],
    parcial_id: str,
    report: dict[str, Any],
) -> dict[str, str]:
    incoming_parcial = _as_dict(_as_dict(incoming_group.get("evaluations")).get(parcial_id))
    local_evaluations = _as_dict(local_group.get("evaluations"))
    local_group["evaluations"] = local_evaluations

    if not incoming_parcial and parcial_id not in local_evaluations:
        return {}

    local_parcial = _as_dict(local_evaluations.get(parcial_id))
    local_evaluations[parcial_id] = local_parcial
    local_categories = _as_list(local_parcial.get("categories"))
    local_parcial["categories"] = local_categories

    activity_id_map: dict[str, str] = {}

    for incoming_category in _as_list(incoming_parcial.get("categories")):
        if not isinstance(incoming_category, dict) or not incoming_category.get("id"):
            continue
        match = _find_by_id_or_name(local_categories, incoming_category, name_keys=("name",))
        if match is None:
            new_category = copy.deepcopy(incoming_category)
            local_categories.append(new_category)
            report["categories_added"] += 1
            for activity in _as_list(new_category.get("activities")):
                if isinstance(activity, dict) and activity.get("id"):
                    activity_id_map[activity["id"]] = activity["id"]
            continue

        # Keep local id; update weight/name when the incoming payload has them.
        if incoming_category.get("name"):
            match["name"] = incoming_category["name"]
        if isinstance(incoming_category.get("weight"), (int, float)):
            match["weight"] = incoming_category["weight"]
        activity_id_map.update(_merge_activities(match, incoming_category, report))

    return activity_id_map


def _merge_parcial_grades(
    local_group: dict[str, Any],
    incoming_group: dict[str, Any],
    parcial_id: str,
    student_id_map: dict[str, str],
    activity_id_map: dict[str, str],
    prefer: str,
    report: dict[str, Any],
) -> None:
    incoming_parcial = _as_dict(_as_dict(incoming_group.get("evaluations")).get(parcial_id))
    if not incoming_parcial:
        return
    local_evaluations = _as_dict(local_group.get("evaluations"))
    local_group["evaluations"] = local_evaluations
    local_parcial = _as_dict(local_evaluations.get(parcial_id))
    local_evaluations[parcial_id] = local_parcial
    local_grades = _as_dict(local_parcial.get("grades"))
    local_parcial["grades"] = local_grades

    for incoming_student_id, incoming_values in _as_dict(incoming_parcial.get("grades")).items():
        local_student_id = student_id_map.get(incoming_student_id, incoming_student_id)
        local_values = _as_dict(local_grades.get(local_student_id))
        local_grades[local_student_id] = local_values

        for incoming_activity_id, incoming_grade in _as_dict(incoming_values).items():
            local_activity_id = activity_id_map.get(incoming_activity_id, incoming_activity_id)
            if local_activity_id not in local_values:
                local_values[local_activity_id] = incoming_grade
                report["grades_added"] += 1
                continue

            local_grade = local_values[local_activity_id]
            if local_grade == incoming_grade:
                continue

            report["conflicts"].append(
                {
                    "type": "grade",
                    "group": incoming_group.get("name"),
                    "student": incoming_student_id,
                    "parcial": parcial_id,
                    "activity": incoming_activity_id,
                    "local": local_grade,
                    "incoming": incoming_grade,
                }
            )
            if prefer == "incoming":
                local_values[local_activity_id] = incoming_grade
                report["grades_updated"] += 1


def _merge_sessions(local_group: dict[str, Any], incoming_group: dict[str, Any]) -> None:
    local_sessions = _as_list(local_group.get("sessions"))
    local_group["sessions"] = local_sessions
    by_id = {session.get("id"): session for session in local_sessions if isinstance(session, dict)}

    for incoming in _as_list(incoming_group.get("sessions")):
        if not isinstance(incoming, dict) or not incoming.get("id"):
            continue
        current = by_id.get(incoming["id"])
        if current is None:
            local_sessions.append(copy.deepcopy(incoming))
        else:
            for key in ("date", "startTime", "endTime", "topic", "attendance", "totalPresent", "totalStudents"):
                if key in incoming:
                    current[key] = copy.deepcopy(incoming[key])
            if incoming.get("recordings"):
                current["recordings"] = copy.deepcopy(incoming["recordings"])


def _merge_group(
    local_group: dict[str, Any],
    incoming_group: dict[str, Any],
    *,
    prefer: str,
    include_attendance: bool,
    report: dict[str, Any],
) -> tuple[dict[str, str], dict[str, str]]:
    student_id_map = _merge_students(local_group, incoming_group, report)

    for key in ("name", "semester", "scheduleSummary", "color", "archived"):
        if key in incoming_group and incoming_group[key] not in (None, ""):
            local_group[key] = incoming_group[key]

    if incoming_group.get("reporting"):
        local_group["reporting"] = {
            **_as_dict(local_group.get("reporting")),
            **_as_dict(incoming_group.get("reporting")),
        }
    if incoming_group.get("closureConfig"):
        local_group["closureConfig"] = copy.deepcopy(incoming_group["closureConfig"])
    if incoming_group.get("finalOverrides"):
        overrides = _as_dict(local_group.get("finalOverrides"))
        for student_id, override in _as_dict(incoming_group.get("finalOverrides")).items():
            local_id = student_id_map.get(student_id, student_id)
            overrides[local_id] = copy.deepcopy(override)
        local_group["finalOverrides"] = overrides

    activity_id_map: dict[str, str] = {}
    for parcial_id in PARCIAL_IDS:
        activity_id_map.update(
            _merge_categories(local_group, incoming_group, parcial_id, report)
        )

    for parcial_id in PARCIAL_IDS:
        _merge_parcial_grades(
            local_group,
            incoming_group,
            parcial_id,
            student_id_map,
            activity_id_map,
            prefer,
            report,
        )

    if include_attendance:
        _merge_sessions(local_group, incoming_group)

    return student_id_map, activity_id_map


def _translate_deliveries(
    local: dict[str, Any],
    incoming: dict[str, Any],
    group_id_map: dict[str, str],
    group_maps: dict[str, tuple[dict[str, str], dict[str, str]]],
    report: dict[str, Any],
) -> None:
    local_deliveries = _as_list(local.get("deliveries"))
    local["deliveries"] = local_deliveries
    by_id = {item.get("id"): item for item in local_deliveries if isinstance(item, dict)}

    for incoming_delivery in _as_list(incoming.get("deliveries")):
        if not isinstance(incoming_delivery, dict) or not incoming_delivery.get("id"):
            continue
        delivery = copy.deepcopy(incoming_delivery)
        group_id = delivery.get("groupId")
        delivery["groupId"] = group_id_map.get(group_id, group_id)
        if group_id in group_maps:
            student_map, activity_map = group_maps[group_id]
            delivery["studentId"] = student_map.get(
                delivery.get("studentId"), delivery.get("studentId")
            )
            delivery["activityId"] = activity_map.get(
                delivery.get("activityId"), delivery.get("activityId")
            )

        if delivery["id"] in by_id:
            by_id[delivery["id"]].update(delivery)
        else:
            local_deliveries.append(delivery)
            report["deliveries_added"] += 1


def _merge_audit_log(local: dict[str, Any], incoming: dict[str, Any]) -> None:
    local_log = _as_list(local.get("auditLog"))
    local["auditLog"] = local_log
    existing_ids = {item.get("id") for item in local_log if isinstance(item, dict)}
    for entry in _as_list(incoming.get("auditLog")):
        if isinstance(entry, dict) and entry.get("id") not in existing_ids:
            local_log.append(copy.deepcopy(entry))
            existing_ids.add(entry.get("id"))


def _merge_settings(local: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(_as_dict(local))
    for key, value in _as_dict(incoming).items():
        if key == "institution" and isinstance(value, dict):
            institution = _as_dict(result.get("institution"))
            for inst_key, inst_value in value.items():
                if institution.get(inst_key) in (None, ""):
                    institution[inst_key] = inst_value
            result["institution"] = institution
        elif key not in result or result[key] in (None, "", [], {}):
            result[key] = copy.deepcopy(value)
    return result


def merge_states(
    local: dict[str, Any],
    incoming: dict[str, Any],
    *,
    prefer: str = "incoming",
    include_attendance: bool = False,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return (merged_state, report). The inputs are not mutated."""
    if prefer not in ("incoming", "local"):
        raise ValueError("prefer debe ser 'incoming' o 'local'")

    merged = copy.deepcopy(local)
    report: dict[str, Any] = {
        "groups_added": 0,
        "groups_matched": 0,
        "students_added": 0,
        "students_matched": 0,
        "categories_added": 0,
        "activities_added": 0,
        "grades_added": 0,
        "grades_updated": 0,
        "deliveries_added": 0,
        "conflicts": [],
    }

    merged["version"] = max(
        int(local.get("version") or 1), int(incoming.get("version") or 1)
    )
    merged["settings"] = _merge_settings(
        _as_dict(local.get("settings")), _as_dict(incoming.get("settings"))
    )

    local_groups = _as_list(merged.get("groups"))
    merged["groups"] = local_groups
    group_id_map: dict[str, str] = {}
    group_maps: dict[str, tuple[dict[str, str], dict[str, str]]] = {}

    for incoming_group in _as_list(incoming.get("groups")):
        if not isinstance(incoming_group, dict):
            continue
        match = None
        for candidate in local_groups:
            if not isinstance(candidate, dict):
                continue
            if incoming_group.get("id") and candidate.get("id") == incoming_group.get("id"):
                match = candidate
                break
            if (
                normalize_text(candidate.get("name")) == normalize_text(incoming_group.get("name"))
                and candidate.get("semester") == incoming_group.get("semester")
            ):
                match = candidate
                break

        if match is None:
            new_group = copy.deepcopy(incoming_group)
            local_groups.append(new_group)
            report["groups_added"] += 1
            report["students_added"] += len(
                [student for student in _as_list(new_group.get("students")) if isinstance(student, dict)]
            )
            activity_map: dict[str, str] = {}
            for parcial_id in PARCIAL_IDS:
                for category in _as_list(
                    _as_dict(_as_dict(new_group.get("evaluations")).get(parcial_id)).get("categories")
                ):
                    for activity in _as_list(_as_dict(category).get("activities")):
                        if isinstance(activity, dict) and activity.get("id"):
                            activity_map[activity["id"]] = activity["id"]
                            report["activities_added"] += 1
            student_map = {
                student["id"]: student["id"]
                for student in _as_list(new_group.get("students"))
                if isinstance(student, dict) and student.get("id")
            }
            group_id_map[incoming_group.get("id")] = new_group.get("id")
            group_maps[incoming_group.get("id")] = (student_map, activity_map)
            continue

        report["groups_matched"] += 1
        group_id_map[incoming_group.get("id")] = match.get("id")
        group_maps[incoming_group.get("id")] = _merge_group(
            match,
            incoming_group,
            prefer=prefer,
            include_attendance=include_attendance,
            report=report,
        )

    _translate_deliveries(merged, incoming, group_id_map, group_maps, report)
    _merge_audit_log(merged, incoming)

    return merged, report


def summarize_report(report: dict[str, Any]) -> str:
    lines = [
        f"Grupos: +{report['groups_added']} nuevos, {report['groups_matched']} emparejados",
        f"Alumnos: +{report['students_added']} nuevos, {report['students_matched']} emparejados",
        f"Categorías: +{report['categories_added']}",
        f"Actividades: +{report['activities_added']}",
        f"Calificaciones: +{report['grades_added']} nuevas, {report['grades_updated']} actualizadas",
        f"Entregas: +{report['deliveries_added']}",
        f"Conflictos: {len(report['conflicts'])}",
    ]
    return "\n".join(lines)
