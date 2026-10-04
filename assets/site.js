/* Superintelligent Daily: page behaviour. Every node is built with createElement/textContent (no innerHTML), so the page runs under
   require-trusted-types-for 'script'. Sections: sign-up, swipe decks, label quiz, live "this hour", reserve dialog, Playbook link slot. */
(function () {
"use strict";

var API = "https://acp9reat3l.execute-api.us-east-1.amazonaws.com/signal/request-link";
var SITE = "superintelligentdaily.com";
/* The JSON is read from siagentsignal.com (GitHub Pages, ACAO *, mirrored hourly): the media host drops CORS headers when Chrome sends its automatic priority header. Only the mp3 stays on the media host (<audio> needs no CORS). */
var HOUR_URL = "https://siagentsignal.com/data/latest.json";
var MEDIA_HOST = "https://media.theagentsignal.com/";
/* PLAYBOOK LINK SLOT: paste the LIVE secure checkout link for the AI-Era Defense Playbook here (an https://buy.stripe.com/... link made in
   the Stripe dashboard). While this is empty the button says "Email me the Playbook link" and goes to the sign-up box. */
var PLAYBOOK_URL = "https://buy.stripe.com/eVqcN45OB50a1e07Jc8Vi0v?client_reference_id=superintelligentdaily-com";

var LANDING_RE = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]{0,199}$/;   // same shape the API accepts
var EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;
var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

/* ---------- sign-up: POST {email, hp, site, landing_path, tz, query?} (same payload as the hub) ---------- */
function payload(email, hp) {
  var b = { email: email, hp: hp || "", site: SITE };
  if (LANDING_RE.test(location.pathname)) b.landing_path = location.pathname;
  try { var tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (tz && tz.length <= 40) b.tz = tz; } catch (e) { /* no zone: the API falls back */ }
  var q = location.search;
  if (q && q.length <= 2048 && /[?&](utm_[a-z]+|ref)=/i.test(q)) b.query = q;   // campaign attribution only
  return b;
}
function post(body) {
  var ctl = window.AbortController ? new AbortController() : null, timer = ctl ? window.setTimeout(function () { ctl.abort(); }, 15000) : 0;
  return fetch(API, { method: "POST", mode: "cors", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { window.clearTimeout(timer); return { status: r.status, code: j && j.error }; }); },
          function () { window.clearTimeout(timer); return { status: 0, code: "network" }; });
}
function errText(res) {
  var s = res.status, c = res.code;
  if (s === 400 && c === "invalid_email") return "That email address doesn't look right. Check it for a typo?";
  if (s === 400) return "Something in the form didn't go through. Please try again.";
  if (s === 415) return "Your browser sent the form in a format we can't read. Refresh the page and try again.";
  if (s === 429) return "Lots of sign-ups from your network just now. Wait a minute, then try again.";
  if (s === 403) return "Sign-up only works on our own site. Open " + SITE + " and try again.";
  if (s >= 500) return "Our sign-up desk hit a snag. Please try again in a moment.";
  return "We couldn't reach the sign-up desk. Check your connection and try again.";
}
function validEmail(v) { return v.length <= 254 && EMAIL_RE.test(v); }

