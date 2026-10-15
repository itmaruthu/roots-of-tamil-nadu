# Roots of Tamil Nadu — Madurai Never Sleeps

A fast, static, SEO-ready website that shows what is open in Madurai, hour by hour: temples, heritage sites, eateries, the flower market and stays, each pinned at its real coordinates.

Built for the **Tamil Nadu Tourism Innovation Challenge 2026** (themes: Culinary, Heritage & Culture, Digital).

## Quick start

```bash
npm run build      # validates data, then writes dist/
npm run serve      # http://localhost:8080 with production security headers
```

No dependencies to install. You need Node.js 18.17 or newer (`.nvmrc` pins 20).

## Deploy

| Host | How |
| --- | --- |
| Netlify | Connect the repo (uses `netlify.toml`), or drag the `dist/` folder onto app.netlify.com/drop. Headers come from `dist/_headers`. |
| Cloudflare Pages | Build command `npm run build`, output `dist`. Uses `dist/_headers`. |
| Vercel | Import the repo; `vercel.json` sets the build and headers. |
| GitHub Pages / any static host | Upload `dist/`. Each page also carries a CSP `<meta>` tag; add the other headers in your server config if you can. |

Before going live, set your real domain so canonical URLs, Open Graph tags and the sitemap are correct:

```bash
SITE_URL=https://your-domain.in npm run build
```

or edit `siteUrl` in `site.config.json`. Also put your team's address in `public/.well-known/security.txt`.

## Folder structure

```
├── site.config.json          Site name, URL, description, data-check date
├── src/
│   ├── data/places.json      The single source of truth: places, hours, coordinates, stories
│   ├── templates/            index.html and place.html, with {{tokens}} filled by the build
│   └── assets/
│       ├── css/main.css      Design tokens (light + dark), layout, components
│       ├── js/app.js         Home page: 24-hour clock, filters, live list, map, day planner
│       ├── js/place.js       Place pages: live open/closed status, distance from you
│       ├── js/modules/       Shared ES modules (hours, geo, map, catalog, sky, host demo, live wait, concierge, DOM helpers)
│       ├── img/              Logo, favicon, app icons, Open Graph image, icon sprite
│       └── fonts/            Self-hosted Hind Madurai, Playfair Display, IBM Plex Mono (SIL OFL)
├── public/                   Copied as-is: manifest, 404, security.txt
├── scripts/
│   ├── build.mjs             Generates dist/: home, 32 place pages, sitemap, robots, headers
│   ├── validate.mjs          Checks places.json (ids, coordinates, hours ranges, alt text)
│   ├── serve.mjs             Local server with production headers and a path-traversal guard
│   └── fetch-images.mjs      Downloads Commons photos, self-hosts them, records author + licence
├── netlify.toml, vercel.json Hosting config
└── dist/                     Build output (git-ignored)
```

## SEO

- One crawlable page per place (`/places/<slug>.html`) with a unique title, meta description and canonical URL.
- schema.org JSON-LD on every page: `HinduTemple`, `Restaurant`, `FoodEstablishment`, `Hotel`, `TouristAttraction` with `GeoCoordinates`, `PostalAddress` and `OpeningHoursSpecification`; `BreadcrumbList`; `WebSite`, `TouristDestination` and `ItemList` on the home page.
- Open Graph and Twitter cards, a 1200×630 share image, `geo.region`/`geo.placename` meta.
- `sitemap.xml` with image entries, `robots.txt`, server-rendered directory and postcards so every page is linked without JavaScript.
- Fast: no framework, self-hosted fonts with `font-display: swap`, lazy images with `srcset`, long-cache headers on assets.

## Security

- Strict Content Security Policy: scripts, styles, fonts, images and data all come from the site itself. No inline scripts or styles, no `eval`, no third-party requests.
- HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, strict referrer policy, `Permissions-Policy` (only geolocation, only for this site), COOP/CORP.
- All data is written to the page with `textContent`/`setAttribute`; nothing goes through `innerHTML`. JSON-LD is escaped at build time.
- External links use `rel="noopener noreferrer"`; photos load with `referrerpolicy="no-referrer"`.
- No cookies, analytics or third-party trackers. "Near me" is opt-in and the position never leaves the device. The day plan lives in `localStorage` only.
- `security.txt` for responsible disclosure. Data validated on every build.

## Photos

28 of the 32 places have a photo, self-hosted as optimised WebP in `src/assets/img/places/` (1200 px plus a 480 px thumbnail). All are freely licensed from Wikimedia Commons (CC0, CC BY or CC BY-SA). The author and licence for each are in `src/data/credits.json` and are shown on the place page and in the footer. Where Commons has no photo of a specific eatery, a photo of the dish it is known for stands in; its alt text and credit say "representative photo".

**Your own photos are the best upgrade**, especially of the shops themselves. Save them as `src/assets/img/places/<place-id>.webp` (and a `-480.webp` thumbnail), then point the place's `image` at them in `places.json`:

```json
"image": { "file": "own", "alt": "Kari dosai on the tawa at Konar Kadai", "local": "assets/img/places/konar-kadai.webp", "thumb": "assets/img/places/konar-kadai-480.webp" }
```

Use only photos you took or have written permission to use, and get consent from anyone shown. `npm run images` can also fetch more Commons photos with their credits.

## Theme fit and the free implementation path

| Challenge brief | In this prototype | Implementation phase (free / open tools) |
| --- | --- | --- |
| Food trails, culinary experiences | 24-hour clock, map, place pages, host demo | Same static site on Netlify or Cloudflare Pages free tier |
| Cooking networks | Voice-note-to-listing demo | Madurai Cooks Network: WhatsApp Cloud API or Telegram bot, Whisper speech-to-text, AI4Bharat IndicTrans2 for Tamil–English |
| Gourmet & craft commerce | Planned (Taste & Craft) | Product pages plus UPI intent links paid straight to the host |
| AR/VR heritage guides | Planned | WebXR with A-Frame and MindAR in the phone browser, no app install |
| Immersive storytelling, discovery | Stories on every place, street-ring map | Recorded audio stories hosted as static files |
| Trip planning | Open-now list, "My Madurai day" | Add saved plans to a Supabase free-tier database |
| AI chatbot | "Ask Roots" concierge (rule-based, in the browser) | Same answers over WhatsApp or Telegram, plus an open-weight language model for free-form questions |
| Traffic, waiting system, queue display | Live wait: darshan estimate, token queue, TV "Now serving" screen (simulated) | Supabase Realtime free tier for live tokens; web push alerts; the display is a web page on any phone or TV |

The darshan wait figures and the token queue are simulated in this prototype and labelled as such on the page.

## Host sign-up (join.html)

"List your place" lets home kitchens, messes, restaurants, hotels, guides and artisans register. On Netlify the form is captured by **Netlify Forms** (free tier, no server code); submissions appear under Site → Forms, and you can turn on email notifications there. On other hosts the page shows the details so they can be copied or sent on WhatsApp. Set your team's WhatsApp number in `site.config.json` (`joinWhatsApp`, digits with country code, e.g. `919876543210`) to switch on the "Send a voice note" button. A hidden honeypot field filters spam; the consent box is required.

## Updating places

Edit `src/data/places.json`. Hours are decimal IST hours (`21.5` = 9:30 pm); a range may run past 24 for after-midnight closing (`[8, 25]` = 8 am–1 am). `days` overrides a weekday (`"0"` = Sunday) and `[]` means closed. Run `npm run validate`.

All hours were last checked against public listings on 15 October 2026. Confirm each with the host before launch.
