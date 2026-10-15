// Home page: 24-hour clock, filters, live list, real-coordinate map, day planner and host demo.
import { el, icon, $, $$, store, prefersReducedMotion, spriteUrl } from './modules/dom.js';
import { DAYS_SHORT, nowInMadurai, isOpen, status, hoursFor, is24h, formatHour } from './modules/hours.js';
import { TYPES, GROUPS, groupOf, imageSrc, directionsUrl, busUrl } from './modules/catalog.js';
import { distanceKm, formatKm, MEENAKSHI, VIEWS } from './modules/geo.js';
import { drawMap } from './modules/map.js';
import { initSky, paintSky } from './modules/sky.js';
import { initHostDemo } from './modules/host.js';
import { initLiveWait } from './modules/livewait.js';
import { initConcierge } from './modules/concierge.js';

const DATA_URL = new URL('../../data/places.json', import.meta.url);
const PLACE_URL = (id) => new URL(`../../places/${id}.html`, import.meta.url).href;
const QUICK = [[4, '4 am halwa', 'prema-vilas'], [5, '5 am temple', 'meenakshi-amman-temple'], [13, '1 pm meals', 'jaya-vilas'],
  [18.75, '6:45 pm light show', 'thirumalai-nayakkar-mahal'], [21, '9 pm palanquin', 'meenakshi-amman-temple'], [23.5, '11:30 pm parotta', 'new-janani-mess']];

const now = nowInMadurai();
let liveWait = { update() {} };
const state = {
  places: [], moments: [],
  day: now.day, hour: 21, filter: 'all', view: 'region',
  tab: 'open', showAll: false, tilt: store.get('roots-3d', true),
  selected: 'meenakshi-amman-temple', plan: store.get('roots-plan', []), me: null, timer: null
};

init().catch((err) => {
  console.error(err);
  const h = document.querySelector('#open-head'); if (h) h.textContent = 'Could not load places. Please refresh.';
});

async function init() {
  fixBrokenImages(document);
  initHostDemo();
  initSky($('#stars'));
  const res = await fetch(DATA_URL, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`places.json ${res.status}`);
  const data = await res.json();
  state.places = data.places;
  state.moments = data.moments;
  buildControls();
  const ctx = { state, places: state.places, placeUrl: PLACE_URL };
  liveWait = initLiveWait(ctx);
  initConcierge(ctx);
  renderFeatured();
  render();
}

/* ---------- Controls ---------- */
function buildControls() {
  const days = $('#days');
  DAYS_SHORT.forEach((d, i) => days.append(el('button', {
    type: 'button', class: 'chip chip--sm', 'aria-pressed': 'false', dataset: { day: i },
    on: { click: () => { state.day = i; render(); } }
  }, d)));

  const moments = $('#moments');
  QUICK.forEach(([h, label, id]) => moments.append(el('button', {
    type: 'button', class: 'chip', 'aria-pressed': 'false', dataset: { hour: h },
    on: { click: () => { stop(); setHour(h); state.selected = id; render(); } }
  }, label)));

  $$('#status-tabs button').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; state.showAll = false; render(); }));
  $('#more').addEventListener('click', () => { state.showAll = !state.showAll; render(); });
  markSeason();
  const filters = $('#filters');
  const all = el('button', { type: 'button', class: 'chip', 'aria-pressed': 'true', dataset: { filter: 'all' }, on: { click: () => setFilter('all') } },
    'All ', el('span', { class: 'n' }, state.places.length));
  filters.append(all);
  for (const [key, g] of Object.entries(GROUPS)) {
    const n = state.places.filter((p) => groupOf(p) === key).length;
    filters.append(el('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', dataset: { filter: key, group: key }, on: { click: () => setFilter(key) } },
      icon(g.icon), `${g.label} `, el('span', { class: 'n' }, n)));
  }

  const legend = $('#legend');
  for (const [type, t] of Object.entries(TYPES)) legend.append(el('span', { dataset: { group: t.group } }, icon(type), t.label));

  const set3d = (on) => { state.tilt = on; store.set('roots-3d', on); render(); };
  $('#mode-3d').addEventListener('click', () => set3d(true));
  $('#mode-2d').addEventListener('click', () => set3d(false));
  let resizeT; addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(render, 150); });
  const views = $('#views');
  for (const [key, v] of Object.entries(VIEWS)) views.append(el('button', {
    type: 'button', 'aria-pressed': String(key === state.view), dataset: { view: key },
    on: { click: () => { state.view = key; render(); } }
  }, v.label));

  $('#clock-range').addEventListener('input', (e) => { stop(); state.hour = Number(e.target.value); render(); });
  $('#now').addEventListener('click', () => { stop(); const n = nowInMadurai(); state.day = n.day; setHour(Math.floor(n.hour * 4) / 4); render(); });
  $('#play').addEventListener('click', togglePlay);
  $('#near-me').addEventListener('click', locate);
  $('#clear-plan').addEventListener('click', () => { state.plan = []; store.set('roots-plan', []); render(); });
}

