# 📥 CoinNavigator - חילוץ קוד מ-Base44

## שלב 1: חילוץ HTML

1. **פתח את הקישור:**
   ```
   https://coin-navigator-9cc11b2e.base44.app/
   ```

2. **לחץ ימני על הדף** → "View Page Source"
   - או: Cmd+Option+U (Mac)
   - או: Ctrl+U (Windows)

3. **העתק את כל ה-HTML** (Cmd+A, Cmd+C)

4. **שמור במחשב:**
   - צור קובץ: `landing-page.html`
   - הדבק את ה-HTML

---

## שלב 2: חילוץ CSS

### שיטה 1: מתוך ה-HTML

1. **בקובץ ה-HTML, חפש:**
   - `<style>` - CSS בתוך ה-HTML
   - או `<link rel="stylesheet">` - קובץ CSS חיצוני

2. **אם יש `<style>`:**
   - העתק את כל התוכן בין `<style>` ל-`</style>`

3. **אם יש קובץ CSS חיצוני:**
   - לחץ על הקישור לקובץ CSS
   - העתק את כל התוכן

### שיטה 2: דרך Inspect

1. **לחץ ימני על הדף** → "Inspect" (או F12)

2. **בחלק Styles:**
   - חפש את כל ה-CSS
   - העתק את כל ה-Styles

---

## שלב 3: מציאת ה-Placeholder לטבלה

1. **בקובץ ה-HTML, חפש:**
   - `[DATA TABLE WILL BE INSERTED HERE]`
   - או `placeholder`
   - או אזור של טבלה/טבלה דמו

2. **סמן את המיקום** - שם נצטרך להוסיף את ה-Shortcode

---

## שלב 4: הכנת הקוד להטמעה

### 4.1: ניקוי הקוד

1. **הסר:**
   - Scripts חיצוניים (אם לא נחוצים)
   - Links ל-CSS חיצוניים (נשתמש ב-CSS שלנו)

2. **שמור:**
   - רק את ה-HTML הבסיסי
   - רק את ה-CSS הפנימי

### 4.2: החלפת Placeholder

1. **מצא את ה-Placeholder לטבלה**
2. **החלף ב:**
   ```
   [coinnavigator_spread]
   ```
   (או נשאיר מקום להוספה ב-WordPress)

---

## שלב 5: הטמעה ב-WordPress

### 5.1: הוספת HTML

1. **WordPress Admin > Pages > Edit** (עמוד ראשי)
2. **מחק תוכן קיים** (או שמור כטיוטה)
3. **הוסף Custom HTML Block:**
   - `/html` → בחר "Custom HTML"
4. **הדבק את ה-HTML** (ללא ה-Placeholder)
5. **במקום ה-Placeholder, הוסף Shortcode Block:**
   - `/shortcode` → בחר "Shortcode"
   - הקלד: `[coinnavigator_spread]`

### 5.2: הוספת CSS

1. **WordPress Admin > Appearance > Customize**
2. **Additional CSS**
3. **הדבק את כל ה-CSS**
4. **Publish**

---

## טיפים

- **שמור גיבוי** לפני שינויים
- **בדוק Responsive** - מובייל חשוב
- **אופטימיזציה** - ודא שהתמונות מותאמות
- **בדוק מהירות** - ודא שהאתר מהיר

---

**מוכן? בואו נתחיל!** 🚀







