# מטרה: $10 ראשונים — תוכנית פעולה

**עדכון:** יוני 2026  
**מודל:** Affiliate (בורסות) קודם · AdSense אחרי אישור · אימייל לטראפיק חוזר

---

## למה $0 עד עכשיו (בקצרה)

1. טבלת spreads הייתה **שבורה** (באג JS) — תוקן.
2. אין מספיק **תנועה** → אין קליקים על לינקי שותפים.
3. חלק מהלינקים לא נבדקו בדשבורד השותפים (MEXC וכו').
4. פרסומות **מוכנות אבל כבויות** עד שיש `ca-pub` אמיתי מאישור AdSense.

---

## מה שינינו בקוד (ספרינט הכנסה)

| שכבה | מה |
|------|-----|
| `assets/js/affiliate-links.js` | מקור אחד לכל לינקי Binance / MEXC / Bybit / OKX / KuCoin / Gate + UTM |
| `dashboard-table.js` | באנר "trade top spread" + לינקים מהמקור המרכזי |
| `index.html` | כפתורי בונוסים מחווטים ל-`data-cn-affiliate`, באנר הכנסה, sticky bar עם שם בורסה |
| GA4 | אירוע `affiliate_click` כבר קיים — סמן כ-Conversion ב-GA4 |

---

## KPI שבועיים (לפני כסף)

ב-[GA4](https://analytics.google.com) → Reports → Events:

| מדד | יעד שבוע 1 |
|-----|------------|
| `affiliate_click` | ≥ 5 |
| `rec_exchange` / `revenue_banner_trade` / `sticky_bar_trade` | לפחות 1 מכל מיקום |
| משתמשים פעילים | ≥ 30 (אורגני או מפוסט אחד) |

**$10 מ-affiliate** = בדרך כלל **מישהו אחד** שנרשם דרך הלינק וסוחר (תלוי תוכנית הבורסה). לא צריך אלפי מבקרים — צריך **מבקרים נכונים + לינק שעובד**.

---

## שבוע 1 — מה לעשות (אתה / שיווק)

### יום 1–2: וידוא צינור
- [ ] פתח [coinnavigator.net](https://www.coinnavigator.net) — הטבלה מלאה?
- [ ] לחץ "Open Binance" מתחת לטבלה — נפתח עם `ref=308417308`?
- [ ] בדשבורד Binance Affiliate — יש קליקים?
- [ ] אותו דבר ל-MEXC / Bybit אם יש גישה

### יום 3: תנועה אחת ממוקדת
פוסט אחד (Reddit / X / Telegram), לא עשרה מאמרים:

> "Built a free tool that shows live crypto arbitrage spreads across 6 CEXes (no signup).  
> Example right now: [coin] X% between [A] and [B].  
> https://www.coinnavigator.net/#dashboard"

קבוצות רלוונטיות: r/CryptoCurrency (בדוק rules), r/CryptoMarkets, קבוצות arb בעברית/אנגלית.

### יום 4–7: מדידה
- אם `affiliate_click` = 0 → בעיית **תנועה**
- אם קליקים יש, $0 בדשבורד שותפים → בעיית **המרה/לינק**

---

## פרסומות (AdSense) — למה כבוי ואיך להדליק

**למה כבוי היום:**
1. אין Publisher ID אמיתי — ב-`index.html` עדיין `ca-pub-XXXXXXXXXXXXXXXX`.
2. סקריפט AdSense **בהערה** (לא נטען).
3. CSS: `.ad-slot { display: none }` עד שמוסיפים class `ad-enabled` על `<html>` — כדי שלא יוצגו מלבנים ריקים לפני אישור Google.

**אחרי אישור AdSense:**
1. החלף `ca-pub-XXXXXXXXXXXXXXXX` ב-ID האמיתי.
2. בטל הערה על שורת `adsbygoogle.js` ב-`index.html`.
3. בטל הערה על `<ins class="adsbygoogle">` בתוך `.ad-slot-inner` (header + mid).
4. הוסף ל-`<html>`: `class="ad-enabled"` (או עדכן CSS להדליק אוטומטית כשיש pub id).

**סדר עדיפות:** קודם affiliate עד $10–50/חודש, אחר כך AdSense (דורש תנועה + אישור).

---

## שלב 2 (אחרי $10)

- [ ] סמן `affiliate_click` כ-Key event / Conversion ב-GA4
- [ ] מאמר אחד עם כוונת קנייה: "Binance vs MEXC arbitrage 2026" + CTA לטבלה
- [ ] בדיקת לינק MEXC מדפדפן (לא רק curl — MEXC חוסם בוטים)
- [ ] Telegram / ניוזלטר שבועי עם top-3 spreads (כבר יש Formspree)

---

## קבצים לזכור

- לינקים: `assets/js/affiliate-links.js`
- טבלה + באנר: `assets/js/dashboard-table.js`
- מקומות פרסומת: `index.html` → `.ad-slot` (header, mid)