function setFilter(f) { state.filter = f; state.showAll = false; render(); }

// Festivals: mark the current season and show live status on the featured temples.
function markSeason() {
  const m = new Date().getMonth() + 1;
  for (const s of $$('.season')) {
    const now = s.dataset.months.split(',').map(Number).includes(m);
    s.classList.toggle('is-now', now);
    s.querySelector('.season-now').hidden = !now;
  }
}
function renderFeatured() {
  const t = nowInMadurai();
  for (const n of $$('[data-live]')) {
    const p = state.places.find((x) => x.id === n.dataset.live);
    if (!p) continue;
    const st = status(p, t.day, t.hour);
    n.className = `feature-live status--${st.state}`;
    n.textContent = `Right now: ${st.text}`;
  }
}
function setHour(h) { state.hour = h; $('#clock-range').value = String(h); }

function togglePlay() {
  if (state.timer) return stop();
  if (state.hour >= 23.75) setHour(0);
  const btn = $('#play');
  btn.setAttribute('aria-pressed', 'true');
  btn.querySelector('use').setAttribute('href', `${spriteUrl()}#pause`);
  btn.querySelector('span').textContent = 'Pause';
  state.timer = setInterval(() => {
    if (state.hour >= 23.75) return stop();
    setHour(Math.round((state.hour + 0.25) * 4) / 4);
    render();
  }, prefersReducedMotion() ? 400 : 180);
}
function stop() {
  if (!state.timer) return;
  clearInterval(state.timer);
  state.timer = null;
  const btn = $('#play');
  btn.setAttribute('aria-pressed', 'false');
  btn.querySelector('use').setAttribute('href', `${spriteUrl()}#play`);
  btn.querySelector('span').textContent = 'Play the day';
}

function locate() {
  const note = $('#map-note');
  if (!('geolocation' in navigator)) { note.textContent = 'Location is not available in this browser.'; return; }
  note.textContent = 'Finding you…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const km = distanceKm(state.me, MEENAKSHI);
      note.textContent = km > 30
        ? `You're ${formatKm(km)} from Meenakshi temple. Distances are shown from you.`
        : 'Sorted by distance from you. Your position stays on this device.';
      render();
    },
    () => { note.textContent = 'Location permission was not given, so distances are from Meenakshi temple.'; },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  );
}

/* ---------- Render ---------- */
const open = (p) => isOpen(p, state.day, state.hour);
const visible = (p) => state.filter === 'all' || groupOf(p) === state.filter;
const origin = () => state.me || MEENAKSHI;

