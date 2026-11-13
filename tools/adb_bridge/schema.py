"""Validation and canonicalization for the ProfAsist localStorage payload."""

from __future__ import annotations

import hashlib
import json
import math
import unicodedata
from typing import Any, Iterable

PARCIAL_IDS = ("parcial1", "parcial2", "parcial3")
GRADE_MIN = 0.0
GRADE_MAX = 10.0


class ValidationError(ValueError):
    """Raised when a payload cannot be safely written to the device."""


def normalize_text(value: Any) -> str:
    text = "" if value is None else str(value)
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return " ".join(text.lower().split())


def normalize_roll(value: Any) -> str:
    text = "" if value is None else str(value)
    return "".join(char for char in text.lower() if char not in " .-\t")


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _require(condition: bool, message: str, issues: list[str]) -> None:
    if not condition:
        issues.append(message)


def _validate_grades(
    grades: Any,
    student_ids: set[str],
    activity_ids: set[str],
    label: str,
    issues: list[str],
) -> None:
    if grades is None:
        return
    if not isinstance(grades, dict):
        issues.append(f"{label}.grades debe ser un objeto")
        return

    for student_id, activities in grades.items():
        if student_id not in student_ids:
            issues.append(f"{label}.grades contiene un alumno huérfano: {student_id}")
        if not isinstance(activities, dict):
            issues.append(f"{label}.grades[{student_id}] debe ser un objeto")
            continue
        for activity_id, grade in activities.items():
            if activity_id not in activity_ids:
                issues.append(
                    f"{label}.grades[{student_id}] contiene una actividad huérfana: {activity_id}"
                )
            if not _is_number(grade):
                issues.append(f"{label}.grades[{student_id}][{activity_id}] no es numérico")
            elif grade < GRADE_MIN or grade > GRADE_MAX:
                issues.append(
                    f"{label}.grades[{student_id}][{activity_id}] fuera de rango: {grade}"
                )


