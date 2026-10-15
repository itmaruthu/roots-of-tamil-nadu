#!/usr/bin/env node
// Static site build: src/ + public/ -> dist/
//  - one crawlable HTML page per place with JSON-LD, Open Graph and canonical URLs
//  - home page with server-rendered directory and postcards (works without JS)
//  - sitemap.xml, robots.txt, security headers for Netlify / Cloudflare Pages / Vercel
//  - .preview/ variant for single-page hosts (Claude artifact preview); never deployed
// Zero dependencies: Node 18+.

import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './validate.mjs';
import { TYPES, GROUPS, commonsImage, commonsPage, directionsUrl, busUrl, osmUrl, imageSrc } from '../src/assets/js/modules/catalog.js';
import { DAYS, hoursFor, is24h, formatHour } from '../src/assets/js/modules/hours.js';
import { planFor, niceStop, MAIN_STANDS } from '../src/assets/js/modules/bus.js';
import { MEENAKSHI, distanceKm, formatKm, nearest, nearestStand, projector, RINGS, VAIGAI } from '../src/assets/js/modules/geo.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const config = JSON.parse(await readFile(join(ROOT, 'site.config.json'), 'utf8'));
const SITE = (process.env.SITE_URL || config.siteUrl).replace(/\/$/, '');
const data = JSON.parse(await readFile(join(SRC, 'data/places.json'), 'utf8'));
const bus = JSON.parse(await readFile(join(SRC, 'data/bus.json'), 'utf8'));
const credits = existsSync(join(SRC, 'data/credits.json')) ? JSON.parse(await readFile(join(SRC, 'data/credits.json'), 'utf8')) : {};
const places = data.places;
const BUILD_DATE = new Date().toISOString().slice(0, 10);

