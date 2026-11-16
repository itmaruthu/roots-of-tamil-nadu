// Find your roots: builds a homecoming trip for a diaspora family from their native district,
// village and family temple, using Roots places near the district and each district's landmarks.
import { el, $, icon } from './modules/dom.js';
import { EMERGENCY, SEARCHES, PHARMACY_TIP, mapSearch } from './modules/health.js';
import { TIERS, CURRENCIES, RATES_AS_OF, currencyFor, estimate, split, money } from './modules/cost.js';
import { drawCard, shareCard, saveCard } from './modules/rootscard.js';
import { combo } from './modules/combo.js';
import { COUNTRIES } from './modules/countries.js';

const DATA_URL = new URL('../../data/places.json', import.meta.url);
const DIST_URL = new URL('../../data/districts.json', import.meta.url);
const VILLAGE_URL = (id) => new URL(`../../data/villages/${id}.json`, import.meta.url);
const NANBAR_URL = new URL('../../data/nanbars.json', import.meta.url);
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

let places = [], districts = [], airports = [], nanbars = [];

// Government first: every plan points to the state's own services before anyone else's.
const GOV = {
  stay: { href: 'https://www.ttdconline.com/', t: 'TTDC Hotel Tamil Nadu', x: 'state-run hotels' },
  tour: { href: 'https://www.ttdconline.com/', t: 'TTDC tours and coaches', x: 'state tourism corporation' },
  bus: { href: 'https://www.tnstc.in/', t: 'TNSTC buses', x: 'state transport' },
  pooja: { href: 'https://hrce.tn.gov.in/', t: 'HR&CE temple services', x: 'pongal, abhishekam and donations, where your temple is under HR&CE' },
  darshan: { href: 'https://hrce.tn.gov.in/', t: 'HR&CE darshan tickets', x: 'official temple tickets' }
};

async function load() {
  const [p, d, n] = await Promise.all([fetch(DATA_URL).then((r) => r.json()), fetch(DIST_URL).then((r) => r.json()),
    fetch(NANBAR_URL).then((r) => r.json()).catch(() => ({ nanbars: [] }))]);
  places = p.places; districts = d.districts; airports = d.airports; nanbars = n.nanbars;
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
    stay: stayTown, gov: [GOV.stay, GOV.bus] });
  out.push({ t: `Come home to ${village}`,
    see: ['Your Ooru Nanbar, a verified local friend, meets you in the village.', `${temple.charAt(0).toUpperCase()}${temple.slice(1)}: pongal or an abhishekam arranged with the temple.`,
      'Find the family street or house and meet the elders who remember the family.', ...(form.kids ? ['For the children: their names in Tamil on a family-tree card.'] : [])],
    eat: ['Lunch on a banana leaf in a village home', 'Evening tea and snacks with relatives'],
    shop: ['Flowers, coconuts and a new veshti or saree for the temple offering'],
    stay: stayVillage, gov: [GOV.pooja] });
  out.push({ t: `Heritage of ${d.name}`,
    see: local(['temple', 'heritage', 'nature']) >= 2 ? asLinks(see(3), dist) : [...d.known, ...asLinks(see(1).filter((p) => p.d < 60), dist)],
    eat: orText(asLinks(eat(2), (p) => p.area), d.food),
    shop: orText(asLinks(shop(2), (p) => p.area), d.shop),
    stay: stayTown, gov: [GOV.tour, 'Monument and museum tickets at the counter'] });
  if (days >= 4) out.push({ t: `Taste and shop ${d.name}`,
    see: ['A morning market walk with your Ooru Nanbar', ...asLinks(see(1).filter((p) => p.d < 60), dist)],
    eat: orText(asLinks(eat(3), (p) => p.area), [d.food[1] || 'Street snacks and the sweet shop your Ooru Nanbar swears by', 'A home-cooked dinner with a local family']),
    shop: orText(asLinks(shop(3), (p) => p.area), [d.shop[1] || 'Handloom, brass and spices at the town bazaar', 'Bangles and flowers for the women of the family']),
    stay: stayTown, gov: ['Poompuhar and Co-optex: the state craft and handloom showrooms'] });
  if (days >= 5) out.push(nearMadurai ? { t: 'Keeladi and Madurai by night',
    see: ['Keeladi: a 2,600-year-old Tamil city by the Vaigai, with pots inscribed in Tamil-Brahmi.', ...asLinks([places.find((p) => p.id === KEELADI.id), places.find((p) => p.id === 'meenakshi-amman-temple')].filter((p) => p && !used.has(p.id)))],
    eat: ['Madurai never sleeps: the night food streets', ...asLinks(mEat(3), (p) => p.area)],
    shop: orText(asLinks(mShop(2), (p) => p.area), ['Sungudi sarees and temple jewellery']),
    stay: mStays.length ? [...asLinks(mStays.slice(0, 2), (p) => p.area)] : ['A hotel near the Meenakshi temple'],
    gov: [GOV.darshan, 'Keeladi Museum and the Nayakkar Mahal sound and light show: tickets at the counter'] }
    : { t: 'Murugan\'s abode near you',
    see: [`${abode.name}, one of Murugan's six abodes (Arupadai Veedu), ${road(d, abode)} km away. Collect your first Arupadai passport stamp.`, ...asLinks([places.find((p) => p.id === abode.id)].filter(Boolean))],
    eat: ['Temple prasadam and a pilgrim-town meal'],
    shop: ['Prayer beads, brass lamps and pictures from the temple stalls'],
    stay: stayTown, gov: [GOV.darshan] });
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
      stay: stayTown, gov: [GOV.darshan] });
  }
  const trip = out.slice(0, days);
  const last = trip.at(-1);
  last.stay = null;
  last.go = `Evening: fly home from ${air.name} with a Taste & Craft box of sweets, spices and a keepsake.`;
  return { d, air, days, out: trip };
}

