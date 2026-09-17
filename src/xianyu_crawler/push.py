"""手机通知：Bark（iOS）与钉钉机器人。"""
from __future__ import annotations

from urllib.parse import urlparse

import httpx


def _safe_https(url: str | None) -> str | None:
    value = (url or "").strip()
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("推送地址必须是 https:// 链接")
    return value


def format_push(event: dict) -> tuple[str, str, str | None]:
    typ = event.get("type")
    title = str(event.get("title") or "发现新商品")
    url = event.get("url")
    if typ == "price_drop":
        return "闲鱼商品降价", f"{title}\n现价 ¥{event.get('curr_price', '-')}", url
    if typ == "sold":
        return "商品已售出或下架", title, url
    if typ == "login_expired":
        return "闲鱼登录已失效", "请打开软件重新扫码登录", None
    return "闲鱼发现新商品", f"{title}\n价格 ¥{event.get('price', '-')}", url


def send_bark(endpoint: str, title: str, body: str, url: str | None = None) -> None:
    target = _safe_https(endpoint)
    if not target:
        return
    payload = {"title": title, "body": body, "group": "十三闲鱼监控"}
    if url:
        payload["url"] = url
    response = httpx.post(target, json=payload, timeout=10.0)
    response.raise_for_status()


def send_dingtalk(webhook: str, title: str, body: str, url: str | None = None) -> None:
    target = _safe_https(webhook)
    if not target:
        return
    response = httpx.post(target, json={
        "msgtype": "link",
        "link": {"title": title, "text": body, "messageUrl": url or "https://www.goofish.com/"},
    }, timeout=10.0)
    response.raise_for_status()


def send_event(settings, event: dict) -> int:
    title, body, url = format_push(event)
    sent = 0
    if getattr(settings, "bark_url", None):
        send_bark(settings.bark_url, title, body, url)
        sent += 1
    if getattr(settings, "dingtalk_webhook", None):
        send_dingtalk(settings.dingtalk_webhook, title, body, url)
        sent += 1
    return sent


def send_test(settings) -> int:
    sample = {"type": "new_recommendation", "title": "测试成功：手机推送已连接", "price": 16.66,
              "url": "https://www.goofish.com/"}
    sent = send_event(settings, sample)
    if not sent:
        raise ValueError("请至少配置 Bark 或钉钉推送地址")
    return sent
