import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import requests

class SpreadDetector:
    def __init__(self):
        self.symbols = [
            "BTCUSDT", "ETHUSDT", "SOLUSDT", 
            "XRPUSDT", "ADAUSDT", "DOGEUSDT", 
            "DOTUSDT", "LINKUSDT", "MATICUSDT"
        ]
        self.data_dir = "data"
        os.makedirs(self.data_dir, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "CoinNavigator/1.0 (+https://coinnavigator.net)",
                "Accept": "application/json,text/plain,*/*",
            }
        )

        # Binance sometimes geo-blocks GitHub-hosted runners. This endpoint is commonly reachable.
        self.binance_endpoints = [
            "https://api.binance.com",
            "https://data-api.binance.vision",
        ]

        # Bybit can also block certain data-center IP ranges. Try a fallback domain as well.
        self.bybit_endpoints = [
            "https://api.bybit.com",
            "https://api.bytick.com",
        ]

    def _get_json(self, url: str, timeout_s: int = 10, retries: int = 3) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        last_err: Optional[str] = None
        for attempt in range(1, retries + 1):
            try:
                res = self.session.get(url, timeout=timeout_s)
                if not res.ok:
                    last_err = f"HTTP {res.status_code} {res.reason}"
                    time.sleep(0.6 * attempt)
                    continue
                try:
                    return res.json(), None
                except Exception:
                    # Some providers return HTML on block pages.
                    snippet = (res.text or "")[:180].replace("\n", " ").strip()
                    last_err = f"Non-JSON response: {snippet!r}"
                    time.sleep(0.6 * attempt)
            except Exception as e:
                last_err = f"{type(e).__name__}: {e}"
                time.sleep(0.6 * attempt)
        return None, last_err

    def get_binance_price_info(self, symbol: str) -> Tuple[Optional[float], Optional[str]]:
        last_err: Optional[str] = None
        for base in self.binance_endpoints:
            url = f"{base}/api/v3/ticker/price?symbol={symbol}"
            data, err = self._get_json(url)
            if data and "price" in data:
                try:
                    return float(data["price"]), None
                except Exception:
                    last_err = "Invalid price format"
                    continue
            last_err = err or "Unknown error"
        return None, last_err

    def get_binance_price(self, symbol: str) -> Optional[float]:
        price, _err = self.get_binance_price_info(symbol)
        return price

    def get_bybit_price_info(self, symbol: str) -> Tuple[Optional[float], Optional[str]]:
        last_err: Optional[str] = None
        for base in self.bybit_endpoints:
            url = f"{base}/v5/market/tickers?category=spot&symbol={symbol}"
            data, err = self._get_json(url)
            if not data:
                last_err = err or "Unknown error"
                continue
            try:
                if data.get("retCode") == 0:
                    items = (((data.get("result") or {}).get("list")) or [])
                    if items:
                        return float(items[0]["lastPrice"]), None
                # Bybit sometimes returns JSON with an error message.
                last_err = f"retCode={data.get('retCode')} retMsg={data.get('retMsg')}"
            except Exception as e:
                last_err = f"{type(e).__name__}: {e}"
        return None, last_err

    def get_bybit_price(self, symbol: str) -> Optional[float]:
        price, _err = self.get_bybit_price_info(symbol)
        return price

    def run(self):
        results = {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "symbols": {},
            "errors": {},
        }

        for symbol in self.symbols:
            binance_price, binance_err = self.get_binance_price_info(symbol)
            bybit_price, bybit_err = self.get_bybit_price_info(symbol)

            if binance_price is None or bybit_price is None:
                results["errors"][symbol] = {
                    "binance": binance_err if binance_price is None else "ok",
                    "bybit": bybit_err if bybit_price is None else "ok",
                }
                continue

            abs_diff = abs(binance_price - bybit_price)
            spread_pct = abs_diff / min(binance_price, bybit_price)

            results["symbols"][symbol] = {
                "binance_price": binance_price,
                "bybit_price": bybit_price,
                "absolute_diff": round(abs_diff, 4),
                "spread_percent": round(spread_pct, 6),
                "higher_exchange": "Binance" if binance_price > bybit_price else "ByBit",
            }

        # Write to /data/spread_data.json (for local/dev) AND /spread_data.json (for simple static hosting)
        output_path = os.path.join(self.data_dir, "spread_data.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        root_output_path = "spread_data.json"
        with open(root_output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)

        print(f"Updated {len(results['symbols'])} symbols")
        if results.get("errors"):
            print(f"Errors: {len(results['errors'])} symbols had missing data")

if __name__ == "__main__":
    detector = SpreadDetector()
    detector.run()
