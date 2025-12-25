# מדריך העלאה לשרת - CoinNavigator

מדריך צעד-אחר-צעד להעלאת הפרויקט לאתר coinnavigator.net

## שלב 1: הכנת הקבצים מקומית

### ✅ בדיקה שהכל עובד מקומית

```bash
# וודא שאתה בתיקיית הפרויקט
cd /Users/andreigurevich/Desktop/CoinNavigator

# הפעל את ה-venv
source venv/bin/activate

# הרץ את הסקריפט
python src/spread_detector.py

# וודא שנוצר קובץ JSON
ls -la data/spread_data.json
```

אם הכל עובד - המשך לשלב הבא.

---

## שלב 2: העלאת קבצי WordPress

### אפשרות A: דרך FTP/SFTP (FileZilla, Cyberduck, וכו')

1. **התחבר לשרת שלך** דרך FTP/SFTP
2. **נווט לתיקיית plugins:**
   ```
   /wp-content/plugins/
   ```
3. **צור תיקייה חדשה:**
   ```
   coinnavigator
   ```
4. **העלה את כל הקבצים מתיקיית `wordpress/` לתיקייה החדשה:**
   - `coinnavigator-plugin.php`
   - `shortcode.php`
   - `shortcode-table-template.php`
   - `shortcode-cards-template.php`
   - `api-endpoint.php` (אופציונלי)

**מבנה סופי בשרת:**
```
/wp-content/plugins/coinnavigator/
├── coinnavigator-plugin.php
├── shortcode.php
├── shortcode-table-template.php
├── shortcode-cards-template.php
└── api-endpoint.php
```

### אפשרות B: דרך WordPress Admin (ZIP)

1. **צור קובץ ZIP** מתיקיית `wordpress/`
2. **היכנס ל-WordPress Admin:**
   - `Plugins > Add New > Upload Plugin`
3. **העלה את קובץ ה-ZIP**
4. **הפעל את ה-plugin**

---

## שלב 3: העלאת קובץ JSON לשרת

### מיקום מומלץ: תיקיית uploads

1. **צור תיקיות בשרת:**
   ```
   /wp-content/uploads/coinnavigator/data/
   ```
2. **העלה את הקובץ:**
   ```
   data/spread_data.json → /wp-content/uploads/coinnavigator/data/spread_data.json
   ```

**או דרך FTP:**
- נווט ל-`/wp-content/uploads/`
- צור תיקייה `coinnavigator`
- בתוכה צור תיקייה `data`
- העלה את `spread_data.json` לתיקיית `data`

---

## שלב 4: עדכון נתיבים בקוד

### עדכן את `shortcode.php`

1. **פתח את הקובץ בשרת:**
   ```
   /wp-content/plugins/coinnavigator/shortcode.php
   ```

2. **מצא את השורה:**
   ```php
   $json_path = ABSPATH . '../data/spread_data.json';
   ```

3. **החלף לפי המיקום שלך:**

   **אם JSON בתיקיית uploads:**
   ```php
   $json_path = WP_CONTENT_DIR . '/uploads/coinnavigator/data/spread_data.json';
   ```

   **אם JSON בתיקיית הפרויקט (מחוץ ל-WordPress):**
   ```php
   $json_path = ABSPATH . '../CoinNavigator/data/spread_data.json';
   ```

### עדכן את `api-endpoint.php` (אם משתמש)

1. **פתח את הקובץ:**
   ```
   /wp-content/plugins/coinnavigator/api-endpoint.php
   ```

2. **עדכן את `$json_path`** לפי המיקום שלך:
   ```php
   $json_path = WP_CONTENT_DIR . '/uploads/coinnavigator/data/spread_data.json';
   ```

---

## שלב 5: הפעלת Plugin ב-WordPress

1. **היכנס ל-WordPress Admin:**
   ```
   https://coinnavigator.net/wp-admin
   ```

2. **נווט ל-Plugins:**
   ```
   Plugins > Installed Plugins
   ```

3. **מצא את "CoinNavigator Spread Detector"**

4. **לחץ על "Activate"**