/* ---------- helpers ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON inside <script type="application/ld+json">: neutralise "</script>" and HTML-significant chars.
const jsonld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')}</script>`;
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
  if (!(k in vars)) throw new Error(`Template variable {{${k}}} missing`);
  return vars[k];
});
const iconSvg = (base, id, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="${base}assets/img/icons.svg#${id}"/></svg>`;
const groupOf = (p) => TYPES[p.type].group;
const hhmm = (x) => { x = ((x % 24) + 24) % 24; const h = Math.floor(x); const m = Math.round((x - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
const placeUrl = (p) => `${SITE}/places/${p.id}.html`;
const absImage = (p) => p.image.local ? `${SITE}/${p.image.local}` : commonsImage(p.image.file, 1600);
const isCommons = (img) => !img.local || credits[img.file];
const hero = { file: 'Aerial view of Madurai Meenakshi amman temple.jpg', alt: 'Aerial view of the Meenakshi Amman Temple and its gopurams rising over Madurai' };

function imageCredit(file) {
  const c = credits[file];
  const who = c ? `${esc(c.artist)}, ${esc(c.license)}` : 'Wikimedia Commons';
  return `Photo: <a href="${esc(commonsPage(file))}" rel="noopener noreferrer" target="_blank">${who}</a>`;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests'
].join('; ');

function head({ title, description, path, base, image, imageAlt, type = 'website', extra = '' }) {
  const url = `${SITE}${path}`;
  const og = image || `${SITE}/assets/img/brand/og-image.png`;
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" hreflang="en-IN" href="${esc(url)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#2A1416">
<meta name="color-scheme" content="light dark">
<meta property="og:site_name" content="${esc(config.name)}">
<meta property="og:locale" content="en_IN">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:alt" content="${esc(imageAlt || config.name)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="geo.region" content="IN-TN">
<meta name="geo.placename" content="Madurai">
<link rel="icon" href="${base}assets/img/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="${base}assets/img/brand/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="${base}assets/img/brand/icon-192.png">
<link rel="manifest" href="${base}manifest.webmanifest">
<link rel="preload" href="${base}assets/fonts/hind-madurai-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${base}assets/fonts/playfair-display-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${base}assets/fonts/ibm-plex-mono-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}assets/css/main.css">
${extra}`;
}

const header = (base) => `<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${base}index.html" aria-label="${esc(config.name)} home"><img src="${base}assets/img/brand/logo.svg" alt="" width="36" height="36"><span>Roots<small>of Tamil Nadu · Madurai</small></span></a>
    <nav class="nav" aria-label="Primary">
      <a href="${base}index.html#clock">24 hours</a>
      <a href="${base}index.html#explore">Map</a>
      <a href="${base}index.html#live">Live wait</a>
      <a href="${base}index.html#cabs">Cabs</a>
      <a href="${base}join.html">List your place</a>
      <a class="nav-cta" href="${base}index.html#explore">What's open now</a>
    </nav>
  </div>
</header>`;

function footer(base) {
  const seen = new Set();
  const imaged = [hero, ...places.filter((p) => p.image && isCommons(p.image)).map((p) => p.image)].filter((img) => !seen.has(img.file) && seen.add(img.file));
  const creditItems = imaged.map((img) => `<li>${esc(img.alt)}. ${imageCredit(img.file)}</li>`).join('\n          ');
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-note">
      <a class="brand" href="${base}index.html"><img src="${base}assets/img/brand/logo.svg" alt="" width="36" height="36"><span>Roots<small>of Tamil Nadu</small></span></a>
      <p>Authentic food, temples and heritage of Madurai, hour by hour. Built for the Tamil Nadu Tourism Innovation Challenge 2026.</p>
      <p>Opening hours come from public listings and shop signboards (last checked ${esc(config.dataCheckedOn)}). Hosts confirm their own details before launch; always check before you travel.</p>
      <p>No cookies, no ads, no trackers. "Near me" uses your location only on your device.</p>
      <p>Built by Team M2P Nexus, Madurai. <a href="mailto:${esc(config.contactEmail)}">${esc(config.contactEmail)}</a> · <a href="tel:${esc(config.contactPhone.replace(/\s/g, ''))}">${esc(config.contactPhone)}</a></p>
      <p>© ${new Date().getFullYear()} Roots of Tamil Nadu.</p>
    </div>
    <div>
      <h2>Photo credits</h2>
      <ul class="credits">
          ${creditItems}
      </ul>
      <p class="note">Temple and heritage photos are freely licensed on Wikimedia Commons; follow each link for the author and licence. Shop and hotel photos were gathered by the Roots team for this prototype and will be replaced with photos shared by each host.</p>
    </div>
  </div>
</footer>`;
}

const BOARDS = ['maroon', 'teal', 'indigo', 'ochre'];
function busPlanHtml(plan) {
  if (!plan) return '';
  const legs = plan.legs.map((l, i) => `<li>${i ? `Change at <b>${esc(niceStop(l.from))}</b>:` : 'Take'} bus ${l.buses.map((b) => `<span class="busno">${esc(b)}</span>`).join(' ')} to ${esc(niceStop(l.to))} · ${l.stops} stops</li>`).join('');
  return `<div class="bus-from"><p class="bus-head">From ${esc(niceStop(plan.from))} <span lang="ta">(${esc(bus.ta[plan.from] || '')})</span></p><p class="bus-meta">${plan.direct ? 'Direct bus' : 'One change'}${plan.fare ? ` · ₹${plan.fare} ordinary fare` : ''}</p><ol class="bus-legs">${legs}</ol><a class="bus-more" href="${esc(plan.url)}" target="_blank" rel="noopener noreferrer">Full route and live buses on MaduraiOne</a></div>`;
}

function boardColour(p) {
  if (p.board) return p.board;
  if (p.type === 'stay') return 'green';
  if (TYPES[p.type].group === 'market') return 'street';
  let h = 0; for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return BOARDS[h % BOARDS.length];
}
function signboard(p) {
  return `<span class="board board--${boardColour(p)}" role="img" aria-label="${esc(`${p.name} signboard; photo coming from the host`)}"><span class="board-name">${esc(p.name.replace(/\s*\(.*\)$/, ''))}</span><span class="board-sub">${p.since ? `Since ${esc(p.since)} · ` : ''}${esc(p.area)}</span><span class="board-note">Photo coming from the host</span></span>`;
}

function picture(p, base, width, sizes, eager = false) {
  const src = imageSrc(p, width, base);
  if (!src) return ['eat', 'stay', 'market'].includes(groupOf(p)) ? signboard(p) : '';
  const srcset = p.image.local
    ? (p.image.thumb ? ` srcset="${esc(base + p.image.thumb)} 480w, ${esc(base + p.image.local)} 1200w" sizes="${sizes}"` : '')
    : ` srcset="${[480, 960, 1600].map((w) => `${esc(commonsImage(p.image.file, w))} ${w}w`).join(', ')}" sizes="${sizes}"`;
  return `<img src="${esc(src)}"${srcset} alt="${esc(p.image.alt)}" width="${width}" height="${Math.round(width * 0.75)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer">`;
}

/* ---------- schema.org ---------- */
function openingSpec(p) {
  const specs = [];
  for (let d = 0; d < 7; d++) {
    for (const [o, c] of hoursFor(p, d)) {
      specs.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${DAYS[d]}`, opens: hhmm(o), closes: c >= 24 && c - 24 < 0.01 ? '23:59' : hhmm(c) });
    }
  }
  return specs;
}
function address(p) {
  const pin = (p.address.match(/\b(6\d{5})\b/) || [])[1];
  return { '@type': 'PostalAddress', streetAddress: p.address.replace(/,?\s*(Madurai\s*)?6\d{5}$/, '').trim(), addressLocality: 'Madurai', addressRegion: 'Tamil Nadu', postalCode: pin, addressCountry: 'IN' };
}
function placeSchema(p) {
  const schemaType = TYPES[p.type].schema;
  const obj = {
    '@context': 'https://schema.org', '@type': schemaType, '@id': `${placeUrl(p)}#place`, name: p.name, description: p.story,
    url: placeUrl(p), address: address(p), geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng },
    hasMap: directionsUrl(p), containedInPlace: { '@type': 'City', name: 'Madurai' }
  };
  if (p.image) obj.image = absImage(p);
  if (!['TouristAttraction'].includes(schemaType)) obj.openingHoursSpecification = openingSpec(p);
  if (TYPES[p.type].group === 'eat') { obj.servesCuisine = 'South Indian, Madurai'; if (p.since) obj.foundingDate = p.since; }
  if (schemaType === 'TouristAttraction') obj.touristType = ['Cultural tourism', 'Heritage tourism'];
  return obj;
}

