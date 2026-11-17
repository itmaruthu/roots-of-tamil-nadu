// Live wait: the crowd at an eatery, set by the owner with one tap and seen on the guest's phone,
// a table request for a family at a chosen time, and a darshan-wait estimate for each temple.
// Prototype: both phones live in this browser and the figures follow an illustrative pattern.
// In the pilot the two pages read one row per shop from a realtime database, or the owner replies on WhatsApp.
import { el, $ } from './dom.js';
import { formatHour, isOpen } from './hours.js';
import { distanceKm, formatKm } from './geo.js';
import { combo } from './combo.js';

const TOKEN_SHOPS = ['konar-kadai', 'new-janani-mess', 'murugan-idli-shop', 'muthukumar-bun-parotta', 'jaya-vilas'];
const STATUS = {
  free: { name: 'Seats free', line: 'Walk in now', minutes: 5, level: 'short' },
  filling: { name: 'Filling up', line: 'About 15 to 20 min for a table', minutes: 20, level: 'mid' },
  full: { name: 'House full', line: '40 min or more for a table', minutes: 45, level: 'long' }
};
const ORDER = ['free', 'filling', 'full'];
const rush = (h) => (h >= 12.5 && h < 14.5) || (h >= 19.5 && h < 21.5);
const nearRush = (h) => (h >= 12 && h < 15) || (h >= 19 && h < 22);
const LEVEL = (m) => (m < 20 ? 'short' : m <= 45 ? 'mid' : 'long');
const LEVEL_NAME = { short: 'Short', mid: 'Moderate', long: 'Long' };

// How busy each temple runs against Meenakshi (1). Illustrative, like the daily pattern below.
const MEENAKSHI_ID = 'meenakshi-amman-temple';
const BUSY = { [MEENAKSHI_ID]: 1, 'thiruparankundram-murugan-temple': 0.6, 'kallazhagar-temple-alagar-kovil': 0.5, 'pandi-muneeswarar-temple': 0.5,
  'pazhamudircholai-murugan-temple': 0.45, 'koodal-azhagar-temple': 0.35 };
const CHITHIRAI = new Set([MEENAKSHI_ID, 'kallazhagar-temple-alagar-kovil']);

/**
 * Illustrative darshan wait (minutes) for an hour of the day: null when the temple is closed.
 * @param {object} [temple] a temple from places.json; its real opening hours are used. Meenakshi when left out.
 */
export function darshanWait(hour, day, festival, temple) {
  if (!isOpen(temple || { h: [[5, 12.5], [16, 22]] }, day, hour)) return null;
  let m = hour < 7 ? 15 : hour < 10 ? 35 : hour < 12.5 ? 50 : hour < 18 ? 40 : hour < 21 ? 60 : 30;
  m *= temple ? BUSY[temple.id] || 0.25 : 1;
  if (day === 0 || day === 6) m *= 1.4;
  if (festival) m *= 2.2;
  return Math.max(5, Math.round(m / 5) * 5);
}

