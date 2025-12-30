# 📥 CoinNavigator - הטמעת Landing Page ב-WordPress

## שלב 1: הכנת הקוד

### אפשרות A: שימוש בתבנית שיצרתי (מומלץ)

1. **פתח את הקובץ:**
   ```
   /Users/andreigurevich/Desktop/CoinNavigator/landing-page-template.html
   ```

2. **העתק את כל התוכן** (Cmd+A, Cmd+C)

---

## שלב 2: הטמעה ב-WordPress

### חלק 1: הוספת HTML

1. **WordPress Admin > Pages > Edit** (ערוך את העמוד הראשי)
2. **מחק את כל התוכן הקיים** (או שמור כטיוטה)
3. **הוסף Custom HTML Block:**
   - לחץ "+" או הקלד `/html`
   - בחר "Custom HTML"
4. **הדבק את כל ה-HTML** מהתבנית
5. **שמור כטיוטה** (עדיין לא לפרסם)

---

### חלק 2: החלפת Placeholder ב-Shortcode

1. **בתוך ה-HTML, מצא את השורה:**
   ```html
   <div class="data-table-placeholder">
       <p>[coinnavigator_spread]</p>
   ```
2. **מחק את כל ה-`<div class="data-table-placeholder">` כולל התוכן**
3. **הוסף Shortcode Block במקום:**
   - לחץ "+" או הקלד `/shortcode`
   - בחר "Shortcode"
   - הקלד: `[coinnavigator_spread]`

---

### חלק 3: הוספת CSS

1. **WordPress Admin > Appearance > Customize**
2. **לחץ "Additional CSS"**
3. **העתק את כל ה-CSS** מתוך ה-HTML (בין `<style>` ל-`</style>`)
4. **הדבק ב-Additional CSS**
5. **לחץ "Publish"**

---

## שלב 3: בדיקה

1. **פתח את האתר:** `https://coinnavigator.net`
2. **בדוק:**
   - האם העיצוב נכון?
   - האם הטבלה מופיעה?
   - האם זה Responsive? (בדוק במובייל)

---

## סיכום — מה לעשות עכשיו

1. **פתח:** `landing-page-template.html`
2. **העתק את כל התוכן**
3. **WordPress > Pages > Edit (עמוד ראשי)**
4. **הוסף Custom HTML Block → הדבק HTML**
5. **החלף את ה-placeholder ב-Shortcode Block**
6. **Appearance > Customize > Additional CSS → הדבק CSS**
7. **שמור ופרסם**

---

**מוכן? בואו נתחיל!** 🚀





