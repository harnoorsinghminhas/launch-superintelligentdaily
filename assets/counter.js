/*!
 * Reading-hours-saved counter v1.0.0
 *
 * Honest by construction:  reading_hours_saved = (items our pipeline read) x minutes_per_item / 60.
 * The method is always printed next to the number; nothing is hard-coded, nothing is invented.
 * Data:   https://siagentsignal.com/data/counters.json  (GitHub Pages, Access-Control-Allow-Origin: *)
 * Safe:   no cookies, no tracking, no innerHTML / eval (works under Trusted Types and a strict CSP:
 *         script-src 'self', style-src 'self', connect-src https://siagentsignal.com).
 *
 * Use:    <div data-hours-saved="hero"></div>   (or "footer")   +   <script src="counter.js" defer></script>
 *         or only  <script src="counter.js" data-variant="footer" defer></script>  (auto-mounts in the last <footer>)
 * Options on the script tag:  data-src (counters.json URL), data-how (explainer page URL), data-variant.
 *
 * Behaviour: ticks up at rate_hours_per_hour from as_of_utc, never more than 2 hours past as_of_utc, never goes
 * backwards, resyncs every 10 minutes and when the tab returns. aria-live="polite". With prefers-reduced-motion it
 * shows one fixed number per page load and does not tick. If the data cannot be fetched it shows nothing.
 */
