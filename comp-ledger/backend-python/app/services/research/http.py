import asyncio
import json
import subprocess


async def curl_get(url: str, timeout_sec: int = 15, extra_args: list[str] = None) -> str | None:
    args = ["curl", "-s", "--max-time", str(timeout_sec)] + (extra_args or []) + [url]
    try:
        result = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(result.communicate(), timeout=timeout_sec + 2)
        return stdout.decode("utf-8", errors="replace") or None
    except Exception:
        return None


async def curl_get_json(url: str, timeout_sec: int = 15) -> dict | list | None:
    text = await curl_get(url, timeout_sec)
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        return None
