# CoinNavigator - Automation Guide

מדריך להגדרת הרצה אוטומטית של סקריפט Python בשרת.

## שיטות אוטומציה

### שיטה 1: Cron Job (מומלץ)

Cron Job הוא הדרך הסטנדרטית להרצת סקריפטים אוטומטית בשרת Linux/Mac.

#### שלב 1: מצא את נתיבי Python

```bash
# מצא את נתיב ה-venv שלך
which python3
# או
which python

# מצא את נתיב הסקריפט
pwd  # בתיקיית הפרויקט
```

#### שלב 2: צור סקריפט wrapper

צור קובץ `run_spread_detector.sh`:

```bash
#!/bin/bash
cd /path/to/CoinNavigator
source venv/bin/activate
python src/spread_detector.py
```

הפוך אותו לביצועי:
```bash
chmod +x run_spread_detector.sh
```

#### שלב 3: הגדר Cron Job

```bash
# פתח את crontab לעריכה
crontab -e

# הוסף שורה אחת מהאפשרויות הבאות:
```

**הרצה כל 5 דקות:**
```cron
*/5 * * * * /path/to/CoinNavigator/run_spread_detector.sh >> /path/to/CoinNavigator/logs/cron.log 2>&1
```

**הרצה כל 15 דקות:**
```cron
*/15 * * * * /path/to/CoinNavigator/run_spread_detector.sh >> /path/to/CoinNavigator/logs/cron.log 2>&1
```

**הרצה כל שעה:**
```cron
0 * * * * /path/to/CoinNavigator/run_spread_detector.sh >> /path/to/CoinNavigator/logs/cron.log 2>&1
```

**הרצה כל יום בשעה 00:00:**
```cron
0 0 * * * /path/to/CoinNavigator/run_spread_detector.sh >> /path/to/CoinNavigator/logs/cron.log 2>&1
```

#### שלב 4: בדיקת Cron Job

```bash
# בדוק את ה-crontab שלך
crontab -l

# בדוק את הלוגים
tail -f /path/to/CoinNavigator/logs/cron.log
```

### שיטה 2: Systemd Timer (Linux)

אם אתה משתמש ב-systemd, אפשר ליצור timer:

**צור קובץ `/etc/systemd/system/coinnavigator.service`:**
```ini
[Unit]
Description=CoinNavigator Spread Detector
After=network.target

[Service]
Type=oneshot
User=your-username
WorkingDirectory=/path/to/CoinNavigator
ExecStart=/path/to/CoinNavigator/venv/bin/python /path/to/CoinNavigator/src/spread_detector.py
```

**צור קובץ `/etc/systemd/system/coinnavigator.timer`:**
```ini
[Unit]
Description=Run CoinNavigator every 15 minutes
Requires=coinnavigator.service

[Timer]
OnCalendar=*:0/15
Persistent=true

[Install]
WantedBy=timers.target
```

**הפעל את ה-timer:**
```bash
sudo systemctl enable coinnavigator.timer
sudo systemctl start coinnavigator.timer
sudo systemctl status coinnavigator.timer
```

### שיטה 3: WordPress Cron Hook

אם אתה רוצה להשתמש ב-WordPress cron:

**צור קובץ PHP שיקרא לסקריפט:**

```php
<?php
// wp-content/mu-plugins/coinnavigator-cron.php

add_action('coinnavigator_update_spread', 'coinnavigator_run_script');

function coinnavigator_run_script() {
    $script_path = '/path/to/CoinNavigator/src/spread_detector.py';
    $venv_python = '/path/to/CoinNavigator/venv/bin/python';
    
    // Run script via shell
    exec("$venv_python $script_path 2>&1", $output, $return_var);
    
    // Log results
    error_log('CoinNavigator: ' . implode("\n", $output));
}

// Schedule event (runs every 15 minutes)
if (!wp_next_scheduled('coinnavigator_update_spread')) {
    wp_schedule_event(time(), '15min', 'coinnavigator_update_spread');
}
```

**הוסף interval מותאם:**
```php
add_filter('cron_schedules', 'coinnavigator_cron_intervals');
function coinnavigator_cron_intervals($schedules) {
    $schedules['15min'] = array(
        'interval' => 15 * 60,
        'display' => 'Every 15 Minutes'
    );
    return $schedules;
}
```

### שיטה 4: GitHub Actions (אם הפרויקט ב-GitHub)

אם אתה משתמש ב-GitHub, אפשר להריץ דרך Actions:

**.github/workflows/update-spread.yml:**
```yaml
name: Update Spread Data

on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.x'
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
      - name: Run spread detector
        run: |
          python src/spread_detector.py
      - name: Upload JSON to server
        # Add step to upload JSON to your WordPress server
        # using FTP, SCP, or API
```

## העלאת JSON לשרת אוטומטית

אם הסקריפט רץ מקומית או בשרת אחר, צריך להעלות את ה-JSON לשרת וורדפרס:

### שיטה 1: SCP/RSYNC

```bash
# הוסף ל-run_spread_detector.sh אחרי הרצת הסקריפט:
scp data/spread_data.json user@coinnavigator.net:/path/to/wp-content/uploads/coinnavigator/data/
```

### שיטה 2: FTP/SFTP Script

```bash
#!/bin/bash
# upload_json.sh

HOST="ftp.coinnavigator.net"
USER="your-username"
PASS="your-password"
REMOTE_DIR="/wp-content/uploads/coinnavigator/data/"

lftp -u $USER,$PASS $HOST <<EOF
cd $REMOTE_DIR
put data/spread_data.json
bye
EOF
```

### שיטה 3: WordPress REST API

אם יש לך plugin שיכול לקבל JSON דרך API:

```bash
curl -X POST https://coinnavigator.net/wp-json/coinnavigator/v1/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d @data/spread_data.json
```

## בדיקה ואימות

1. **בדוק שהסקריפט רץ:**
   ```bash
   python src/spread_detector.py
   ```

2. **בדוק שה-JSON נוצר:**
   ```bash
   cat data/spread_data.json
   ```

3. **בדוק שהקובץ עלה לשרת:**
   ```bash
   ssh user@coinnavigator.net "cat /path/to/spread_data.json"
   ```

4. **בדוק את ה-API endpoint:**
   ```bash
   curl https://coinnavigator.net/api-endpoint.php
   ```

## פתרון בעיות

**Cron לא רץ:**
- בדוק שהנתיבים נכונים (השתמש בנתיבים מוחלטים)
- בדוק הרשאות לקובץ
- בדוק את הלוגים: `grep CRON /var/log/syslog`

**JSON לא מתעדכן:**
- בדוק שהסקריפט רץ בהצלחה
- בדוק הרשאות כתיבה לתיקיית `data/`
- בדוק חיבור לאינטרנט

**WordPress לא מציג נתונים:**
- וודא שה-JSON במיקום הנכון
- בדוק הרשאות קריאה לקובץ
- בדוק את error logs של PHP

## המלצות

- **תדירות:** 5-15 דקות זה מספיק טוב לרוב המקרים
- **לוגים:** שמור לוגים לניפוי באגים
- **Backup:** שמור גיבוי של ה-JSON
- **Monitoring:** הוסף התראות אם הסקריפט נכשל


