# CoinNavigator Sprint Plan (14 Days)

## Sprint Goal
Move from zero revenue to first measurable monetization by improving conversion tracking, CTA funnel clarity, and high-intent page performance.

## North-Star Metrics (end of sprint)
- `affiliate_click` events per week: 40+
- Email leads per week: 15+
- Outbound exchange CTR from high-intent pages: 4%+
- First attributed partner signup (or clear signup proxy event)

## Day-by-Day Execution

### Days 1-2: Tracking Foundation (P0)
- Standardize conversion events on homepage:
  - `affiliate_click`
  - `outbound_exchange_click`
  - `lead_submit`
  - `contact_submit`
- Add consistent conversion parameters:
  - `source_page`, `region`, `exchange`, `symbol`, `cta_name`, `destination`
- Verify events in GA4 DebugView and Realtime.

### Days 3-4: Conversion Path Tightening
- Build a single “best next action” CTA logic on homepage sections.
- Reduce CTA ambiguity on commercial sections (one primary action, one secondary).
- Ensure all exchange links include working UTM structure and affiliate disclosure nearby.

### Days 5-6: High-Intent Page Upgrades
- Improve `binance-review`, `mexc-review`, `bybit-review`:
  - stronger trust section
  - concise “why this exchange for arbitrage” block
  - one dominant conversion CTA above the fold
- Add “Back to live monitor” smart internal link to retain flow.

### Days 7-8: Lead Capture + Nurture
- Launch lead magnet flow (email alert + concise promise).
- Add simple segmentation in forms (`beginner`, `active trader`, `researcher`).
- Track segmented lead submits as event params.

### Days 9-10: SEO-to-Revenue Bridge
- Add/refresh 2 high-intent pages:
  - exchange comparison with clear winner by use case
  - “best arbitrage route today” style landing
- Ensure each page has one clear commercial CTA and one trust CTA.

### Days 11-12: Retention + Return Visits
- Add non-intrusive return hooks:
  - “last viewed coin” shortcut
  - “new opportunities since your last visit” message
- Track returning-user conversion lift.

### Days 13-14: QA + Decision Review
- QA all commercial links and events.
- Review GA4 funnel:
  - page_view -> affiliate_click -> lead_submit -> outbound exchange
- Publish sprint summary with next 30-day targets.

## What we started now (this session)
- Created this sprint plan.
- Implementing P0 tracking standardization on homepage (`index.html`) to make monetization measurable.

## Risks to monitor
- High event volume with inconsistent naming (fix by strict event schema).
- Affiliate links changing/expiring (weekly link QA needed).
- High traffic variance from AI referrals (analyze separately by source/medium).