export function initLiveWait(ctx) {
  const root = $('#live-wait');
  if (!root) return { update() {}, queue() { return null; } };
  let festival = false;
  // Visitors' reports nudge the estimate for the hour they were made in.
  const reports = { hour: null, temple: null, factor: 1, count: 0 };
  const temples = ctx.places.filter((p) => p.type === 'temple').sort((a, b) => (BUSY[b.id] || 0) - (BUSY[a.id] || 0) || a.name.localeCompare(b.name));
  let temple = temples.find((p) => p.id === MEENAKSHI_ID) || temples[0];
  const tName = (p) => p.short || p.name;
  const shops = TOKEN_SHOPS.map((id) => ctx.places.find((p) => p.id === id)).filter(Boolean);
  // manual: the owner's last tap, kept for the hour it was made in. book: one table request and its answer.
  const fresh = () => ({ manual: null, book: null, people: 4, slot: null });
  const queues = Object.fromEntries(shops.map((p) => [p.id, fresh()]));
  let shopId = shops[0].id;
  // Without an owner's tap, the status follows the usual lunch and dinner rush. Illustrative.
  const statusOf = (id, hour) => {
    const m = queues[id].manual;
    if (m && m.hour === Math.floor(hour)) return m.status;
    return rush(hour) ? (id === shops[0].id ? 'full' : 'filling') : nearRush(hour) ? 'filling' : 'free';
  };
  const wait = (hour, day, t = temple) => {
    const w = darshanWait(hour, day, festival, t);
    return w === null ? null : Math.max(5, Math.round((w * (reports.temple === t.id && reports.hour === Math.floor(hour) ? reports.factor : 1)) / 5) * 5);
  };

  // ----- darshan -----
  const templeInput = $('#lw-temple');
  const pickTemple = (p) => { temple = p; templeBox.set(tName(p)); update(); };
  const templeBox = combo(templeInput, { strict: true, strictMessage: 'Choose a temple from the list',
    options: () => temples.map((p) => ({ v: tName(p), hint: p.area, id: p.id })),
    onPick: (o) => { const p = o && temples.find((x) => x.id === o.id); if (p) { temple = p; update(); } else templeBox.set(tName(temple)); } });
  templeBox.set(tName(temple));
  $('#lw-quiet').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    pickTemple(temples.find((p) => p.id === b.dataset.id));
  });
  const festivalBtn = $('#lw-festival');
  festivalBtn.addEventListener('click', () => { festival = !festival; festivalBtn.setAttribute('aria-pressed', String(festival)); update(); });
  // Links elsewhere on the page (the Chithirai section) open this panel with the festival crowd switched on.
  for (const a of document.querySelectorAll('[data-lw-festival]')) a.addEventListener('click', () => { festival = true; festivalBtn.setAttribute('aria-pressed', 'true'); pickTemple(temples.find((p) => p.id === MEENAKSHI_ID) || temple); });
  $('#lw-report').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-wait]'); if (!b) return;
    const { day, hour } = ctx.state, msg = $('#lw-report-msg');
    const base = darshanWait(hour, day, festival, temple);
    if (base === null) { msg.textContent = `${tName(temple)} is closed at ${formatHour(hour)}, so there is no wait to report.`; return; }
    // Pull the estimate a third of the way toward what the visitor saw.
    const seen = { short: 12, mid: 32, long: 65 }[b.dataset.wait];
    if (reports.hour !== Math.floor(hour) || reports.temple !== temple.id) { reports.hour = Math.floor(hour); reports.temple = temple.id; reports.factor = 1; reports.count = 0; }
    reports.count += 1;
    reports.factor += ((seen / base) - reports.factor) / 3;
    msg.textContent = `Thank you. ${reports.count} ${reports.count === 1 ? 'report' : 'reports'} for ${tName(temple)} at ${formatHour(Math.floor(hour))} on this device; the estimate has moved.`;
    update();
  });

  // ----- crowd status and table requests -----
  const select = $('#lw-shop');
  for (const p of shops) select.append(el('option', { value: p.id }, p.name));
  select.addEventListener('change', () => { shopId = select.value; update(); });
  const go = (id) => { shopId = id; select.value = id; update(); };

  // The next hour today, within opening hours, outside the lunch and dinner rush.
  function quietHour(p, hour) {
    for (let h = Math.ceil(hour * 2) / 2 + 0.5; h < 24; h += 0.5) if (!rush(h) && isOpen(p, ctx.state.day, h) && (rush(hour) || h >= hour + 1.5)) return h;
    return null;
  }
  // Table times a family can ask for: half-hour steps from 30 minutes ahead, while the shop is open.
  function slots(p, hour) {
    const out = [];
    for (let h = Math.ceil(hour * 2) / 2 + 0.5; h < 24 && out.length < 5; h += 0.5) if (isOpen(p, ctx.state.day, h) && isOpen(p, ctx.state.day, h + 0.5)) out.push(h);
    return out;
  }
  const code = (p, h) => `R-${(p.id.length * 37 + Math.round(h * 2) * 13) % 900 + 100}`;

  function guestView(p, q, open, hour) {
    if (!open) {
      const other = shops.find((o) => isOpen(o, ctx.state.day, hour));
      return [el('p', { class: 'lw-line' }, `${p.name} is closed at ${formatHour(hour)}.`),
        other ? el('button', { class: 'btn btn--ghost btn--sm', type: 'button', on: { click: () => go(other.id) } }, `See ${other.short || other.name}, open now`)
          : el('p', { class: 'note' }, 'None of these eateries is open at this hour. Move the clock above.')];
    }
    const key = statusOf(p.id, hour), st = STATUS[key];
    const out = [el('p', { class: 'lw-label2' }, `${p.name} · right now`),
      el('p', { class: `lw-status lw-level--${st.level}` }, st.name),
      el('p', { class: 'lw-line' }, st.line),
      el('p', { class: 'note' }, q.manual && q.manual.hour === Math.floor(hour) ? 'Set by the owner just now.' : 'From the usual pattern at this hour. The owner updates it with one tap.')];
    if (key === 'full') {
      const alts = shops.filter((o) => o.id !== p.id && isOpen(o, ctx.state.day, hour)).map((o) => ({ o, k: statusOf(o.id, hour), km: distanceKm(p, o) }))
        .filter((x) => x.k !== 'full').sort((a, b) => ORDER.indexOf(a.k) - ORDER.indexOf(b.k) || a.km - b.km).slice(0, 2);
      const later = quietHour(p, hour);
      if (later !== null) out.push(el('p', { class: 'lw-line' }, el('b', {}, 'Go later: '), `it usually eases around ${formatHour(later)}.`));
      if (alts.length) out.push(el('p', { class: 'lw-ask' }, 'Go nearby, easier now:'), el('ul', { class: 'lw-quiet-list' }, ...alts.map(({ o, k, km }) => el('li', {},
        el('button', { type: 'button', class: 'lw-quiet-btn', on: { click: () => go(o.id) } }, el('b', {}, o.short || o.name),
          el('span', { class: `lw-level--${STATUS[k].level}` }, STATUS[k].name), el('small', {}, `${formatKm(km)} away`))))));
    }
    // A table for the family at a chosen time: a request the owner answers, never an automatic promise.
    const b = q.book;
    if (b && b.state === 'asked') {
      out.push(el('div', { class: 'lw-book' }, el('p', { class: 'lw-ask' }, `Asked: table for ${b.people} at ${formatHour(b.at)}`),
        el('p', { class: 'note' }, 'Waiting for the owner to say yes. Answer it on the owner\'s phone.'),
        el('button', { class: 'btn btn--ghost btn--sm', type: 'button', on: { click: () => { q.book = null; update(); } } }, 'Cancel the request')));
    } else if (b && b.state === 'yes') {
      out.push(el('div', { class: 'lw-book lw-book--yes' }, el('p', { class: 'lw-ask' }, `Confirmed: table for ${b.people} at ${formatHour(b.at)}`),
        el('p', { class: 'lw-code' }, code(p, b.at)),
        el('p', { class: 'note' }, 'Show this code at the counter. The table is held for 10 minutes after the time, then given to the next family.'),
        el('button', { class: 'btn btn--ghost btn--sm', type: 'button', on: { click: () => { q.book = null; update(); } } }, 'Cancel my table')));
    } else {
      const times = slots(p, hour);
      if (b && b.state === 'no') out.push(el('p', { class: 'lw-warn' }, `Sorry, no table at ${formatHour(b.at)}. Please pick another time.`));
      if (b && b.state === 'offer') out.push(el('p', { class: 'lw-warn' }, `No table at ${formatHour(b.at)}, but the owner can seat you at ${formatHour(b.offer)}.`),
        el('button', { class: 'btn btn--sm', type: 'button', id: 'lw-accept-offer', on: { click: () => { q.book = { ...b, at: b.offer, state: 'yes' }; update(); } } }, `Take ${formatHour(b.offer)}`));
      if (!times.length) out.push(el('p', { class: 'note' }, 'Too close to closing time to hold a table today.'));
      else {
        if (!times.includes(q.slot)) q.slot = times[0];
        const people = el('select', { class: 'select', id: 'lw-people', 'aria-label': 'People', on: { change: (e) => { q.people = Number(e.target.value); } } },
          ...Array.from({ length: 19 }, (_, n) => el('option', { value: String(n + 2), selected: q.people === n + 2 }, `${n + 2} people`)));
        out.push(el('div', { class: 'lw-book' }, el('p', { class: 'lw-ask' }, 'Coming with family? Ask for a table'), people,
          el('div', { class: 'chips', role: 'group', 'aria-label': 'Time' }, ...times.map((h) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(q.slot === h),
            on: { click: () => { q.slot = h; update(); } } }, formatHour(h)))),
          el('button', { class: 'btn lw-main', type: 'button', id: 'lw-ask-table', on: { click: () => { q.book = { people: q.people, at: q.slot, state: 'asked' }; update(); } } }, 'Ask for this table')));
      }
    }
    return out;
  }

  function vendorView(p, q, open, hour) {
    const key = statusOf(p.id, hour), b = q.book;
    const out = [el('p', { class: 'lw-ask' }, 'How is it now? One tap.'),
      el('div', { class: 'lw-taps', role: 'group', 'aria-label': 'Crowd now' }, ...ORDER.map((k) => el('button', { type: 'button', class: `lw-tap lw-level--${STATUS[k].level}`, dataset: { status: k },
        'aria-pressed': String(open && key === k), disabled: !open, on: { click: () => { q.manual = { status: k, hour: Math.floor(hour) }; update(); } } }, STATUS[k].name)))];
    if (b && b.state === 'asked') {
      const next = slots(p, b.at).find((h) => h > b.at && !rush(h)) ?? null;
      out.push(el('div', { class: 'lw-book' }, el('p', { class: 'lw-label2' }, 'Table request'),
        el('p', { class: 'lw-ask' }, `Family of ${b.people} at ${formatHour(b.at)}`),
        el('button', { class: 'btn btn--sm', type: 'button', id: 'lw-yes', on: { click: () => { b.state = 'yes'; update(); } } }, 'Yes, hold the table'),
        next === null ? '' : el('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'lw-offer', on: { click: () => { b.state = 'offer'; b.offer = next; update(); } } }, `Offer ${formatHour(next)} instead`),
        el('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'lw-no', on: { click: () => { b.state = 'no'; update(); } } }, 'Sorry, full')));
    } else if (b && b.state === 'yes') {
      out.push(el('div', { class: 'lw-book lw-book--yes' }, el('p', { class: 'lw-label2' }, 'Tables held today'), el('p', { class: 'lw-ask' }, `${formatHour(b.at)} · family of ${b.people} · ${code(p, b.at)}`)));
    } else out.push(el('p', { class: 'note' }, 'No table requests yet. Ask for one on the guest\'s phone.'));
    out.push(el('p', { class: 'note' }, 'No app to install. An owner who prefers WhatsApp replies 1, 2 or 3 to set the crowd, and YES or NO to a table request.'));
    return out;
  }

  function update() {
    const { day, hour } = ctx.state;
    // Darshan: a level first, minutes second, and the best hour of the day.
    const w = wait(hour, day);
    const now = $('#lw-darshan-now');
    now.textContent = w === null ? 'Closed now' : `${LEVEL_NAME[LEVEL(w)]} · ~${w} min`;
    now.className = `lw-big${w === null ? '' : ` lw-level--${LEVEL(w)}`}`;
    const fest = CHITHIRAI.has(temple.id) ? 'Chithirai festival crowd' : 'Festival crowd';
    festivalBtn.textContent = fest;
    $('#lw-darshan-at').textContent = `${tName(temple)} at ${formatHour(hour)}${festival ? `, ${fest.toLowerCase().replace('chithirai', 'Chithirai')}` : ''} · open ${temple.hours}`;
    const hours = [];
    for (let h = 4; h < 23; h += 1) hours.push(h);
    $('#lw-bars').replaceChildren(...hours.map((h) => {
      const v = wait(h + 0.5, day);
      const pct = v === null ? 0 : Math.min(100, (v / 140) * 100);
      return el('div', { class: `lw-bar${Math.floor(hour) === h ? ' is-now' : ''}${v === null ? ' is-closed' : ` lw-level--${LEVEL(v)}`}`, title: `${formatHour(h)}: ${v === null ? 'closed' : `~${v} min`}` },
        el('span', { class: 'lw-fill', style: { height: `${Math.max(pct, v === null ? 0 : 6)}%` } }),
        el('small', {}, h % 3 === 2 ? formatHour(h).replace(' ', '') : ''));
    }));
    const best = hours.map((h) => [h, wait(h + 0.5, day)]).filter(([, v]) => v !== null).sort((a, b) => a[1] - b[1])[0];
    $('#lw-best').textContent = best ? `Best time today: around ${formatHour(best[0])}, about ${best[1]} min.` : '';
    // Other temples open now with a shorter wait: this is how crowds get spread across the city.
    const others = temples.filter((t) => t.id !== temple.id).map((t) => ({ t, w: wait(hour, day, t), km: distanceKm(temple, t) }))
      .filter((x) => x.w !== null && (w === null || x.w < w) && x.km <= 15).sort((a, b) => a.w - b.w || a.km - b.km).slice(0, 4); // within a short ride
    $('#lw-quiet-box').hidden = !others.length;
    $('#lw-quiet-title').textContent = w === null ? 'Open right now' : 'Shorter waits right now';
    $('#lw-quiet').replaceChildren(...others.map(({ t, w: ow, km }) => el('li', {},
      el('button', { type: 'button', class: 'lw-quiet-btn', dataset: { id: t.id } }, el('b', {}, tName(t)),
        el('span', { class: `lw-level--${LEVEL(ow)}` }, `${LEVEL_NAME[LEVEL(ow)]} · ~${ow} min`), el('small', {}, `${formatKm(km)} away`)))));

    // Crowd status and table request on the two phones
    const p = ctx.places.find((x) => x.id === shopId);
    const q = queues[shopId];
    const open = isOpen(p, day, hour);
    $('#lw-guest').replaceChildren(...guestView(p, q, open, hour).filter(Boolean));
    $('#lw-vendor').replaceChildren(...vendorView(p, q, open, hour).filter(Boolean));
  }

  update();
  return {
    update,
    /** Live figures for one shop, for the guide: null when the shop has no token queue. */
    /** Darshan wait for a temple at the clock's hour, for the guide. */
    darshan(t) { const { day, hour } = ctx.state; return wait(hour, day, t); },
    queue(id) {
      if (!queues[id]) return null;
      const st = STATUS[statusOf(id, ctx.state.hour)];
      return { status: st.name, line: st.line, minutes: st.minutes };
    }
  };
}
