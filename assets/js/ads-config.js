// CoinNavigator ads — edit this file to turn on revenue from display ads.
// Docs: MONETIZATION_SPRINT.md
(function (global) {
  'use strict';

  global.COINNAVIGATOR_ADS = {
    // Flip to true after you have a real AdSense publisher ID (or approved alt network).
    enabled: false,

    // 'auto' = AdSense Auto ads (simplest — one client ID, units created in AdSense UI).
    // 'units' = fill each [data-ad-slot] on the page (needs slot IDs below).
    mode: 'auto',

    adsense: {
      client: 'ca-pub-XXXXXXXXXXXXXXXX',
      slots: {
        header: '',
        mid: '',
        sidebar: '',
      },
    },

    // Optional: crypto-native CPM while waiting for AdSense (Coinzilla, A-Ads, etc.)
    // Paste their script URL when approved — ads-boot.js will inject it.
    altNetwork: {
      enabled: false,
      scriptSrc: '',
    },
  };
})(window);