var form = $("#join");
var em = $('input[type="email"]', form), hp = $('input[name="website"]', form), err = $(".js-err", form);
var btn = $('button[type="submit"]', form), done = $("#done"), doneEmail = $("#done-email"), busy = false;
em.addEventListener("blur", function () {   // inline validation on blur, never only on submit
  var v = em.value.trim();
  if (v && !validEmail(v)) { err.textContent = "That email address doesn't look right yet."; em.setAttribute("aria-invalid", "true"); }
  else { err.textContent = ""; em.removeAttribute("aria-invalid"); }
});
em.addEventListener("input", function () { if (em.getAttribute("aria-invalid") && validEmail(em.value.trim())) { err.textContent = ""; em.removeAttribute("aria-invalid"); } });
form.addEventListener("submit", function (e) {
  e.preventDefault();
  if (busy) return;
  var v = em.value.trim();
  if (!validEmail(v)) { err.textContent = "Please enter your email address, like name@example.com."; em.setAttribute("aria-invalid", "true"); em.focus(); return; }
  busy = true; btn.disabled = true; var label = btn.textContent; btn.textContent = "Sending…"; err.textContent = "";
  post(payload(v, hp ? hp.value : "")).then(function (res) {
    busy = false; btn.disabled = false; btn.textContent = label;
    if (res.status === 200) { form.hidden = true; doneEmail.textContent = v; done.hidden = false; done.focus(); return; }
    err.textContent = errText(res);
    if (res.code === "invalid_email") { em.setAttribute("aria-invalid", "true"); em.focus(); }
  });
});
function goJoin(e) {
  if (e) e.preventDefault();
  var target = form.hidden ? done : form;
  target.scrollIntoView({ behavior: REDUCE ? "auto" : "smooth", block: "center" });
  window.setTimeout(function () { if (!form.hidden) em.focus({ preventScroll: true }); else done.focus({ preventScroll: true }); }, REDUCE ? 0 : 350);
}
$$("[data-join]").forEach(function (a) { a.addEventListener("click", goJoin); });

/* ---------- swipe decks: scroll-snap track + prev/next + dots + arrow keys (controls appear only when JS runs) ---------- */
function initDeck(root) {
  var track = $(".snap", root), cards = track.children, n = cards.length;
  var nav = $(".deck-nav", root), prev = $("[data-prev]", root), next = $("[data-next]", root), count = $("[data-count]", root), dots = $("[data-dots]", root);
  var cur = 0, ticking = false;
  if (nav) nav.hidden = false;
  for (var i = 0; i < n; i++) dots.appendChild(document.createElement("i"));
  function offset(i) { return cards[i].offsetLeft - cards[0].offsetLeft; }
  function index() {
    var l = track.scrollLeft, best = 0, bd = 1e9;
    if (l >= track.scrollWidth - track.clientWidth - 2) return n - 1;
    for (var i = 0; i < n; i++) { var d = Math.abs(offset(i) - l); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  function paint() {
    ticking = false; cur = index();
    $$("i", dots).forEach(function (d, i) { d.className = i === cur ? "on" : ""; });
    count.textContent = (cur + 1) + " of " + n;
    prev.disabled = cur === 0; next.disabled = cur === n - 1;
  }
  function go(i) { i = Math.max(0, Math.min(n - 1, i)); track.scrollTo({ left: offset(i), behavior: REDUCE ? "auto" : "smooth" }); }
  track.addEventListener("scroll", function () { if (!ticking) { ticking = true; window.requestAnimationFrame(paint); } }, { passive: true });
  prev.addEventListener("click", function () { go(cur - 1); });
  next.addEventListener("click", function () { go(cur + 1); });
  track.addEventListener("keydown", function (e) {
    if (e.target !== track) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); }
  });
  window.addEventListener("resize", paint);
  paint();
}
$$("[data-deck]").forEach(initDeck);

/* ---------- "label three claims" mini quiz ---------- */
var NAMES = { conf: "Confirmed", rep: "Reported", open: "Still open" };
var WHY = {
  conf: "The source itself published it, so it is Confirmed.",
  rep: "Credible outlets say so, but the company has not confirmed it, so it is Reported.",
  open: "One anonymous post, with nothing behind it, is Still open."
};
$$("[data-mini] .q").forEach(function (q) {
  var ans = q.getAttribute("data-answer"), fb = $(".fb", q), picks = $$(".pick", q);
  picks.forEach(function (b) {
    b.addEventListener("click", function () {
      var p = b.getAttribute("data-pick");
      picks.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      if (p === ans) { fb.className = "fb ok"; fb.textContent = "Right. " + WHY[ans]; }
      else { fb.className = "fb no"; fb.textContent = "Not quite. " + NAMES[p] + " doesn't fit: " + WHY[ans]; }
    });
  });
});

