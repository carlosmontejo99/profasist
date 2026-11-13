from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import merge  # noqa: E402
import schema  # noqa: E402


def base_state() -> dict:
    return {
        "version": 2,
        "settings": {
            "currentSemester": "2026-B",
            "institution": {
                "university": "UNIVERSIDAD AUTÓNOMA DE CIUDAD JUÁREZ",
                "institute": "DCQB",
                "professor": "Carlos Montejo Dávila",
            },
        },
        "groups": [
            {
                "id": "group-1",
                "name": "Enzimología A-L3",
                "semester": "2026-B",
                "scheduleSummary": "Lun 10:00",
                "color": "#4f46e5",
                "archived": False,
                "students": [
                    {"id": "st-1", "name": "José Hernández Pérez", "rollNumber": "2026-001"},
                    {"id": "st-2", "name": "María del Carmen Álvarez", "rollNumber": "2026-002"},
                ],
                "sessions": [
                    {
                        "id": "s1",
                        "date": "2026-08-01",
                        "startTime": "10:00",
                        "endTime": "12:00",
                        "attendance": {
                            "st-1": {"studentId": "st-1", "status": "present", "timestamp": 1}
                        },
                        "totalPresent": 1,
                        "totalStudents": 2,
                    }
                ],
                "evaluations": {
                    "parcial1": {
                        "categories": [
                            {
                                "id": "cat_tareas",
                                "name": "Tareas",
                                "weight": 40,
                                "activities": [
                                    {"id": "act_t1", "name": "Tarea 1"},
                                    {"id": "act_t2", "name": "Tarea 2"},
                                ],
                            },
                            {
                                "id": "cat_bitacora",
                                "name": "Bitácora",
                                "weight": 60,
                                "activities": [{"id": "act_b1", "name": "Bitácora"}],
                            },
                        ],
                        "grades": {"st-1": {"act_t1": 8}},
                    }
                },
                "deliveries": [],
            }
        ],
        "deliveries": [],
        "auditLog": [],
    }


class SchemaTests(unittest.TestCase):
    def test_valid_state(self) -> None:
        self.assertEqual(schema.validate_state(base_state()), [])

    def test_grade_out_of_range(self) -> None:
        state = base_state()
        state["groups"][0]["evaluations"]["parcial1"]["grades"]["st-1"]["act_t1"] = 12
        issues = schema.validate_state(state)
        self.assertTrue(any("fuera de rango" in issue for issue in issues))

    def test_orphan_grade(self) -> None:
        state = base_state()
        state["groups"][0]["evaluations"]["parcial1"]["grades"]["st-999"] = {"act_t1": 8}
        issues = schema.validate_state(state)
        self.assertTrue(any("alumno huérfano" in issue for issue in issues))

    def test_duplicate_group_id(self) -> None:
        state = base_state()
        state["groups"].append(copy.deepcopy(state["groups"][0]))
        issues = schema.validate_state(state)
        self.assertTrue(any("duplicado" in issue for issue in issues))

    def test_semantic_hash_is_key_order_independent(self) -> None:
        left = {"version": 2, "settings": {"a": 1, "b": 2}, "groups": []}
        right = {"groups": [], "settings": {"b": 2, "a": 1}, "version": 2}
        self.assertEqual(schema.semantic_hash(left), schema.semantic_hash(right))


