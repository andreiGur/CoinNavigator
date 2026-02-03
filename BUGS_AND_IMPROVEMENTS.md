# Bugs & Improvements (Feb 2026)

## 1. Polymarket "View on Polymarket" 404 — FIXED

**Cause:** Gamma API returns **markets** with a `slug` (market slug). Polymarket’s site uses:
- `/event/{event_slug}` for the event page
- `/event/{event_slug}/{market_slug}` for a specific market inside an event

We were building `/event/{market_slug}` only. For multi-market events (e.g. “How many people will Trump deport?”), the event has a different slug than each market, so `/event/{market_slug}` often 404’d.

**Fix:**
- In `src/polymarket_hot.py`: read the **event** slug from each market’s `events[]` (Gamma returns it). Build URL as:
  - `https://polymarket.com/event/{event_slug}` when event_slug === market_slug (single-market)
  - `https://polymarket.com/event/{event_slug}/{market_slug}` when different (multi-market)
- Regenerated `polymarket_hot.json` and `data/polymarket_hot.json` with correct URLs.
- Frontend: `buildMarketUrl` / `buildPolymarketUrl` now fall back to `https://polymarket.com` if `url` is missing or invalid, so “View on Polymarket” never points to a broken link.

**Deploy:** Commit and push so the updated JSON and HTML are live. The daily workflow (update_polymarket.yml) will keep producing correct URLs from now on.

---

## 2. Bug scan summary

- **Polymarket 404:** Fixed as above.
- **Empty Polymarket JSON:** If `python3 src/polymarket_hot.py` runs without network, it overwrites JSON with `markets: []`. Avoid running the script in offline environments, or add a “don’t overwrite if API failed” guard in the script.
- **XSS:** API text (question, slug, image URL) is now escaped/validated on the Polymarket page (`escapeHtml`, `imgSrc` only if `http`). Low risk before (we control the pipeline) but safer now.
- **Contact page:** Contains placeholder “Add your support email here” — intentional; replace when you have a final support address.
- **Spread/Polymarket fetch errors:** Homepage and Polymarket page already show error messages and empty states when JSON fails; no change needed.

---

## 3. Improvements made today

1. **Polymarket links:** Correct event/market URL logic + fallback to Polymarket home.
2. **Frontend safety:** URL validation and HTML escaping on Polymarket page.
3. **Regenerated JSON:** Current `polymarket_hot.json` and `data/polymarket_hot.json` have correct links.

---

## 4. How to make the project better today (next steps)

1. **Deploy:** Commit and push (including updated `polymarket_hot.json`, `data/polymarket_hot.json`, `polymarket/index.html`, `index.html`, `src/polymarket_hot.py`) so the Polymarket fix is live.
2. **Trust line:** On `/polymarket/`, you already show “Updated: …”. Optionally add a short line like “Data from Polymarket’s public Gamma API” for transparency.
3. **Don’t overwrite JSON on API failure:** In `src/polymarket_hot.py`, consider writing output only when `payload["error"] is None` (or when `payload["markets"]` is non-empty), so a failed run doesn’t replace good JSON with an empty file.
