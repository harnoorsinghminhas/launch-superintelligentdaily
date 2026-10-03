/* Superintelligent Daily holding page: the sign-up box.
   The request, payload and honeypot are copied from the hub (hub-my-brief/assets/app.js): POST {email, hp, site, landing_path, tz, query?}
   to the Signal API. Every node is set with textContent (no innerHTML), so the page runs under require-trusted-types-for 'script'. */
(function () {
"use strict";
var API = "https://acp9reat3l.execute-api.us-east-1.amazonaws.com/signal/request-link";
var SITE = "superintelligentdaily.com";
var LANDING_RE = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]{0,199}$/;   // same shape the API accepts
var EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

function payload(email, hp) {
  // The request-link schema is strict: only email, hp, site, landing_path, tz, query, profile are sent.
  var b = { email: email, hp: hp || "", site: SITE };
  if (LANDING_RE.test(location.pathname)) b.landing_path = location.pathname;
  try { var tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (tz && tz.length <= 40) b.tz = tz; } catch (e) { /* no zone: the API falls back */ }
  var q = location.search;
  if (q && q.length <= 2048 && /[?&](utm_[a-z]+|ref)=/i.test(q)) b.query = q;   // campaign attribution only
  return b;
}
function post(body) {
  var ctl = window.AbortController ? new AbortController() : null, timer = ctl ? window.setTimeout(function () { ctl.abort(); }, 15000) : 0;
  return fetch(API, { method: "POST", mode: "cors", credentials: "omit", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { window.clearTimeout(timer); return { status: r.status, code: j && j.error }; }); },
          function () { window.clearTimeout(timer); return { status: 0, code: "network" }; });
}
function errText(res) {
  var s = res.status, c = res.code;
  if (s === 400 && c === "invalid_email") return "That email address doesn't look right. Check it for a typo?";
  if (s === 400) return "Something in the form didn't go through. Please try again.";
  if (s === 415) return "Your browser sent the form in a format we can't read. Refresh the page and try again.";
  if (s === 429) return "Lots of sign-ups from your network just now. Wait a minute, then try again.";
  if (s === 403) return "Sign-up only works on our own site. Open superintelligentdaily.com and try again.";
  if (s >= 500) return "Our sign-up desk hit a snag. Please try again in a moment.";
  return "We couldn't reach the sign-up desk. Check your connection and try again.";
}
function validEmail(v) { return v.length <= 254 && EMAIL_RE.test(v); }

var form = document.getElementById("join");
if (!form) return;
var em = form.querySelector('input[type="email"]'), hp = form.querySelector('input[name="website"]'), err = form.querySelector(".js-err");
var btn = form.querySelector('button[type="submit"]'), done = document.getElementById("done"), doneEmail = document.getElementById("done-email");
var busy = false;

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
  busy = true; btn.disabled = true; var label = btn.textContent; btn.textContent = "Sending\u2026"; err.textContent = "";
  post(payload(v, hp ? hp.value : "")).then(function (res) {
    busy = false; btn.disabled = false; btn.textContent = label;
    if (res.status === 200) {
      form.hidden = true; doneEmail.textContent = v; done.hidden = false; done.focus();
      return;
    }
    err.textContent = errText(res);
    if (res.code === "invalid_email") { em.setAttribute("aria-invalid", "true"); em.focus(); }
  });
});
})();
