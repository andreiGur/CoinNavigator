# מבנה הפרויקט CoinNavigator

## איך הפרויקט בנוי

- **אתר סטטי** – HTML בלבד. אין שרת, אין WordPress.
- **אירוח:** Vercel (הדומיין coinnavigator.net).
- **נתונים:** הדף הראשי ועמודים אחרים טוענים מחירים מ־JSON בתוך הפרויקט.

---

## תיקיות עיקריות

| תיקייה / קובץ | תפקיד |
|---------------|--------|
| **index.html** | דף הבית – טבלת spread, לינקים לעמודים |
| **about/, blog/, terms/, contact/, privacy-policy/** | עמודי תוכן (כל אחד עם index.html) |
| **binance-review/, mexc-review/, bybit-arbitrage/, וכו'** | עמודי בורסות |
| **polymarket/** | עמוד Polymarket (שוקי חיזוי) |
| **data/** | `spread_data.json` – מחירים מהבורסות; `polymarket_hot.json` – אירועי Polymarket |
| **src/** | סקריפטי Python: `spread_detector.py` (מחירים), `polymarket_hot.py` (Polymarket) |
| **.github/workflows/** | GitHub Actions: מעדכנים את קבצי ה־JSON כל 15 דקות ומוסיפים commit |

יש גם **spread_data.json** ו־**polymarket_hot.json** בשורש הפרויקט – כדי שהאתר יוכל לטעון גם מ־`/spread_data.json` וגם מ־`/data/spread_data.json`.

---

## איך הנתונים מתעדכנים (בלי WordPress)

1. **GitHub Action** (`.github/workflows/update_data.yml`) רץ **כל 15 דקות**.
2. הוא מריץ את `src/spread_detector.py`, שמעדכן את `data/spread_data.json`.
3. הוא עושה commit + push ל־GitHub.
4. **Vercel** מחובר ל־repo ומבצע build/deploy אוטומטי אחרי כל push.
5. האתר החי (coinnavigator.net) מגיש את הקבצים המעודכנים מהפרויקט, כולל `data/spread_data.json`.

אין צורך ב־Cron על שרת, ב־WordPress או בהעלאה ידנית – רק להעלות את הקוד ל־GitHub ולוודא ש־Vercel מחובר ל־repo.

---

## תיקיית wordpress/

התיקייה `wordpress/` מכילה קבצי PHP ישנים (plugin, shortcodes). **הפרויקט הנוכחי לא משתמש ב־WordPress** – האתר הוא סטטי ב־Vercel. אפשר להתעלם מהתיקייה או למחוק אותה אם אין שימוש עתידי.