5. **בדוק את ההגדרות:**
   ```
   Settings > CoinNavigator
   ```
   - אמור לראות סטטוס של קובץ ה-JSON
   - אם יש שגיאה - בדוק את הנתיבים

---

## שלב 6: בדיקה באתר

### בדיקת API Endpoint (אופציונלי)

פתח בדפדפן:
```
https://coinnavigator.net/wp-content/plugins/coinnavigator/api-endpoint.php
```

אמור לראות JSON עם הנתונים.

### בדיקת Shortcode

1. **צור עמוד חדש או ערוך עמוד קיים:**
   ```
   Pages > Add New
   ```

2. **הוסף shortcode:**
   ```
   [coinnavigator_spread]
   ```

3. **שמור וצפה בעמוד**

4. **אמור לראות טבלה עם נתוני Spread**

### בדיקת Shortcode עם פרמטרים

נסה גם:
```
[coinnavigator_spread symbol="BTCUSDT" style="cards"]
```

---

## שלב 7: הגדרת אוטומציה (אופציונלי)

### אם יש לך גישה ל-SSH:

1. **התחבר לשרת:**
   ```bash
   ssh user@coinnavigator.net
   ```

2. **העלה את כל הפרויקט לשרת:**
   ```bash
   # דרך SCP
   scp -r /Users/andreigurevich/Desktop/CoinNavigator user@coinnavigator.net:/path/to/
   ```

3. **הגדר cron job:**
   ```bash
   crontab -e
   ```

4. **הוסף שורה (כל 15 דקות):**
   ```cron
   */15 * * * * cd /path/to/CoinNavigator && /path/to/CoinNavigator/run_spread_detector.sh
   ```

5. **העלה JSON אוטומטית למיקום הנכון:**
   - עדכן את `run_spread_detector.sh` להוסיף העתקה ל-`/wp-content/uploads/coinnavigator/data/`

### אם אין גישה ל-SSH:

- תוכל להריץ את הסקריפט מקומית
- להעלות את ה-JSON ידנית דרך FTP
- או להשתמש ב-GitHub Actions (ראה `AUTOMATION.md`)

---

## פתרון בעיות נפוצות

### ❌ "Spread data not available"
**פתרון:**
- וודא ש-`spread_data.json` קיים במיקום הנכון
- בדוק הרשאות קריאה (chmod 644)
- בדוק את הנתיב ב-`shortcode.php`

### ❌ Shortcode לא מופיע
**פתרון:**
- וודא שה-plugin מופעל
- בדוק שאין שגיאות PHP (בדוק error logs)
- נסה shortcode פשוט: `[coinnavigator_spread]`

### ❌ "Invalid data format"
**פתרון:**
- וודא שה-JSON תקין (פתח אותו ובדוק)
- הרץ את הסקריפט Python שוב
- וודא שהקובץ לא פגום

### ❌ Plugin לא מופיע
**פתרון:**
- וודא שהקבצים במיקום הנכון
- בדוק שיש `coinnavigator-plugin.php` בתיקיית plugin
- בדוק הרשאות קבצים

---

## סיכום - רשימת פעולות

- [ ] הרצת הסקריפט מקומית ובדיקה שהוא עובד
- [ ] העלאת קבצי WordPress לשרת (תיקיית plugins)
- [ ] העלאת `spread_data.json` לשרת
- [ ] עדכון נתיבים ב-`shortcode.php`
- [ ] הפעלת Plugin ב-WordPress
- [ ] בדיקת shortcode בעמוד
- [ ] הגדרת אוטומציה (אופציונלי)

---

## צעדים הבאים אחרי שהכל עובד

1. **שיפור עיצוב** - התאמת ה-CSS לתבנית Astra
2. **הוספת בורסות** - Coinbase, Kraken, וכו'
3. **הוספת מטבעות** - עוד מטבעות מלבד BTC/ETH
4. **אופטימיזציה** - caching, CDN, וכו'
5. **SEO** - תיוג נכון, meta tags, וכו'

---

**שאלות?** בדוק את `wordpress/README.md` ו-`AUTOMATION.md` לפרטים נוספים.


