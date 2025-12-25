# 🚀 Quick Start - CoinNavigator

## מה לעשות עכשיו - 7 שלבים פשוטים

### ✅ שלב 1: בדיקה מקומית (2 דקות)

```bash
cd /Users/andreigurevich/Desktop/CoinNavigator
source venv/bin/activate
python src/spread_detector.py
```

**תוצאה צפויה:** קובץ `data/spread_data.json` נוצר בהצלחה ✅

---

### ✅ שלב 2: העלאת Plugin (5 דקות)

**דרך FTP/SFTP:**
1. התחבר לשרת coinnavigator.net
2. נווט ל: `/wp-content/plugins/`
3. צור תיקייה: `coinnavigator`
4. העלה את כל הקבצים מתיקיית `wordpress/`:
   - `coinnavigator-plugin.php`
   - `shortcode.php`
   - `shortcode-table-template.php`
   - `shortcode-cards-template.php`

**או דרך WordPress Admin:**
1. צור ZIP מתיקיית `wordpress/`
2. `Plugins > Add New > Upload Plugin`
3. העלה את ה-ZIP

---

### ✅ שלב 3: העלאת JSON (2 דקות)

1. צור תיקיות בשרת:
   ```
   /wp-content/uploads/coinnavigator/data/
   ```

2. העלה את הקובץ:
   ```
   data/spread_data.json → /wp-content/uploads/coinnavigator/data/spread_data.json
   ```

---

### ✅ שלב 4: הפעלת Plugin (1 דקה)

1. היכנס ל: `https://coinnavigator.net/wp-admin`
2. `Plugins > Installed Plugins`
3. מצא "CoinNavigator Spread Detector"
4. לחץ "Activate"

---

### ✅ שלב 5: בדיקת הגדרות (1 דקה)

1. `Settings > CoinNavigator`
2. אמור לראות: "✓ Data file found"
3. אם לא - בדוק שהקובץ במיקום הנכון

---

### ✅ שלב 6: הוספת Shortcode (2 דקות)

1. `Pages > Add New` (או ערוך עמוד קיים)
2. הוסף shortcode:
   ```
   [coinnavigator_spread]
   ```
3. שמור וצפה בעמוד

---

### ✅ שלב 7: בדיקה סופית (1 דקה)

**אמור לראות:**
- טבלה עם נתוני BTC ו-ETH
- מחירים מ-Binance ו-ByBit
- אחוזי Spread
- תאריך עדכון אחרון

---

## 🎯 סיכום - מה צריך לעשות

| שלב | פעולה | זמן משוער |
|-----|-------|-----------|
| 1 | בדיקה מקומית | 2 דק' |
| 2 | העלאת Plugin | 5 דק' |
| 3 | העלאת JSON | 2 דק' |
| 4 | הפעלת Plugin | 1 דק' |
| 5 | בדיקת הגדרות | 1 דק' |
| 6 | הוספת Shortcode | 2 דק' |
| 7 | בדיקה סופית | 1 דק' |
| **סה"כ** | | **~15 דקות** |

---

## 📁 מבנה קבצים בשרת

```
/wp-content/
├── plugins/
│   └── coinnavigator/
│       ├── coinnavigator-plugin.php
│       ├── shortcode.php
│       ├── shortcode-table-template.php
│       └── shortcode-cards-template.php
└── uploads/
    └── coinnavigator/
        └── data/
            └── spread_data.json
```

---

## 🔧 אם משהו לא עובד

### "Spread data not available"
→ בדוק שהקובץ במיקום: `/wp-content/uploads/coinnavigator/data/spread_data.json`

### Shortcode לא מופיע
→ וודא שה-plugin מופעל ב-`Plugins > Installed Plugins`

### נתונים לא מעודכנים
→ הרץ את הסקריפט Python שוב והעלה את ה-JSON מחדש

---

## 📚 תיעוד נוסף

- **מדריך מפורט:** `DEPLOYMENT_GUIDE.md`
- **אוטומציה:** `AUTOMATION.md`
- **WordPress:** `wordpress/README.md`

---

**מוכן? בואו נתחיל! 🚀**


