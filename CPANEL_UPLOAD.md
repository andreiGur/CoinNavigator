# 📤 מדריך העלאה דרך cPanel - CoinNavigator

## שלב 1: התחברות ל-cPanel

1. **היכנס ל-cPanel:**
   ```
   https://server325.web-hosting.com:2083
   ```

2. **התחבר עם:**
   - **Username:** (מאימייל Welcome של Namecheap)
   - **Password:** (מאימייל Welcome של Namecheap)

   ⚠️ **חשוב:** זה לא שם המשתמש/סיסמה של WordPress!

---

## שלב 2: פתיחת File Manager

1. **ב-cPanel, מצא את "File Manager"**
   - בדרך כלל בחלק "Files"

2. **לחץ על "File Manager"**

3. **בחר את התיקייה:**
   - בחר `public_html` (או `www` - תלוי בשרת)
   - זה התיקייה הראשית של האתר

---

## שלב 3: העלאת Plugin

### 3.1: יצירת תיקיית Plugin

1. **נווט ל:**
   ```
   public_html/wp-content/plugins/
   ```

2. **צור תיקייה חדשה:**
   - לחץ על "New Folder" (או "Create Folder")
   - שם התיקייה: `coinnavigator`
   - לחץ "Create"

3. **היכנס לתיקייה החדשה** (לחץ עליה)

### 3.2: העלאת קבצי Plugin

**אפשרות A: העלאה דרך cPanel (מומלץ)**

1. **לחץ על "Upload"** (בחלק העליון)

2. **גרור את הקבצים** מתיקיית `wordpress/`:
   - `coinnavigator-plugin.php`
   - `shortcode.php`
   - `shortcode-table-template.php`
   - `shortcode-cards-template.php`
   - `api-endpoint.php` (אופציונלי)

3. **המתן לסיום ההעלאה**

**אפשרות B: העלאה כ-ZIP (אם יש בעיות)**

1. **העלה את `coinnavigator-plugin.zip`**

2. **לחץ על הקובץ > "Extract"**

3. **מחק את קובץ ה-ZIP** אחרי החילוץ

---

## שלב 4: העלאת קובץ JSON

### 4.1: יצירת תיקיות

1. **נווט ל:**
   ```
   public_html/wp-content/uploads/
   ```

2. **צור תיקיות:**
   - לחץ "New Folder"
   - שם: `coinnavigator`
   - לחץ "Create"
   
3. **היכנס לתיקייה `coinnavigator`**

4. **צור תיקייה נוספת:**
   - לחץ "New Folder"
   - שם: `data`
   - לחץ "Create"

5. **היכנס לתיקייה `data`**

### 4.2: העלאת קובץ JSON

1. **לחץ על "Upload"**

2. **העלה את הקובץ:**
   ```
   /Users/andreigurevich/Desktop/CoinNavigator/data/spread_data.json
   ```

3. **המתן לסיום ההעלאה**

---

## שלב 5: בדיקת הרשאות (חשוב!)

1. **בחר את הקובץ `spread_data.json`**

2. **לחץ ימני > "Change Permissions"** (או "Permissions")

3. **הגדר:**
   - **Read:** ✓ ✓ ✓ (כולם)
   - **Write:** ✓ (בעלים בלבד)
   - **Execute:** (לא צריך)

4. **הערך צריך להיות:** `644`

5. **לחץ "Change Permissions"**

---

## שלב 6: הפעלת Plugin ב-WordPress

1. **היכנס ל-WordPress Admin:**
   ```
   https://coinnavigator.net/wp-admin
   ```

2. **נווט ל:**
   ```
   Plugins > Installed Plugins
   ```

3. **מצא "CoinNavigator Spread Detector"**

4. **לחץ "Activate"**

---

## שלב 7: בדיקת הגדרות

1. **ב-WordPress Admin:**
   ```
   Settings > CoinNavigator
   ```

2. **אמור לראות:**
   - ✓ Data file found
   - Last updated: [תאריך]
   - Symbols: BTCUSDT, ETHUSDT

3. **אם לא - בדוק:**
   - שהקובץ במיקום: `/wp-content/uploads/coinnavigator/data/spread_data.json`
   - שההרשאות נכונות (644)

---

## שלב 8: הוספת Shortcode

1. **ב-WordPress Admin:**
   ```
   Pages > Add New
   ```
   (או ערוך עמוד קיים)

2. **הוסף shortcode:**
   ```
   [coinnavigator_spread]
   ```

3. **שמור וצפה בעמוד**

4. **אמור לראות טבלה עם נתוני Spread!** 🎉

---

## מבנה סופי בשרת

```
public_html/
└── wp-content/
    ├── plugins/
    │   └── coinnavigator/
    │       ├── coinnavigator-plugin.php
    │       ├── shortcode.php
    │       ├── shortcode-table-template.php
    │       └── shortcode-cards-template.php
    └── uploads/
        └── coinnavigator/
            └── data/
                └── spread_data.json (644)
```

---

## פתרון בעיות

### "Plugin not found"
→ וודא שהקבצים ב-`/wp-content/plugins/coinnavigator/`

### "Spread data not available"
→ בדוק שהקובץ ב-`/wp-content/uploads/coinnavigator/data/spread_data.json`
→ בדוק הרשאות (644)

### "Permission denied"
→ שנה הרשאות ל-644

---

**מוכן? בואו נתחיל!** 🚀


