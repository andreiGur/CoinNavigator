# 🔄 CoinNavigator - הגדרת Cron Job - צעד אחר צעד

## ✅ שלב 1: העלאת קבצים - הושלם!

הקבצים כבר בשרת:
- `/home/cointasu/CoinNavigator/src/spread_detector.py`
- `/home/cointasu/CoinNavigator/requirements.txt`

---

## שלב 2: יצירת Virtual Environment

### אפשרות A: דרך cPanel Terminal (אם יש)

1. **cPanel > Terminal** (בחלק "Advanced" או "Advanced Tools")
2. **אם אין Terminal, נדלג על זה ונשתמש ב-Python של המערכת**

אם יש Terminal:
```bash
cd ~/CoinNavigator
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### אפשרות B: בלי Terminal (נשתמש ב-Python של המערכת)

אם אין Terminal, נשתמש ב-Python של המערכת ישירות.

---

## שלב 3: הגדרת Cron Job

### 3.1: גישה ל-Cron Jobs

1. **ב-cPanel, מצא "Cron Jobs"**
   - בדרך כלל בחלק "Advanced" או "Advanced Tools"
   - או חפש "Cron" בחיפוש

2. **לחץ על "Cron Jobs"**

### 3.2: יצירת Cron Job חדש

1. **לחץ על "Add New Cron Job"** (או "Create Cron Job")

2. **בחר "Standard"** (לא Advanced)

3. **הגדר את השדות:**

   | שדה | ערך | הסבר |
   |-----|-----|------|
   | **Minute** | `*/15` | כל 15 דקות |
   | **Hour** | `*` | כל שעה |
   | **Day** | `*` | כל יום |
   | **Month** | `*` | כל חודש |
   | **Weekday** | `*` | כל יום בשבוע |

4. **בשדה "Command", הקלד:**

   **אם יש venv:**
   ```bash
   cd /home/cointasu/CoinNavigator && /home/cointasu/CoinNavigator/venv/bin/python /home/cointasu/CoinNavigator/src/spread_detector.py
   ```

   **אם אין venv (Python של המערכת):**
   ```bash
   cd /home/cointasu/CoinNavigator && python3 /home/cointasu/CoinNavigator/src/spread_detector.py
   ```

5. **לחץ "Add New Cron Job"** (או "Create")

---

## שלב 4: בדיקה

### 4.1: בדיקה ידנית (אופציונלי)

אם יש Terminal:
```bash
cd ~/CoinNavigator
python3 src/spread_detector.py
```

### 4.2: בדיקת הקובץ

1. **דרך File Manager:**
   - נווט ל: `public_html/wp-content/uploads/coinnavigator/data/`
   - בדוק אם `spread_data.json` קיים
   - בדוק את תאריך העדכון

2. **המתן 15 דקות:**
   - הקובץ אמור להתעדכן אוטומטית

---

## פתרון בעיות

### Cron Job לא רץ:
- ✅ בדוק שהנתיבים נכונים
- ✅ בדוק שהקובץ `spread_detector.py` קיים
- ✅ בדוק ש-Python 3 מותקן

### JSON לא מתעדכן:
- ✅ בדוק שהסקריפט רץ
- ✅ בדוק הרשאות כתיבה לתיקייה
- ✅ בדוק שהנתיב נכון

---

## סיכום - מה לעשות עכשיו

1. **בדוק אם יש Terminal ב-cPanel** (אופציונלי)
2. **cPanel > Cron Jobs**
3. **צור Cron Job חדש:**
   - Minute: `*/15`
   - Command: (העתק מהמעלה)
4. **שמור**
5. **המתן 15 דקות ובדוק**

---

**מוכן? בואו נמשיך!** 🚀