(function () {
  'use strict';
  if (window.__hoursSavedCounter) { return; }
  window.__hoursSavedCounter = '1.0.0';

  var doc = document;
  var me = doc.currentScript;
  function opt(name, dflt) { var v = me && me.getAttribute('data-' + name); return v ? v : dflt; }

  var SRC = opt('src', 'https://siagentsignal.com/data/counters.json');
  var HOW = opt('how', 'https://siagentsignal.com/how-we-count.html');
  var MAX_EXTRAPOLATION_MS = 2 * 60 * 60 * 1000;
  var RESYNC_MS = 10 * 60 * 1000;
  var TICK_MS = 1000;

  var CSS = [
    '.hs{box-sizing:border-box;font:inherit;color:inherit;line-height:1.45;text-align:inherit}',
    '.hs *{box-sizing:inherit}',
    '.hs-num{font-variant-numeric:tabular-nums}',
    '.hs a{color:inherit;font-weight:600;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.18em}',
    '.hs a:hover{text-decoration-thickness:2px}',
    '.hs a:focus-visible{outline:2px solid currentColor;outline-offset:2px;border-radius:2px}',
    '.hs--footer{max-width:46rem;margin:.75rem auto 0;padding:0 1rem;font-size:.8125rem;text-align:var(--hs-align,center)}',
    '.hs--footer .hs-ico{margin-right:.15em}',
    '.hs--footer .hs-num{font-weight:700}',
    '.hs--hero{display:block;max-width:34rem;margin:1.1rem 0 1.25rem;padding:.8rem 1rem;text-align:left;',
    'border:1px solid rgba(127,127,127,.4);border-radius:12px;background:rgba(127,127,127,.08)}',
    '.hs--hero .hs-main{display:flex;flex-wrap:wrap;align-items:baseline;gap:.1rem .5rem}',
    '.hs--hero .hs-ico{font-size:1.25rem}',
    '.hs--hero .hs-num{font-size:clamp(1.9rem,7vw,2.75rem);font-weight:700;line-height:1.1;letter-spacing:-.01em}',
    '.hs--hero .hs-label{font-size:1.05rem;font-weight:600}',
    '.hs--hero .hs-rate{margin-top:.2rem;font-size:.9rem}',
    '.hs--hero .hs-how{display:block;margin-top:.4rem;font-size:.85rem}'
  ].join('');

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mq && mq.matches); }

  var nf0, nf1;
  try {
    nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  } catch (e) { nf0 = null; nf1 = null; }
  function fmt0(n) { return nf0 ? nf0.format(n) : String(Math.floor(n)); }
  function fmt1(n) { return nf1 ? nf1.format(n) : n.toFixed(1); }

  var data = null;        // validated snapshot of counters.json
  var shownMax = 0;       // the number never goes backwards
  var nodes = [];         // mounted widgets
  var hosts = [];         // mount points (also the ones still waiting for data)
  var lastFetch = 0;
  var built = false;

  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }

  function addCss() {
    try {
      if (typeof CSSStyleSheet === 'function' && 'adoptedStyleSheets' in doc) {
        var sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS);
        doc.adoptedStyleSheets = doc.adoptedStyleSheets.concat([sheet]);
        return;
      }
    } catch (e1) { /* fall through to a style element */ }
    try {
      var st = el('style', '', CSS);
      st.setAttribute('data-hours-saved', '');
      (doc.head || doc.documentElement).appendChild(st);
    } catch (e2) { /* unstyled but still readable */ }
  }

  function howLink() {
    var a = el('a', 'hs-link', 'How we count');
    a.setAttribute('href', HOW);
    var sameOrigin = false;
    try { sameOrigin = new URL(HOW, location.href).origin === location.origin; } catch (e) { sameOrigin = false; }
    if (!sameOrigin) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
    return a;
  }

  function mount(host, variant) {
    while (host.firstChild) { host.removeChild(host.firstChild); }
    host.style.minHeight = '';
    host.classList.add('hs', 'hs--' + variant);

    var live = el('span', 'hs-live');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    var ico = el('span', 'hs-ico', '⏱︎');
    ico.setAttribute('aria-hidden', 'true');
    var num = el('span', 'hs-num', '');
    live.appendChild(ico);
    live.appendChild(doc.createTextNode(' '));
    live.appendChild(num);
    live.appendChild(el('span', 'hs-label', ' reading hours saved'));

    var how = el('span', 'hs-how');
    how.appendChild(howLink());
    how.appendChild(doc.createTextNode(': every item we read × ' + data.mpi +
      ' minutes, about the time to read a typical news article.'));

    var rateEl = null;
    if (variant === 'hero') {
      var main = el('div', 'hs-main');
      main.appendChild(live);
      host.appendChild(main);
      rateEl = el('div', 'hs-rate', '');
      host.appendChild(rateEl);
      host.appendChild(how);
    } else {
      host.appendChild(live);
      host.appendChild(doc.createTextNode('. '));
      host.appendChild(how);
    }
    return { host: host, variant: variant, num: num, rate: rateEl, last: '' };
  }

  function valueNow() {
    var ms = Math.max(0, Math.min(Date.now() - data.asOf, MAX_EXTRAPOLATION_MS));
    return data.base + data.rate * (ms / 3600000);
  }

  function paint(n, v) {
    var t = n.variant === 'hero' ? fmt1(Math.floor(v * 10) / 10) : fmt0(Math.floor(v));
    if (n.last !== t) { n.num.textContent = t; n.last = t; }
  }

  function paintAll() {
    var v = valueNow();
    if (v < shownMax) { v = shownMax; } else { shownMax = v; }
    for (var i = 0; i < nodes.length; i++) { paint(nodes[i], v); }
  }

  function describe() {
    var when = '';
    try { when = new Date(data.asOf).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { when = data.asUtc; }
    var tip = 'As of ' + when + ': ' + fmt0(data.items) + ' items read since ' + data.first + ', at ' +
      data.mpi + ' minutes each. Between updates the counter moves at our recent average pace.';
    var perHour = Math.round(data.rate);
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].num.setAttribute('title', tip);
      if (nodes[i].rate) {
        nodes[i].rate.textContent = perHour >= 1 ? 'Adding about ' + fmt0(perHour) + ' hours every hour.' : '';
      }
    }
  }

  function accept(j) {
    var base = Number(j && j.reading_hours_total);
    var asOf = Date.parse(j && j.as_of_utc);
    var rate = Number(j && j.rate_hours_per_hour);
    var mpi = Number(j && j.minutes_per_item);
    if (!isFinite(base) || base < 0 || !isFinite(asOf)) { throw new Error('bad counters.json'); }
    if (!isFinite(rate) || rate < 0 || rate > 1e6) { rate = 0; }
    if (!isFinite(mpi) || mpi <= 0) { mpi = 3; }
    if (data && asOf < data.asOf) { return; }       // never step back to older data
    data = {
      base: base, rate: rate, asOf: asOf, mpi: mpi, asUtc: String(j.as_of_utc),
      items: Number(j.items_total) || 0, first: String(j.first_day || '')
    };
    if (!built) {
      addCss();
      for (var i = 0; i < hosts.length; i++) {
        nodes.push(mount(hosts[i], hosts[i].getAttribute('data-hours-saved') === 'hero' ? 'hero' : 'footer'));
      }
      built = true;
    }
    describe();
    paintAll();
  }

  function load() {
    if (!window.fetch) { return; }
    lastFetch = Date.now();
    fetch(SRC, { mode: 'cors', credentials: 'omit' })
      .then(function (r) { if (!r.ok) { throw new Error('http ' + r.status); } return r.json(); })
      .then(accept)
      .catch(function () {
        // No number is better than a wrong one: unmounted hosts collapse, mounted ones keep the last good value.
        if (!built) { for (var i = 0; i < hosts.length; i++) { hosts[i].style.minHeight = ''; } }
      });
  }

  function init() {
    hosts = [].slice.call(doc.querySelectorAll('[data-hours-saved]'));
    if (!hosts.length) {
      var v = opt('variant', '');
      if (!v) { return; }
      var h = el('div');
      h.setAttribute('data-hours-saved', v === 'hero' ? 'hero' : 'footer');
      var feet = doc.querySelectorAll('footer');
      (feet.length ? feet[feet.length - 1] : doc.body).appendChild(h);
      hosts.push(h);
    }
    for (var i = 0; i < hosts.length; i++) {
      if (hosts[i].getAttribute('data-hours-saved') === 'hero') { hosts[i].style.minHeight = '6.5rem'; }
    }
    load();
    if (!window.setInterval) { return; }
    setInterval(function () { if (data && !doc.hidden && !reduced()) { paintAll(); } }, TICK_MS);
    setInterval(function () { if (!doc.hidden && !reduced()) { load(); } }, RESYNC_MS);
    doc.addEventListener('visibilitychange', function () {
      if (!doc.hidden && !reduced() && Date.now() - lastFetch > RESYNC_MS) { load(); }
    });
  }

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { init(); }
}());
