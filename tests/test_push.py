import pytest

from xianyu_crawler import push
from xianyu_crawler.push import _safe_https, format_push, format_push_batch


def test_format_new_item_push_contains_price_and_link():
    title, body, url = format_push({
        "type": "new_recommendation", "title": "测试显卡", "price": 888,
        "url": "https://www.goofish.com/item?id=1",
    })
    assert "新商品" in title
    assert "888" in body
    assert url is not None and url.endswith("id=1")


def test_push_endpoint_must_use_https():
    with pytest.raises(ValueError):
        _safe_https("http://example.com/hook")
    assert _safe_https("https://example.com/hook") == "https://example.com/hook"


def test_bark_ignores_stale_environment_proxy(monkeypatch):
    captured = {}

    class Response:
        def raise_for_status(self):
            return None

    class Client:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def post(self, target, json):
            captured["target"] = target
            captured["json"] = json
            return Response()

    monkeypatch.setattr(push.httpx, "Client", Client)
    push.send_bark("https://api.day.app/device-key", "测试", "成功")
    assert captured["trust_env"] is False
    assert captured["target"] == "https://api.day.app/device-key"


def test_multiple_items_are_merged_into_one_summary():
    title, body, url = format_push_batch([
        {"type": "new_recommendation", "title": "iPhone 15", "price": 3000, "url": "u1"},
        {"type": "new_recommendation", "title": "iPhone 14", "price": 2200, "url": "u2"},
    ])
    assert "新品2件" in title
    assert "iPhone 15" in body and "iPhone 14" in body
    assert url == "u1"


def test_send_events_continues_when_one_channel_fails(monkeypatch):
    settings = type("S", (), {
        "bark_url": "https://api.day.app/bad", "pushplus_token": "ok", "dingtalk_webhook": None,
    })()
    monkeypatch.setattr(push, "send_bark", lambda *_args: (_ for _ in ()).throw(ConnectionError("bad")))
    monkeypatch.setattr(push, "send_pushplus", lambda *_args: None)
    assert push.send_events(settings, [{"type": "new_recommendation", "title": "x"}]) == 1