class MergeTests(unittest.TestCase):
    def test_adds_new_group_student_and_activity(self) -> None:
        local = base_state()
        incoming = base_state()
        incoming["groups"][0]["id"] = "group-2"
        incoming["groups"][0]["name"] = "Enzimología A-L2"
        incoming["groups"][0]["students"] = [
            {"id": "st-3", "name": "Nuevo Alumno", "rollNumber": "2026-003"}
        ]
        incoming["groups"][0]["evaluations"]["parcial1"]["categories"][0]["activities"].append(
            {"id": "act_t3", "name": "Tarea 3"}
        )
        incoming["groups"][0]["evaluations"]["parcial1"]["grades"] = {"st-3": {"act_t3": 9.5}}

        merged, report = merge.merge_states(local, incoming)

        self.assertEqual(report["groups_added"], 1)
        self.assertEqual(report["students_added"], 1)
        self.assertEqual(report["activities_added"], 4)  # 3 existing + Tarea 3 in the new group
        self.assertEqual(len(merged["groups"]), 2)
        self.assertEqual(
            merged["groups"][1]["evaluations"]["parcial1"]["grades"]["st-3"]["act_t3"],
            9.5,
        )
        self.assertEqual(schema.validate_state(merged), [])

    def test_merge_is_idempotent(self) -> None:
        local = base_state()
        incoming = base_state()
        incoming["groups"][0]["evaluations"]["parcial1"]["grades"]["st-1"]["act_t2"] = 9
        incoming["groups"][0]["evaluations"]["parcial1"]["grades"]["st-2"] = {"act_b1": 7.5}

        first, _ = merge.merge_states(local, incoming)
        second, report = merge.merge_states(first, incoming)

        self.assertEqual(schema.semantic_hash(first), schema.semantic_hash(second))
        self.assertEqual(report["grades_added"], 0)
        self.assertEqual(report["grades_updated"], 0)
        self.assertEqual(report["conflicts"], [])

    def test_prefer_incoming_overwrites_and_prefer_local_preserves(self) -> None:
        local = base_state()
        incoming = base_state()
        incoming["groups"][0]["evaluations"]["parcial1"]["grades"]["st-1"]["act_t1"] = 10

        incoming_merged, report = merge.merge_states(local, incoming, prefer="incoming")
        self.assertEqual(
            incoming_merged["groups"][0]["evaluations"]["parcial1"]["grades"]["st-1"]["act_t1"],
            10,
        )
        self.assertEqual(report["grades_updated"], 1)
        self.assertEqual(len(report["conflicts"]), 1)

        local_merged, report = merge.merge_states(local, incoming, prefer="local")
        self.assertEqual(
            local_merged["groups"][0]["evaluations"]["parcial1"]["grades"]["st-1"]["act_t1"],
            8,
        )
        self.assertEqual(report["grades_updated"], 0)
        self.assertEqual(len(report["conflicts"]), 1)

    def test_preserves_sessions_and_attendance_by_default(self) -> None:
        local = base_state()
        incoming = base_state()
        incoming["groups"][0]["sessions"] = []

        merged, _ = merge.merge_states(local, incoming)
        self.assertEqual(len(merged["groups"][0]["sessions"]), 1)
        self.assertIn("st-1", merged["groups"][0]["sessions"][0]["attendance"])

    def test_translates_student_and_activity_ids_matched_by_name(self) -> None:
        local = base_state()
        incoming = base_state()
        group = incoming["groups"][0]
        # Same people/activities, different ids: the merge must not orphan grades.
        group["students"][0]["id"] = "phone-st-1"
        group["evaluations"]["parcial1"]["categories"][0]["activities"][0]["id"] = "phone-act-1"
        group["evaluations"]["parcial1"]["grades"] = {
            "phone-st-1": {"phone-act-1": 9.9}
        }
        incoming["deliveries"] = [
            {
                "id": "delivery-1",
                "groupId": "group-1",
                "studentId": "phone-st-1",
                "parcialId": "parcial1",
                "activityId": "phone-act-1",
                "channel": "teams",
                "receivedAt": "2026-11-13T12:00:00.000Z",
                "evidenceRef": "Tarea1.pdf",
                "status": "pendiente",
                "actor": "docente",
            }
        ]

        merged, _ = merge.merge_states(local, incoming)
        grades = merged["groups"][0]["evaluations"]["parcial1"]["grades"]
        self.assertEqual(grades["st-1"]["act_t1"], 9.9)
        self.assertNotIn("phone-st-1", grades)
        self.assertEqual(merged["deliveries"][0]["studentId"], "st-1")
        self.assertEqual(merged["deliveries"][0]["activityId"], "act_t1")
        self.assertEqual(schema.validate_state(merged), [])

    def test_does_not_mutate_inputs(self) -> None:
        local = base_state()
        incoming = base_state()
        before_local = schema.semantic_hash(local)
        before_incoming = schema.semantic_hash(incoming)
        merge.merge_states(local, incoming)
        self.assertEqual(before_local, schema.semantic_hash(local))
        self.assertEqual(before_incoming, schema.semantic_hash(incoming))


if __name__ == "__main__":
    unittest.main()
