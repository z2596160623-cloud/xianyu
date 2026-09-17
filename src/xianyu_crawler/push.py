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


def format_push_batch(events: list[dict]) -> tuple[str, str, str | None]:
    """同一轮事件合成一条摘要，避免首轮/宽条件连续轰炸手机。"""
    if not events:
        raise ValueError("没有可推送的事件")
    if len(events) == 1:
        return format_push(events[0])
    counts: dict[str, int] = {}
    for event in events:
        typ = str(event.get("type") or "other")
        counts[typ] = counts.get(typ, 0) + 1
    names = {
        "new_recommendation": "新品", "price_drop": "降价", "sold": "售出", "favorited": "收藏"
    }
    summary = "、".join(f"{names.get(k, k)}{v}件" for k, v in counts.items())
    lines = []
    for event in events[:5]:
        title = str(event.get("title") or "未命名商品")
        price = event.get("curr_price") if event.get("type") == "price_drop" else event.get("price")
        lines.append(f"¥{price} {title}" if price not in (None, "") else title)
    if len(events) > 5:
        lines.append(f"另有 {len(events) - 5} 件，请打开软件查看")
    return f"闲鱼监控：{summary}", "\n".join(lines), events[0].get("url")


def _post_json(target: str, payload: dict) -> httpx.Response:
    """推送服务默认直连，避免失效的 Clash/系统代理导致 Windows 10061。"""
    try:
        with httpx.Client(trust_env=False, timeout=10.0) as client:
            response = client.post(target, json=payload)
        response.raise_for_status()
        return response
    except httpx.ConnectError as exc:
        raise ConnectionError("无法连接推送服务器，请检查电脑网络、防火墙或代理设置") from exc


def send_bark(endpoint: str, title: str, body: str, url: str | None = None) -> None:
    target = _safe_https(endpoint)
    if not target:
        return
    payload = {"title": title, "body": body, "group": "十三闲鱼监控"}
    if url:
        payload["url"] = url
    _post_json(target, payload)


def send_dingtalk(webhook: str, title: str, body: str, url: str | None = None) -> None:
    target = _safe_https(webhook)
    if not target:
        return
    _post_json(target, {
        "msgtype": "link",
        "link": {"title": title, "text": body, "messageUrl": url or "https://www.goofish.com/"},
    })


def send_pushplus(token: str, title: str, body: str, url: str | None = None) -> None:
    value = (token or "").strip()
    if not value or any(ch.isspace() for ch in value):
        raise ValueError("PushPlus Token 格式不正确")
    content = body + (f"\n\n商品链接：{url}" if url else "")
    response = _post_json("https://www.pushplus.plus/send", {
        "token": value, "title": title, "content": content, "template": "txt",
    })
    try:
        result = response.json()
    except ValueError:
        return
    if isinstance(result, dict) and result.get("code") not in (None, 200):
        raise ValueError(str(result.get("msg") or "PushPlus 推送失败"))


def send_event(settings, event: dict) -> int:
    return send_events(settings, [event])


def send_events(settings, events: list[dict]) -> int:
    title, body, url = format_push_batch(events)
    sent = 0
    errors: list[Exception] = []
    if getattr(settings, "bark_url", None):
        try:
            send_bark(settings.bark_url, title, body, url)
            sent += 1
        except Exception as exc:
            errors.append(exc)
    if getattr(settings, "pushplus_token", None):
        try:
            send_pushplus(settings.pushplus_token, title, body, url)
            sent += 1
        except Exception as exc:
            errors.append(exc)
    if getattr(settings, "dingtalk_webhook", None):
        try:
            send_dingtalk(settings.dingtalk_webhook, title, body, url)
            sent += 1
        except Exception as exc:
            errors.append(exc)
    if not sent and errors:
        raise errors[0]
    return sent


def send_test(settings) -> int:
    sample = {"type": "new_recommendation", "title": "测试成功：手机推送已连接", "price": 16.66,
              "url": "https://www.goofish.com/"}
    sent = send_event(settings, sample)
    if not sent:
        raise ValueError("请至少配置 Bark、PushPlus 或钉钉推送")
    return sent
