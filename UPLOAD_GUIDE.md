# 📤 מדריך העלאה מפורט - CoinNavigator

## הבהרה חשובה: Namecheap vs Hosting

**Namecheap** = רק רישום דומיין (איפה הדומיין רשום)
**Hosting** = השרת עצמו (איפה האתר מאוחסן)

אתה צריך למצוא את **Hosting Provider** שלך (לא Namecheap).

---

## שלב 1: מציאת פרטי Hosting

### איפה השרת שלך?

**אפשרויות נפוצות:**
- **cPanel** (רוב החברות)
- **WordPress.com** (אם זה WordPress.com hosting)
- **Bluehost, HostGator, SiteGround** (חברות hosting נפוצות)
- **Cloudflare Pages, Vercel** (אם זה static hosting)

### איך למצוא?

1. **בדוק אימיילים** - חיפש "hosting", "cPanel", "FTP"
2. **בדוק Namecheap:**
   - היכנס ל-Namecheap
   - `Domain List` > בחר `coinnavigator.net`
   - בדוק ב-`Nameservers` - איפה הם מצביעים?
   - אם זה `nameserver1.hosting-provider.com` - זה ה-hosting שלך
3. **בדוק מייל** - חיפש "Welcome" או "Account Details"

---

## שלב 2: התחברות לשרת

### אפשרות A: דרך cPanel (הכי נפוץ)

1. **מצא את כתובת cPanel:**
   - בדרך כלל: `https://coinnavigator.net/cpanel`
   - או: `https://cpanel.coinnavigator.net`
   - או: כתובת שנתן ה-hosting provider

2. **התחבר עם שם משתמש וסיסמה:**
   - (אותם פרטים שקיבלת מה-hosting)

3. **מצא "File Manager":**
   - לחץ על "File Manager" ב-cPanel
   - נווט ל-`public_html` או `www`

### אפשרות B: דרך FTP Client (FileZilla, Cyberduck)

**צריך פרטים:**
- **FTP Host:** `ftp.coinnavigator.net` או `coinnavigator.net`
- **Username:** (מההosting)
- **Password:** (מההosting)
- **Port:** 21 (FTP) או 22 (SFTP)

**איפה למצוא?**
- ב-cPanel: `FTP Accounts`
- או באימייל מה-hosting

---

## שלב 3: העלאת קבצי WordPress

### דרך File Manager (cPanel)

1. **נווט לתיקייה:**
   ```
   public_html/wp-content/plugins/
   ```

2. **צור תיקייה חדשה:**
   - לחץ "New Folder"
   - שם: `coinnavigator`

3. **היכנס לתיקייה החדשה**

4. **העלה קבצים:**
   - לחץ "Upload"
   - גרור את הקבצים מתיקיית `wordpress/`:
     - `coinnavigator-plugin.php`
     - `shortcode.php`
     - `shortcode-table-template.php`
     - `shortcode-cards-template.php`

### דרך FTP Client (FileZilla)

1. **התחבר לשרת**

2. **נווט ל:**
   ```
   /public_html/wp-content/plugins/
   ```

3. **צור תיקייה:** `coinnavigator`

4. **גרור את הקבצים** מתיקיית `wordpress/` לתיקייה החדשה

---

## שלב 4: העלאת קובץ JSON

### דרך File Manager

1. **נווט ל:**
   ```
   public_html/wp-content/uploads/
   ```

2. **צור תיקיות:**
   - `coinnavigator` (אם לא קיימת)
   - `data` (בתוך coinnavigator)

3. **העלה את הקובץ:**
   - `data/spread_data.json` → `wp-content/uploads/coinnavigator/data/spread_data.json`

### דרך FTP

1. **נווט ל:**
   ```
   /public_html/wp-content/uploads/
   ```

2. **צור תיקיות** (אם לא קיימות):
   - `coinnavigator`
   - `data` (בתוך coinnavigator)

3. **העלה את הקובץ:**
   - גרור `spread_data.json` לתיקיית `data`

---

## שלב 5: דרך WordPress Admin (אם אין FTP)

### העלאת Plugin כ-ZIP

1. **צור קובץ ZIP:**
   - ב-Mac: בחר את תיקיית `wordpress/` > לחץ ימני > "Compress"
   - שם: `coinnavigator.zip`

2. **היכנס ל-WordPress:**
   - `https://coinnavigator.net/wp-admin`
   - `Plugins > Add New > Upload Plugin`

3. **העלה את ה-ZIP**

4. **הפעל את ה-plugin**

### העלאת JSON דרך Media Library

1. **WordPress Admin:**
   - `Media > Add New`

2. **העלה את `spread_data.json`**

3. **מצא את הנתיב:**
   - לחץ על הקובץ
   - העתק את ה-URL
   - זה יהיה משהו כמו: `/wp-content/uploads/2024/12/spread_data.json`

4. **העבר את הקובץ:**
   - דרך File Manager, העבר את הקובץ ל-`/wp-content/uploads/coinnavigator/data/`

---

## שלב 6: בדיקת הרשאות

### דרך File Manager

1. **בחר את הקובץ `spread_data.json`**
2. **לחץ "Change Permissions"**
3. **הגדר:** `644` (readable by all)
4. **שמור**

### דרך FTP

- הרשאות צריכות להיות: `644` או `755`

---

## פתרון בעיות

### "Cannot connect to FTP"
→ בדוק:
- כתובת ה-FTP נכונה?
- Port נכון? (21 ל-FTP, 22 ל-SFTP)
- Firewall חוסם?

### "Permission denied"
→ בדוק הרשאות קבצים (644)

### "Plugin not found"
→ וודא שהקבצים במיקום:
```
/wp-content/plugins/coinnavigator/
```

### "JSON not found"
→ וודא שהקובץ במיקום:
```
/wp-content/uploads/coinnavigator/data/spread_data.json
```

---

## סיכום - מה צריך להעלות

### קבצי Plugin:
```
wordpress/
├── coinnavigator-plugin.php
├── shortcode.php
├── shortcode-table-template.php
└── shortcode-cards-template.php
```
→ ל: `/wp-content/plugins/coinnavigator/`

### קובץ JSON:
```
data/spread_data.json
```
→ ל: `/wp-content/uploads/coinnavigator/data/spread_data.json`

---

## צעדים הבאים אחרי העלאה

1. **הפעל Plugin:** `Plugins > Installed Plugins > Activate`
2. **בדוק הגדרות:** `Settings > CoinNavigator`
3. **הוסף Shortcode:** `[coinnavigator_spread]` בעמוד
4. **צפה בתוצאה!** 🎉

---

**צריך עזרה נוספת?** תגיד לי איזה hosting provider יש לך או איך אתה מתחבר לשרת!


