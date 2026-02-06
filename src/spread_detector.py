import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

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

        # Public exchanges to display (Bybit may be blocked from GitHub-hosted runners).
        self.exchange_order = ["Binance", "MEXC", "Bybit"]  # Focus only on exchanges with affiliate links

    def _get_json(self, url: str, timeout_s: int = 10, retries: int = 3) -> Tuple[Optional[Any], Optional[str]]:
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

    def _to_dash_symbol(self, symbol: str) -> str:
        # BTCUSDT -> BTC-USDT
        if symbol.endswith("USDT"):
            return f"{symbol[:-4]}-USDT"
        return symbol

    def _to_gate_symbol(self, symbol: str) -> str:
        # BTCUSDT -> BTC_USDT
        if symbol.endswith("USDT"):
            return f"{symbol[:-4]}_USDT"
        return symbol

    def get_okx_price_info(self, symbol: str) -> Tuple[Optional[float], Optional[str]]:
        inst_id = self._to_dash_symbol(symbol)
        url = f"https://www.okx.com/api/v5/market/ticker?instId={inst_id}"
        data, err = self._get_json(url)
        if not data:
            return None, err
        try:
            items = (data.get("data") or [])
            if items:
                return float(items[0]["last"]), None
            return None, "Empty data list"
        except Exception as e:
            return None, f"{type(e).__name__}: {e}"

    def get_kucoin_price_info(self, symbol: str) -> Tuple[Optional[float], Optional[str]]:
        ku_symbol = self._to_dash_symbol(symbol)
        url = f"https://api.kucoin.com/api/v1/market/orderbook/level1?symbol={ku_symbol}"
        data, err = self._get_json(url)
        if not data:
            return None, err
        try:
            if str(data.get("code")) == "200000":
                return float(data["data"]["price"]), None
            return None, f"code={data.get('code')} msg={data.get('msg')}"
        except Exception as e:
            return None, f"{type(e).__name__}: {e}"

    def get_gate_price_info(self, symbol: str) -> Tuple[Optional[float], Optional[str]]:
        gate_symbol = self._to_gate_symbol(symbol)
        url = f"https://api.gateio.ws/api/v4/spot/tickers?currency_pair={gate_symbol}"
        data, err = self._get_json(url)
        if not data:
            return None, err
        try:
            if isinstance(data, list) and data:
                return float(data[0]["last"]), None
            return None, "Empty list"
        except Exception as e:
            return None, f"{type(e).__name__}: {e}"

    def get_mexc_price_info(self, symbol: str) -> Tuple[Optional[float], Optional[str]]:
        url = f"https://api.mexc.com/api/v3/ticker/price?symbol={symbol}"
        data, err = self._get_json(url)
        if not data:
            return None, err
        try:
            if "price" in data:
                return float(data["price"]), None
            return None, "Missing price"
        except Exception as e:
            return None, f"{type(e).__name__}: {e}"

    def _exchange_fetchers(self) -> Dict[str, Any]:
        # Only include exchanges with affiliate links
        return {
            "Binance": self.get_binance_price_info,
            "MEXC": self.get_mexc_price_info,
            "Bybit": self.get_bybit_price_info,
        }

    def _all_fetchers(self) -> Dict[str, Any]:
        """All exchanges we can fetch (for full price table and best buy/sell)."""
        return {
            "Binance": self.get_binance_price_info,
            "OKX": self.get_okx_price_info,
            "KuCoin": self.get_kucoin_price_info,
            "Gate": self.get_gate_price_info,
            "MEXC": self.get_mexc_price_info,
            "Bybit": self.get_bybit_price_info,
        }

    def run(self) -> Dict[str, Any]:
        """Fetch prices from all exchanges for all symbols; compute best buy/sell and spread."""
        fetchers = self._all_fetchers()
        exchange_names = list(fetchers.keys())
        symbols_data: Dict[str, Any] = {}
        errors: Dict[str, Dict[str, str]] = {}

        for symbol in self.symbols:
            prices: Dict[str, float] = {}
            sym_errors: Dict[str, str] = {}

            for name, get_price_info in fetchers.items():
                price, err = get_price_info(symbol)
                if price is not None:
                    prices[name] = price
                if err:
                    sym_errors[name] = err

            binance_price = prices.get("Binance")
            bybit_price = prices.get("Bybit")

            best_buy = None
            best_sell = None
            absolute_diff = None
            spread_percent = None
            if prices:
                min_price = min(prices.values())
                max_price = max(prices.values())
                best_buy_ex = min(prices, key=prices.get)
                best_sell_ex = max(prices, key=prices.get)
                best_buy = {"exchange": best_buy_ex, "price": min_price}
                best_sell = {"exchange": best_sell_ex, "price": max_price}
                absolute_diff = round(max_price - min_price, 2)
                if min_price and min_price > 0:
                    spread_percent = round((max_price - min_price) / min_price, 8)

            symbols_data[symbol] = {
                "prices": prices,
                "absolute_diff": absolute_diff,
                "spread_percent": spread_percent,
                "best_buy": best_buy,
                "best_sell": best_sell,
                "binance_price": binance_price,
                "bybit_price": bybit_price,
            }
            if sym_errors:
                errors[symbol] = sym_errors

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "symbols": symbols_data,
            "errors": errors,
            "exchanges": exchange_names,
        }

    def save_to_json(self, data: Dict[str, Any], filename: str = "spread_data.json") -> Optional[str]:
        """Save results to data/spread_data.json (used by the static site / Vercel)."""
        path = os.path.join(self.data_dir, filename)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving JSON: {e}", flush=True)
            return None
        return path


if __name__ == "__main__":
    detector = SpreadDetector()
    payload = detector.run()
    out = detector.save_to_json(payload)
    if out:
        print(f"Saved to {out}", flush=True)
    else:
        raise SystemExit(1)