function render() {
  const vis = state.places.filter(visible);
  const on = vis.filter(open);
  const opensLater = (p) => !open(p) && hoursFor(p, state.day).some(([o]) => o > state.hour);
  const later = vis.filter(opensLater);
  const off = vis.filter((p) => !open(p) && !opensLater(p));
  const firstOpen = (p) => (hoursFor(p, state.day).find(([o]) => o > state.hour) || [99])[0];
  later.sort((a, b) => firstOpen(a) - firstOpen(b));
  // Temples lead the list: the five featured temples first, then the other temples, then everything else.
  const FEATURED = ['meenakshi-amman-temple', 'thiruparankundram-murugan-temple', 'pazhamudircholai-murugan-temple', 'kallazhagar-temple-alagar-kovil', 'pandi-muneeswarar-temple'];
  const HIGHLIGHT = ['keeladi-museum', 'alanganallur-jallikattu-vadivasal', 'pathu-thoon-ten-pillars', 'jallikattu-arena-alanganallur'];
  const rank = (p) => { const f = FEATURED.indexOf(p.id); if (f >= 0) return f; const h = HIGHLIGHT.indexOf(p.id); return h >= 0 ? 5 + h : p.type === 'temple' ? 10 : 20; };
  if (!state.me) for (const l of [on, off]) l.sort((a, b) => rank(a) - rank(b));
  if (state.me) { const d = (p) => distanceKm(state.me, p); on.sort((a, b) => d(a) - d(b)); off.sort((a, b) => d(a) - d(b)); }

  $('#time').textContent = formatHour(state.hour);
  $('#count').textContent = `${on.length} of ${vis.length} open`;
  const m = state.moments.find((x) => state.hour >= x.s && state.hour < x.e);
  $('#moment').textContent = m ? m.t : '';
  $('#sky-text').classList.toggle('is-light', paintSky($('#sky'), $('#orb'), $('#stars'), state.hour));

  $$('#days button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.day) === state.day)));
  $$('#moments button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.hour) === state.hour)));
  $$('#filters button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)));
  $$('#views button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));

  const lists = { open: on, later, closed: off };
  $('#n-open').textContent = on.length; $('#n-later').textContent = later.length; $('#n-closed').textContent = off.length;
  $$('#status-tabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === state.tab)));
  const list = lists[state.tab];
  const LIMIT = 12;
  const shown = state.showAll ? list : list.slice(0, LIMIT);
  $('#tiles').replaceChildren(...shown.map((p) => card(p, state.tab === 'open')));
  $('#open-head').textContent = list.length
    ? { open: `${on.length} places open at ${formatHour(state.hour)}.`, later: 'Opening later today, soonest first.', closed: 'Closed for the rest of today.' }[state.tab]
    : { open: 'Everything here is resting at this hour.', later: 'Nothing else opens later today.', closed: 'Nothing is closed for the day.' }[state.tab];
  $('#sort-note').textContent = state.me && state.tab !== 'later' ? 'Nearest first.' : '';
  const more = $('#more');
  more.hidden = list.length <= LIMIT;
  more.textContent = state.showAll ? 'Show fewer' : `Show all ${list.length}`;

  $('#mode-3d').setAttribute('aria-pressed', String(state.tilt));
  $('#mode-2d').setAttribute('aria-pressed', String(!state.tilt));
  drawMap($('#map-svg'), { places: vis, view: state.view, selected: state.selected, isOpen: open, me: state.me, tilt: state.tilt, onSelect: (id) => select(id, true) });
  renderSpot();
  renderPlan();
  liveWait.update();
}

function select(id, fromMap) {
  state.selected = id;
  render();
  if (fromMap) $(`.ptile[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

const ASSET = (path) => new URL(`../../${path}`, import.meta.url).href;

const BOARDS = ['maroon', 'teal', 'indigo', 'ochre'];
function boardColour(p) {
  if (p.board) return p.board;
  if (p.type === 'stay') return 'green';
  if (groupOf(p) === 'market') return 'street';
  let h = 0; for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return BOARDS[h % BOARDS.length];
}

function thumb(p, cls = 'thumb', width = 480) {
  const node = el('span', { class: cls, dataset: { group: groupOf(p) } }, icon(p.type));
  const src = imageSrc(p, width);
  if (!src && ['eat', 'stay', 'market'].includes(groupOf(p))) {
    node.replaceChildren(el('span', { class: `board board--${boardColour(p)}`, role: 'img', 'aria-label': `${p.name} signboard; photo coming from the host` },
      el('span', { class: 'board-name' }, p.name.replace(/\s*\(.*\)$/, '')),
      el('span', { class: 'board-sub' }, `${p.since ? `Since ${p.since} · ` : ''}${p.area}`),
      el('span', { class: 'board-note' }, 'Photo coming from the host')));
  }
  if (src) {
    const img = el('img', { src: ASSET(src), alt: p.image.alt, loading: 'lazy', decoding: 'async', width: 480, height: 360 });
    img.addEventListener('error', () => img.remove(), { once: true });
    node.append(img);
  }
  return node;
}

function card(p, isOn) {
  const st = status(p, state.day, state.hour);
  const saved = state.plan.includes(p.id);
  const selected = p.id === state.selected;
  const dist = distanceNote(p, '', 'from Meenakshi');
  return el('li', {
    class: `ptile${isOn ? '' : ' is-closed'}${selected ? ' is-selected' : ''}`,
    dataset: { id: p.id, group: groupOf(p) }, tabindex: '0', 'aria-label': `${p.name}, ${st.text}`,
    on: {
      click: () => select(p.id, false),
      keydown: (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(p.id, false); } }
    }
  },
  el('div', { class: 'ptile-media' },
    thumb(p, 'thumb'),
    el('span', { class: `ptile-status status-chip--${st.state}` }, st.text),
    el('button', {
      class: 'save', type: 'button', 'aria-pressed': String(saved), 'aria-label': `${saved ? 'Remove' : 'Add'} ${p.name} ${saved ? 'from' : 'to'} my day`,
      on: { click: (e) => { e.stopPropagation(); togglePlan(p.id); } }
    }, icon('star'))),
  el('div', { class: 'ptile-body' },
    el('h4', { class: 'ptile-name' }, el('a', { href: PLACE_URL(p.id), on: { click: (e) => e.stopPropagation() } }, p.name)),
    el('p', { class: 'ptile-meta' }, icon(p.type), `${TYPES[p.type].label}${dist ? ` · ${dist}` : ''}`,
      p.diet ? el('span', { class: `badge badge--${p.diet}` }, p.diet === 'veg' ? 'Veg' : 'Non-veg') : null),
    el('div', { class: 'ptile-actions' },
      el('a', { class: 'iconbtn', href: directionsUrl(p), target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Directions to ${p.name}`, on: { click: (e) => e.stopPropagation() } }, icon('route'), 'Go'),
      el('a', { class: 'iconbtn', href: PLACE_URL(p.id) + '#bus', 'aria-label': `Buses to ${p.name}`, on: { click: (e) => e.stopPropagation() } }, icon('bus'), 'Bus'),
      el('a', { class: 'iconbtn', href: PLACE_URL(p.id), on: { click: (e) => e.stopPropagation() } }, 'Details', icon('arrow'))))
  );
}

function renderSpot() {
  const p = state.places.find((x) => x.id === state.selected);
  const spot = $('#spot');
  if (!p) { spot.replaceChildren(); return; }
  const st = status(p, state.day, state.hour);
  spot.dataset.group = groupOf(p);
  spot.replaceChildren(
    thumb(p, 'tile', 480),
    el('b', {}, p.name),
    el('span', { class: `status status--${st.state}` }, st.text),
    el('span', { class: 'note' }, p.area, distanceNote(p, ' · ', 'from Meenakshi temple')),
    el('div', { class: 'spot-actions' },
      el('a', { class: 'btn', href: directionsUrl(p), target: '_blank', rel: 'noopener noreferrer' }, icon('route'), 'Directions'),
      el('a', { class: 'btn btn--ghost', href: busUrl(p), target: '_blank', rel: 'noopener noreferrer' }, icon('bus'), 'Bus route'),
      el('a', { class: 'btn btn--ghost', href: PLACE_URL(p.id) }, 'Story & hours', icon('arrow')))
  );
}

function distanceNote(p, sep, label) {
  const km = distanceKm(origin(), p);
  if (!state.me && km < 0.05) return '';
  return `${sep}${formatKm(km)} ${state.me ? 'from you' : label}`;
}

function togglePlan(id) {
  state.plan = state.plan.includes(id) ? state.plan.filter((x) => x !== id) : [...state.plan, id];
  store.set('roots-plan', state.plan);
  render();
}

function renderPlan() {
  const items = state.plan.map((id) => state.places.find((p) => p.id === id)).filter(Boolean);
  const first = (p) => { const h = hoursFor(p, state.day); return is24h(h) ? -1 : h.length ? h[0][0] : 99; };
  items.sort((a, b) => first(a) - first(b));
  $('#plan-list').replaceChildren(...items.map((p) => {
    const h = hoursFor(p, state.day);
    const when = is24h(h) ? (p.type === 'stay' ? 'Base' : '24 h') : h.length ? formatHour(h[0][0]) : 'Closed';
    return el('li', { dataset: { group: groupOf(p) } }, el('span', { class: 'pt' }, when), icon(p.type), el('a', { href: PLACE_URL(p.id) }, p.name));
  }));
  $('#plan-empty').hidden = items.length > 0;
  $('#clear-plan').hidden = items.length === 0;
}

/** Images that failed before this module loaded (CSP forbids inline onerror). */
function fixBrokenImages(root) {
  for (const img of root.querySelectorAll('img')) {
    const drop = () => img.remove();
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) drop();
    else img.addEventListener('error', drop, { once: true });
  }
}
