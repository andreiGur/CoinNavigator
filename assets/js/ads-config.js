// CoinNavigator ads — edit this file to turn on revenue from display ads.
// HOW TO ENABLE:
//   Coinzilla (fastest, crypto-native, 24–48h approval):
//     1. Register at https://coinzilla.com/register → Publisher
//     2. Create a "Standard Banner" zone — copy the zone script URL
//     3. Set coinzilla.enabled = true and paste zone scripts in coinzilla.zones below
//
//   Google AdSense (higher RPM long-term, 2–4 week approval):
//     1. Apply at https://www.google.com/adsense with coinnavigator.net
//     2. Set adsense.client = 'ca-pub-YOUR_REAL_ID' and adsense.enabled = true
(function (global) {
  'use strict';

  global.COINNAVIGATOR_ADS = {

    // ── Coinzilla (crypto ad network — enable first while waiting for AdSense) ──
    coinzilla: {
      enabled: false,   // ← set true after Coinzilla approves your site
      // Paste the full <script> src from your Coinzilla zone dashboard:
      zones: {
        // header: 'https://coinzilla.com/zone/XXXXXXXX',
        // mid:    'https://coinzilla.com/zone/YYYYYYYY',
      },
    },

    // ── Google AdSense ──────────────────────────────────────────────────────────
    adsense: {
      enabled: false,   // ← set true after AdSense approves
      client: 'ca-pub-XXXXXXXXXXXXXXXX',   // ← replace with your real ID
      mode: 'auto',     // 'auto' = let Google place ads | 'units' = use slot IDs below
      slots: {
        header: '',
        mid: '',
      },
    },

    // ── A-Ads (Bitcoin ad network, no approval needed) ──────────────────────────
    aads: {
      enabled: false,
      adUnitId: '',     // ← your A-Ads ad unit ID (e.g. '1234567')
    },

  };
})(window);
