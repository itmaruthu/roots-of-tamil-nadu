// Find your roots: builds a homecoming trip for a diaspora family from their native district,
// village and family temple, using Roots places near the district and each district's landmarks.
import { el, $, icon } from './modules/dom.js';
import { EMERGENCY, SEARCHES, PHARMACY_TIP, mapSearch } from './modules/health.js';

const DATA_URL = new URL('../../data/places.json', import.meta.url);
const DIST_URL = new URL('../../data/districts.json', import.meta.url);
const PLACE_URL = (id) => new URL(`../../places/${id}.html`, import.meta.url).href;
const EMAIL = document.querySelector('script[data-email]')?.dataset.email || '';

// Murugan's six abodes (Arupadai Veedu): a stamp-passport circuit any family can follow.
const ARUPADAI = [
  { name: 'Thiruparankundram', lat: 9.879, lng: 78.071, id: 'thiruparankundram-murugan-temple' },
  { name: 'Tiruchendur', lat: 8.496, lng: 78.125 },
  { name: 'Palani', lat: 10.449, lng: 77.520, id: 'palani-murugan-temple' },
  { name: 'Swamimalai', lat: 10.957, lng: 79.326 },
  { name: 'Tiruttani', lat: 13.176, lng: 79.611 },
  { name: 'Pazhamudircholai', lat: 10.099, lng: 78.221, id: 'pazhamudircholai-murugan-temple' }
];
const KEELADI = { lat: 9.862, lng: 78.181, id: 'keeladi-museum' };
const MADURAI = { lat: 9.9195, lng: 78.1193 };

