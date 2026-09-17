import json

from xianyu_crawler import distribution
from xianyu_crawler.config import Settings


def test_distribution_default_and_environment_override(tmp_path, monkeypatch):
    monkeypatch.setattr(distribution, "__file__", str(tmp_path / "distribution.py"))
    (tmp_path / "distribution.json").write_text(
        json.dumps({"license_server": "https://license.example/"}), encoding="utf-8"
    )
    monkeypatch.delenv("XIANYU_LICENSE_SERVER", raising=False)
    assert distribution.bundled_license_server() == "https://license.example"
    monkeypatch.setenv("XIANYU_LICENSE_SERVER", "https://override.example")
    assert Settings().license_server == "https://override.example"


def test_distribution_rejects_insecure_url(tmp_path, monkeypatch):
    monkeypatch.setattr(distribution, "__file__", str(tmp_path / "distribution.py"))
    (tmp_path / "distribution.json").write_text(
        '{"license_server":"http://license.example"}', encoding="utf-8"
    )
    assert distribution.bundled_license_server() is None


def test_distribution_missing_file(tmp_path, monkeypatch):
    monkeypatch.setattr(distribution, "__file__", str(tmp_path / "distribution.py"))
    assert distribution.bundled_license_server() is None
