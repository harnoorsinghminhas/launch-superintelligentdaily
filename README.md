# Superintelligent Daily: launching soon (superintelligentdaily.com)

A static "Launching soon" holding page, served by GitHub Pages at https://superintelligentdaily.com/. No build step, no dependencies, no secrets.
Made 2026-10-03 at Harnoor's request. When the real site goes live, the DNS records for this domain are repointed and this repo's
Pages site is switched off (see the go-live runbook, section "Pages holding pages").

## Files
| File | What it is |
|---|---|
| `index.html` | The page: rocket, name, "Launching soon", one line on the site, the sign-up box, the Founders' Preview note, privacy link. |
| `assets/style.css` | All styling. The palette is the `:root` block at the top (the only per-site part). |
| `assets/app.js` | The sign-up box. Same request, payload and honeypot as the hub's app.js; posts to the Signal API with `site` = `superintelligentdaily.com`. |
| `assets/logo.svg` | PLACEHOLDER text wordmark (the logo slot). |
| `assets/favicon.svg`, `assets/og.png` | Browser icon and the 1200x630 link-preview image. |
| `CNAME` | The custom domain GitHub Pages serves. Do not delete it. |

## How to swap in the real logo (one place)
The logo appears once, as a single image in `index.html`:

```html
<img class="logo" id="logo" src="assets/logo.svg" width="..." height="38" alt="Superintelligent Daily">
```

1. **Same file name (easiest).** Replace `assets/logo.svg` with your logo saved as an SVG. Nothing else changes.
2. **PNG or another name.** Put the file in `assets/` (for example `assets/logo.png`) and edit that one tag: set `src="assets/logo.png"`,
   set `height` to 38 (the CSS shows it 38px tall on phones, 44px on desktop and keeps the ratio), and set `width` to
   the logo's width at that height (width = 38 x logo width / logo height). Keep the `alt` text.
3. Use a logo that works on this page's background (light). Commit and push to `main`; GitHub Pages republishes in about a minute.
4. Optional: the link-preview image `assets/og.png` and the favicon `assets/favicon.svg` are separate files, replace them the same way.

## Notes
- The sign-up button posts the visitor's email to the Signal API (`request-link`), which emails a confirmation link. The API must allow this
  page's origin (`https://superintelligentdaily.com`) in its CORS list.
- The content-security policy is in a `<meta>` tag in `index.html` (GitHub Pages cannot set response headers). It allows only this site's own
  files plus a POST to the Signal API. If you add anything external (fonts, analytics), add it to that policy.
