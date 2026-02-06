# CoinNavigator – בדיקה ואימות

## איך הפרויקט עובד (ללא WordPress)

- **אתר סטטי** ב־Vercel (coinnavigator.net).
- הנתונים מגיעים מקבצי JSON בתוך הפרויקט: `data/spread_data.json`, `data/polymarket_hot.json`.
- העדכון מתבצע אוטומטית על ידי **GitHub Actions** – כל 15 דקות.

---

## אמינות המידע באתר

1. **עדכון נתונים:** ה־workflow `update_data.yml` מריץ את `src/spread_detector.py` ומוסיף commit ל־`data/spread_data.json`. Vercel מבצע deploy אחרי כל push.
2. **אזהרות למשתמש:** כשהנתונים ישנים (מעל שעה) או כשמחיר BTC בטבלה שונה ב־>5% ממחיר Binance החי, האתר מציג **באנר אזהרה** ותאריך עדכון באדום.
3. **בדיקה:** וודא ש־"Last updated" בדף הבית מתקדם וש־BTC קרוב למחיר הנוכחי (למשל Binance/CoinGecko).

---

## מה לבדוק

### ב־GitHub

- **Actions** → "Update spread data" – רץ כל 15 דקות (או הרץ ידנית: Run workflow).
- אחרי הרצה – אמור להופיע commit חדש עם `data/spread_data.json`.

### באתר (coinnavigator.net)

- בדף הבית – טבלת המחירים מתמלאת.
- "Last updated" בתחתית הטבלה – תאריך/שעה עדכניים.
- מחיר BTC בטבלה – בסביבות המחיר הנוכחי ב־Binance.

---

## אם משהו לא עובד

- **ה־Action נכשל:** בדוק ב־Actions את הלוג; וודא ש־`requests` מותקן (ב־workflow יש `pip install requests`).
- **האתר לא מתעדכן:** וודא ש־Vercel מחובר ל־repo ושבנייה רצה אחרי ה־push.
- **מחירים לא הגיוניים:** האתר יציג באנר אזהרה אם הנתונים ישנים או אם יש סטייה גדולה ממחיר Binance החי.
