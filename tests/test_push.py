import pytest

from xianyu_crawler.push import _safe_https, format_push


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
