// Find your roots: builds a homecoming trip for a diaspora family from their native district,
// village and family temple, using Roots places near the district and each district's landmarks.
import { el, $ } from './modules/dom.js';

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

function plan(form) {
  const d = districts.find((x) => x.id === form.district);
  const village = form.village || `your village in ${d.name}`;
  const temple = form.temple || 'your kuladeivam temple';
  const days = Number(form.days) || 5;
  const air = nearest(airports, d);
  const near = places.map((p) => ({ ...p, d: km(d, p) })).filter((p) => p.d < 110).sort((a, b) => a.d - b.d);
  const sights = near.filter((p) => ['temple', 'heritage', 'nature'].includes(p.type)).slice(0, 4);
  const food = near.filter((p) => ['meal', 'sweet', 'drink'].includes(p.type)).slice(0, 3);
  const abode = nearest(ARUPADAI, d);
  const nearMadurai = km(d, MADURAI) < 200;

  const out = [];
  out.push({ t: `Arrive at ${air.name}`, items: [`About ${road(air, d)} km to ${d.name}. Rest, then an easy evening walk.`, 'Your Ooru Nanbar calls to welcome you and confirm tomorrow.'] });
  out.push({ t: `Come home to ${village}`, items: [
    'Your Ooru Nanbar, a verified local friend, meets you in the village.',
    `Visit ${temple}: pongal or an abhishekam arranged with the temple.`,
    'Find the family street or house; meet elders who remember the family.',
    'Lunch on a banana leaf in a village home.',
    ...(form.kids ? ['For the children: write their names in Tamil on a family-tree card.'] : [])
  ] });
  out.push({ t: `Heritage of ${d.name}`, items: sights.length ? null : d.known, links: sights.map((p) => [p, road(d, p) < 5 ? 'in town' : `${road(d, p)} km`]), note: sights.length ? d.known.join(' · ') : '' });
  if (days >= 4) out.push({ t: `Taste ${d.name}`, items: food.length ? null : ['Your Ooru Nanbar takes you to the messes and sweet shops locals swear by.', 'Market morning: flowers, spices and the vessels shops.'], links: food.map((p) => [p, p.area]) });
  if (days >= 5) out.push({ t: nearMadurai ? 'Keeladi and Madurai by night' : 'Murugan\'s abode near you', items: nearMadurai
    ? ['Keeladi: a 2,600-year-old Tamil city by the Vaigai, with pots inscribed in Tamil-Brahmi.', 'Evening: Meenakshi temple, then the night food streets. Madurai never sleeps.']
    : [`${abode.name}, one of Murugan's six abodes (Arupadai Veedu), ${road(d, abode)} km away. Collect your first stamp in the Arupadai passport.`],
    links: nearMadurai ? [[places.find((p) => p.id === KEELADI.id)], [places.find((p) => p.id === 'meenakshi-amman-temple')]].filter((x) => x[0]) : (abode.id ? [[places.find((p) => p.id === abode.id)]] : []) });
  if (days >= 7) {
    out.push({ t: 'Relatives and rest', items: ['A free day for relatives, weddings or a second temple visit.', 'Tailors and silk: have a family outfit made for the next festival.'] });
    out.push({ t: 'Arupadai passport', items: [`Nearest abode: ${abode.name} (${road(d, abode)} km). Each of the six abodes gives a stamp; children collect all six over the years.`] });
  }
  const trip = out.slice(0, days);
  const last = trip.at(-1);
  last.items = [...(last.items || []), `Evening: fly home from ${air.name} with a Taste & Craft box of sweets, spices and a sungudi or silk keepsake.`];
  return { d, air, days, out: trip };
}

function render(f, res) {
  const box = $('#roots-plan');
  const title = `${f.family ? `The ${f.family} family` : 'Your family'}: homecoming to ${f.village || res.d.name}`;
  const lines = [title, `${res.d.name} district (${res.d.ta}) · ${res.days} days${f.from ? ` · from ${f.from}` : ''}`, ''];
  const days = res.out.map((day, i) => {
    lines.push(`Day ${i + 1}: ${day.t}`);
    (day.items || []).forEach((x) => lines.push(`- ${x}`));
    (day.links || []).forEach(([p, extra]) => p && lines.push(`- ${p.short || p.name}${extra ? ` (${extra})` : ''}`));
    return el('li', { class: 'roots-day' },
      el('p', { class: 'roots-day-n' }, `Day ${i + 1}`),
      el('h3', {}, day.t),
      day.items ? el('ul', {}, ...day.items.map((x) => el('li', {}, x))) : '',
      day.links?.length ? el('ul', { class: 'roots-links' }, ...day.links.filter(([p]) => p).map(([p, extra]) => placeLink(p, extra))) : '',
      day.note ? el('p', { class: 'note' }, `Also in ${res.d.name}: ${day.note}`) : '');
  });
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
    el('ol', { class: 'roots-days' }, ...days));
  box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

await load();
$('#roots-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!form.reportValidity()) return;
  const f = Object.fromEntries(new FormData(form));
  f.kids = $('#r-kids').checked; f.tamil = $('#r-tamil').checked;
  for (const k of ['village', 'temple', 'family', 'from']) f[k] = (f[k] || '').trim();
  render(f, plan(f));
});
const pre = new URLSearchParams(location.search).get('district');
if (pre && districts.some((d) => d.id === pre)) $('#r-district').value = pre;
