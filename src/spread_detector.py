import requests
import json
import os
from datetime import datetime
from typing import Dict, Optional

class SpreadDetector:
    def __init__(self):
        # Expanded list of popular coins
        self.symbols = [
            "BTCUSDT", "ETHUSDT", "SOLUSDT", 
            "XRPUSDT", "ADAUSDT", "DOGEUSDT", 
            "DOTUSDT", "LINKUSDT", "MATICUSDT"
        ]
        self.data_dir = "data"
        os.makedirs(self.data_dir, exist_ok=True)

    def get_binance_price(self, symbol: str) -> Optional[float]:
        try:
            url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"
            response = requests.get(url, timeout=10)
            data = response.json()
            return float(data["price"])
        except Exception as e:
            print(f"Error fetching Binance price for {symbol}: {e}")
            return None

    def get_bybit_price(self, symbol: str) -> Optional[float]:
        try:
            url = f"https://api.bybit.com/v5/market/tickers?category=spot&symbol={symbol}"
            response = requests.get(url, timeout=10)
            data = response.json()
            if data["retCode"] == 0 and data["result"]["list"]:
                return float(data["result"]["list"][0]["lastPrice"])
            return None
        except Exception as e:
            print(f"Error fetching ByBit price for {symbol}: {e}")
            return None

    def run(self):
        results = {
            "timestamp": datetime.utcnow().isoformat() + "Z", # Ensure ISO format with Z
            "symbols": {}
        }

        print(f"--- Starting Update: {results['timestamp']} ---")
        for symbol in self.symbols:
            binance_price = self.get_binance_price(symbol)
            bybit_price = self.get_bybit_price(symbol)

            if binance_price and bybit_price:
                abs_diff = abs(binance_price - bybit_price)
                spread_pct = abs_diff / min(binance_price, bybit_price)
                
                results["symbols"][symbol] = {
                    "binance_price": binance_price,
                    "bybit_price": bybit_price,
                    "absolute_diff": round(abs_diff, 4),
                    "spread_percent": round(spread_pct, 6),
                    "higher_exchange": "Binance" if binance_price > bybit_price else "ByBit"
                }
                print(f"Processed {symbol}: Spread {round(spread_pct * 100, 4)}%")

        # Save to JSON
        output_path = os.path.join(self.data_dir, "spread_data.json")
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)
        print(f"Successfully saved {len(results['symbols'])} symbols to {output_path}")

if __name__ == "__main__":
    detector = SpreadDetector()
    detector.run()
