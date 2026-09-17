"""Optional, non-secret distributor defaults included by the packaging process."""
import json
from pathlib import Path
from urllib.parse import urlsplit


def bundled_license_server() -> str | None:
    path = Path(__file__).with_name("distribution.json")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    value = data.get("license_server") if isinstance(data, dict) else None
    if not isinstance(value, str):
        return None
    parts = urlsplit(value)
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
        return None
    return value.rstrip("/")
