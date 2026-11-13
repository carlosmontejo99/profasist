"""Thin, explicit ADB helpers for the ProfAsist WebView bridge."""

from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.error
import urllib.request
import http.client
from typing import Any


class AdbError(RuntimeError):
    pass


def adb_binary() -> str:
    return os.environ.get("ADB", "adb")


def run(
    arguments: list[str],
    *,
    serial: str | None = None,
    check: bool = False,
    timeout: int = 30,
) -> subprocess.CompletedProcess[str]:
    command = [adb_binary()]
    if serial:
        command.extend(["-s", serial])
    command.extend(arguments)
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    if check and result.returncode != 0:
        raise AdbError(
            f"Falló {' '.join(command)} (código {result.returncode}): {result.stderr.strip()}"
        )
    return result


def list_devices() -> list[str]:
    result = run(["devices"])
    if result.returncode != 0:
        raise AdbError(result.stderr.strip() or "adb devices falló")
    devices: list[str] = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line or line.startswith("List of devices"):
            continue
        parts = line.split()
        if len(parts) >= 2 and parts[1] == "device":
            devices.append(parts[0])
    return devices


def resolve_serial(serial: str | None = None) -> str:
    devices = list_devices()
    if serial:
        if serial not in devices:
            raise AdbError(f"El dispositivo {serial} no está conectado. Detectados: {devices}")
        return serial
    if not devices:
        raise AdbError("No hay dispositivos ADB. Conecta el teléfono y habilita depuración USB.")
    if len(devices) > 1:
        raise AdbError(
            "Hay varios dispositivos ADB. Usa --serial. Detectados: " + ", ".join(devices)
        )
    return devices[0]


def get_pid(serial: str, package: str) -> str | None:
    result = run(["shell", "pidof", package], serial=serial)
    output = result.stdout.strip()
    return output.split()[0] if output else None


def launch_app(serial: str, package: str) -> None:
    run(
        ["shell", "monkey", "-p", package, "-c", "android.intent.category.LAUNCHER", "1"],
        serial=serial,
    )


def list_devtools_sockets(serial: str) -> list[str]:
    result = run(["shell", "cat", "/proc/net/unix"], serial=serial)
    sockets: list[str] = []
    for line in result.stdout.splitlines():
        if "webview_devtools_remote" not in line:
            continue
        name = line.strip().split()[-1].lstrip("@")
        if name and name not in sockets:
            sockets.append(name)
    return sockets


def candidate_sockets(serial: str, package: str) -> list[str]:
    pid = get_pid(serial, package)
    sockets = list_devtools_sockets(serial)
    preferred = f"webview_devtools_remote_{pid}" if pid else None
    ordered: list[str] = []
    if preferred and preferred in sockets:
        ordered.append(preferred)
    elif preferred:
        ordered.append(preferred)
    for socket in sockets:
        if socket not in ordered:
            ordered.append(socket)
    return ordered


def forward(serial: str, port: int, socket: str) -> None:
    run(["forward", f"tcp:{port}", f"localabstract:{socket}"], serial=serial, check=True)


def remove_forward(serial: str, port: int) -> None:
    run(["forward", "--remove", f"tcp:{port}"], serial=serial)


def list_forwards(serial: str) -> str:
    return run(["forward", "--list"], serial=serial).stdout.strip()


def fetch_json(port: int, path: str = "/json/list", timeout: float = 3.0) -> Any:
    url = f"http://127.0.0.1:{port}{path}"
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (
        urllib.error.URLError,
        http.client.HTTPException,
        TimeoutError,
        ConnectionError,
        OSError,
        json.JSONDecodeError,
    ) as error:
        raise AdbError(f"No se pudo leer {url}: {error}") from error


def wait_for_devtools(port: int, timeout: float = 8.0) -> list[dict[str, Any]]:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            targets = fetch_json(port)
            if isinstance(targets, list):
                return targets
            if isinstance(targets, dict) and isinstance(targets.get("targets"), list):
                return targets["targets"]
        except AdbError as error:
            last_error = error
        time.sleep(0.3)
    raise AdbError(f"El socket de DevTools no respondió en {timeout}s: {last_error}")


def describe_targets(targets: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for target in targets:
        title = target.get("title") or "(sin título)"
        url = target.get("url") or ""
        target_type = target.get("type") or "?"
        lines.append(f"  - [{target_type}] {title} · {url}")
    return "\n".join(lines) if lines else "  (sin targets)"
