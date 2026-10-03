# Superintelligent Daily (superintelligentdaily.com)

Static MVP served by GitHub Pages at https://superintelligentdaily.com/. Est. 2026-10-03 (Harnoor, Telegram 19:16). No build step, no
dependencies, no secrets. The earlier rocket page is kept at `/launching-soon.html` (noindex).

## Files
| File | What it is |
|---|---|
| `index.html` | The site: terms block, hero + sign-up, live "This hour", "SI in 60 seconds" swipe cards, today's Gemini audio sample, plans, Playbook, FAQ. |
| `assets/site.css`, `assets/site.js` | All styling and behaviour. Every DOM node is built with `textContent` (page runs under `require-trusted-types-for 'script'`). |
| `assets/logo.svg` | PLACEHOLDER text wordmark (the logo slot, see below). |
| `assets/icon.svg`, `assets/og.png` | Favicon and the 1200x630 link card. |
| `assets/audio/si-in-60-seconds-2026-10-03.mp3` | Today's sample (72.7 s). Script + voice in `F:/launch-pages/_gen/mvp_audio.py`; made with Gemini TTS (voice Sulafat) through `gemini_audio_service.render_cached`. |
| `launching-soon.html`, `assets/style.css`, `assets/app.js` | The archived rocket page and its two files. `_gen/build.py` still writes `style.css`/`app.js`; it has `skip_index=True` for this key, so it never touches `index.html`, `404.html` or this README. |
| `CNAME`, `.nojekyll`, `robots.txt`, `sitemap.xml` | Pages plumbing. Do not delete `CNAME`. |

## Logo slot (one place)
`index.html` has a single `<img class="logo" id="logo" src="assets/logo.svg" width="247" height="38">` (also in `404.html`). Replace `assets/logo.svg`
with the real logo under the same name, or change that one tag.

## Playbook checkout link slot (needs the owner)
There is no live checkout link yet (the only Playbook link in Stripe is TEST mode, which cannot take a real card). The Playbook card says
"Email me the Playbook link". When the live Stripe payment link exists, paste it into `PLAYBOOK_URL` at the top of `assets/site.js`
(an `https://buy.stripe.com/...` link); the button then becomes "Buy the Playbook" and opens it in a new tab. Nothing else changes.

## Live data
"This hour" reads `https://media.theagentsignal.com/ironman/audio/si-preview/hourly/latest.json` (CORS `*`) and shows a calm "warming up"
state if it cannot. The media host is in the CSP `connect-src` and `media-src` (the policy is a `<meta>` tag; Pages cannot set headers).

## Sign-up
POSTs `{email, hp, site: "superintelligentdaily.com", landing_path, tz, query?}` to the Signal API `request-link`. CORS for this origin is already allowed.