const km = (a, b) => {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const road = (a, b) => Math.round(km(a, b) * 1.3 / 5) * 5; // straight line × 1.3 ≈ road distance
const nearest = (list, p) => list.map((x) => ({ ...x, d: km(p, x) })).sort((a, b) => a.d - b.d)[0];

let places = [], districts = [], airports = [];

async function load() {
  const [p, d] = await Promise.all([fetch(DATA_URL).then((r) => r.json()), fetch(DIST_URL).then((r) => r.json())]);
  places = p.places; districts = d.districts; airports = d.airports;
}

function placeLink(p, extra = '') {
  return el('li', {}, el('a', { href: PLACE_URL(p.id) }, p.short || p.name), extra ? ` · ${extra}` : '');
}

// A day has four parts: what to see, where to eat, what to buy and where to sleep.
// Entries are plain text or { p, x }: a Roots place (linked) with a short note.
const nearMaduraiCheck = (d) => km(d, MADURAI) < 200;
function plan(form) {
  const d = districts.find((x) => x.id === form.district);
  const village = form.village || `your village in ${d.name}`;
  const temple = form.temple || 'your kuladeivam temple';
  const days = Number(form.days) || 5;
  const air = nearest(airports, d);
  const near = places.map((p) => ({ ...p, d: km(d, p) })).filter((p) => p.d < 110).sort((a, b) => a.d - b.d);
  const dist = (p) => (road(d, p) < 5 ? 'in town' : `${road(d, p)} km`);
  const used = new Set();
  const queue = (types, src = near) => (n) => {
    const got = src.filter((p) => types.includes(p.type) && !used.has(p.id)).slice(0, n);
    got.forEach((p) => used.add(p.id));
    return got;
  };
  const see = queue(['temple', 'heritage', 'nature']);
  const eat = queue(['meal', 'sweet', 'drink']);
  const shop = queue(['dress', 'jewel', 'homeware', 'grocery', 'market', 'vegetable']);
  const madurai = places.map((p) => ({ ...p, d: km(MADURAI, p) })).filter((p) => p.d < 12).sort((a, b) => a.d - b.d);
  const mEat = queue(['meal', 'sweet', 'drink'], madurai);
  const mShop = queue(['dress', 'jewel', 'homeware'], madurai);
  const stays = near.filter((p) => p.type === 'stay' && p.d < 60);
  const mStays = madurai.filter((p) => p.type === 'stay');
  const abodes = ARUPADAI.map((x) => ({ ...x, d: km(d, x) })).sort((a, b) => a.d - b.d);
  const abode = abodes[0];
  const abode2 = nearMaduraiCheck(d) ? abodes[0] : abodes[1];
  const nearMadurai = km(d, MADURAI) < 200;
  const local = (types) => near.filter((p) => types.includes(p.type) && p.d < 40).length;
  const asLinks = (arr, note) => arr.map((p) => ({ p, x: note ? note(p) : '' }));
  const orText = (arr, text) => (arr.length ? arr : text);
  const stayTown = stays.length
    ? [...asLinks(stays.slice(0, 2), (p) => p.area), 'or a verified Roots homestay']
    : [`A hotel in ${d.name} town, or a verified homestay near ${village} arranged by your Ooru Nanbar`];
  const stayVillage = [`A village homestay arranged by your Ooru Nanbar, or back to your hotel${stays[0] ? ` (${stays[0].short || stays[0].name})` : ''}`];

  const out = [];
  out.push({ t: `Arrive at ${air.name}`,
    see: [`About ${road(air, d)} km to ${d.name}. Settle in, then an easy evening walk.`, ...asLinks(see(1), dist)],
    eat: orText(asLinks(eat(1), (p) => p.area), [`${d.food[0]} for your first dinner`]),
    shop: ['A local SIM card and a little cash for temples and bus fares'],
    stay: stayTown });
  out.push({ t: `Come home to ${village}`,
    see: ['Your Ooru Nanbar, a verified local friend, meets you in the village.', `${temple.charAt(0).toUpperCase()}${temple.slice(1)}: pongal or an abhishekam arranged with the temple.`,
      'Find the family street or house and meet the elders who remember the family.', ...(form.kids ? ['For the children: their names in Tamil on a family-tree card.'] : [])],
    eat: ['Lunch on a banana leaf in a village home', 'Evening tea and snacks with relatives'],
    shop: ['Flowers, coconuts and a new veshti or saree for the temple offering'],
    stay: stayVillage });
  out.push({ t: `Heritage of ${d.name}`,
    see: local(['temple', 'heritage', 'nature']) >= 2 ? asLinks(see(3), dist) : [...d.known, ...asLinks(see(1).filter((p) => p.d < 60), dist)],
    eat: orText(asLinks(eat(2), (p) => p.area), d.food),
    shop: orText(asLinks(shop(2), (p) => p.area), d.shop),
    stay: stayTown });
  if (days >= 4) out.push({ t: `Taste and shop ${d.name}`,
    see: ['A morning market walk with your Ooru Nanbar', ...asLinks(see(1).filter((p) => p.d < 60), dist)],
    eat: orText(asLinks(eat(3), (p) => p.area), [d.food[1] || 'Street snacks and the sweet shop your Ooru Nanbar swears by', 'A home-cooked dinner with a local family']),
    shop: orText(asLinks(shop(3), (p) => p.area), [d.shop[1] || 'Handloom, brass and spices at the town bazaar', 'Bangles and flowers for the women of the family']),
    stay: stayTown });
  if (days >= 5) out.push(nearMadurai ? { t: 'Keeladi and Madurai by night',
    see: ['Keeladi: a 2,600-year-old Tamil city by the Vaigai, with pots inscribed in Tamil-Brahmi.', ...asLinks([places.find((p) => p.id === KEELADI.id), places.find((p) => p.id === 'meenakshi-amman-temple')].filter((p) => p && !used.has(p.id)))],
    eat: ['Madurai never sleeps: the night food streets', ...asLinks(mEat(3), (p) => p.area)],
    shop: orText(asLinks(mShop(2), (p) => p.area), ['Sungudi sarees and temple jewellery']),
    stay: mStays.length ? [...asLinks(mStays.slice(0, 2), (p) => p.area)] : ['A hotel near the Meenakshi temple'] }
    : { t: 'Murugan\'s abode near you',
    see: [`${abode.name}, one of Murugan's six abodes (Arupadai Veedu), ${road(d, abode)} km away. Collect your first Arupadai passport stamp.`, ...asLinks([places.find((p) => p.id === abode.id)].filter(Boolean))],
    eat: ['Temple prasadam and a pilgrim-town meal'],
    shop: ['Prayer beads, brass lamps and pictures from the temple stalls'],
    stay: stayTown });
  if (days >= 7) {
    out.push({ t: 'Relatives and rest',
      see: ['A free day for relatives, a wedding or a second temple visit', ...asLinks(see(1), dist)],
      eat: ['A family feast at home with relatives'],
      shop: ['Tailors and silk: a family outfit for the next festival', ...asLinks(shop(1), (p) => p.area)],
      stay: stayTown });
    out.push({ t: 'Arupadai passport and goodbyes',
      see: [`${abode2.name}, another of Murugan's six abodes (${road(d, abode2)} km): one more Arupadai passport stamp. Children collect all six over the years.`, ...asLinks([places.find((p) => p.id === abode2.id)].filter(Boolean))],
      eat: orText(asLinks(eat(1), (p) => p.area), [d.food[0]]),
      shop: [`Take-home gifts: ${d.shop[0]}`],
      stay: stayTown });
  }
  const trip = out.slice(0, days);
  const last = trip.at(-1);
  last.stay = null;
  last.go = `Evening: fly home from ${air.name} with a Taste & Craft box of sweets, spices and a keepsake.`;
  return { d, air, days, out: trip };
}

function render(f, res) {
  const box = $('#roots-plan');
  const title = `${f.family ? `The ${f.family} family` : 'Your family'}: homecoming to ${f.village || res.d.name}`;
  const lines = [title, `${res.d.name} district (${res.d.ta}) · ${res.days} days${f.from ? ` · from ${f.from}` : ''}`, ''];
  const PARTS = [['see', 'See'], ['eat', 'Eat'], ['shop', 'Shop'], ['stay', 'Stay']];
  const entry = (e) => (typeof e === 'string' ? el('li', {}, e) : placeLink(e.p, e.x));
  const entryText = (e) => (typeof e === 'string' ? e : `${e.p.short || e.p.name}${e.x ? ` (${e.x})` : ''}`);
  const days = res.out.map((day, i) => {
    lines.push(`Day ${i + 1}: ${day.t}`);
    for (const [k, label] of PARTS) if (day[k]?.length) lines.push(`  ${label}: ${day[k].map(entryText).join('; ')}`);
    if (day.go) lines.push(`  ${day.go}`);
    return el('li', { class: 'roots-day' },
      el('p', { class: 'roots-day-n' }, `Day ${i + 1}`),
      el('h3', {}, day.t),
      ...PARTS.filter(([k]) => day[k]?.length).map(([k, label]) => el('div', { class: `roots-part roots-part--${k}` },
        el('p', { class: 'roots-part-l' }, label), el('ul', {}, ...day[k].map(entry)))),
      day.go ? el('p', { class: 'roots-go' }, day.go) : '');
  });
  lines.push('', `Emergency: ${EMERGENCY.map((e) => `${e.n} ${e.label}`).join(' · ')}`);
  const text = lines.join('\n');
  const subject = `Ooru Nanbar request: ${f.family || 'family'} to ${f.village || res.d.name}, ${res.d.name}`;
  const mail = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${text}\n\nKuladeivam: ${f.temple || '-'}\nTravelling from: ${f.from || '-'}\nTamil-English guide: ${f.tamil ? 'yes' : 'no'}`)}`;
  const copy = el('button', { class: 'btn btn--ghost', type: 'button', on: { click: async (e) => {
    try { await navigator.clipboard.writeText(text); e.currentTarget.textContent = 'Copied'; } catch { e.currentTarget.textContent = 'Copy not available'; }
  } } }, 'Copy this plan');

  box.replaceChildren(
    el('div', { class: 'roots-plan-head' },
      el('div', {}, el('p', { class: 'eyebrow' }, `${res.d.name} · ${res.d.ta}`), el('h2', {}, title),
        el('p', { class: 'lead' }, `A ${res.days}-day homecoming. Nearest airport: ${res.air.name}, about ${road(res.air, res.d)} km from ${res.d.name}.`)),
      el('div', { class: 'roots-actions' },
        el('a', { class: 'btn', href: mail }, 'Request my Ooru Nanbar'), copy,
        el('p', { class: 'note' }, `Or email ${EMAIL}. A Roots team member replies within two working days.`))),
    el('ol', { class: 'roots-days' }, ...days),
    el('div', { class: 'health' },
      el('h3', {}, icon('health'), `Health & safety in ${res.d.name}`),
      el('div', { class: 'chips' }, ...SEARCHES.map((x) => el('a', { class: 'btn btn--sm btn--ghost', href: mapSearch(x.q, res.d.lat, res.d.lng), target: '_blank', rel: 'noopener noreferrer' }, icon(x.icon), x.label))),
      el('p', { class: 'note' }, `The government hospital in ${res.d.name} town has a 24-hour casualty ward. Your Ooru Nanbar will share the nearest hospital and pharmacy to your village before you arrive.`),
      el('p', { class: 'health-l' }, 'Emergency numbers'),
      el('ul', { class: 'health-nums' }, ...EMERGENCY.map((e) => el('li', {}, el('a', { class: 'health-num', href: `tel:${e.n}` }, icon('phone'), el('b', {}, e.n)), el('span', {}, e.label)))),
      el('p', { class: 'note' }, PHARMACY_TIP)));
  box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Load data once; the button works even if clicked before the data arrives.
const ready = load();
const form = $('#roots-form');

async function go() {
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Planning…';
  try {
    await ready;
    const f = Object.fromEntries(new FormData(form));
    f.kids = $('#r-kids').checked; f.tamil = $('#r-tamil').checked;
    for (const k of ['village', 'temple', 'family', 'from']) f[k] = (f[k] || '').trim();
    render(f, plan(f));
  } catch (err) {
    const box = $('#roots-plan');
    box.replaceChildren(el('p', { class: 'note' }, 'Sorry, the plan could not load. Please refresh the page and try again.'));
    box.hidden = false;
    console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = 'Plan my homecoming';
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (form.reportValidity()) go();
});

// Arriving from the home page with a district chosen: show the plan straight away.
const pre = new URLSearchParams(location.search).get('district');
if (pre) {
  ready.then(() => {
    if (!districts.some((d) => d.id === pre)) return;
    $('#r-district').value = pre;
    go();
  });
}
