// Shared Formspree lead capture: checklist delivery + optional redirect to thanks page.
(function (global) {
  'use strict';

  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xwpbqvow';
  const CHECKLIST_URL = '/downloads/arbitrage-checklist/';
  const THANKS_URL = '/subscribe/thanks/';

  async function submitForm(form, options) {
    const opts = options || {};
    const action = form.getAttribute('action') || FORMSPREE_ENDPOINT;
    const resp = await fetch(action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    });
    if (!resp.ok) throw new Error('formspree_' + resp.status);

    if (typeof global.track === 'function') {
      const listType = (form.querySelector('[name="list_type"]:checked') || {}).value ||
        form.querySelector('[name="list_type"]')?.value || 'spread_alerts';
      global.track('lead_submit', {
        lead_type: listType === 'weekly_digest' ? 'weekly_digest' : 'email_alert',
        source_page: opts.sourcePage || document.body?.getAttribute('data-cn-page') || 'unknown',
        source_event: opts.trackEvent || 'lead_capture'
      });
    }

    if (opts.redirectThanks !== false) {
      const q = new URLSearchParams();
      q.set('checklist', '1');
      const listEl = form.querySelector('[name="list_type"]:checked') || form.querySelector('[name="list_type"]');
      if (listEl && listEl.value) q.set('list', listEl.value);
      global.location.href = THANKS_URL + '?' + q.toString();
    }
    return resp;
  }

  function wireForm(form, options) {
    if (!form || form.dataset.cnLeadWired === '1') return;
    form.dataset.cnLeadWired = '1';
    const opts = options || {};

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const prevHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      }
      try {
        await submitForm(form, opts);
        if (opts.onSuccess) opts.onSuccess();
        if (opts.redirectThanks === false) {
          const sent = document.getElementById(opts.sentId || 'email-sent');
          if (sent) sent.style.display = 'inline-block';
          form.style.display = 'none';
        }
      } catch (_err) {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = prevHtml;
        }
        alert('Something went wrong. Please try again.');
      }
    });
  }

  global.CoinNavigatorLeadCapture = {
    FORMSPREE_ENDPOINT: FORMSPREE_ENDPOINT,
    CHECKLIST_URL: CHECKLIST_URL,
    THANKS_URL: THANKS_URL,
    submitForm: submitForm,
    wireForm: wireForm
  };
})(window);
