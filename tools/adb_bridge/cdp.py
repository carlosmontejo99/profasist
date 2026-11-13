"""Playwright CDP access to the ProfAsist WebView."""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

STATE_KEY = "profasist_v1_data"
PREVIOUS_KEY = "profasist_v1_data__prev"

try:
    from playwright.async_api import async_playwright
except ImportError as error:  # pragma: no cover - surfaced by the CLI
    async_playwright = None  # type: ignore[assignment]
    PLAYWRIGHT_IMPORT_ERROR = error
else:
    PLAYWRIGHT_IMPORT_ERROR = None


class CdpError(RuntimeError):
    pass


def _pick_page(browser: Any) -> Any:
    pages: list[Any] = []
    for context in browser.contexts:
        pages.extend(context.pages)
    if not pages:
        raise CdpError("El WebView no expone ninguna página CDP.")

    for page in pages:
        url = page.url or ""
        if "localhost" in url or "capacitor" in url or url.startswith("file://"):
            return page
    return pages[0]


@asynccontextmanager
async def session(port: int, timeout_ms: int = 15000) -> AsyncIterator[Any]:
    if async_playwright is None:
        raise CdpError(
            "Playwright no está instalado. Ejecuta: pip install playwright && playwright install chromium"
        )
    async with async_playwright() as playwright:
        browser = await playwright.chromium.connect_over_cdp(
            f"http://127.0.0.1:{port}", timeout=timeout_ms
        )
        page = _pick_page(browser)
        try:
            yield page
        finally:
            try:
                await browser.close()
            except Exception:
                pass


async def read_raw(page: Any) -> str | None:
    return await page.evaluate(
        "(key) => localStorage.getItem(key)", STATE_KEY
    )


async def read_state(page: Any) -> dict[str, Any] | None:
    raw = await read_raw(page)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise CdpError(f"localStorage[{STATE_KEY}] no contiene JSON válido: {error}") from error


async def write_raw(page: Any, raw: str) -> None:
    await page.evaluate(
        "([key, value]) => localStorage.setItem(key, value)", [STATE_KEY, raw]
    )


async def write_state(page: Any, state: dict[str, Any]) -> None:
    await write_raw(page, json.dumps(state, ensure_ascii=False, separators=(",", ":")))


async def save_previous(page: Any) -> str | None:
    raw = await read_raw(page)
    if raw:
        await page.evaluate(
            "([key, value]) => localStorage.setItem(key, value)", [PREVIOUS_KEY, raw]
        )
    return raw


async def restore_previous(page: Any) -> bool:
    raw = await page.evaluate(
        "(key) => localStorage.getItem(key)", PREVIOUS_KEY
    )
    if not raw:
        return False
    await write_raw(page, raw)
    await reload(page)
    return True


async def reload(page: Any) -> None:
    try:
        await page.reload(wait_until="domcontentloaded", timeout=15000)
    except Exception:
        # Some WebView/DevTools versions do not implement wait_until reliably.
        await page.reload()
    await wait_for_state(page)


async def wait_for_state(page: Any, timeout_ms: int = 10000) -> None:
    try:
        await page.wait_for_function(
            "(key) => Boolean(localStorage.getItem(key))",
            arg=STATE_KEY,
            timeout=timeout_ms,
        )
    except Exception as error:
        raise CdpError(f"La app no expuso localStorage[{STATE_KEY}] tras recargar: {error}") from error


async def page_info(page: Any) -> dict[str, Any]:
    return {
        "url": page.url,
        "title": await page.title(),
    }
