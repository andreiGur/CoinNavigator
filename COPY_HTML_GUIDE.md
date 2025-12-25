# 📋 CoinNavigator - איך להעתיק HTML מ-Developer Tools

## שיטה 1: Copy Element (הכי פשוט)

1. **ב-Developer Tools, מצא את ה-`<body>` tag**
2. **לחץ ימני על `<body>`**
3. **בחר "Copy" → "Copy element"** (או "Copy outerHTML")
4. **הדבק במחשב** (Cmd+V)

---

## שיטה 2: Copy OuterHTML

1. **ב-Developer Tools, לחץ על `<body>`**
2. **לחץ ימני**
3. **בחר "Copy" → "Copy outerHTML"**
4. **הדבק במחשב**

---

## שיטה 3: View Page Source (הכי אמין)

1. **סגור את Developer Tools** (F12 או Cmd+Option+I)
2. **לחץ ימני על הדף** (לא על Developer Tools)
3. **בחר "View Page Source"** (או Cmd+Option+U)
4. **העתק את כל ה-HTML** (Cmd+A, Cmd+C)
5. **הדבק במחשב**

---

## שיטה 4: דרך Console

1. **פתח Console** (בחלק Developer Tools)
2. **הקלד:**
   ```javascript
   document.documentElement.outerHTML
   ```
3. **לחץ Enter**
4. **העתק את התוצאה**

---

## שיטה 5: Copy All (אם יש)

1. **ב-Developer Tools, לחץ ימני על `<html>`**
2. **בחר "Copy" → "Copy element"**
3. **הדבק במחשב**

---

## המלצה: View Page Source

**הכי פשוט ואמין:**

1. **סגור Developer Tools** (F12)
2. **לחץ ימני על הדף** (לא על Developer Tools!)
3. **"View Page Source"**
4. **העתק הכל** (Cmd+A, Cmd+C)

---

## אחרי שהעתקת:

1. **פתח קובץ חדש** במחשב: `landing-page.html`
2. **הדבק את ה-HTML**
3. **מחק את השורה עם `id="base44-edit-badge"`** (זה האלמנט שמשתנה)
4. **שמור**

---

**נסה את "View Page Source" - זה הכי פשוט!** 🚀


