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