/* ---------- static locator map (build-time SVG) ---------- */
function locator(p) {
  const fromCentre = distanceKm(p, MEENAKSHI);
  const view = fromCentre < 1.1 ? 'old' : fromCentre < 4.5 ? 'city' : 'region';
  const project = projector(view, 400);
  const [cx, cy] = project(MEENAKSHI.lat, MEENAKSHI.lng);
  const rings = RINGS.map((r) => { const h = r.km * project.scale; return `<rect x="${(cx - h).toFixed(1)}" y="${(cy - h).toFixed(1)}" width="${(2 * h).toFixed(1)}" height="${(2 * h).toFixed(1)}" class="map-ring"/>`; }).join('');
  const river = VAIGAI.map(([a, b]) => project(a, b).map((n) => n.toFixed(1)).join(',')).join(' ');
  const others = places.filter((o) => o.id !== p.id).map((o) => { const [x, y] = project(o.lat, o.lng); return x > 0 && x < 400 && y > 0 && y < 400 ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="currentColor" opacity=".25"/>` : ''; }).join('');
  const [x, y] = project(p.lat, p.lng);
  const ref = p.id === 'meenakshi-amman-temple' ? '' : `<rect x="${(cx - 6).toFixed(1)}" y="${(cy - 6).toFixed(1)}" width="12" height="12" rx="2" class="ref"/><text x="${(cx + 10).toFixed(1)}" y="${(cy - 8).toFixed(1)}" class="map-label">Meenakshi</text>`;
  return `<svg class="locator" viewBox="0 0 400 400" role="img" aria-label="${esc(`Location of ${p.name} in Madurai`)}"><polyline points="${river}" class="map-river"/>${rings}${others}${ref}<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" class="here"/></svg>`;
}

/* ---------- pages ---------- */
function postcards(base) {
  const ids = ['meenakshi-amman-temple', 'thirumalai-nayakkar-mahal', 'thiruparankundram-murugan-temple', 'kallazhagar-temple-alagar-kovil', 'koodal-azhagar-temple',
    'vandiyur-mariamman-teppakulam', 'samanar-hills', 'yoga-narasimha-temple-yanaimalai', 'gandhi-memorial-museum', 'konar-kadai'];
  return ids.map((id, i) => {
    const p = places.find((x) => x.id === id);
    const wide = i === 0 || i === 7 ? ' postcard--wide' : '';
    return `        <a class="postcard${wide}" href="${base}places/${p.id}.html" data-group="${groupOf(p)}">
          <span class="ph">${iconSvg(base, p.type)}${picture(p, base, wide ? 960 : 480, wide ? '(max-width: 960px) 100vw, 600px' : '(max-width: 960px) 50vw, 300px')}</span>
          <span class="postcard-body"><b>${esc(p.name)}</b><span>${esc(p.area)}${p.since ? ` · since ${esc(p.since)}` : ''}</span></span>
        </a>`;
  }).join('\n');
}

function directory(base) {
  return Object.entries(GROUPS).map(([key, g]) => {
    const items = places.filter((p) => groupOf(p) === key)
      .map((p) => `<li><a href="${base}places/${p.id}.html">${esc(p.name)}</a></li>`).join('');
    return `        <div data-group="${key}"><h3>${iconSvg(base, g.icon)}${esc(g.label)}</h3><ul>${items}</ul></div>`;
  }).join('\n');
}

function homeSchema() {
  return [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: config.name, url: `${SITE}/`, inLanguage: 'en-IN', description: config.description },
    { '@context': 'https://schema.org', '@type': 'TouristDestination', name: 'Madurai', description: 'The temple city of Tamil Nadu, known for the Meenakshi Amman Temple and its round-the-clock food culture.',
      geo: { '@type': 'GeoCoordinates', latitude: MEENAKSHI.lat, longitude: MEENAKSHI.lng }, touristType: ['Culinary tourism', 'Heritage tourism', 'Pilgrimage'] },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Places on Roots in Madurai',
      itemListElement: places.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: placeUrl(p), name: p.name })) }
  ];
}

