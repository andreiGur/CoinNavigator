# CoinNavigator WordPress Integration

הנחיות להעלאת והתקנת קבצי PHP באתר וורדפרס.

## קבצים

1. **`api-endpoint.php`** - API endpoint לקריאת JSON
2. **`shortcode.php`** - קוד shortcode להצגה בעמודים
3. **`shortcode-table-template.php`** - תבנית טבלה
4. **`shortcode-cards-template.php`** - תבנית כרטיסים

## התקנה

### שלב 1: העלאת קבצי JSON לשרת

1. העלה את תיקיית `data/` לשרת שלך
2. מיקום מומלץ: `/wp-content/uploads/coinnavigator/data/`
3. או: בתיקיית הפרויקט מחוץ ל-WordPress

### שלב 2: התקנת API Endpoint

**אפשרות A: בתיקיית WordPress root**
- העלה את `api-endpoint.php` לתיקיית ה-root של וורדפרס
- גישה: `https://coinnavigator.net/api-endpoint.php`
- עדכן את `$json_path` בקובץ לפי המיקום שלך

**אפשרות B: בתיקיית uploads**
- העלה את `api-endpoint.php` ל-`/wp-content/uploads/coinnavigator/`
- גישה: `https://coinnavigator.net/wp-content/uploads/coinnavigator/api-endpoint.php`

### שלב 3: התקנת Shortcode

**שיטה 1: דרך functions.php של התבנית**
1. פתח `Appearance > Theme Editor > functions.php`
2. העתק את כל התוכן מ-`shortcode.php`
3. הדבק בסוף הקובץ
4. העלה את קבצי התבנית (`shortcode-table-template.php` ו-`shortcode-cards-template.php`) לאותה תיקייה

**שיטה 2: יצירת Plugin מותאם אישית (מומלץ)**
1. צור תיקייה: `/wp-content/plugins/coinnavigator/`
2. העלה את כל הקבצים לתיקייה
3. צור קובץ `coinnavigator.php` עם header של plugin:

```php
<?php
/**
 * Plugin Name: CoinNavigator Spread Detector
 * Description: Displays cryptocurrency spread data
 * Version: 1.0
 */

require_once __DIR__ . '/shortcode.php';
```

4. הפעל את ה-plugin דרך `Plugins > Installed Plugins`

### שלב 4: עדכון נתיבי קבצים

בקובץ `shortcode.php`, עדכן את `$json_path` לפי המיקום שלך:

```php
// אם JSON בתיקיית uploads:
$json_path = WP_CONTENT_DIR . '/uploads/coinnavigator/data/spread_data.json';

// אם JSON מחוץ ל-WordPress:
$json_path = ABSPATH . '../data/spread_data.json';
```

## שימוש

### Shortcode בסיסי
```
[coinnavigator_spread]
```

### Shortcode עם פרמטרים
```
[coinnavigator_spread symbol="BTCUSDT" style="cards"]
[coinnavigator_spread symbol="ETHUSDT" style="table"]
```

**פרמטרים:**
- `symbol`: `BTCUSDT`, `ETHUSDT`, או `all` (ברירת מחדל)
- `style`: `table` (ברירת מחדל) או `cards`

## אוטומציה - הרצת הסקריפט

### שיטה 1: Cron Job בשרת

צור cron job שיריץ את הסקריפט כל X דקות:

```bash
# ערוך את crontab
crontab -e

# הוסף שורה להרצה כל 5 דקות:
*/5 * * * * cd /path/to/CoinNavigator && /path/to/venv/bin/python src/spread_detector.py

# או כל 15 דקות:
*/15 * * * * cd /path/to/CoinNavigator && /path/to/venv/bin/python src/spread_detector.py
```

### שיטה 2: WordPress Cron

ניתן ליצור WordPress cron hook שיקרא לסקריפט דרך HTTP או SSH.

## בדיקה

1. הרץ את הסקריפט Python מקומית
2. העלה את `spread_data.json` לשרת
3. בדוק את ה-API: `https://coinnavigator.net/api-endpoint.php`
4. הוסף shortcode לעמוד: `[coinnavigator_spread]`
5. צפה בעמוד - הנתונים אמורים להופיע

## פתרון בעיות

**"Spread data not available"**
- וודא ש-`spread_data.json` קיים במיקום הנכון
- בדוק הרשאות קריאה לקובץ (chmod 644)

**"Invalid data format"**
- וודא שה-JSON תקין
- בדוק שהסקריפט Python רץ בהצלחה

**Shortcode לא מופיע**
- וודא שהקוד נוסף ל-`functions.php` או שה-plugin מופעל
- בדוק שאין שגיאות PHP (בדוק error logs)


