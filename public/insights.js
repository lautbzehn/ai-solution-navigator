// Visit insights for the site's owner: which pages are read, for how long and how far down, which links are
// clicked, the site that sent you here, and the tagged link (?via=name) if one did. No cookies, nothing saved
// in your browser, and nothing at all when your browser sends Global Privacy Control. Details: /privacy/.
//
// The apps on other icarianforge.com addresses carry their own copy of this file, set up by its script tag:
//   data-endpoint="https://www.icarianforge.com/api/i"  where to report (this site's own /api/i otherwise)
//   data-routes                                          a single-page app: each change of address is a new page
//   data-clicks="outbound"                               only links that leave the app, never its buttons or labels
(() => {
  const script = document.currentScript;
  const ENDPOINT = script?.dataset.endpoint || '/api/i';
  const OUTBOUND_ONLY = script?.dataset.clicks === 'outbound';
  const KEY = 'if-insights';
  try {
    const url = new URL(location.href);
    // The owner's devices opt out once (the dashboard does this too) and are never counted after that.
    if (url.searchParams.has('ignore-me')) {
      localStorage.setItem(KEY, 'ignore');
      url.searchParams.delete('ignore-me');
      history.replaceState(history.state, '', url);
    }
    if (localStorage.getItem(KEY) === 'ignore') return;
  } catch {
    // Storage blocked: carry on, this visitor simply isn't the owner.
  }
  if (navigator.globalPrivacyControl) return;

  let path = location.pathname;
  const send = (data) => {
    const body = JSON.stringify({ ...data, p: path, w: innerWidth, wd: navigator.webdriver ? 1 : 0 });
    if (!(navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body))) {
      fetch(ENDPOINT, { method: 'POST', body, keepalive: true, credentials: 'omit' }).catch(() => {});
    }
  };

  // The tag is read once, then taken out of the address bar so a copied or shared link doesn't carry it on.
  const url = new URL(location.href);
  const via = (url.searchParams.get('via') || '').toLowerCase().slice(0, 40);
  if (url.searchParams.has('via')) {
    url.searchParams.delete('via');
    history.replaceState(history.state, '', url);
  }
  let referrer = '';
  try {
    referrer = document.referrer ? new URL(document.referrer).hostname : '';
  } catch {}

  let shown = 0;
  let since = document.visibilityState === 'visible' ? performance.now() : 0;
  let depth = 0;
  let reported = -1;
  const seconds = () => Math.round((shown + (since ? performance.now() - since : 0)) / 1000);
  const measure = () => {
    const doc = document.documentElement;
    const read = Math.min(100, Math.round(((scrollY + innerHeight) / Math.max(doc.scrollHeight, 1)) * 100));
    if (read > depth) depth = read;
  };
  const leave = () => {
    const s = seconds();
    if (s === reported) return;
    reported = s;
    send({ k: 'leave', s, d: depth });
  };

  send({ k: 'view', r: referrer, v: via });
  measure();
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      measure();
      ticking = false;
    });
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (since) shown += performance.now() - since;
      since = 0;
      leave();
    } else {
      since = performance.now();
    }
  });
  addEventListener('pagehide', leave);
  // Coming back with the browser's Back button restores the page without reloading it: a fresh view.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    shown = 0;
    since = performance.now();
    reported = -1;
    send({ k: 'view', r: '', v: '' });
  });

  // In a single-page app the address changes without a page load: close out the old page, then count the new one.
  if (script?.dataset.routes !== undefined) {
    const moved = () => {
      if (location.pathname === path) return;
      leave();
      path = location.pathname;
      shown = 0;
      since = document.visibilityState === 'visible' ? performance.now() : 0;
      depth = 0;
      reported = -1;
      send({ k: 'view', r: '', v: '' });
      measure();
    };
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        moved();
        return result;
      };
    }
    addEventListener('popstate', moved);
  }

  // Where a click goes, never what anyone typed: a page on this site, another site's address, or "email".
  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element && e.target.closest('a[href], button');
    if (!el) return;
    const label = OUTBOUND_ONLY ? '' : (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (el.tagName === 'BUTTON') return OUTBOUND_ONLY ? undefined : send({ k: 'click', t: 'button', l: label });
    let to;
    try {
      to = new URL(el.getAttribute('href'), location.href);
    } catch {
      return;
    }
    if (to.protocol === 'mailto:') return send({ k: 'click', t: 'email', l: label });
    if (!/^https?:$/.test(to.protocol)) return;
    if (OUTBOUND_ONLY && to.host === location.host) return;
    const t = to.host === location.host ? `${to.pathname}` : `${to.hostname}${to.pathname === '/' ? '' : to.pathname}`;
    send({ k: 'click', t: t.slice(0, 200), l: label });
  }, { capture: true });
})();