async function renderHome(base, path) {
  const tpl = await readFile(join(SRC, 'templates/index.html'), 'utf8');
  return fill(tpl, {
    base,
    head: head({
      title: 'Madurai Never Sleeps · What’s open now in the temple city | Roots of Tamil Nadu',
      description: `Live opening hours and real locations for ${places.length} temples, heritage sites, eateries and stays in Madurai — from 4 am halwa to 1 am parotta.`,
      path, base, imageAlt: 'Roots of Tamil Nadu: Madurai Never Sleeps',
      extra: [`<link rel="preload" as="image" href="${esc(base + credits[hero.file].local)}" imagesrcset="${esc(base + credits[hero.file].thumb)} 480w, ${esc(base + credits[hero.file].local)} 1200w" imagesizes="100vw">`, ...homeSchema().map(jsonld)].join('\n')
    }),
    header: header(base),
    footer: footer(base),
    heroSrc: esc(base + credits[hero.file].local),
    heroSrcset: `${esc(base + credits[hero.file].thumb)} 480w, ${esc(base + credits[hero.file].local)} 1200w`,
    heroAlt: esc(hero.alt),
    heroCredit: imageCredit(hero.file),
    count: String(places.length),
    templeCount: String(places.filter((p) => p.type === 'temple').length),
    postcards: postcards(base),
    directory: directory(base)
  });
}

