"""本地授权客户端：一机一码、在线校验、短期离线宽限。

只上传不可逆设备指纹和激活码；闲鱼登录态、用户名和本地数据不会上传。
"""
from __future__ import annotations

import hashlib
import json
import os
import platform
import subprocess
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx

APP_SALT = "shisan-goofish-v1"
OFFLINE_GRACE_HOURS = 72


def _machine_seed() -> str:
    if platform.system() == "Windows":
        try:
            result = subprocess.run(
                ["reg", "query", r"HKLM\SOFTWARE\Microsoft\Cryptography", "/v", "MachineGuid"],
                capture_output=True, text=True, timeout=3, check=False,
            )
            if result.returncode == 0:
                value = result.stdout.strip().split()[-1]
                if value:
                    return value
        except (OSError, subprocess.SubprocessError, IndexError):
            pass
    for path in (Path("/etc/machine-id"), Path("/var/lib/dbus/machine-id")):
        try:
            value = path.read_text(encoding="utf-8").strip()
            if value:
                return value
        except OSError:
            pass
    return f"{platform.system()}|{platform.machine()}|{uuid.getnode()}"


def device_id() -> str:
    digest = hashlib.sha256(f"{APP_SALT}|{_machine_seed()}".encode()).hexdigest().upper()
    return "-".join(digest[i : i + 4] for i in range(0, 20, 4))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


class LicenseClient:
    def __init__(self, data_dir: Path, server_url: str | None = None):
        self.data_dir = Path(data_dir)
        self.cache_path = self.data_dir / "license.json"
        self.server_url = (server_url or os.getenv("XIANYU_LICENSE_SERVER", "")).rstrip("/")

    def _load(self) -> dict[str, Any]:
        try:
            value = json.loads(self.cache_path.read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else {}
        except (OSError, ValueError):
            return {}

    def _save(self, value: dict[str, Any]) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        temp = self.cache_path.with_suffix(".tmp")
        temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temp.replace(self.cache_path)

    def status(self) -> dict[str, Any]:
        cache = self._load()
        expires_at = _parse_dt(cache.get("expires_at"))
        checked_at = _parse_dt(cache.get("checked_at"))
        now = _now()
        time_valid = bool(expires_at and expires_at > now)
        within_grace = bool(checked_at and checked_at + timedelta(hours=OFFLINE_GRACE_HOURS) > now)
        valid = bool(cache.get("valid") and time_valid and within_grace)
        return {
            "valid": valid,
            "device_id": device_id(),
            "expires_at": cache.get("expires_at"),
            "plan": cache.get("plan"),
            "offline_grace_hours": OFFLINE_GRACE_HOURS,
            "needs_activation": not bool(cache.get("license_key")),
            "message": "授权有效" if valid else "请输入有效激活码",
        }

    def _request(self, endpoint: str, license_key: str) -> dict[str, Any]:
        if not self.server_url:
            raise RuntimeError("尚未配置授权服务器")
        response = httpx.post(
            f"{self.server_url}/v1/{endpoint}",
            json={"license_key": license_key, "device_id": device_id(), "app_version": "0.2.0"},
            timeout=12.0,
        )
        response.raise_for_status()
        body = response.json()
        if not isinstance(body, dict):
            raise RuntimeError("授权服务器返回格式错误")
        return body

    def activate(self, license_key: str) -> dict[str, Any]:
        key = license_key.strip().upper()
        if not key:
            raise ValueError("激活码不能为空")
        body = self._request("activate", key)
        if not body.get("valid"):
            return {**self.status(), "message": body.get("message", "激活码无效")}
        self._save({
            "valid": True,
            "license_key": key,
            "expires_at": body.get("expires_at"),
            "plan": body.get("plan", "monthly"),
            "checked_at": _now().isoformat(),
        })
        return self.status()

    def verify(self) -> dict[str, Any]:
        cache = self._load()
        key = cache.get("license_key")
        if not key:
            return self.status()
        try:
            body = self._request("verify", key)
        except (httpx.HTTPError, RuntimeError):
            return self.status()
        cache.update({
            "valid": bool(body.get("valid")),
            "expires_at": body.get("expires_at"),
            "plan": body.get("plan", cache.get("plan")),
            "checked_at": _now().isoformat(),
        })
        self._save(cache)
        return self.status()
