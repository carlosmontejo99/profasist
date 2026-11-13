"""Atomic JSON snapshots and checksums for the ADB bridge."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BACKUP_DIR = PROJECT_ROOT / "backups"


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def write_json_atomic(path: Path, data: Any) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent)
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink(missing_ok=True)
    return path


def write_snapshot(
    data: Any,
    *,
    out: Path | None = None,
    out_dir: Path | None = None,
    prefix: str = "profasist_snapshot",
) -> Path:
    if out is None:
        directory = out_dir or DEFAULT_BACKUP_DIR
        out = directory / f"{prefix}_{timestamp()}.json"
    return write_json_atomic(Path(out), data)


def write_report(data: Any, out: Path | None = None) -> Path | None:
    if out is None:
        return None
    return write_json_atomic(Path(out), data)