async function renderPlace(p) {
  const tpl = await readFile(join(SRC, 'templates/place.html'), 'utf8');
  const base = '../';
  const t = TYPES[p.type];
  const rows = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const h = hoursFor(p, d);
    const text = !h.length ? 'Closed' : is24h(h) ? 'Open 24 hours' : h.map(([o, c]) => `${formatHour(o)}–${formatHour(c)}`).join(', ');
    return `<tr data-day="${d}"><th scope="row">${DAYS[d]}</th><td>${esc(text)}</td></tr>`;
  }).join('');
  const near = nearest(p, places, 6).map(({ place: o, km }) =>
    `<li><a href="${o.id}.html" data-group="${groupOf(o)}"><span class="tile">${iconSvg(base, o.type)}</span><span><b>${esc(o.name)}</b><small>${esc(TYPES[o.type].label)} · ${formatKm(km)} away</small></span></a></li>`).join('');
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Madurai', item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name: GROUPS[t.group].label, item: `${SITE}/#explore` },
    { '@type': 'ListItem', position: 3, name: p.name, item: placeUrl(p) }] };
  const kind = { meal: 'Restaurant', sweet: 'Sweets & snacks', drink: 'Drinks', temple: 'Temple', heritage: 'Heritage site', market: 'Market', stay: 'Hotel' }[p.type] || `Shopping · ${TYPES[p.type].label}`;
  const description = `${p.name}, ${p.area}, Madurai: ${p.story} Hours: ${p.hours}.`.slice(0, 300);
  return fill(tpl, {
    base,
    head: head({
      title: `${p.name}, Madurai — hours, location & story | Roots of Tamil Nadu`,
      description, path: `/places/${p.id}.html`, base, type: 'place',
      image: p.image ? absImage(p) : null, imageAlt: p.image?.alt,
      extra: [jsonld(placeSchema(p)), jsonld(crumbs),
        `<meta property="place:location:latitude" content="${p.lat}">`, `<meta property="place:location:longitude" content="${p.lng}">`].join('\n')
    }),
    header: header(base),
    footer: footer(base),
    id: esc(p.id),
    group: groupOf(p),
    name: esc(p.name),
    groupLabel: esc(GROUPS[t.group].label),
    kind: esc(kind.charAt(0).toUpperCase() + kind.slice(1)),
    area: esc(p.area),
    since: p.since ? ` · since ${esc(p.since)}` : '',
    diet: p.diet ? `<span class="badge badge--${p.diet}">${p.diet === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}</span>` : '',
    photo: `<span class="ph">${iconSvg(base, p.type)}${picture(p, base, 960, '(max-width: 860px) 100vw, 580px', true)}</span>`,
    photoCredit: !p.image ? '' : p.image.credit === 'team'
      ? '<p class="note">Photo gathered by the Roots team for this prototype; it will be replaced with the host\'s own photo.</p>'
      : isCommons(p.image) ? `<p class="note">${imageCredit(p.image.file)}</p>` : '',
    story: esc(p.story),
    hoursText: esc(p.hours),
    hoursRows: rows,
    tips: p.tips ? `<div class="card"><h2 class="h3">Good to know</h2><ul class="tips">${p.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '',
    address: esc(p.address),
    lat: String(p.lat), lng: String(p.lng),
    directions: esc(directionsUrl(p)),
    bus: esc(busUrl(p)),
    busStop: (() => {
      const stop = bus.places[p.id];
      if (!stop) return '';
      const hub = bus.hubs[stop];
      const walk = hub ? distanceKm(p, hub) : null;
      return `Get off at <b>${esc(niceStop(stop))}</b> <span lang="ta">(${esc(bus.ta[stop] || '')})</span>${walk !== null && walk > 0.15 ? `, about ${esc(formatKm(walk))} on foot from here` : ''}.`;
    })(),
    busPlan: MAIN_STANDS.map((h) => bus.places[p.id] === h
      ? `<div class="bus-from"><p class="bus-head">${esc(niceStop(h))}</p><p>This place is at the bus stand. Walk from here.</p></div>`
      : busPlanHtml(planFor(bus, p.id, h))).join(''),
    busFetched: esc(new Date(bus.fetched).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })),
    osm: esc(osmUrl(p)),
    fromTemple: p.id === 'meenakshi-amman-temple' ? 'The centre of the old city' : `${formatKm(distanceKm(p, MEENAKSHI))} from Meenakshi Amman Temple`,
    locator: locator(p),
    nearby: near
  });
}

/* ---------- build ---------- */
async function build() {
  const problems = validate(data);
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

  await rm(DIST, { recursive: true, force: true });
  await mkdir(join(DIST, 'places'), { recursive: true });
  await cp(join(SRC, 'assets'), join(DIST, 'assets'), { recursive: true });
  await cp(join(SRC, 'data'), join(DIST, 'data'), { recursive: true });
  await cp(join(ROOT, 'public'), DIST, { recursive: true });

  await writeFile(join(DIST, 'index.html'), await renderHome('', '/'));
  const joinTpl = await readFile(join(SRC, 'templates/join.html'), 'utf8');
  await writeFile(join(DIST, 'join.html'), fill(joinTpl, {
    base: '',
    head: head({ title: 'List your place on Roots — free for Madurai hosts | Roots of Tamil Nadu', description: 'Home kitchens, messes, restaurants, sweet shops, hotels, guides and artisans in Madurai: join Roots free, get verified and appear on the live map with free Live wait tokens.', path: '/join.html', base: '' }),
    header: header(''), footer: footer(''),
    whatsapp: esc(config.joinWhatsApp || ''), email: esc(config.contactEmail), phone: esc(config.contactPhone), tel: esc(config.contactPhone.replace(/\s/g, '')), forms: esc(config.formsBackend || '')
  }));
  for (const p of places) await writeFile(join(DIST, 'places', `${p.id}.html`), await renderPlace(p));

  const urls = [{ loc: `${SITE}/`, pri: '1.0' }, { loc: `${SITE}/join.html`, pri: '0.8' }, ...places.map((p) => ({ loc: placeUrl(p), pri: p.featured ? '0.9' : '0.7', img: p.image && absImage(p) }))];
  await writeFile(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${BUILD_DATE}</lastmod><priority>${u.pri}</priority>${u.img ? `<image:image><image:loc>${esc(u.img)}</image:loc></image:image>` : ''}</url>`).join('\n')}
