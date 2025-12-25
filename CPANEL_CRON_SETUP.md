# 🔄 CoinNavigator - cPanel Cron Job Setup

## שלב 1: הכנת הסקריפט בשרת

### 1.1: העלאת הפרויקט לשרת

1. **דרך cPanel File Manager:**
   - נווט ל: `public_html/` (או מחוץ ל-public_html)
   - צור תיקייה: `CoinNavigator` (או שם אחר)
   - העלה את כל הקבצים:
     - `src/spread_detector.py`
     - `requirements.txt`
     - `run_spread_detector.sh`

### 1.2: יצירת venv בשרת

**דרך cPanel Terminal (אם יש):**
```bash
cd ~/CoinNavigator
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**או דרך SSH דרך cPanel (אם יש אפשרות):**
- cPanel > Terminal
- הרץ את הפקודות למעלה

---

## שלב 2: הגדרת Cron Job דרך cPanel

### 2.1: גישה ל-Cron Jobs

1. **היכנס ל-cPanel**
2. **מצא "Cron Jobs"** (בחלק "Advanced" או "Advanced Tools")
3. **לחץ על "Cron Jobs"**

### 2.2: יצירת Cron Job חדש

**בחר "Standard" (לא Advanced)**

**הגדרות:**
- **Minute:** `*/15` (כל 15 דקות)
- **Hour:** `*` (כל שעה)
- **Day:** `*` (כל יום)
- **Month:** `*` (כל חודש)
- **Weekday:** `*` (כל יום בשבוע)

**Command:**
```bash
cd /home/cointasu/CoinNavigator && /home/cointasu/CoinNavigator/venv/bin/python /home/cointasu/CoinNavigator/src/spread_detector.py
```

**או עם wrapper script:**
```bash
cd /home/cointasu/CoinNavigator && bash /home/cointasu/CoinNavigator/run_spread_detector.sh
```

---

## שלב 3: העלאת JSON אוטומטית

### בעיה: Cron Job לא יכול להעלות קבצים ל-WordPress

**פתרון: שמירה ישירה למיקום WordPress**

עדכן את `spread_detector.py` לשמור ישירות למיקום הנכון:

```python
def save_to_json(self, data: Dict, filename: str = "spread_data.json"):
    """Save results to JSON file"""
    try:
        # Save to local data directory
        local_path = f"data/{filename}"
        with open(local_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        # Also save directly to WordPress location
        wp_path = "/home/cointasu/public_html/wp-content/uploads/coinnavigator/data/spread_data.json"
        with open(wp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"\nResults saved to {local_path} and {wp_path}")
        return wp_path
    except Exception as e:
        print(f"Error saving to JSON: {e}")
        return None
```

---

## שלב 4: בדיקה

### 4.1: הרצה ידנית

1. **cPanel > Terminal** (אם יש)
2. הרץ:
   ```bash
   cd ~/CoinNavigator
   source venv/bin/activate
   python src/spread_detector.py
   ```

### 4.2: בדיקת Cron Job

1. **cPanel > Cron Jobs**
2. בדוק את ה-Log (אם יש)
3. או בדוק את הקובץ:
   ```bash
   cat ~/CoinNavigator/logs/runner.log
   ```

---

## פתרון בעיות

### Cron Job לא רץ:
- בדוק שהנתיבים נכונים
- בדוק הרשאות לקובץ (chmod +x)
- בדוק את הלוגים

### JSON לא מתעדכן:
- בדוק שהסקריפט רץ
- בדוק הרשאות כתיבה
- בדוק שהנתיב נכון

---

## הערות חשובות

1. **נתיבים:** וודא שהנתיבים נכונים (תלוי בשרת)
2. **הרשאות:** וודא שיש הרשאות כתיבה
3. **Python:** וודא ש-Python 3 מותקן בשרת
4. **venv:** וודא שה-venv נוצר בשרת

---

**מוכן? בואו נתחיל!** 🚀




