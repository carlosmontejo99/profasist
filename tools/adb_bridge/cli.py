#!/usr/bin/env python3
"""Deterministic ADB bridge for ProfAsist.

Commands:
    doctor   Diagnose ADB, the WebView socket and the local payload.
    pull     Read the phone state into a timestamped JSON snapshot.
    diff     Compare a JSON payload against the phone without writing.
    push     Merge and, with --apply, write the result back to the phone.
    audit    Validate a JSON payload without touching a device.

By default push is a dry-run. Writing requires --apply.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Allow execution as `python3 tools/adb_bridge/cli.py`.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import adb  # noqa: E402
import cdp  # noqa: E402
import merge  # noqa: E402
import schema  # noqa: E402
import snapshot  # noqa: E402

DEFAULT_PACKAGE = "com.carlos.profasist"
DEFAULT_PORT = 9223


def load_state_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise ValueError(f"No existe el archivo: {path}")
    data = snapshot.read_json(path)
    if isinstance(data, dict) and isinstance(data.get("data"), dict):
        # BackupFile: { app, version, createdAt, data: AppData }
        data = data["data"]
    elif isinstance(data, dict) and isinstance(data.get("profasist_v1_data"), dict):
        data = data["profasist_v1_data"]
    if not isinstance(data, dict):
        raise ValueError("El archivo debe contener un objeto AppData.")
    return data


def print_issues(issues: list[str], limit: int = 20) -> None:
    for issue in issues[:limit]:
        print(f"  - {issue}")
    if len(issues) > limit:
        print(f"  ... {len(issues) - limit} problemas más")


def require_valid(state: dict[str, Any], label: str) -> None:
    issues = schema.validate_state(state)
    if issues:
        print(f"[-] {label} no es válido ({len(issues)} problemas):", file=sys.stderr)
        print_issues(issues)
        raise schema.ValidationError(f"{label} inválido")


def activate_socket(serial: str, sockets: list[str], port: int) -> str:
    last_error: Exception | None = None
    for socket in sockets:
        adb.remove_forward(serial, port)
        try:
            adb.forward(serial, port, socket)
            targets = adb.wait_for_devtools(port)
            if targets:
                print(f"[+] Socket activo: @{socket}")
                print(adb.describe_targets(targets))
                return socket
        except adb.AdbError as error:
            last_error = error
            adb.remove_forward(serial, port)
    raise adb.AdbError(f"Ningún socket de DevTools respondió: {last_error}")


async def _read_device_state(page: Any) -> dict[str, Any]:
    state = await cdp.read_state(page)
    if state is None:
        raise cdp.CdpError(
            "localStorage[profasist_v1_data] está vacío. Abre la app y registra datos."
        )
    return state


async def command_doctor(args: argparse.Namespace) -> int:
    serial = adb.resolve_serial(args.serial)
    print(f"[+] Dispositivo: {serial}")
    pid = adb.get_pid(serial, args.package)
    print(f"[+] PID {args.package}: {pid or 'no está abierto'}")
    sockets = adb.candidate_sockets(serial, args.package)
    print(f"[+] Sockets candidatos: {sockets or 'ninguno'}")

    activate_socket(serial, sockets, args.port)
    try:
        async with cdp.session(args.port) as page:
            info = await cdp.page_info(page)
            print(f"[+] Página: {info['title']} · {info['url']}")
            state = await _read_device_state(page)
            issues = schema.validate_state(state)
            print(f"[+] Resumen: {json.dumps(schema.count_summary(state), ensure_ascii=False)}")
            print(f"[+] Hash: {schema.semantic_hash(state)}")
            if issues:
                print(f"[!] El estado local tiene {len(issues)} problemas:")
                print_issues(issues)
                return 3
            print("[+] Estado local válido.")
            print(f"[+] Forward: {adb.list_forwards(serial) or '(sin forwards)'}")
            return 0
    finally:
        adb.remove_forward(serial, args.port)


async def command_pull(args: argparse.Namespace) -> int:
    serial = adb.resolve_serial(args.serial)
    sockets = adb.candidate_sockets(serial, args.package)
    if not sockets:
        raise adb.AdbError("No se encontró webview_devtools_remote.")
    activate_socket(serial, sockets, args.port)
    try:
        async with cdp.session(args.port) as page:
            state = await _read_device_state(page)
            issues = schema.validate_state(state)
            if issues:
                print(f"[!] Estado con {len(issues)} problemas; se guarda igual como evidencia:")
                print_issues(issues)
            destination = snapshot.write_snapshot(
                state, out=Path(args.out) if args.out else None
            )
            print(f"[+] Snapshot: {destination}")
            print(f"[+] Resumen: {json.dumps(schema.count_summary(state), ensure_ascii=False)}")
            print(f"[+] Hash: {schema.semantic_hash(state)}")
            return 0
    finally:
        adb.remove_forward(serial, args.port)


@asynccontextmanager
async def merge_session(args: argparse.Namespace):
    incoming = load_state_file(Path(args.input))
    require_valid(incoming, "El JSON de entrada")

    serial = adb.resolve_serial(args.serial)
    sockets = adb.candidate_sockets(serial, args.package)
    if not sockets:
        raise adb.AdbError("No se encontró webview_devtools_remote.")
    activate_socket(serial, sockets, args.port)

    try:
        async with cdp.session(args.port) as page:
            local = await _read_device_state(page)
            require_valid(local, "El estado del teléfono")
            merged, report = merge.merge_states(
                local,
                incoming,
                prefer=args.prefer,
                include_attendance=args.include_attendance,
            )
            yield local, incoming, merged, report, page
    finally:
        adb.remove_forward(serial, args.port)


async def command_diff(args: argparse.Namespace) -> int:
    async with merge_session(args) as (local, incoming, merged, report, _page):
        print(merge.summarize_report(report))
        conflicts = report.get("conflicts") or []
        if conflicts:
            print(f"\n[!] Conflictos ({len(conflicts)}):")
            for conflict in conflicts[:20]:
                print(
                    "  - {group} · {student} · {parcial}/{activity}: local={local} incoming={incoming}".format(
                        **conflict
                    )
                )
        print(f"\n[+] Hash local:   {schema.semantic_hash(local)}")
        print(f"[+] Hash resultado: {schema.semantic_hash(merged)}")
        snapshot.write_report(
            {"report": report, "merged": merged},
            Path(args.report) if args.report else None,
        )
        if args.report:
            print(f"[+] Reporte: {args.report}")
        return 0


async def command_push(args: argparse.Namespace) -> int:
    async with merge_session(args) as (local, incoming, merged, report, page):
        print(merge.summarize_report(report))
        conflicts = report.get("conflicts") or []
        if conflicts:
            print(f"[!] Conflictos: {len(conflicts)} (prefer={args.prefer})")
            for conflict in conflicts[:10]:
                print(
                    "  - {group} · {student} · {parcial}/{activity}: local={local} incoming={incoming}".format(
                        **conflict
                    )
                )

        local_hash = schema.semantic_hash(local)
        merged_hash = schema.semantic_hash(merged)
        print(f"[+] Hash local:   {local_hash}")
        print(f"[+] Hash resultado: {merged_hash}")

        if local_hash == merged_hash:
            print("[+] Sin cambios: no se escribe en el dispositivo.")
            return 0

        if not args.apply:
            print("[*] DRY RUN: usa --apply para escribir en el teléfono.")
            return 0

        backup = snapshot.write_snapshot(local, prefix="profasist_pre_push")
        print(f"[+] Snapshot local: {backup}")

        merged.setdefault("syncMeta", {})
        merged["syncMeta"].update(
            {
                "lastPushAt": datetime.now(timezone.utc).isoformat(),
                "source": "adb_bridge",
                "hash": merged_hash,
            }
        )
        expected_hash = schema.semantic_hash(merged)

        await cdp.save_previous(page)
        await cdp.write_state(page, merged)
        await cdp.reload(page)
        written = await cdp.read_state(page)
        if written is None:
            raise cdp.CdpError("El teléfono no devolvió el estado después de escribir.")

        issues = schema.validate_state(written)
        if issues:
            print("[-] El estado escrito no es válido; restaurando copia previa.", file=sys.stderr)
            print_issues(issues)
            await cdp.restore_previous(page)
            return 4

        written_hash = schema.semantic_hash(written)
        if written_hash != expected_hash:
            print(
                f"[-] Hash distinto tras escribir ({written_hash} != {expected_hash}); restaurando.",
                file=sys.stderr,
            )
            await cdp.restore_previous(page)
            return 4

        print("[+] Push verificado: el estado del teléfono coincide con el hash esperado.")
        print(f"[+] Resumen: {json.dumps(schema.count_summary(written), ensure_ascii=False)}")
        return 0


async def command_audit(args: argparse.Namespace) -> int:
    incoming = load_state_file(Path(args.input))
    issues = schema.validate_state(incoming)
    print(f"[+] Resumen: {json.dumps(schema.count_summary(incoming), ensure_ascii=False)}")
    print(f"[+] Hash: {schema.semantic_hash(incoming)}")
    if issues:
        print(f"[-] {len(issues)} problemas:", file=sys.stderr)
        print_issues(issues)
        snapshot.write_report({"valid": False, "issues": issues}, Path(args.report) if args.report else None)
        return 3
    print("[+] Esquema válido.")
    snapshot.write_report({"valid": True, "issues": []}, Path(args.report) if args.report else None)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Puente ADB determinista para ProfAsist (dry-run por defecto)."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    def common(sub: argparse.ArgumentParser) -> None:
        sub.add_argument("--serial", help="Serial ADB (si hay más de un dispositivo)")
        sub.add_argument("--package", default=DEFAULT_PACKAGE)
        sub.add_argument("--port", type=int, default=DEFAULT_PORT)

    doctor = subparsers.add_parser("doctor", help="Diagnostica ADB, socket y estado")
    common(doctor)
    doctor.set_defaults(handler=command_doctor)

    pull = subparsers.add_parser("pull", help="Lee el estado del teléfono")
    common(pull)
    pull.add_argument("--out", help="Ruta del snapshot de salida")
    pull.set_defaults(handler=command_pull)

    diff = subparsers.add_parser("diff", help="Compara un JSON con el teléfono")
    common(diff)
    diff.add_argument("--in", dest="input", required=True, help="JSON de entrada")
    diff.add_argument("--prefer", choices=("incoming", "local"), default="incoming")
    diff.add_argument("--include-attendance", action="store_true")
    diff.add_argument("--report", help="Guardar reporte JSON")
    diff.set_defaults(handler=command_diff)

    push = subparsers.add_parser("push", help="Fusiona y escribe con --apply")
    common(push)
    push.add_argument("--in", dest="input", required=True, help="JSON de entrada")
    push.add_argument("--apply", action="store_true", help="Escribir en el dispositivo")
    push.add_argument("--prefer", choices=("incoming", "local"), default="incoming")
    push.add_argument("--include-attendance", action="store_true")
    push.set_defaults(handler=command_push)

    audit = subparsers.add_parser("audit", help="Valida un JSON sin dispositivo")
    audit.add_argument("--in", dest="input", required=True, help="JSON a validar")
    audit.add_argument("--report", help="Guardar reporte JSON")
    audit.set_defaults(handler=command_audit)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return asyncio.run(args.handler(args))
    except (adb.AdbError, cdp.CdpError, schema.ValidationError, ValueError) as error:
        print(f"[-] {error}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("[-] Interrumpido.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
