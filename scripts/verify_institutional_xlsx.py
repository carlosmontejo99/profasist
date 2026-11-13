#!/usr/bin/env python3
"""Structural and recalculation verifier for ProfAsist institutional actas.

Usage:
    python3 scripts/verify_institutional_xlsx.py /path/to/Acta.xlsx
    python3 scripts/verify_institutional_xlsx.py /path/to/Acta.xlsx --recalc
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import openpyxl

EXPECTED_SHEETS = ["Resumen Semestral", "Parcial 1", "Parcial 2", "Parcial 3"]
EXPECTED_HEADERS = [
    "No.",
    "Matrícula",
    "Nombre del Alumno",
    "Parcial 1",
    "Parcial 2",
    "Parcial 3",
    "Calificación Final",
    "Estatus",
]
GREEN = "FFDCFCE7"
RED = "FFFEE2E2"


class VerificationError(AssertionError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


def cell_value(ws, coordinate: str) -> Any:
    return ws[coordinate].value


def formula(value: Any) -> str:
    if isinstance(value, str) and value.startswith("="):
        return value
    if isinstance(value, dict):
        return str(value.get("formula", ""))
    return ""


def verify_structure(path: Path) -> dict[str, Any]:
    workbook = openpyxl.load_workbook(path, data_only=False)
    require(workbook.sheetnames == EXPECTED_SHEETS, f"Pestañas inesperadas: {workbook.sheetnames}")

    summary = workbook["Resumen Semestral"]
    require(str(summary["A1"].value or "").strip() != "", "A1 (universidad) está vacío")
    require(
        "Semestre" in str(summary["A2"].value or "")
        and "Prof." in str(summary["A2"].value or ""),
        "A2 no contiene Semestre/Profesor",
    )

    headers = [summary.cell(4, column).value for column in range(1, 9)]
    require(headers == EXPECTED_HEADERS, f"Encabezados inesperados: {headers}")

    require(formula(summary["D5"].value).startswith("=IF('Parcial 1'"), "D5 no referencia Parcial 1")
    require(formula(summary["E5"].value).startswith("=IF('Parcial 2'"), "E5 no referencia Parcial 2")
    require(formula(summary["F5"].value).startswith("=IF('Parcial 3'"), "F5 no referencia Parcial 3")
    require("Pendiente" in formula(summary["G5"].value), "G5 no contempla Pendiente")
    require("Acreditado" in formula(summary["H5"].value), "H5 no calcula Acreditado")

    require(summary.freeze_panes == "C5", f"Congelado de Resumen inesperado: {summary.freeze_panes}")

    status_fills = {
        str(summary.cell(row, 8).fill.fgColor.rgb)
        for row in range(5, summary.max_row + 1)
        if summary.cell(row, 2).value
    }
    require(status_fills.issubset({GREEN, RED, "00000000"}),
            f"Rellenos de estatus inesperados: {status_fills}")

    for name in EXPECTED_SHEETS[1:]:
        ws = workbook[name]
        require(ws.freeze_panes == "C6", f"{name}: congelado inesperado {ws.freeze_panes}")
        total_column = None
        for column in range(4, ws.max_column + 1):
            header = str(ws.cell(4, column).value or "")
            if header.startswith("Calificación Parcial"):
                total_column = column
                break
        require(total_column is not None, f"{name}: no se encontró la columna total")
        total_formula = formula(ws.cell(6, total_column).value)
        if total_formula:
            require("IF(ISNUMBER(" in total_formula, f"{name}: la fórmula total no re-normaliza")
            require("ROUND(" in total_formula, f"{name}: la fórmula total no redondea")

    calculation = workbook.calculation
    require(calculation is not None and calculation.fullCalcOnLoad,
            "El libro no fuerza fullCalcOnLoad")

    return {
        "sheets": workbook.sheetnames,
        "status_fills": sorted(status_fills),
        "summary_freeze": summary.freeze_panes,
        "summary_formula_g5": formula(summary["G5"].value),
        "summary_formula_h5": formula(summary["H5"].value),
    }


def verify_recalculation(path: Path) -> None:
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    require(soffice is not None, "LibreOffice/soffice no está disponible para recalcular")

    with tempfile.TemporaryDirectory(prefix="profasist-recalc-") as temporary:
        output_dir = Path(temporary)
        subprocess.run(
            [soffice, "--headless", "--convert-to", "xlsx", "--outdir", str(output_dir), str(path)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        recalculated_path = output_dir / path.name
        require(recalculated_path.exists(), "LibreOffice no generó el archivo recalculado")

        original = openpyxl.load_workbook(path, data_only=True)["Resumen Semestral"]
        recalculated = openpyxl.load_workbook(recalculated_path, data_only=True)["Resumen Semestral"]

        for row in range(5, original.max_row + 1):
            if not original.cell(row, 2).value:
                continue
            for column in range(4, 9):
                before = original.cell(row, column).value
                after = recalculated.cell(row, column).value
                if isinstance(before, (int, float)) and isinstance(after, (int, float)):
                    require(abs(float(before) - float(after)) < 0.051,
                            f"Fila {row} col {column}: {before!r} != {after!r} tras recálculo")
                else:
                    require(str(before or "").strip().upper() == str(after or "").strip().upper(),
                            f"Fila {row} col {column}: {before!r} != {after!r} tras recálculo")


def main() -> int:
    parser = argparse.ArgumentParser(description="Verifica un acta institucional de ProfAsist.")
    parser.add_argument("path", type=Path, help="Ruta del archivo .xlsx")
    parser.add_argument("--recalc", action="store_true", help="Recalcula con LibreOffice y compara")
    args = parser.parse_args()

    if not args.path.exists():
        print(f"[-] No existe: {args.path}", file=sys.stderr)
        return 2

    try:
        result = verify_structure(args.path)
        print("[+] Estructura válida")
        for key, value in result.items():
            print(f"    {key}: {value}")
        if args.recalc:
            verify_recalculation(args.path)
            print("[+] Recálculo de LibreOffice coincidente")
        return 0
    except VerificationError as error:
        print(f"[-] Verificación fallida: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
