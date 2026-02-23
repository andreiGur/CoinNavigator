import json
import os
from datetime import datetime, timezone

import requests


def fmt_usd(v):
    if not isinstance(v, (int, float)):
        return "—"
    try:
        return f"${v:,.2f}"
    except Exception:
        return str(v)


def pick_alert_row(data):
    symbols = (data or {}).get("symbols") or {}

    # Prefer BTC to match the social MVP requirement.
    if "BTCUSDT" in symbols:
        return "BTCUSDT", symbols["BTCUSDT"]

    # Fallback: highest spread with best buy/sell.
    best = None
    for sym, info in symbols.items():
        try:
            if not info or not info.get("best_buy") or not info.get("best_sell"):
                continue
            sp = info.get("spread_percent")
            if not isinstance(sp, (int, float)):
                continue
            if best is None or sp > best[0]:
                best = (sp, sym, info)
        except Exception:
            continue
    if best:
        return best[1], best[2]
    return None, None


def build_message(data):
    ts = (data or {}).get("timestamp")
    updated_txt = ""
    if ts:
        try:
            d = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            updated_txt = d.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        except Exception:
            updated_txt = str(ts)

    sym, info = pick_alert_row(data)
    if not sym or not info:
        return f"CoinNavigator alert: no spread data available right now. coinnavigator.net"

    coin = sym.replace("USDT", "")
    buy = info.get("best_buy") or {}
    sell = info.get("best_sell") or {}
    sp = info.get("spread_percent")
    spread_pct = (sp * 100) if isinstance(sp, (int, float)) else None
    spread_txt = f"{spread_pct:.3f}%" if isinstance(spread_pct, (int, float)) else "—"

    msg = (
        f"{coin} spread: {spread_txt} — "
        f"{buy.get('exchange','—')} → {sell.get('exchange','—')}. "
        f"Check: coinnavigator.net/#dashboard"
    )
    if updated_txt:
        msg += f"\nUpdated: {updated_txt}"
    return msg


def send_telegram(bot_token, chat_id, text):
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": True,
    }
    r = requests.post(url, json=payload, timeout=20)
    r.raise_for_status()
    return r.json()


def main():
    path = os.environ.get("SPREAD_DATA_PATH", "data/spread_data.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    text = build_message(data)
    print(text)

    bot_token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    chat_id = (os.environ.get("TELEGRAM_CHAT_ID") or "").strip()
    if not bot_token or not chat_id:
        print("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set; skipping send.")
        return

    send_telegram(bot_token, chat_id, text)
    print("Sent to Telegram.")


if __name__ == "__main__":
    main()