const CHECKS = ['Identity and address checked', 'Met in person by the Roots team', 'Vouched for by the village panchayat or temple committee'];
function nanbarCard(n) {
  const d = districts.find((x) => x.id === n.district);
  return el('article', { class: 'nanbar' },
    el('div', { class: 'nanbar-top' },
      el('span', { class: 'nanbar-face', 'aria-hidden': 'true' }, n.name.charAt(0)),
      el('div', {}, el('h4', {}, n.name, ' ', el('span', { lang: 'ta' }, n.ta)),
        el('p', { class: 'nanbar-where' }, `${n.village}, ${d ? d.name : ''}`),
        el('p', { class: 'nanbar-work' }, n.work)),
      el('span', { class: 'nanbar-tag' }, 'Sample')),
    el('p', { class: 'nanbar-langs' }, `Speaks ${n.langs.join(', ')}`),
    el('ul', { class: 'nanbar-knows' }, ...n.knows.map((k) => el('li', {}, k))),
    el('ul', { class: 'nanbar-checks' }, ...CHECKS.map((c) => el('li', {}, c))));
}

function render(f, res) {
  const box = $('#roots-plan');
  const title = `${f.family ? `The ${f.family} family` : 'Your family'}: homecoming to ${f.village || res.d.name}`;
  const lines = [title, `${f.taluk ? `${f.taluk} taluk, ` : ''}${res.d.name} district (${res.d.ta}) · ${res.days} days${f.from ? ` · from ${f.from}` : ''}`, ''];
  const PARTS = [['see', 'See'], ['eat', 'Eat'], ['shop', 'Shop'], ['stay', 'Stay'], ['gov', 'Govt']];
  const entry = (e) => (typeof e === 'string' ? el('li', {}, e)
    : e.href ? el('li', {}, el('a', { href: e.href, target: '_blank', rel: 'noopener noreferrer' }, e.t), e.x ? ` · ${e.x}` : '')
    : placeLink(e.p, e.x));
  const entryText = (e) => (typeof e === 'string' ? e : `${e.href ? e.t : e.p.short || e.p.name}${e.x ? ` (${e.x})` : ''}`);
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
  const subject = `Ooru Nanbar request: ${f.family || 'family'} to ${f.village || res.d.name}, ${res.d.name}`;

  // Price estimate: people, comfort and currency change it live; the request email and copied plan carry it.
  const cost = { people: f.kids ? 4 : 2, tier: 'comfortable', cur: currencyFor(f.from) };
  const both = (inr) => (cost.cur === 'INR' ? money(inr) : `${money(inr)} (about ${money(inr, cost.cur)})`);
  const costText = () => {
    const e = estimate({ days: res.days, people: cost.people, tier: cost.tier, kids: f.kids });
    return [`Estimate (${TIERS[cost.tier].label}, ${cost.people} people, flights not included): ${both(e.total)}`,
      ...e.lines.map((l) => `  ${l.label}: ${money(l.amt)}`)].join('\n');
  };
  const fullText = () => `${lines.join('\n')}\n\n${costText()}`;
  const mail = el('a', { class: 'btn' }, 'Request my Ooru Nanbar');
  const setMail = () => mail.setAttribute('href', `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${fullText()}\n\nTaluk: ${f.taluk || '-'}\nKuladeivam: ${f.temple || '-'}\nTravelling from: ${f.from || '-'}\nPeople: ${cost.people}\nTamil-English guide: ${f.tamil ? 'yes' : 'no'}`)}`);
  const copy = el('button', { class: 'btn btn--ghost', type: 'button', on: { click: async (e) => {
    try { await navigator.clipboard.writeText(fullText()); e.currentTarget.textContent = 'Copied'; } catch { e.currentTarget.textContent = 'Copy not available'; }
  } } }, 'Copy this plan');

  const select = (label, id, options, value, on) => el('label', { class: 'field' }, label,
    el('select', { id, on: { change: (e) => { on(e.target.value); update(); } } },
      ...options.map(([v, t]) => el('option', { value: v, selected: String(v) === String(value) }, t))));
  const out = el('div', { class: 'cost-out' });
  const curInput = el('input', { id: 'c-cur', value: cost.cur, maxlength: '24' });
  const curField = el('div', { class: 'field' }, el('label', { for: 'c-cur' }, 'Show in'), el('div', { class: 'combo' }, curInput));
  const curBox = combo(curInput, { strict: true, strictMessage: 'Choose a currency from the list',
    options: () => Object.entries(CURRENCIES).map(([k, c]) => ({ v: k, hint: c.name })),
    onPick: (o) => { if (o) { cost.cur = o.v; update(); } else curBox.set(cost.cur); } });
  function update() {
    const e = estimate({ days: res.days, people: cost.people, tier: cost.tier, kids: f.kids });
    const abroad = cost.cur !== 'INR';
    out.replaceChildren(
      el('p', { class: 'cost-total' }, el('b', {}, abroad ? money(e.total, cost.cur) : money(e.total)),
        el('span', {}, abroad ? ` · ${money(e.total)}` : '', ` for ${res.days} days`)),
      el('p', { class: 'cost-sub' }, `About ${abroad ? money(e.perPerson, cost.cur) : money(e.perPerson)} a person · ${abroad ? money(e.perDay, cost.cur) : money(e.perDay)} a day`),
      el('p', { class: 'note' }, `${TIERS[cost.tier].label}: ${TIERS[cost.tier].note.toLowerCase()}.`),
      el('table', { class: 'cost-table' }, el('tbody', {}, ...e.lines.map((l) => el('tr', { class: l.k === 'fee' ? 'cost-fee' : null },
        el('th', { scope: 'row' }, l.label), el('td', {}, money(l.amt)), abroad ? el('td', {}, money(l.amt, cost.cur)) : null)))),
      el('div', { class: 'split' },
        el('h4', {}, 'Where your money goes'),
        el('div', { class: 'split-bar', role: 'img', 'aria-label': split(e).map((x) => `${x.label} ${x.pct}%`).join(', ') },
          ...split(e).map((x) => el('span', { class: `split-seg split-seg--${x.k}`, style: { 'flex-grow': String(x.pct) } }))),
        el('ul', { class: 'split-list' }, ...split(e).map((x) => el('li', { class: `split-row split-row--${x.k}` },
          el('span', { class: 'split-pct' }, `${x.pct}%`),
          el('span', { class: 'split-what' }, el('b', {}, x.label), el('small', {}, x.note)),
          el('span', { class: 'split-amt' }, money(x.amt))))),
        el('p', { class: 'note' }, 'An illustration: it assumes GST-registered hotels, restaurants and cabs at 5%, and 18% GST on the Roots fee.')),
      el('p', { class: 'note' }, `Flights to India are not included. A planning estimate, not a quote: your Ooru Nanbar confirms real prices before you book. ${abroad ? `Exchange rate approximate (${RATES_AS_OF}): 1 ${cost.cur} ≈ ₹${CURRENCIES[cost.cur].rate}.` : ''}`));
    setMail();
  }
  const costPanel = el('div', { class: 'panel cost' },
    el('h3', {}, 'What this trip costs'),
    el('div', { class: 'cost-fields' },
      select('People travelling', 'c-people', Array.from({ length: 12 }, (_, i) => [i + 1, String(i + 1)]), cost.people, (v) => { cost.people = Number(v); }),
      select('Comfort', 'c-tier', Object.entries(TIERS).map(([k, t]) => [k, t.label]), cost.tier, (v) => { cost.tier = v; }),
      curField),
    out);
  update();

  // Family roots card: drawn in the browser, shared or saved from it.
  const canvas = el('canvas', { class: 'roots-card-img', width: 1080, height: 1350, role: 'img',
    'aria-label': `Roots card: ${f.family ? `the ${f.family} family` : 'our family'} is coming home to ${f.village || res.d.name}, ${res.d.name} district` });
  const fileName = `roots-${(f.family || 'family').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${res.d.id}`;
  const shareText = `${f.family ? `The ${f.family} family` : 'Our family'} is coming home to ${f.village || res.d.name}, ${res.d.name}. Find your roots: ${location.origin}${location.pathname}`;
  const shareBtn = el('button', { class: 'btn', type: 'button', on: { click: async (e) => {
    const b = e.currentTarget;
    try { const r = await shareCard(canvas, fileName, shareText); b.textContent = r === 'saved' ? 'Saved: share it from your photos' : r === 'shared' ? 'Shared' : 'Share my roots card'; } catch { b.textContent = 'Sharing not available'; }
  } } }, 'Share my roots card');
  const saveBtn = el('button', { class: 'btn btn--ghost', type: 'button', on: { click: () => saveCard(canvas, fileName) } }, 'Save image');
  const cardPanel = el('div', { class: 'panel roots-card' },
    el('h3', {}, 'Your family roots card'),
    el('p', { class: 'note' }, 'Share it on WhatsApp with the family. It is made on this device; nothing is uploaded.'),
    canvas,
    el('div', { class: 'roots-actions' }, shareBtn, saveBtn));
  drawCard(canvas, { family: f.family, village: f.village, taluk: f.taluk, temple: f.temple, from: f.from, days: res.days, d: res.d, districts, site: `${location.origin}${location.pathname}` })
    .catch((err) => console.error(err));

  const dkm = (n) => { const nd = districts.find((x) => x.id === n.district); return nd ? km(res.d, nd) : 1e9; };
  const mine = [...nanbars].sort((a, b) => dkm(a) - dkm(b))[0];
  const nanbarPanel = mine ? el('div', { class: 'panel nanbar-match', id: 'your-nanbar' },
    el('h3', {}, 'Your Ooru Nanbar'),
    nanbarCard(mine),
    el('p', { class: 'note' }, `A sample profile. After your request, Roots matches a verified Ooru Nanbar from ${f.village || res.d.name} and sends you their name, photo and phone number.`)) : '';

  box.replaceChildren(
    el('div', { class: 'roots-plan-head' },
      el('div', {}, el('p', { class: 'eyebrow' }, `${f.taluk ? `${f.taluk} taluk · ` : ''}${res.d.name} · ${res.d.ta}`), el('h2', {}, title),
        el('p', { class: 'lead' }, `A ${res.days}-day homecoming. Nearest airport: ${res.air.name}, about ${road(res.air, res.d)} km from ${res.d.name}.`)),
      el('div', { class: 'roots-actions' },
        mail, copy,
        el('p', { class: 'note' }, `Or email ${EMAIL}. A Roots team member replies within two working days.`))),
    el('div', { class: 'roots-extras', id: 'roots-extras' }, el('div', { class: 'roots-stack' }, cardPanel, nanbarPanel), costPanel),
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

// District → taluk → village: each a type-and-select field. Taluks and villages load per district.
const fDistrict = $('#r-district'), iDistrict = $('#r-district-name'), iTaluk = $('#r-taluk'), iVillage = $('#r-village');
let taluks = {};
const talukOf = (name) => Object.keys(taluks).find((t) => t.toLowerCase() === name.trim().toLowerCase());

async function setDistrict(d) {
  fDistrict.value = d ? d.id : '';
  talukBox.set(''); villageBox.set('');
  taluks = {};
  for (const i of [iTaluk, iVillage]) { i.disabled = !d; i.placeholder = d ? 'Loading…' : 'Choose a district first'; }
  if (!d) return;
  try { taluks = (await fetch(VILLAGE_URL(d.id)).then((r) => r.json())).taluks; } catch { taluks = {}; }
  if (fDistrict.value !== d.id) return; // the visitor has already chosen another district
  const has = Object.keys(taluks).length;
  iTaluk.placeholder = has ? `Type or choose a taluk in ${d.name}` : 'Type the taluk';
  iVillage.placeholder = has ? 'Type or choose a village' : 'Type the village or town';
}

const districtBox = combo(iDistrict, { strict: true, strictMessage: 'Choose a district from the list',
  options: () => districts.map((d) => ({ v: d.name, hint: d.ta, id: d.id })),
  onPick: (o) => { const d = o && districts.find((x) => x.id === o.id); if ((d ? d.id : '') !== fDistrict.value) setDistrict(d); } });
const talukBox = combo(iTaluk, { empty: 'Not on the list? Newer taluks may be missing: keep what you typed.',
  options: () => Object.keys(taluks).map((t) => ({ v: t, hint: `${taluks[t].length} villages` })),
  onPick: () => { villageBox.set(''); } });
const villageBox = combo(iVillage, {
  options: () => {
    const t = talukOf(iTaluk.value);
    return t ? taluks[t] : Object.entries(taluks).flatMap(([name, list]) => list.map((v) => ({ v, hint: `${name} taluk`, taluk: name })));
  },
  onPick: (o) => { if (o?.taluk && !iTaluk.value.trim()) talukBox.set(o.taluk); } });
combo($('#r-from'), { options: () => COUNTRIES, empty: 'Not on the list? Keep what you typed.' });

async function go() {
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Planning…';
  try {
    await ready;
    const f = Object.fromEntries(new FormData(form));
    f.kids = $('#r-kids').checked; f.tamil = $('#r-tamil').checked;
    for (const k of ['taluk', 'village', 'temple', 'family', 'from']) f[k] = (f[k] || '').trim();
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

// Arriving with a district chosen (from the home page or a shared link): show the plan straight away.
const qs = new URLSearchParams(location.search);
const pre = qs.get('district');
if (pre) {
  ready.then(async () => {
    const d = districts.find((x) => x.id === pre);
    if (!d) return;
    districtBox.set(d.name);
    await setDistrict(d);
    const village = (qs.get('village') || '').slice(0, 60);
    const taluk = (qs.get('taluk') || '').slice(0, 60) || Object.keys(taluks).find((t) => village && taluks[t].some((v) => v.toLowerCase() === village.toLowerCase())) || '';
    talukBox.set(taluk); villageBox.set(village);
    for (const k of ['temple', 'family', 'from']) if (qs.get(k)) $(`#r-${k}`).value = qs.get(k).slice(0, 60);
    if (['3', '5', '7'].includes(qs.get('days'))) $('#r-days').value = qs.get('days');
    go();
  });
}

// The Ooru Nanbar section under the form: who the family will meet.
ready.then(() => {
  const list = $('#nanbar-list');
  if (list && nanbars.length) list.replaceChildren(...nanbars.map((n) => el('li', {}, nanbarCard(n))));
}).catch(() => {});
