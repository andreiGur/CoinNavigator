import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import ssl
import urllib.request


class PolymarketHot:
    """
    Fetch "hot" Polymarket markets (high 24h volume) from the public Gamma API
    and write a small, stable JSON payload the frontend can consume.
    """

    def __init__(self):
        self.data_dir = "data"
        os.makedirs(self.data_dir, exist_ok=True)

        self.headers = {
            "User-Agent": "CoinNavigator/1.0 (+https://coinnavigator.net)",
            "Accept": "application/json,text/plain,*/*",
        }
        self.ssl_ctx = ssl.create_default_context()

        self.base = "https://gamma-api.polymarket.com"

    def _get_json(self, url: str, timeout_s: int = 15, retries: int = 3) -> Tuple[Optional[Any], Optional[str]]:
        last_err: Optional[str] = None
        for attempt in range(1, retries + 1):
            try:
                req = urllib.request.Request(url, headers=self.headers, method="GET")
                with urllib.request.urlopen(req, timeout=timeout_s, context=self.ssl_ctx) as r:
                    status = getattr(r, "status", None) or 200
                    if status < 200 or status >= 300:
                        last_err = f"HTTP {status}"
                        time.sleep(0.8 * attempt)
                        continue
                    raw = r.read()
                try:
                    return json.loads(raw), None
                except Exception:
                    snippet = (raw[:180] if isinstance(raw, (bytes, bytearray)) else b"")[:180].decode(
                        "utf-8", errors="replace"
                    )
                    last_err = f"Non-JSON response: {snippet!r}"
                    time.sleep(0.8 * attempt)
            except Exception as e:
                last_err = f"{type(e).__name__}: {e}"
                time.sleep(0.8 * attempt)
        return None, last_err

    @staticmethod
    def _parse_json_list_field(v: Any) -> List[Any]:
        # Gamma returns some fields as stringified JSON arrays: '["Yes","No"]'
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        return []

    @staticmethod
    def _to_float(v: Any) -> Optional[float]:
        try:
            if v is None:
                return None
            return float(v)
        except Exception:
            return None

    @staticmethod
    def _format_outcomes(outcomes: List[Any], prices: List[Any]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for i, name in enumerate(outcomes):
            p = prices[i] if i < len(prices) else None
            pf = PolymarketHot._to_float(p)
            if isinstance(name, str):
                out.append({"name": name, "price": pf})
        return out

    @staticmethod
    def _best_yes_no(outcomes: List[Dict[str, Any]]) -> Tuple[Optional[float], Optional[float]]:
        yes = None
        no = None
        for o in outcomes:
            n = (o.get("name") or "").strip().lower()
            if n == "yes":
                yes = o.get("price")
            elif n == "no":
                no = o.get("price")
        return yes, no

    def run(self, limit: int = 30, top_n: int = 12) -> Dict[str, Any]:
        # NOTE: Gamma rejects unknown query params with 422.
        # Keep the query minimal and sort/filter in our code.
        url = f"{self.base}/markets?limit={limit}&active=true&closed=false"
        data, err = self._get_json(url)
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        payload: Dict[str, Any] = {
            "timestamp": now,
            "source": "gamma-api.polymarket.com",
            "markets": [],
            "error": err,
        }

        if not isinstance(data, list):
            return payload

        markets: List[Dict[str, Any]] = []
        for m in data:
            if not isinstance(m, dict):
                continue

            slug = m.get("slug")
            question = m.get("question")
            if not slug or not question:
                continue

            outcomes_raw = self._parse_json_list_field(m.get("outcomes"))
            prices_raw = self._parse_json_list_field(m.get("outcomePrices"))
            outcomes = self._format_outcomes(outcomes_raw, prices_raw)
            yes_price, no_price = self._best_yes_no(outcomes)

            volume24 = self._to_float(m.get("volume24hr")) or 0.0

            item: Dict[str, Any] = {
                "id": str(m.get("id") or ""),
                "slug": slug,
                "question": question,
                "url": f"https://polymarket.com/event/{slug}",
                "image": m.get("image") or m.get("icon"),
                "endDate": m.get("endDate"),
                "volume24hr": volume24,
                "volume": self._to_float(m.get("volume")),
                "liquidity": self._to_float(m.get("liquidity")),
                "yes": yes_price,
                "no": no_price,
                "oneDayPriceChange": self._to_float(m.get("oneDayPriceChange")),
                "outcomes": outcomes[:6],  # keep it small for frontend
            }
            markets.append(item)

        markets.sort(key=lambda x: (x.get("volume24hr") or 0.0), reverse=True)
        payload["markets"] = markets[:top_n]
        payload["error"] = None
        return payload

    def write_files(self, payload: Dict[str, Any]) -> None:
        output_path = os.path.join(self.data_dir, "polymarket_hot.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

        root_output = "polymarket_hot.json"
        with open(root_output, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

        print(f"Updated polymarket markets: {len(payload.get('markets') or [])}")


if __name__ == "__main__":
    detector = PolymarketHot()
    detector.write_files(detector.run())


