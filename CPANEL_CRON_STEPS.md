# 📋 CoinNavigator - cPanel Cron Job - צעדים מפורטים

## שלב 1: העלאת הפרויקט לשרת

### 1.1: דרך cPanel File Manager

1. **היכנס ל-cPanel File Manager**
2. **נווט ל:** `public_html/` (או מחוץ ל-public_html - יותר בטוח)
3. **צור תיקייה:** `CoinNavigator`
4. **העלה את הקבצים:**
   - `src/spread_detector.py`
   - `requirements.txt`
   - `run_spread_detector.sh` (אופציונלי)

**מבנה בשרת:**
```
/home/cointasu/CoinNavigator/
├── src/
│   └── spread_detector.py
├── requirements.txt
└── run_spread_detector.sh
```

---

## שלב 2: יצירת Virtual Environment בשרת

### 2.1: דרך cPanel Terminal (אם יש)

1. **cPanel > Terminal** (או "Advanced" > "Terminal")
2. **הרץ:**
   ```bash
   cd ~/CoinNavigator
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

### 2.2: אם אין Terminal - דרך SSH דרך cPanel

1. **cPanel > SSH Access** (אם יש)
2. **העתק את פרטי ההתחברות**
3. **התחבר דרך SSH client**
4. **הרץ את הפקודות למעלה**

### 2.3: אם אין אפשרות ל-SSH/Terminal

**אפשרות חלופית:** נשתמש ב-Python של המערכת (אם מותקן)

---

## שלב 3: הגדרת Cron Job

### 3.1: גישה ל-Cron Jobs

1. **cPanel > Cron Jobs** (בחלק "Advanced" או "Advanced Tools")
2. **לחץ על "Cron Jobs"**

### 3.2: יצירת Cron Job חדש

**בחר "Standard" (לא Advanced)**

**הגדרות:**

| שדה | ערך | הסבר |
|-----|-----|------|
| **Minute** | `*/15` | כל 15 דקות |
| **Hour** | `*` | כל שעה |
| **Day** | `*` | כל יום |
| **Month** | `*` | כל חודש |
| **Weekday** | `*` | כל יום בשבוע |

**Command (אפשרות 1 - עם venv):**
```bash
cd /home/cointasu/CoinNavigator && /home/cointasu/CoinNavigator/venv/bin/python /home/cointasu/CoinNavigator/src/spread_detector.py
```

**Command (אפשרות 2 - עם system Python):**
```bash
cd /home/cointasu/CoinNavigator && python3 /home/cointasu/CoinNavigator/src/spread_detector.py
```

**Command (אפשרות 3 - עם wrapper script):**
```bash
cd /home/cointasu/CoinNavigator && bash /home/cointasu/CoinNavigator/run_spread_detector.sh
```

### 3.3: שמירה

1. **לחץ "Add New Cron Job"**
2. **שמור**

---

## שלב 4: בדיקה

### 4.1: בדיקה ידנית

1. **cPanel > Terminal** (אם יש)
2. **הרץ:**
   ```bash
   cd ~/CoinNavigator
   python3 src/spread_detector.py
   ```
3. **בדוק שהקובץ נוצר:**
   ```bash
   ls -la ~/public_html/wp-content/uploads/coinnavigator/data/spread_data.json
   ```

### 4.2: בדיקת Cron Job

1. **המתן 15 דקות**
2. **בדוק את הקובץ:**
   - דרך File Manager
   - או דרך Terminal: `cat ~/public_html/wp-content/uploads/coinnavigator/data/spread_data.json`

### 4.3: בדיקת לוגים

אם יש לוגים ב-cPanel:
- בדוק את ה-Email (אם הוגדר)
- או בדוק את הלוגים ב-cPanel

---

## פתרון בעיות

### Cron Job לא רץ:
- ✅ בדוק שהנתיבים נכונים
- ✅ בדוק שהקובץ קיים
- ✅ בדוק הרשאות (chmod +x אם צריך)
- ✅ בדוק ש-Python מותקן

### JSON לא מתעדכן:
- ✅ בדוק שהסקריפט רץ
- ✅ בדוק הרשאות כתיבה לתיקייה
- ✅ בדוק שהנתיב נכון

### שגיאת Python:
- ✅ בדוק ש-Python 3 מותקן
- ✅ בדוק שה-venv נוצר (אם משתמשים בו)
- ✅ בדוק שה-requirements הותקנו

---

## הערות חשובות

1. **נתיבים:** התאם את הנתיבים לפי השרת שלך
2. **הרשאות:** וודא שיש הרשאות כתיבה
3. **Python:** וודא ש-Python 3 מותקן
4. **תדירות:** 15 דקות זה מספיק טוב

---

**מוכן? בואו נתחיל!** 🚀







