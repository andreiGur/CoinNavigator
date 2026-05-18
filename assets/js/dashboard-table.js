// Homepage spread dashboard: table, filters, sparklines, modals, periodic refresh. Depends on tracking, data-client, region, spread-engine (load before this file).
(function (global) {
  'use strict';

        // Dashboard UI state (search/filters/sort)
        const TARGET_TICKERS = [
            'BTC','ETH','SOL','XRP','TON',
            'DOGE','ADA','BNB','TRX','DOT',
            'LINK','LTC','AVAX','MATIC','SHIB',
            'UNI','XLM','NEAR','ATOM','APT',
        ];
        const TARGET_SYMBOLS = TARGET_TICKERS.map(t => t + 'USDT');

        const TABLE_STATE = {
            q: '',
            onlyGt01: false,
            onlyProfitable: false,
            onlyUsdt: true,
            onlyCex: true,
            hideMissing: true,
            sortBy: 'spread_desc',
        };

        let LAST_SPREAD_DATA = null;

        // How-To modal helpers (used by table actions)
        function openHowModal(payload) {
            const modal = document.getElementById('how-modal');
            const summary = document.getElementById('how-summary');
            if (!modal || !summary) return;
            summary.textContent = payload;
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }

        function closeHowModal() {
            const modal = document.getElementById('how-modal');
            if (!modal) return;
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }

        (function initHowModalOnce() {
            document.querySelectorAll('[data-close="how"]').forEach((el) => {
                el.addEventListener('click', closeHowModal);
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') { closeHowModal(); closeCalcModal(); }
            });
        })();

        let _calcSpread = 0;
        let _calcBuyEx = '';
        function openCalcModal(ticker, spreadPct, buyEx) {
            _calcSpread = spreadPct;
            _calcBuyEx = buyEx || '';
            const modal = document.getElementById('calc-modal');
            const label = document.getElementById('calc-coin-label');
            if (!modal) return;
            if (label) label.textContent = `${ticker} — Raw spread: ${spreadPct.toFixed(4)}%`;
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
            updateCalcResult();
        }
        function closeCalcModal() {
            const modal = document.getElementById('calc-modal');
            if (!modal) return;
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }
        function updateCalcResult() {
            const amount = parseFloat(document.getElementById('calc-amount')?.value) || 0;
            const feeBuy = parseFloat(document.getElementById('calc-fee-buy')?.value) || 0;
            const feeSell = parseFloat(document.getElementById('calc-fee-sell')?.value) || 0;
            const feeW = parseFloat(document.getElementById('calc-fee-withdraw')?.value) || 0;
            const spreadUSDT = amount * _calcSpread / 100;
            const buyCost = amount * feeBuy / 100;
            const sellCost = amount * feeSell / 100;
            const net = spreadUSDT - buyCost - sellCost - feeW;
            const pct = amount > 0 ? (net / amount * 100) : 0;
            const el = document.getElementById('calc-result');
            if (!el) return;
            el.className = 'calc-result' + (net < 0 ? ' loss' : '');
            el.innerHTML = `
                <div>Gross spread: <b>$${spreadUSDT.toFixed(2)}</b></div>
                <div>Buy fee: <b>−$${buyCost.toFixed(2)}</b></div>
                <div>Sell fee: <b>−$${sellCost.toFixed(2)}</b></div>
                <div>Withdrawal: <b>−$${feeW.toFixed(2)}</b></div>
                <hr style="border-color:rgba(255,255,255,0.08);margin:0.5rem 0">
                <div class="calc-profit ${net < 0 ? 'neg' : ''}">Net profit: ${net >= 0 ? '+' : ''}$${net.toFixed(2)} (${pct.toFixed(3)}%)</div>
            `;
            // Show affiliate CTA only when profitable
            const ctaBox = document.getElementById('calc-trade-cta');
            const ctaBtn = document.getElementById('calc-trade-btn');
            const ctaBtnLabel = document.getElementById('calc-trade-btn-label');
            if (ctaBox && ctaBtn) {
                if (net > 0 && _calcBuyEx) {
                    const affLinks = window.AFFILIATE_LINKS_GLOBAL || {};
                    const affUrl = affLinks[_calcBuyEx] || affLinks['Binance'] || '#';
                    ctaBtn.href = affUrl;
                    ctaBtn.setAttribute('data-ex', _calcBuyEx);
                    if (ctaBtnLabel) ctaBtnLabel.textContent = `Open ${_calcBuyEx} — Start Trading`;
                    ctaBox.style.display = 'block';
                } else {
                    ctaBox.style.display = 'none';
                }
            }
        }
        (function initCalcModalOnce() {
            document.querySelectorAll('[data-close="calc"]').forEach((el) => {
                el.addEventListener('click', closeCalcModal);
            });
            ['calc-amount','calc-fee-buy','calc-fee-sell','calc-fee-withdraw'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', updateCalcResult);
            });
        })();

        function normalizeCoinQuery(q) {
            const s = (q || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (!s) return '';
            return s.endsWith('USDT') ? s : s;
        }

        function getFavs() {
            try {
                const raw = localStorage.getItem('coinnavigator_favs') || '[]';
                const arr = JSON.parse(raw);
                return Array.isArray(arr) ? arr.filter(Boolean) : [];
            } catch {
                return [];
            }
        }

        function setFavs(arr) {
            try { localStorage.setItem('coinnavigator_favs', JSON.stringify(arr)); } catch {}
        }

        function toggleFav(symbol) {
            const sym = (symbol || '').toString();
            if (!sym) return;
            const favs = new Set(getFavs());
            if (favs.has(sym)) favs.delete(sym); else favs.add(sym);
            setFavs(Array.from(favs));
            global.track('fav_toggle', { sym });
        }

        // Spread history (local-only). Used by /dashboard.
        const HISTORY_KEY = 'coinnavigator_spread_history_v1';
        function loadHistory() {
            try {
                const raw = localStorage.getItem(HISTORY_KEY) || '{}';
                const obj = JSON.parse(raw);
                return (obj && typeof obj === 'object') ? obj : {};
            } catch {
                return {};
            }
        }
        function saveHistory(obj) {
            try { localStorage.setItem(HISTORY_KEY, JSON.stringify(obj)); } catch {}
        }
        function recordHistorySnapshot(data) {
            try {
                if (!data || !data.timestamp || !data.symbols) return;
                const ts = data.timestamp;
                const hist = loadHistory();
                for (const sym of TARGET_SYMBOLS) {
                    const info = data.symbols[sym];
                    if (!info || typeof info.spread_percent !== 'number' || !Number.isFinite(info.spread_percent)) continue;
                    const sp = info.spread_percent * 100;
                    if (!hist[sym]) hist[sym] = [];
                    const arr = hist[sym];
                    const last = arr.length ? arr[arr.length - 1] : null;
                    if (last && last.t === ts) continue;
                    arr.push({ t: ts, s: sp });
                    // Keep last ~14 days if updating every ~15m (approx 14*24*4 = 1344)
                    if (arr.length > 1500) hist[sym] = arr.slice(-1500);
                }
                saveHistory(hist);
            } catch {}
        }

        function syncCoinDatalist(extraSymbols) {
            const dl = document.getElementById('coin-list');
            if (!dl) return;
            const set = new Set(TARGET_TICKERS);
            if (extraSymbols && typeof extraSymbols === 'object') {
                Object.keys(extraSymbols).forEach((sym) => {
                    if (!sym) return;
                    const t = sym.replace('USDT', '');
                    if (t) set.add(t);
                });
            }
            const opts = Array.from(set).sort().map((t) => `<option value="${t}"></option>`).join('');
            dl.innerHTML = opts;
        }

        function readControlsIntoState() {
            const qEl = document.getElementById('coin-search');
            const gtEl = document.getElementById('only-gt-01');
            const usdtEl = document.getElementById('only-usdt');
            const cexEl = document.getElementById('only-cex');
            const sortEl = document.getElementById('sort-by');
            const missingEl = document.getElementById('hide-missing');
            TABLE_STATE.q = qEl ? qEl.value : '';
            TABLE_STATE.onlyGt01 = !!(gtEl && gtEl.checked);
            const profEl2 = document.getElementById('only-profitable');
            TABLE_STATE.onlyProfitable = !!(profEl2 && profEl2.checked);
            TABLE_STATE.onlyUsdt = !!(usdtEl && usdtEl.checked);
            TABLE_STATE.onlyCex = !!(cexEl && cexEl.checked);
            TABLE_STATE.hideMissing = !!(missingEl && missingEl.checked);
            TABLE_STATE.sortBy = sortEl ? (sortEl.value || 'spread_desc') : 'spread_desc';
        }

        function renderFromLastData() {
            if (!LAST_SPREAD_DATA) return;
            // Trigger a render pass without refetching data
            try { renderDashboardTable(LAST_SPREAD_DATA); } catch {}
        }

        function initDashboardControls() {
            const qEl = document.getElementById('coin-search');
            const clearEl = document.getElementById('coin-clear');
            const gtEl = document.getElementById('only-gt-01');
            const usdtEl = document.getElementById('only-usdt');
            const cexEl = document.getElementById('only-cex');
            const sortEl = document.getElementById('sort-by');

            const onChange = () => {
                readControlsIntoState();
                renderFromLastData();
            };
            const missingEl = document.getElementById('hide-missing');
            if (qEl) qEl.addEventListener('input', onChange);
            if (qEl) qEl.addEventListener('change', onChange);
            if (gtEl) gtEl.addEventListener('change', onChange);
            const profEl = document.getElementById('only-profitable');
            if (profEl) profEl.addEventListener('change', onChange);
            if (usdtEl) usdtEl.addEventListener('change', onChange);
            if (cexEl) cexEl.addEventListener('change', onChange);
            if (missingEl) missingEl.addEventListener('change', onChange);
            if (sortEl) sortEl.addEventListener('change', onChange);

            if (clearEl && qEl) {
                clearEl.addEventListener('click', () => {
                    qEl.value = '';
                    onChange();
                });
            }
        }

        function spreadColorClass(pct) {
            if (pct == null) return 'spread-none';
            if (pct >= 0.3) return 'spread-high';
            if (pct >= 0.1) return 'spread-mid';
            return 'spread-low';
        }

        function renderDashboardTable(data) {
            const tbody = document.getElementById('spread-body');
            const timestampDiv = document.getElementById('timestamp');
            const maxSpreadDiv = document.getElementById('max-spread');
            const assetCountDiv = document.getElementById('asset-count');
            const statusDiv = document.getElementById('table-status');
            if (!tbody) return;

            const region = global.getRegion();
            const buildReviewUrl = (path) => {
                if (path.startsWith('http')) return path; // already absolute (affiliate)
                const u = new URL(path, window.location.origin);
                u.searchParams.set('region', region);
                return u.pathname + u.search;
            };

            // Direct affiliate links for exchanges we're partnered with.
            // For others we route through the review page first.
            const AFFILIATE_LINKS = {
                Binance: 'https://accounts.binance.com/register?ref=308417308&utm_source=coinnavigator&utm_medium=table&utm_campaign=arb_table',
                Bybit:   'https://partner.bybit.com/b/153018?utm_source=coinnavigator&utm_medium=table&utm_campaign=arb_table',
                MEXC:    'https://www.mexc.com/acquisition/custom-sign-up?shareCode=mexc-3ksU2&utm_source=coinnavigator&utm_medium=table&utm_campaign=arb_table',
                OKX:     'https://www.okx.com/join/coinnavigator',
                KuCoin:  'https://www.kucoin.com/ucenter/signup?utm_source=coinnavigator',
                Gate:    'https://www.gate.io/signup?utm_source=coinnavigator',
            };
            window.AFFILIATE_LINKS_GLOBAL = AFFILIATE_LINKS;
            const REVIEW_PAGES = {
                Binance: AFFILIATE_LINKS.Binance,
                MEXC:    AFFILIATE_LINKS.MEXC,
                Bybit:   AFFILIATE_LINKS.Bybit,
                OKX:     AFFILIATE_LINKS.OKX,
                KuCoin:  AFFILIATE_LINKS.KuCoin,
                Gate:    AFFILIATE_LINKS.Gate,
            };

            const qRaw = normalizeCoinQuery(TABLE_STATE.q);
            const qTicker = qRaw.replace('USDT', '');
            const minSpreadPct = TABLE_STATE.onlyProfitable ? 0.3 : (TABLE_STATE.onlyGt01 ? 0.1 : 0);

            const universe = Array.from(new Set([
                ...TARGET_SYMBOLS,
                ...Object.keys((data && data.symbols) || {}),
            ]));

            let profitableNowCount = 0;
            let trackedNowCount = 0;
            try {
                for (const sym of universe) {
                    const inf = (data && data.symbols && data.symbols[sym]) ? data.symbols[sym] : null;
                    if (inf && inf.best_buy && inf.best_sell && typeof inf.spread_percent === 'number') {
                        trackedNowCount += 1;
                        if (inf.spread_percent * 100 >= 0.3) profitableNowCount += 1;
                    }
                }
                window.__cn_profitableNow = profitableNowCount;
                window.__cn_trackedNow = trackedNowCount;
                document.dispatchEvent(new CustomEvent('cn:opportunities', { detail: { profitable: profitableNowCount, tracked: trackedNowCount } }));
            } catch {}

            const rows = universe.map((symbol) => {
                const info = (data && data.symbols && data.symbols[symbol]) ? data.symbols[symbol] : null;
                const hasBest = !!(info && info.best_buy && info.best_sell);
                const spreadPct = (info && typeof info.spread_percent === 'number' && Number.isFinite(info.spread_percent))
                    ? info.spread_percent * 100
                    : null;
                const ticker = symbol.replace('USDT', '');
                return { symbol, ticker, info, hasBest, spreadPct };
            }).filter((r) => {
                if (TABLE_STATE.onlyUsdt && !r.symbol.endsWith('USDT')) return false;
                if (TABLE_STATE.hideMissing && !r.hasBest) return false;
                if (minSpreadPct > 0) {
                    if (r.spreadPct == null) return false;
                    if (r.spreadPct < minSpreadPct) return false;
                }
                if (qTicker) {
                    if (r.ticker === qTicker) return true;
                    if (r.ticker.includes(qTicker)) return true;
                    return false;
                }
                return true;
            });

            rows.sort((a, b) => {
                const aSp = (a.spreadPct == null) ? -Infinity : a.spreadPct;
                const bSp = (b.spreadPct == null) ? -Infinity : b.spreadPct;
                if (TABLE_STATE.sortBy === 'spread_asc') return aSp - bSp;
                if (TABLE_STATE.sortBy === 'alpha') return a.ticker.localeCompare(b.ticker);
                // Default: spread_desc
                return bSp - aSp;
            });

            tbody.innerHTML = '';
            const favs = new Set(getFavs());
            let highestSpread = 0;

            const fmt = (v) => (typeof v === 'number')
                ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`
                : 'N/A';

            if (rows.length === 0) {
                const isFilteringProfitable = TABLE_STATE.onlyProfitable;
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = `
                    <td colspan="5" style="padding: 2.5rem 1.5rem; text-align: center;">
                        <div style="max-width: 640px; margin: 0 auto;">
                            <div style="font-size: 2rem; margin-bottom: 0.5rem;">${isFilteringProfitable ? '⏳' : '🔍'}</div>
                            <h3 style="font-size: 1.15rem; margin-bottom: 0.6rem; color: var(--text-main);">
                                ${isFilteringProfitable
                                    ? 'No profitable spreads right now'
                                    : 'No coins match your filters'}
                            </h3>
                            <p style="color: var(--text-muted); font-size: 0.92rem; margin-bottom: 1.1rem; line-height: 1.55;">
                                ${isFilteringProfitable
                                    ? `Markets are quiet — none of the ${trackedNowCount || 20} tracked pairs currently show a spread above 0.30% (the threshold to profit after standard 0.10% fees per leg).<br/><strong style="color: var(--text-main);">Profitable spreads typically appear during volatility spikes.</strong> Get an email the moment one opens.`
                                    : 'Try clearing the search box or toggling off some filters above.'}
                            </p>
                            ${isFilteringProfitable ? `
                            <div style="display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap; margin-bottom: 0.8rem;">
                                <a class="btn btn-primary" href="#email-alerts" data-track="empty_state_alert_cta" style="font-size: 0.9rem;">
                                    <i class="fas fa-bell"></i> Alert me when spreads open
                                </a>
                                <button type="button" class="btn btn-ghost" id="empty-show-all" data-track="empty_state_show_all" style="font-size: 0.9rem;">
                                    <i class="fas fa-eye"></i> Show all spreads anyway
                                </button>
                            </div>
                            <div style="font-size: 0.78rem; color: var(--text-muted); padding-top: 0.6rem; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 0.8rem;">
                                Meanwhile: <a href="/polymarket/" data-track="empty_state_pm" style="color: var(--primary-light); font-weight: 600;">Check Polymarket movers →</a>
                                &nbsp; · &nbsp; <a href="/blog/" data-track="empty_state_blog" style="color: var(--primary-light); font-weight: 600;">Read arbitrage guides →</a>
                            </div>
                            ` : ''}
                        </div>
                    </td>
                `;
                tbody.appendChild(emptyRow);
                const showAllBtn = emptyRow.querySelector('#empty-show-all');
                if (showAllBtn) {
                    showAllBtn.addEventListener('click', () => {
                        const cb = document.getElementById('only-profitable');
                        if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
                    });
                }
            }

            for (const r of rows) {
                const symbol = r.symbol;
                const info = r.info || {};
                const hasBest = r.hasBest;
                const ticker = r.ticker;

                const prices = (info.prices && Object.keys(info.prices).length)
                    ? info.prices
                    : {
                        Binance: info.binance_price,
                        Bybit: info.bybit_price,
                    };

                const hasSpread = typeof info.spread_percent === 'number' && hasBest;
                let displaySpreadText = '—';
                let displaySpread = null;
                let spreadDetails = hasBest ? `Buy ${info.best_buy.exchange} / Sell ${info.best_sell.exchange}` : 'Data coming soon';
                if (hasSpread) {
                    displaySpread = info.spread_percent * 100;
                    displaySpreadText = displaySpread.toFixed(4) + '%';
                    if (displaySpread > highestSpread) highestSpread = displaySpread;
                }

                const buyText = hasBest ? `${info.best_buy.exchange} • ${fmt(info.best_buy.price)}` : '—';
                const sellText = hasBest ? `${info.best_sell.exchange} • ${fmt(info.best_sell.price)}` : '—';

                const buyUrl = hasBest ? (REVIEW_PAGES[info.best_buy.exchange] || '/binance-review/') : '#';
                const sellUrl = hasBest ? (REVIEW_PAGES[info.best_sell.exchange] || '/binance-review/') : '#';
                const buyReviewUrl = hasBest ? buildReviewUrl(buyUrl) : '#';
                const sellReviewUrl = hasBest ? buildReviewUrl(sellUrl) : '#';

                const calcSpread = hasSpread ? displaySpread.toFixed(4) : '0';
                const buyIsAffiliate = buyReviewUrl.startsWith('http');
                const sellIsAffiliate = sellReviewUrl.startsWith('http');
                const actionHtml = hasBest
                    ? `<div class="row-actions">
                         <a class="btn-mini btn-mini-primary" href="${buyReviewUrl}" ${buyIsAffiliate ? 'target="_blank" rel="noopener nofollow"' : ''} title="Buy leg: ${info.best_buy.exchange}${buyIsAffiliate ? ' (affiliate link)' : ' (review)'}" data-track="table_buy_aff" data-ex="${info.best_buy.exchange}" data-sym="${symbol}"><i class="fas fa-cart-shopping"></i> Buy on ${info.best_buy.exchange}</a>
                         <a class="btn-mini" href="${sellReviewUrl}" ${sellIsAffiliate ? 'target="_blank" rel="noopener nofollow"' : ''} title="Sell leg: ${info.best_sell.exchange}${sellIsAffiliate ? ' (affiliate link)' : ' (review)'}" data-track="table_sell_aff" data-ex="${info.best_sell.exchange}" data-sym="${symbol}"><i class="fas fa-right-left"></i> Sell on ${info.best_sell.exchange}</a>
                         <button class="btn-mini" type="button" data-open="how" data-track="table_how" data-sym="${symbol}"><i class="fas fa-wand-magic-sparkles"></i> How</button>
                         <button class="btn-mini hide-mobile" type="button" data-toggle="details"><i class="fas fa-circle-info"></i> Prices</button>
                         <button class="btn-mini btn-mini-calc" type="button" data-open="calc" data-spread="${calcSpread}" data-sym="${symbol}" data-buy-ex="${hasBest ? info.best_buy.exchange : ''}" data-sell-ex="${hasBest ? info.best_sell.exchange : ''}" title="Calculate net profit after fees"><i class="fas fa-calculator"></i> Calc</button>
                       </div>`
                    : `<span class="muted">Data coming soon</span>`;

                const favOn = favs.has(symbol);
                const row = document.createElement('tr');
                if (displaySpread != null && displaySpread >= 0.5) row.classList.add('row-hot');
                row.innerHTML = `
                    <td>
                        <div class="symbol-box clickable" data-open="details" title="Click to open details">
                            <button class="fav-btn ${favOn ? 'on' : ''}" type="button" data-fav="${symbol}" title="${favOn ? 'Remove from favorites' : 'Add to favorites'}">
                                <i class="fa${favOn ? 's' : 'r'} fa-star" aria-hidden="true"></i>
                            </button>
                            <i class="fas fa-coins" style="color: #f7931a"></i>
                            <span class="name">${ticker}</span>
                        </div>
                    </td>
                    <td class="price-val">${hasBest ? `<a class="link-mini focus-ring" href="${buyReviewUrl}" title="Go to ${info.best_buy.exchange} review (region-aware)"><i class="fas fa-store"></i> ${buyText}</a>` : '<span class="muted">—</span>'}</td>
                    <td class="price-val">${hasBest ? `<a class="link-mini focus-ring" href="${sellReviewUrl}" title="Go to ${info.best_sell.exchange} review (region-aware)"><i class="fas fa-store"></i> ${sellText}</a>` : '<span class="muted">—</span>'}</td>
                    <td><div class="spread-cell">${displaySpread != null && displaySpread >= 0.5 ? '<span class="hot-badge"><i class="fas fa-fire"></i> HOT</span>' : (displaySpread != null && displaySpread >= 0.3 ? '<span class="hot-badge" style="background:rgba(16,185,129,0.15);color:#34d399;border-color:rgba(16,185,129,0.35);"><i class="fas fa-circle-check"></i> Profitable</span>' : '')}<span class="spread-val ${spreadColorClass(displaySpread)} ${hasBest ? 'clickable' : 'spread-none'}" data-open="how" title="${spreadDetails}${hasBest ? ' (click for how)' : ''}">${displaySpreadText}</span></div></td>
                    <td>${actionHtml}</td>
                `;
                tbody.appendChild(row);

                // Details row (all exchange prices + chart placeholder)
                const detailsRow = document.createElement('tr');
                detailsRow.className = 'details-row';
                detailsRow.style.display = 'none';
                const errMap = (data.errors && data.errors[symbol]) ? data.errors[symbol] : null;
                const exchangeKeys = Object.keys(prices || {});
                const detailsItems = exchangeKeys.map((ex) => {
                    const v = prices[ex];
                    const err = errMap && errMap[ex] && typeof v !== 'number' ? errMap[ex] : null;
                    const right = (typeof v === 'number') ? fmt(v) : (err ? `<span class="err">${err}</span>` : 'N/A');
                    return `<div class="details-item"><span class="ex">${ex}</span><span class="val">${right}</span></div>`;
                }).join('');
                detailsRow.innerHTML = `<td colspan="5">
                    <div class="details">
                        <div class="muted" style="margin-bottom: 0.5rem;">All observed prices (some exchanges may be temporarily blocked).</div>
                        <div class="details-grid">${detailsItems || '<div class="muted">No price details yet.</div>'}</div>
                        <div class="spark-wrap">
                            <div class="spark-meta">
                                <span><i class="fas fa-chart-line"></i> 24h price (USD)</span>
                                <span class="muted" data-spark-status="${symbol}">Open “Prices” to load chart</span>
                            </div>
                            <canvas class="spark-canvas" data-spark="${symbol}" height="70"></canvas>
                        </div>
                    </div>
                </td>`;
                tbody.appendChild(detailsRow);

                const favBtn = row.querySelector(`button[data-fav="${symbol}"]`);
                if (favBtn) {
                    favBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        toggleFav(symbol);
                        const nowOn = new Set(getFavs()).has(symbol);
                        favBtn.classList.toggle('on', nowOn);
                        favBtn.setAttribute('title', nowOn ? 'Remove from favorites' : 'Add to favorites');
                        favBtn.innerHTML = `<i class="fa${nowOn ? 's' : 'r'} fa-star" aria-hidden="true"></i>`;
                    });
                }

                const toggleBtn = row.querySelector('button[data-toggle="details"]');
                if (toggleBtn) {
                    toggleBtn.addEventListener('click', () => {
                        const next = (detailsRow.style.display === 'none') ? '' : 'none';
                        detailsRow.style.display = next;
                        if (next !== 'none') {
                            const status = detailsRow.querySelector(`[data-spark-status="${symbol}"]`);
                            if (status) status.textContent = 'Loading…';
                            ensureSparkline(symbol, ticker, detailsRow);
                        }
                    });
                }

                const openDetails = () => {
                    const next = (detailsRow.style.display === 'none') ? '' : 'none';
                    detailsRow.style.display = next;
                    if (next !== 'none') {
                        const status = detailsRow.querySelector(`[data-spark-status="${symbol}"]`);
                        if (status) status.textContent = 'Loading…';
                        ensureSparkline(symbol, ticker, detailsRow);
                    }
                };
                const symbolBox = row.querySelector('[data-open="details"]');
                if (symbolBox) symbolBox.addEventListener('click', openDetails);

                const openHow = () => {
                    if (!hasBest) return;
                    const msg = `${ticker}: Buy on ${info.best_buy.exchange} at ${fmt(info.best_buy.price)} • Sell on ${info.best_sell.exchange} at ${fmt(info.best_sell.price)} • Spread ${displaySpreadText}`;
                    openHowModal(msg);
                };
                const howBtn = row.querySelector('button[data-open="how"]');
                if (howBtn) howBtn.addEventListener('click', (e) => { e.preventDefault(); openHow(); });
                const spreadBadge = row.querySelector('.spread-val[data-open="how"]');
                if (spreadBadge) spreadBadge.addEventListener('click', (e) => { e.preventDefault(); openHow(); });

                const calcBtn = row.querySelector('button[data-open="calc"]');
                if (calcBtn) calcBtn.addEventListener('click', () => {
                    openCalcModal(ticker, parseFloat(calcBtn.dataset.spread) || 0, calcBtn.dataset.buyEx || '');
                });
            }

            if (assetCountDiv) assetCountDiv.innerText = TARGET_SYMBOLS.length;
            if (maxSpreadDiv) maxSpreadDiv.innerText = highestSpread > 0 ? (highestSpread.toFixed(3) + '%') : '--';
            if (statusDiv) statusDiv.textContent = `Showing ${rows.length} / ${TARGET_SYMBOLS.length}`;

            const profitableCountEl = document.getElementById('profitable-count');
            const profitableSubEl = document.getElementById('stat-profitable-sub');
            if (profitableCountEl) {
                profitableCountEl.innerText = profitableNowCount;
                if (profitableNowCount === 0) {
                    profitableCountEl.style.color = 'var(--text-muted)';
                    if (profitableSubEl) profitableSubEl.innerHTML = '<span style="color:var(--primary-light);">Get alert when one opens →</span>';
                } else if (profitableNowCount >= 3) {
                    profitableCountEl.style.color = '#34d399';
                    if (profitableSubEl) profitableSubEl.innerText = `HOT — ${profitableNowCount} live opportunities`;
                } else {
                    profitableCountEl.style.color = 'var(--accent)';
                    if (profitableSubEl) profitableSubEl.innerText = 'spreads > 0.30%';
                }
            }

            const quietBanner = document.getElementById('spread-quiet-banner');
            if (quietBanner) {
                const filteringProfitable = TABLE_STATE.onlyProfitable;
                if (filteringProfitable && rows.length === 0 && trackedNowCount > 0) {
                    quietBanner.className = 'data-freshness-banner banner-warn';
                    quietBanner.innerHTML = `<i class="fas fa-filter" aria-hidden="true"></i><span><strong>Profitable filter is on</strong> — no spreads above 0.30% right now (fees are ~0.20% round-trip). <button type="button" id="quiet-show-all-btn" style="margin-left:0.35rem;background:transparent;border:none;color:var(--primary-light);font-weight:800;cursor:pointer;text-decoration:underline;">Show all spreads</button> or <a href="#email-alerts" style="color:var(--primary-light);font-weight:700;">get an alert</a> when one opens.</span>`;
                    const btn = quietBanner.querySelector('#quiet-show-all-btn');
                    if (btn) btn.addEventListener('click', () => {
                        const cb = document.getElementById('only-profitable');
                        if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
                    });
                } else if (!filteringProfitable && profitableNowCount === 0 && trackedNowCount > 0) {
                    quietBanner.className = 'data-freshness-banner banner-warn';
                    const topSp = highestSpread > 0 ? highestSpread.toFixed(3) : '—';
                    quietBanner.innerHTML = `<i class="fas fa-circle-info" aria-hidden="true"></i><span>Markets are quiet — highest spread right now is <strong>${topSp}%</strong> (below the ~0.30% needed to profit after fees). Showing all tracked pairs. <a href="#email-alerts" style="color:var(--primary-light);font-weight:700;">Get alerts</a> when spreads open.</span>`;
                } else {
                    quietBanner.className = 'data-freshness-banner hidden';
                    quietBanner.innerHTML = '';
                }
            }

            if (timestampDiv && data && data.timestamp) {
                const date = new Date(data.timestamp);
                const ageHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
                timestampDiv.innerHTML = `<i class="far fa-clock"></i> Last updated: ${date.toLocaleString()}`;
                if (ageHours > 1) {
                    timestampDiv.style.color = 'var(--danger)';
                    timestampDiv.innerHTML += ` <span class="err">(${ageHours >= 24 ? Math.floor(ageHours / 24) + ' days' : Math.floor(ageHours) + ' hours'} ago)</span>`;
                } else {
                    timestampDiv.style.color = '';
                }

                // Countdown to next 15-min update
                const UPDATE_INTERVAL_MS = 15 * 60 * 1000;
                const nextUpdate = date.getTime() + UPDATE_INTERVAL_MS;
                const timerEl = document.getElementById('next-update-timer');
                const countdownEl = document.getElementById('next-update-countdown');
                if (timerEl && countdownEl) {
                    timerEl.style.display = 'flex';
                    if (window._countdownInterval) clearInterval(window._countdownInterval);
                    window._countdownInterval = setInterval(() => {
                        const remaining = nextUpdate - Date.now();
                        if (remaining <= 0) {
                            countdownEl.textContent = 'updating…';
                            countdownEl.style.color = '#34d399';
                        } else {
                            const mins = Math.floor(remaining / 60000);
                            const secs = Math.floor((remaining % 60000) / 1000);
                            countdownEl.textContent = `${mins}:${String(secs).padStart(2,'0')}`;
                            countdownEl.style.color = remaining < 60000 ? '#fbbf24' : '';
                        }
                    }, 1000);
                }
            }
        }

        // Sparkline charts (CoinGecko + Chart.js)
        const COINGECKO_IDS = {
            BTC: 'bitcoin',
            ETH: 'ethereum',
            SOL: 'solana',
            XRP: 'ripple',
            TON: 'toncoin',
            DOGE: 'dogecoin',
            ADA: 'cardano',
            BNB: 'binancecoin',
            TRX: 'tron',
            DOT: 'polkadot',
            LINK: 'chainlink',
            LTC: 'litecoin',
            AVAX: 'avalanche-2',
            MATIC: 'polygon-ecosystem-token',
            SHIB: 'shiba-inu',
            UNI: 'uniswap',
            XLM: 'stellar',
            NEAR: 'near',
            ATOM: 'cosmos',
            APT: 'aptos',
        };

        const SPARK_CACHE = new Map(); // key: cgId -> { ts, prices[] }
        const SPARK_CHARTS = new Map(); // key: symbol -> Chart

        async function fetchCoinGecko1d(cgId) {
            const cached = SPARK_CACHE.get(cgId);
            if (cached && (Date.now() - cached.ts) < 5 * 60 * 1000) return cached.prices;
            const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(cgId)}/market_chart?vs_currency=usd&days=1&interval=hourly`;
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
            const json = await res.json();
            const prices = (json && Array.isArray(json.prices)) ? json.prices : [];
            SPARK_CACHE.set(cgId, { ts: Date.now(), prices });
            return prices;
        }

        async function ensureSparkline(symbol, ticker, detailsRowEl) {
            try {
                if (SPARK_CHARTS.has(symbol)) {
                    const status = detailsRowEl.querySelector(`[data-spark-status="${symbol}"]`);
                    if (status) status.textContent = 'Loaded';
                    return;
                }
                if (!window.Chart) {
                    const status = detailsRowEl.querySelector(`[data-spark-status="${symbol}"]`);
                    if (status) status.textContent = 'Chart.js not available';
                    return;
                }
                const cgId = COINGECKO_IDS[ticker];
                const status = detailsRowEl.querySelector(`[data-spark-status="${symbol}"]`);
                if (!cgId) {
                    if (status) status.textContent = 'No chart source yet';
                    return;
                }
                const canvas = detailsRowEl.querySelector(`canvas[data-spark="${symbol}"]`);
                if (!canvas) return;
                const pts = await fetchCoinGecko1d(cgId);
                const ys = pts.map(p => p && typeof p[1] === 'number' ? p[1] : null).filter(v => v != null);
                if (!ys.length) {
                    if (status) status.textContent = 'No chart data';
                    return;
                }
                const labels = ys.map((_, i) => i);
                const ctx = canvas.getContext('2d');
                const chart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            data: ys,
                            borderColor: 'rgba(129, 140, 248, 0.95)',
                            backgroundColor: 'rgba(129, 140, 248, 0.10)',
                            tension: 0.25,
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: true,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { enabled: false } },
                        scales: { x: { display: false }, y: { display: false } },
                        animation: { duration: 250 },
                    },
                });
                SPARK_CHARTS.set(symbol, chart);
                if (status) status.textContent = 'Loaded';
            } catch (e) {
                const status = detailsRowEl.querySelector(`[data-spark-status="${symbol}"]`);
                if (status) status.textContent = 'Failed to load';
            }
        }

        async function updateDashboard() {
            try {
                console.log('Fetching data...');
                let data = await global.fetchJsonWithFallback();
                if (data && data.timestamp) {
                    const ageMinutes = (Date.now() - new Date(data.timestamp).getTime()) / 60000;
                    if (Number.isFinite(ageMinutes) && ageMinutes > 20) {
                        try {
                            const livePayload = await global.fetchLiveSpreadFallback();
                            if (livePayload && livePayload.symbols) {
                                data = livePayload;
                            }
                        } catch (liveErr) {
                            console.warn('Live spread fallback failed:', liveErr);
                        }
                    }
                }
                console.log('Data received:', data);

                LAST_SPREAD_DATA = data;
                recordHistorySnapshot(data);
                syncCoinDatalist((data && data.symbols) || {});
                readControlsIntoState();
                renderDashboardTable(data);

                global.track('dashboard_render', { assets: TARGET_SYMBOLS.length });
                if (typeof window._stickyBarPopulate === 'function') window._stickyBarPopulate(data);

                // Hero snapshot (top spreads)
                try {
                    const bars = document.getElementById('hero-viz-bars');
                    const sub = document.getElementById('hero-viz-sub');
                    if (bars) {
                        const rows = [];
                        for (const [sym, info] of Object.entries(data.symbols || {})) {
                            const hasBest = info && info.best_buy && info.best_sell;
                            const sp = (typeof info.spread_percent === 'number') ? (info.spread_percent * 100) : null;
                            if (!hasBest || sp == null || !Number.isFinite(sp) || sp <= 0) continue;
                            rows.push({
                                sym,
                                pct: sp,
                                buy: info.best_buy.exchange,
                                sell: info.best_sell.exchange,
                            });
                        }
                        rows.sort((a, b) => b.pct - a.pct);
                        const top = rows.slice(0, 5);
                        const max = top.length ? Math.max(...top.map(x => x.pct)) : 0;

                        if (sub) {
                            const ts = data && data.timestamp ? new Date(data.timestamp) : null;
                            const stamp = ts ? ts.toLocaleString() : '—';
                            sub.innerHTML = top.length
                                ? `Based on latest refresh (${stamp}). Bars show relative spread size.`
                                : `No reliable spreads to display right now (data may be partial).`;
                        }

                        if (!top.length) {
                            bars.innerHTML = `
                                <div class="viz-row" role="listitem">
                                    <div class="viz-sym">—</div>
                                    <div class="viz-bar"><span style="width: 0%"></span></div>
                                    <div class="viz-val">—</div>
                                </div>`;
                        } else {
                            bars.innerHTML = top.map((r) => {
                                const label = r.sym.replace('USDT', '');
                                const width = max > 0 ? Math.max(6, Math.min(100, (r.pct / max) * 100)) : 0;
                                const title = `${label}: buy ${r.buy} → sell ${r.sell}`;
                                return `
                                    <div class="viz-row" role="listitem" title="${title}">
                                        <div class="viz-sym">${label}</div>
                                        <div class="viz-bar"><span style="width: ${width.toFixed(0)}%"></span></div>
                                        <div class="viz-val">${r.pct.toFixed(3)}%</div>
                                    </div>
                                `;
                            }).join('');
                        }
                    }
                } catch {}

                // ── Best Opportunity card ──────────────────────────────
                try {
                    const oppCard  = document.getElementById('opp-card');
                    const oppEmpty = document.getElementById('opp-empty');
                    if (oppCard && oppEmpty) {
                        const rows2 = [];
                        for (const [sym, info] of Object.entries(data.symbols || {})) {
                            const hasBest = info && info.best_buy && info.best_sell;
                            const sp = (typeof info.spread_percent === 'number') ? (info.spread_percent * 100) : null;
                            if (!hasBest || sp == null || !Number.isFinite(sp) || sp <= 0) continue;
                            rows2.push({ sym, sp, buy: info.best_buy.exchange, sell: info.best_sell.exchange });
                        }
                        rows2.sort((a, b) => b.sp - a.sp);
                        const best = rows2[0];
                        // 0.1% fee per leg × 2 legs = 0.2% total cost
                        const FEE_PCT = 0.20;
                        if (best && best.sp > FEE_PCT) {
                            const netProfit = Math.round(((best.sp - FEE_PCT) / 100) * 1000 * 10) / 10; // $ on $1k
                            const label = best.sym.replace('USDT','').replace('BUSD','');
                            document.getElementById('opp-coin').textContent   = label + ' arbitrage';
                            document.getElementById('opp-route').textContent  = 'Buy on ' + best.buy + ' → Sell on ' + best.sell;
                            document.getElementById('opp-spread-pct').textContent = best.sp.toFixed(3) + '%';
                            document.getElementById('opp-profit-val').textContent = '+$' + netProfit.toFixed(1);
                            // affiliate link for the buy exchange
                            const tradeBtn = document.getElementById('opp-trade-btn');
                            if (tradeBtn) {
                                const aff = (window.AFFILIATE_LINKS_GLOBAL || {})[best.buy] || (window.AFFILIATE_LINKS_GLOBAL || {}).Binance;
                                tradeBtn.href = aff;
                                tradeBtn.setAttribute('data-ex', best.buy);
                            }
                            oppCard.style.display  = 'flex';
                            oppEmpty.style.display = 'none';
                        } else {
                            oppCard.style.display  = 'none';
                            oppEmpty.style.display = 'flex';
                        }
                    }
                } catch(e) { console.warn('opp-card error', e); }

                const banner = document.getElementById('data-freshness-banner');
                if (banner) {
                    const date = data.timestamp ? new Date(data.timestamp) : null;
                    const ageHours = date ? (Date.now() - date.getTime()) / (1000 * 60 * 60) : 999;
                    let msg = '';
                    let bannerLevel = 'warn';
                    const ageMins = ageHours * 60;
                    if (ageHours > 2) {
                        msg = `Spread data is ${ageHours >= 24 ? Math.floor(ageHours / 24) + ' day(s)' : Math.floor(ageHours) + ' hour(s)'} old — prices may have changed significantly.`;
                        bannerLevel = 'error';
                    } else if (ageHours > 0.5) {
                        msg = `Spread data is over ${Math.round(ageMins)} minutes old. Prices may have shifted. Always verify before trading.`;
                        bannerLevel = 'warn';
                    }
                    if (msg) {
                        banner.className = `data-freshness-banner banner-${bannerLevel}`;
                        banner.innerHTML = `<i class="fas fa-exclamation-triangle" aria-hidden="true"></i><span>${msg}</span>`;
                    } else if (date) {
                        banner.className = 'data-freshness-banner banner-ok';
                        banner.innerHTML = `<i class="fas fa-circle-check" aria-hidden="true"></i><span>Data fresh — last updated ${Math.round(ageMins)} min ago.</span>`;
                    } else {
                        banner.className = 'data-freshness-banner hidden';
                        banner.innerHTML = '';
                    }
                }

                if (data.symbols && data.symbols.BTCUSDT && banner) {
                    fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', { cache: 'no-store' })
                        .then(r => r.ok ? r.json() : null)
                        .then(live => {
                            if (!live || typeof live.price !== 'string') return;
                            const livePrice = parseFloat(live.price);
                            if (!Number.isFinite(livePrice)) return;
                            const cached = data.symbols.BTCUSDT.binance_price || data.symbols.BTCUSDT.best_buy?.price;
                            if (cached == null) return;
                            const diffPct = Math.abs(cached - livePrice) / livePrice;
                            if (diffPct > 0.05) {
                                const bannerEl = document.getElementById('data-freshness-banner');
                                if (!bannerEl) return;
                                const existing = bannerEl.textContent || '';
                                const priceMsg = ` Table shows BTC ~$${cached.toLocaleString(undefined, { maximumFractionDigits: 0 })} but current Binance price is ~$${livePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`;
                                bannerEl.className = 'data-freshness-banner';
                                bannerEl.innerHTML = `<i class="fas fa-exclamation-triangle" aria-hidden="true"></i><span>${existing ? existing + ' ' : ''}Price mismatch:${priceMsg}</span>`;
                            }
                        })
                        .catch(() => {});
                }
                
            } catch (error) {
                console.error('Detailed Error:', error);
                document.getElementById('spread-body').innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger); padding: 4rem;">
                    <div style="margin-bottom: 10px;">Sync Error: ${error.message}</div>
                    <div style="font-size: 0.6rem; opacity: 0.7;">Make sure data/spread_data.json exists on GitHub</div>
                </td></tr>`;
            }
        }

  global.TARGET_TICKERS = TARGET_TICKERS;
  global.TARGET_SYMBOLS = TARGET_SYMBOLS;
  global.CoinNavigatorDashboard = {
    boot: function () {
      initDashboardControls();
      updateDashboard();
      setInterval(updateDashboard, 60000);
    }
  };
})(window);
