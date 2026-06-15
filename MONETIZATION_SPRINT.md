# ספרינט מונטיזציה — CoinNavigator

**מטרה:** הכנסה ראשונה (מ-$10 ומעלה)  
**מצב נוכחי:** ~127 משתמשים/שבוע · $0 · תשתית affiliate + פרסומות מוכנה

---

## ערוצי הכנסה — דירוג לפי מהירות לכסף

| # | ערוץ | פוטנציאל ($/חודש בנפח נוכחי) | זמן להכנסה | מצב באתר |
|---|------|------------------------------|------------|----------|
| 1 | **Affiliate בורסות** (Binance, MEXC, Bybit) | $10–200 אם יש 1–3 הרשמות פעילות | שבועות | ✅ מוטמע — צריך תנועה + לינקים תקינים |
| 2 | **Polymarket referral** (`via=Bn0AqAs`) | $5–50 | שבועות | ✅ בבלוג ו-Polymarket hub |
| 3 | **פרסומות Display** (AdSense / רשת קריפטו) | $1–15 ב-~500 צפיות/חודש | ימים–שבועות אחרי אישור | 🟡 תשתית מוכנה — `ads-config.js` |
| 4 | **תוכן ממוקד המרה** | מכפיל affiliate | 2–4 שבועות SEO | 🟡 יש 28 מאמרים — חסר CTA אחיד |
| 5 | **API בתשלום** | $20–100+ | חודשים | 🟡 waitlist ב-`/api/` |
| 6 | **Sponsor slot** ("Featured exchange") | $50–300/חודש ישיר | חודשים | ❌ לא קיים |
| 7 | **ניוזלטר ממונטז** | איטי | חודשים | 🟡 Formspree בלבד |

**המלצה:** שלושה ערוצים במקביל — **Affiliate + פרסומות + Polymarket** — לא לבחור רק אחד.

---

## שלב 1 — פרסומות (השבוע)

### אופציה א: Google AdSense (מומלץ לטווח ארוך)

1. הגש בקשה: [google.com/adsense](https://www.google.com/adsense) עם `https://www.coinnavigator.net`
2. ודא: Privacy Policy, About, תוכן מקורי (יש)
3. אחרי אישור — ערוך `assets/js/ads-config.js`:
   ```js
   enabled: true,
   mode: 'auto',
   adsense: { client: 'ca-pub-המספר-שלך', slots: { ... } }
   ```
4. Deploy — פרסומות יופיעו אוטומטית (Auto ads) או ב-slots בדף הבית

### אופציה ב: רשת קריפטו (מהיר יותר לאישור, CPM נמוך)

בזמן המתנה ל-AdSense:

- [Coinzilla](https://coinzilla.com) — באנרים לנישת crypto
- [A-Ads](https://a-ads.com) — Bitcoin ad network, סף נמוך

הדבק את `scriptSrc` ב-`ads-config.js` → `altNetwork.enabled: true`

### איפה הפרסומות באתר

| מיקום | קובץ | `data-ad-slot` |
|-------|------|----------------|
| מתחת ל-header | `index.html` | `header` |
| אחרי טבלת spreads | `index.html` | `mid` |
| (עתידי) בלוג | `assets/snippets/ad-slot.html` | להעתיק למאמרים |

---

## שלב 2 — Affiliate (הכי קרוב ל-$10)

**מתמטיקה עם 127 משתמשים/שבוע:**

- 3–5% לוחצים לינק שותף ≈ 4–6 קליקים/שבוע  
- 5–15% מהם נרשמים ≈ 0–1 הרשמה/שבוע  
- **$10** = בדרך כלל **הרשמה אחת** שמפקידה וסוחרת על Binance/MEXC

**פעולות:**

1. GA4 → Events → `affiliate_click` — אם 0, הבעיה תנועה/CTA
2. בדשבורד Binance Affiliate — וודא שקליקים נספרים
3. תקן MEXC אם 404 (בדפדפן, לא curl)
4. פוסט **אחד** בשבוע עם לינק לטבלה החיה

**CTAs שכבר באתר:** טבלה, באנר ירוק, sticky bar, כפתורי בונוסים — ראה `affiliate-links.js`

---

## שלב 3 — Polymarket (מונטיזציה שכבר קיימת)

לינק: `https://polymarket.com?via=Bn0AqAs`

- חזק בדפי `/polymarket/` והמאמרים על prediction markets
- הוסף CTA קצר בסוף **כל** מאמר בלוג (לא רק PM): "See what markets expect →"

---

## שלב 4 — תוכן שמוכר (לא רק תנועה)

3 מאמרים עם כוונת רכישה — עדכן CTA לטבלה + affiliate:

1. `binance-vs-mexc/` — כבר קיים
2. `blog/how-to-make-money-on-crypto-arbitrage-2026-top-5-spreads-today/`
3. `arbitrage-calculator/` — מחשבון + "ראה spreads חיים"

---

## שלב 5 — הכנסה מתקדמת (אחרי $50/חודש)

| רעיון | תיאור |
|-------|--------|
| **API Pro** | $9/חודש ל-webhook spreads — רשימת המתנה ב-`/api/` |
| **Telegram Premium** | התראות spread >0.3% — $5/חודש |
| **Sponsored exchange** | "Featured this week" — $100/חודש לבורסה |
| **Lead gen** | מכירת לידים לבוטי ארביטראז' (זהירות משפטית) |

---

## KPI לספרינט (4 שבועות)

| שבוע | יעד |
|------|-----|
| 1 | AdSense מוגש או רשת קריפטו מחוברת · `affiliate_click` ≥ 5 |
| 2 | 200 משתמשים/שבוע · לינק MEXC מאומת |
| 3 | `$1` ראשון (ads או affiliate) |
| 4 | `$10` מצטבר · Conversion מוגדר ב-GA4 |

---

## קבצים טכניים

```
assets/js/ads-config.js   ← הדלקת פרסומות (עריכה ידנית)
assets/js/ads-boot.js     ← טוען AdSense / רשת חלופית
assets/css/ads.css
assets/js/affiliate-links.js
REVENUE_FIRST_10.md
```

**הדלקת פרסומות בפקודה אחת אחרי אישור:**  
`enabled: true` + `client: 'ca-pub-...'` ב-`ads-config.js` → commit → Vercel.