def validate_state(data: Any) -> list[str]:
    """Return a list of human-readable issues. Empty means safe to write."""
    issues: list[str] = []

    if not isinstance(data, dict):
        return ["El estado raíz debe ser un objeto JSON."]
    _require(isinstance(data.get("version"), (int, float)), "version debe ser numérico", issues)
    _require(isinstance(data.get("settings"), dict), "settings debe ser un objeto", issues)

    groups = data.get("groups")
    if not isinstance(groups, list):
        issues.append("groups debe ser un arreglo")
        return issues

    group_ids: set[str] = set()
    for group_index, group in enumerate(groups):
        if not isinstance(group, dict):
            issues.append(f"groups[{group_index}] debe ser un objeto")
            continue
        group_id = group.get("id")
        if not isinstance(group_id, str) or not group_id.strip():
            issues.append(f"groups[{group_index}].id es obligatorio")
        elif group_id in group_ids:
            issues.append(f"groups[{group_index}].id duplicado: {group_id}")
        else:
            group_ids.add(group_id)

        _require(isinstance(group.get("name"), str), f"groups[{group_index}].name es obligatorio", issues)
        _require(isinstance(group.get("semester"), str), f"groups[{group_index}].semester es obligatorio", issues)
        students = group.get("students")
        sessions = group.get("sessions")
        _require(isinstance(students, list), f"groups[{group_index}].students debe ser un arreglo", issues)
        _require(isinstance(sessions, list), f"groups[{group_index}].sessions debe ser un arreglo", issues)

        student_list = students if isinstance(students, list) else []
        student_ids: set[str] = set()
        for student_index, student in enumerate(student_list):
            if not isinstance(student, dict):
                issues.append(f"groups[{group_index}].students[{student_index}] debe ser un objeto")
                continue
            student_id = student.get("id")
            if not isinstance(student_id, str) or not student_id.strip():
                issues.append(f"groups[{group_index}].students[{student_index}].id es obligatorio")
            elif student_id in student_ids:
                issues.append(f"groups[{group_index}] alumno duplicado: {student_id}")
            else:
                student_ids.add(student_id)
            _require(
                isinstance(student.get("name"), str),
                f"groups[{group_index}].students[{student_index}].name es obligatorio",
                issues,
            )

        evaluations = group.get("evaluations")
        if evaluations is not None and not isinstance(evaluations, dict):
            issues.append(f"groups[{group_index}].evaluations debe ser un objeto")
            evaluations = None

        if isinstance(evaluations, dict):
            for parcial_id in PARCIAL_IDS:
                parcial = evaluations.get(parcial_id)
                if parcial is None:
                    continue
                if not isinstance(parcial, dict):
                    issues.append(f"groups[{group_index}].{parcial_id} debe ser un objeto")
                    continue
                categories = parcial.get("categories")
                if not isinstance(categories, list):
                    issues.append(f"groups[{group_index}].{parcial_id}.categories debe ser un arreglo")
                    continue

                category_ids: set[str] = set()
                activity_ids: set[str] = set()
                for category_index, category in enumerate(categories):
                    if not isinstance(category, dict):
                        issues.append(
                            f"groups[{group_index}].{parcial_id}.categories[{category_index}] debe ser un objeto"
                        )
                        continue
                    category_id = category.get("id")
                    if not isinstance(category_id, str) or not category_id.strip():
                        issues.append(
                            f"groups[{group_index}].{parcial_id}.categories[{category_index}].id es obligatorio"
                        )
                    elif category_id in category_ids:
                        issues.append(
                            f"groups[{group_index}].{parcial_id} categoría duplicada: {category_id}"
                        )
                    else:
                        category_ids.add(category_id)

                    weight = category.get("weight")
                    if not _is_number(weight) or weight < 0 or weight > 100:
                        issues.append(
                            f"groups[{group_index}].{parcial_id}.categories[{category_index}].weight inválido"
                        )

                    activities = category.get("activities")
                    if not isinstance(activities, list):
                        issues.append(
                            f"groups[{group_index}].{parcial_id}.categories[{category_index}].activities debe ser un arreglo"
                        )
                        continue
                    for activity_index, activity in enumerate(activities):
                        if not isinstance(activity, dict):
                            issues.append(
                                f"groups[{group_index}].{parcial_id} actividad inválida en {category_index}/{activity_index}"
                            )
                            continue
                        activity_id = activity.get("id")
                        if not isinstance(activity_id, str) or not activity_id.strip():
                            issues.append(
                                f"groups[{group_index}].{parcial_id} actividad sin id en {category_index}/{activity_index}"
                            )
                        elif activity_id in activity_ids:
                            issues.append(
                                f"groups[{group_index}].{parcial_id} actividad duplicada: {activity_id}"
                            )
                        else:
                            activity_ids.add(activity_id)

                _validate_grades(
                    parcial.get("grades"),
                    student_ids,
                    activity_ids,
                    f"groups[{group_index}].{parcial_id}",
                    issues,
                )

        for session_index, session in enumerate(sessions if isinstance(sessions, list) else []):
            if not isinstance(session, dict):
                issues.append(f"groups[{group_index}].sessions[{session_index}] debe ser un objeto")
                continue
            attendance = session.get("attendance")
            if attendance is not None and not isinstance(attendance, dict):
                issues.append(
                    f"groups[{group_index}].sessions[{session_index}].attendance debe ser un objeto"
                )

    deliveries = data.get("deliveries")
    if deliveries is not None and not isinstance(deliveries, list):
        issues.append("deliveries debe ser un arreglo")
    elif isinstance(deliveries, list):
        group_index = {
            group.get("id"): group
            for group in groups
            if isinstance(group, dict) and group.get("id")
        }
        for delivery_index, delivery in enumerate(deliveries):
            if not isinstance(delivery, dict):
                issues.append(f"deliveries[{delivery_index}] debe ser un objeto")
                continue
            group = group_index.get(delivery.get("groupId"))
            if group is None:
                issues.append(
                    f"deliveries[{delivery_index}] apunta a un grupo inexistente: {delivery.get('groupId')}"
                )
                continue
            student_ids = {
                student.get("id")
                for student in (group.get("students") or [])
                if isinstance(student, dict)
            }
            if delivery.get("studentId") not in student_ids:
                issues.append(
                    f"deliveries[{delivery_index}] apunta a un alumno inexistente: {delivery.get('studentId')}"
                )
            parcial_id = delivery.get("parcialId")
            if parcial_id not in PARCIAL_IDS:
                issues.append(f"deliveries[{delivery_index}].parcialId inválido: {parcial_id}")
            else:
                evaluations = group.get("evaluations")
                if not isinstance(evaluations, dict):
                    evaluations = {}
                parcial = evaluations.get(parcial_id)
                if not isinstance(parcial, dict):
                    parcial = {}
                activity_ids = {
                    activity.get("id")
                    for category in parcial.get("categories") or []
                    if isinstance(category, dict)
                    for activity in category.get("activities") or []
                    if isinstance(activity, dict)
                }
                if delivery.get("activityId") not in activity_ids:
                    issues.append(
                        f"deliveries[{delivery_index}] apunta a una actividad inexistente: {delivery.get('activityId')}"
                    )
            grade = delivery.get("grade")
            if grade is not None and (
                not _is_number(grade) or grade < GRADE_MIN or grade > GRADE_MAX
            ):
                issues.append(f"deliveries[{delivery_index}].grade inválido: {grade}")
            if delivery.get("status") not in {"pendiente", "validada", "rechazada", "duplicada"}:
                issues.append(f"deliveries[{delivery_index}].status inválido: {delivery.get('status')}")

    audit_log = data.get("auditLog")
    if audit_log is not None and not isinstance(audit_log, list):
        issues.append("auditLog debe ser un arreglo")

    return issues


def validate_or_raise(data: Any) -> None:
    issues = validate_state(data)
    if issues:
        raise ValidationError("\n".join(issues))


def canonical_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def semantic_hash(data: Any) -> str:
    return hashlib.sha256(canonical_json(data).encode("utf-8")).hexdigest()


def count_summary(data: dict[str, Any]) -> dict[str, int]:
    groups = data.get("groups") or []
    students = sum(len(group.get("students") or []) for group in groups if isinstance(group, dict))
    sessions = sum(len(group.get("sessions") or []) for group in groups if isinstance(group, dict))
    deliveries = len(data.get("deliveries") or [])
    return {
        "groups": len(groups),
        "students": students,
        "sessions": sessions,
        "deliveries": deliveries,
    }


def activities_for_group(group: dict[str, Any]) -> Iterable[tuple[str, str, str, str]]:
    """Yield (parcial_id, category_id, activity_id, activity_name)."""
    evaluations = group.get("evaluations") or {}
    for parcial_id in PARCIAL_IDS:
        parcial = evaluations.get(parcial_id) or {}
        for category in parcial.get("categories") or []:
            category_id = category.get("id")
            for activity in category.get("activities") or []:
                yield (
                    parcial_id,
                    str(category_id),
                    str(activity.get("id")),
                    str(activity.get("name") or ""),
                )