</urlset>
`);
  await writeFile(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  // Security headers for hosts that read them (Netlify, Cloudflare Pages). vercel.json mirrors these.
  await writeFile(join(DIST, '_headers'), `/*
  Content-Security-Policy: ${CSP}; frame-ancestors 'none'
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/data/*
  Cache-Control: public, max-age=300
`);

  // Preview variant: same page without the document wrapper (for hosts that add their own).
  const home = await renderHome('', '/');
  const headPart = home.slice(home.indexOf('<head>') + 6, home.indexOf('</head>'))
    .replace(/<meta charset[^>]*>\n|<meta name="viewport"[^>]*>\n|<meta http-equiv="Content-Security-Policy"[^>]*>\n/g, '')
    .replace('<title>', '<meta name="claude:viewport-fit-sides" content="cover">\n<title>');
  const bodyPart = home.slice(home.indexOf('<body>') + 6, home.indexOf('</body>'));
  await mkdir(join(ROOT, '.preview'), { recursive: true });
  await writeFile(join(ROOT, '.preview', 'index.html'), `<title>Madurai Never Sleeps</title>\n${headPart.replace(/<title>[^<]*<\/title>\n?/, '')}\n<div data-sprite-root>${bodyPart}</div>\n`);

  const pages = (await readdir(join(DIST, 'places'))).length + 1;
  console.log(`Built ${pages} pages for ${SITE} → dist/`);
}

await build();
