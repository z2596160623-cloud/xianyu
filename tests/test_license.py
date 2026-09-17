from datetime import datetime, timedelta, timezone

from xianyu_crawler.license import LicenseClient, device_id


def test_device_id_is_stable_and_redacted():
    first = device_id()
    assert first == device_id()
    assert len(first.split("-")) == 5
    assert all(len(part) == 4 for part in first.split("-"))


def test_cached_license_valid_within_offline_grace(tmp_path):
    client = LicenseClient(tmp_path)
    now = datetime.now(timezone.utc)
    client._save({
        "valid": True,
        "license_key": "XY-TEST",
        "expires_at": (now + timedelta(days=5)).isoformat(),
        "checked_at": now.isoformat(),
        "plan": "monthly",
    })
    status = client.status()
    assert status["valid"] is True
    assert status["plan"] == "monthly"


def test_cached_license_rejects_expired(tmp_path):
    client = LicenseClient(tmp_path)
    now = datetime.now(timezone.utc)
    client._save({
        "valid": True,
        "license_key": "XY-TEST",
        "expires_at": (now - timedelta(minutes=1)).isoformat(),
        "checked_at": now.isoformat(),
    })
    assert client.status()["valid"] is False


def test_activate_binds_response_to_local_cache(tmp_path, monkeypatch):
    client = LicenseClient(tmp_path, "https://license.example")
    monkeypatch.setattr(client, "_request", lambda endpoint, key: {
        "valid": True,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "plan": "monthly",
    })
    assert client.activate("xy-demo")["valid"] is True
    assert client._load()["license_key"] == "XY-DEMO"
