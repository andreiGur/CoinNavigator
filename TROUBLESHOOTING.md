# 🔧 CoinNavigator - פתרון בעיות - עדכון אוטומטי

## הבעיה: הנתונים לא מתעדכנים

התאריך "Last updated: 2025-12-09 10:33:54" לא משתנה.

---

## שלב 1: בדיקת Cron Job

### 1.1: בדיקה ב-cPanel

1. **cPanel > Cron Jobs**
2. **בדוק את ה-Cron Job:**
   - האם הוא מופיע ברשימה?
   - האם השדות נכונים?
   - Minute: `*/15` (לא `15`)

### 1.2: בדיקת לוגים

אם יש אפשרות לראות לוגים:
- בדוק את ה-Email (אם הוגדר)
- או בדוק את הלוגים ב-cPanel

---

## שלב 2: בדיקה ידנית

### 2.1: דרך cPanel Terminal (אם יש)

1. **cPanel > Terminal**
2. **הרץ:**
   ```bash
   cd ~/CoinNavigator
   python3 src/spread_detector.py
   ```
3. **בדוק:**
   - האם הסקריפט רץ?
   - האם יש שגיאות?
   - האם הקובץ נוצר?

### 2.2: בדיקת הקובץ

1. **File Manager:**
   - נווט ל: `public_html/wp-content/uploads/coinnavigator/data/`
   - בדוק את `spread_data.json`
   - בדוק את "Last Modified" - האם הוא מתעדכן?

---

## שלב 3: בעיות נפוצות ופתרונות

### בעיה 1: Cron Job לא רץ

**סיבות אפשריות:**
- Minute מוגדר כ-`15` במקום `*/15`
- נתיבים לא נכונים
- Python לא מותקן
- הרשאות לא נכונות

**פתרון:**
1. ערוך את ה-Cron Job
2. בדוק שהנתיבים נכונים
3. בדוק ש-Python 3 מותקן

---

### בעיה 2: הסקריפט לא רץ

**סיבות אפשריות:**
- Python לא מותקן
- requirements לא הותקנו
- שגיאות בקוד

**פתרון:**
1. בדוק ש-Python 3 מותקן: `python3 --version`
2. התקן requirements: `pip3 install requests`
3. הרץ ידנית ובדוק שגיאות

---

### בעיה 3: הקובץ לא נוצר במיקום הנכון

**סיבות אפשריות:**
- נתיבים לא נכונים
- הרשאות כתיבה
- תיקיות לא קיימות

**פתרון:**
1. בדוק שהנתיבים נכונים
2. בדוק הרשאות: `chmod 755` לתיקיות
3. צור את התיקיות אם לא קיימות

---

## שלב 4: בדיקה מהירה

### 4.1: בדיקת Python

```bash
python3 --version
```

אמור להציג גרסה (למשל: Python 3.x.x)

### 4.2: בדיקת הסקריפט

```bash
cd ~/CoinNavigator
python3 src/spread_detector.py
```

אמור להציג:
- "Checking BTCUSDT..."
- "Checking ETHUSDT..."
- "Results saved to..."

### 4.3: בדיקת הקובץ

```bash
ls -la ~/public_html/wp-content/uploads/coinnavigator/data/spread_data.json
```

אמור להציג את הקובץ עם תאריך עדכון

---

## פתרון מהיר - בדיקה ידנית

1. **cPanel > Terminal** (אם יש)
2. **הרץ:**
   ```bash
   cd ~/CoinNavigator
   python3 src/spread_detector.py
   ```
3. **בדוק את הקובץ:**
   ```bash
   cat ~/public_html/wp-content/uploads/coinnavigator/data/spread_data.json
   ```

---

## מה לעשות עכשיו

1. **בדוק את ה-Cron Job** ב-cPanel
2. **נסה להריץ ידנית** (אם יש Terminal)
3. **בדוק את הקובץ** - האם הוא מתעדכן?
4. **ספר לי מה קורה** - נמשיך משם

---

**בואו נפתור את זה!** 🔧