/* ---------- live "this hour" ---------- */
var LABELS = { "CONFIRMED": ["conf", "Confirmed"], "REPORTED": ["rep", "Reported"], "STILL OPEN": ["open", "Still open"] };
function safeUrl(u) { try { var x = new URL(u); return x.protocol === "https:" ? x.href : ""; } catch (e) { return ""; } }
function chip(label) { var m = LABELS[String(label || "").toUpperCase()]; return m ? el("span", "chip " + m[0], m[1]) : null; }
function storyRow(title, outlet, label, url) {
  var li = el("li"), c = chip(label), href = safeUrl(url);
  if (c) li.appendChild(c);
  if (href) { var a = el("a", "st-title", title); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; li.appendChild(a); }
  else li.appendChild(el("span", "st-title", title));
  if (outlet) li.appendChild(el("span", "st-src", outlet));
  return li;
}
function mmss(s) { s = Math.round(+s || 0); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
var box = $("#hourBox"), hourTimer = 0;
function warming(msg) {
  clear(box); box.setAttribute("aria-busy", "false");
  var p = el("p", "warm", msg || "This hour is warming up. The live brief refreshes every hour, so check back in a few minutes.");
  var b = el("button", "btn line sm", "Try again"); b.type = "button"; b.addEventListener("click", loadHour);
  p.appendChild(document.createElement("br")); p.appendChild(b); box.appendChild(p);
}
function renderHour(d) {
  var stories = Array.isArray(d.stories) ? d.stories.slice(0, 5) : [], ticker = Array.isArray(d.ticker) ? d.ticker.slice(0, 12) : [];
  if (!stories.length && !ticker.length) { warming(); return; }
  clear(box); box.setAttribute("aria-busy", "false");
  var meta = el("p", "hour-meta"), t = d.generated_at ? new Date(d.generated_at) : null;
  if (t && !isNaN(t)) meta.appendChild(el("span", null, "Updated " + t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " your time"));
  if (d.articles_24h_label) meta.appendChild(el("span", null, "Our desk read " + d.articles_24h_label + " articles in the last 24 hours"));
  if (meta.firstChild) box.appendChild(meta);
  if (stories.length) {
    var ol = el("ol", "stories"); ol.setAttribute("aria-label", "Top stories this hour");
    stories.forEach(function (s) { if (s && s.title) ol.appendChild(storyRow(String(s.title), s.outlet_name || s.outlet, s.label, s.url)); });
    box.appendChild(ol);
  }
  var au = safeUrl(d.audio_url);
  if (au && au.indexOf(MEDIA_HOST) === 0 && d.audio_status !== "error") {
    var w = el("div", "hour-audio"), a = document.createElement("audio");
    w.appendChild(el("b", null, "Hear this hour" + (d.audio_seconds ? " (" + mmss(d.audio_seconds) + ")" : "") + ". AI-generated voices."));
    a.controls = true; a.preload = "none"; a.src = au; a.setAttribute("aria-label", "This hour's audio brief"); w.appendChild(a); box.appendChild(w);
  }
  if (ticker.length) {
    var det = el("details", "more"), sm = el("summary", null, "More headlines from the last hours (" + ticker.length + ")"), ul = el("ul");
    ticker.forEach(function (s) { if (s && s.headline) ul.appendChild(storyRow(String(s.headline), s.outlet_name || s.outlet, s.label, s.url)); });
    det.appendChild(sm); det.appendChild(ul); box.appendChild(det);
  }
  if (d.tidbit) box.appendChild(el("p", "tidbit", String(d.tidbit)));
}
function loadHour() {
  box.setAttribute("aria-busy", "true");
  var ctl = window.AbortController ? new AbortController() : null, timer = ctl ? window.setTimeout(function () { ctl.abort(); }, 12000) : 0;
  fetch(HOUR_URL, { mode: "cors", credentials: "omit", signal: ctl ? ctl.signal : undefined })   /* no cache:"no-store": it adds a Cache-Control request header and the CDN then answers without CORS headers */
    .then(function (r) { window.clearTimeout(timer); if (!r.ok) throw new Error("http"); return r.json(); })
    .then(renderHour, function () { window.clearTimeout(timer); warming(); });
  window.clearTimeout(hourTimer); hourTimer = window.setTimeout(loadHour, 10 * 60 * 1000);   // calm refresh every 10 minutes
}
loadHour();

/* ---------- reserve dialog: honest, nothing is charged ---------- */
var TIERS = {
  pro: { n: "Pro", get: "Your role brief every weekday, the full hourly radio-style brief, three lanes in full, full rumor and fact detail.", price: "Launches at $9.99/mo ($99/yr). Founding price $7.99/mo or $79/yr, locked while you stay subscribed.", save: "$2/mo · $24/yr · 20%", dep: "$9.99" },
  max: { n: "MAX", get: "Everything in Pro with every lane in full, morning and evening deep dives (learning, no news), all 24 white papers, the member forum.", price: "Launches at $19.99/mo ($199/yr). Founding price $14.99/mo or $149/yr, locked while you stay subscribed.", save: "$5/mo · $60/yr · 25%", dep: "$29" },
  ultra: { n: "Ultra", get: "Everything in MAX, the 21-book library, training by job title, the full Defense Playbook and the insider circle.", price: "Launches at $99.99/mo ($999/yr). Founding price $69.99/mo or $699/yr, locked while you stay subscribed.", save: "$30/mo · $360/yr · 30%", dep: "$99" }
};
var dlg = $("#dlg"), lastBtn = null;
function row(dl, k, v) { var d = el("div"); d.appendChild(el("dt", null, k)); d.appendChild(el("dd", null, v)); dl.appendChild(d); }
$$("[data-reserve]").forEach(function (b) {
  b.addEventListener("click", function () {
    var T = TIERS[b.getAttribute("data-reserve")]; if (!T) return;
    lastBtn = b; $("#dlgH").textContent = "Reserve " + T.n;
    var pu = b.getAttribute("data-pay-url"); $("#dlgGo").textContent = pu ? "Reserve for " + T.dep : "Email me the reservation link";
    if (pu) $("#dlgFine").textContent = "Secure checkout by Stripe opens in this tab. The deposit is refundable on request before launch.";
    var dl = clear($("#dlgFour"));
    row(dl, "1. What you get", T.get); row(dl, "2. Price", T.price); row(dl, "3. What you save", T.save);
    row(dl, "4. Deposit", T.dep + ", refundable on request before launch only. It reserves the founding price; it is not a subscription payment. The price shown is the price you pay at checkout.");
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  });
});
function closeDlg() { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); }
$("#dlgClose").addEventListener("click", closeDlg);
$("#dlgGo").addEventListener("click", function () { /* pay-wired */ var u = lastBtn && lastBtn.getAttribute("data-pay-url"); if (u) { window.location.assign(u); return; } lastBtn = null; closeDlg(); goJoin(); });
dlg.addEventListener("close", function () { if (lastBtn) lastBtn.focus(); });
dlg.addEventListener("click", function (e) { if (e.target === dlg) closeDlg(); });

/* ---------- Playbook link slot ---------- */
(function () {
  var a = $("#pbBuy"), note = $("#pbNote"), u = safeUrl(PLAYBOOK_URL);
  if (!u) return;   // no live checkout link yet: keep "Email me the Playbook link"
  a.textContent = "Buy the Playbook · $49"; a.href = u; a.removeAttribute("target"); a.rel = "noopener"; a.removeAttribute("data-join");
  a.removeEventListener("click", goJoin);
  note.textContent = "Secure checkout by Stripe opens in this tab. A digital download, delivered right away.";
})();
})();
