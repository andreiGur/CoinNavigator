# עדכון הנתונים באתר

האתר מציג מחירים מ־`data/spread_data.json` ו־`spread_data.json`. הפרויקט אתר סטטי ב־Vercel.

---

## איך הנתונים מתעדכנים

- ה־workflow **Update spread data** רץ:
  - **כל 15 דקות** (schedule)
  - **בכל push ל־main** (גם עדכון קוד מעלה נתונים חדשים)
  - **ידנית:** Actions → Update spread data → Run workflow
- הסקריפט מעדכן את שני הקבצים ועושה commit + push; Vercel עושה deploy והאתר מקבל נתונים עדכניים.

---

## אם הנתונים לא מתעדכנים (למשל "4 days old")

1. **הרצה עכשיו (ידנית):** ב־GitHub → **Actions** → **Update spread data** → **Run workflow** (כפתור ירוק). אחרי שהריצה מסתיימת בהצלחה, האתר יתעדכן אחרי ה־deploy ב־Vercel.
2. **הרשאות ל־workflow:** ב־GitHub → **Settings** → **Actions** → **General** → **Workflow permissions** → בחר **Read and write permissions** (כדי שה־workflow יוכל לעשות push).
3. **אם ה־schedule לא רץ:** GitHub מפסיק scheduled workflows אחרי חודשיים ללא פעילות ב־repo. כל push ל־main מפעיל את ה־workflow ומרענן נתונים, אז די ב־push אחד כדי להחזיר עדכונים.

---

## בדיקה

- **Actions:** ריצות של "Update spread data" מסתיימות ב־green, ויש commit "chore: update spread_data.json [automated]".
- **באתר:** "Last updated" מתקדם, ומחיר BTC קרוב למחיר ב־Binance.
