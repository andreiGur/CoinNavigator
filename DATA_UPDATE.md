# עדכון הנתונים באתר

האתר מציג מחירים מ־`data/spread_data.json`. הפרויקט **לא משתמש ב־WordPress** – האתר סטטי ב־Vercel.

---

## איך הנתונים מתעדכנים

**אין צורך לעשות כלום ידנית.**

- ה־workflow **`.github/workflows/update_data.yml`** רץ אוטומטית **כל 15 דקות** ב־GitHub.
- הוא מריץ את `src/spread_detector.py`, מעדכן את `data/spread_data.json`, ועושה commit + push.
- Vercel מזהה את ה־push ומבצע deploy מחדש – והאתר החי מקבל את הקובץ המעודכן.

---

## בדיקה

1. **GitHub:** Repo → **Actions** → "Update spread data" – אמור לרוץ כל 15 דקות.
2. **הרצה ידנית:** Actions → Update spread data → **Run workflow**.
3. **באתר:** בדף הבית – "Last updated" אמור להתקדם, ומחיר BTC קרוב למחיר הנוכחי (למשל ב־Binance).

אם "Last updated" לא מתעדכן – וודא ש־Vercel מחובר ל־repo ושבנייה רצה אחרי כל push.
