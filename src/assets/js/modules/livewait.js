// Live wait: one token queue seen on three screens (the guest's phone, the owner's phone, the shop's TV),
// and a darshan-wait estimate for the Meenakshi temple.
// Prototype: the queue lives in this browser and the darshan figure is an illustrative pattern.
// In the pilot the same three pages read one row per shop from a realtime database.
import { el, $, prefersReducedMotion } from './dom.js';
import { formatHour, isOpen } from './hours.js';
import { distanceKm, formatKm } from './geo.js';

const TOKEN_SHOPS = ['konar-kadai', 'new-janani-mess', 'murugan-idli-shop', 'muthukumar-bun-parotta', 'jaya-vilas'];
const MIN_PER_PARTY = { 'konar-kadai': 5, 'new-janani-mess': 4, 'murugan-idli-shop': 3, 'muthukumar-bun-parotta': 4, 'jaya-vilas': 6 };
const PARTY = ['1–2', '3–4', '5 or more'];
const LEVEL = (m) => (m < 20 ? 'short' : m <= 45 ? 'mid' : 'long');
const LEVEL_NAME = { short: 'Short', mid: 'Moderate', long: 'Long' };

/** Illustrative darshan wait (minutes) at Meenakshi temple for an hour of the day. */
export function darshanWait(hour, day, festival) {
  const temple = { h: [[5, 12.5], [16, 22]] };
  if (!isOpen(temple, day, hour)) return null;
  let m = hour < 7 ? 15 : hour < 10 ? 35 : hour < 12.5 ? 50 : hour < 18 ? 40 : hour < 21 ? 60 : 30;
  if (day === 0 || day === 6) m *= 1.4;
  if (festival) m *= 2.2;
  return Math.round(m / 5) * 5;
}

export function initLiveWait(ctx) {
  const root = $('#live-wait');
  if (!root) return { update() {}, queue() { return null; } };
  let festival = false;
  // Visitors' reports nudge the estimate for the hour they were made in.
  const reports = { hour: null, factor: 1, count: 0 };
  const shops = TOKEN_SHOPS.map((id) => ctx.places.find((p) => p.id === id)).filter(Boolean);
  const queues = Object.fromEntries(shops.map((p, i) => [p.id, { serving: 30 + i * 7, issued: 36 + i * 9, mine: null, party: 0, walkIn: null }]));
  let shopId = shops[0].id;
  let timer = null, voice = false;

  const waiting = (q) => q.issued - q.serving;
  const wait = (hour, day) => {
    const w = darshanWait(hour, day, festival);
    return w === null ? null : Math.round((w * (reports.hour === Math.floor(hour) ? reports.factor : 1)) / 5) * 5;
  };

  // ----- darshan -----
  const festivalBtn = $('#lw-festival');
  festivalBtn.addEventListener('click', () => { festival = !festival; festivalBtn.setAttribute('aria-pressed', String(festival)); update(); });
  // Links elsewhere on the page (the Chithirai section) open this panel with the festival crowd switched on.
  for (const a of document.querySelectorAll('[data-lw-festival]')) a.addEventListener('click', () => { festival = true; festivalBtn.setAttribute('aria-pressed', 'true'); update(); });
  $('#lw-report').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-wait]'); if (!b) return;
    const { day, hour } = ctx.state, msg = $('#lw-report-msg');
    const base = darshanWait(hour, day, festival);
    if (base === null) { msg.textContent = `The temple is closed at ${formatHour(hour)}, so there is no wait to report.`; return; }
    // Pull the estimate a third of the way toward what the visitor saw.
    const seen = { short: 12, mid: 32, long: 65 }[b.dataset.wait];
    if (reports.hour !== Math.floor(hour)) { reports.hour = Math.floor(hour); reports.factor = 1; reports.count = 0; }
    reports.count += 1;
    reports.factor += ((seen / base) - reports.factor) / 3;
    msg.textContent = `Thank you. ${reports.count} ${reports.count === 1 ? 'report' : 'reports'} for ${formatHour(Math.floor(hour))} on this device; the estimate has moved.`;
    update();
  });

  // ----- token queue -----
  const select = $('#lw-shop');
  for (const p of shops) select.append(el('option', { value: p.id }, p.name));
  select.addEventListener('change', () => { shopId = select.value; stopSim(); update(); });
  const voiceBtn = $('#lw-voice');
  if (!('speechSynthesis' in window)) voiceBtn.hidden = true;
  voiceBtn.addEventListener('click', () => {
    voice = !voice; voiceBtn.setAttribute('aria-pressed', String(voice));
    if (voice) announce(queues[shopId].serving);
  });
  $('#lw-full').addEventListener('click', () => {
    const screen = $('#lw-screen');
    if (screen.requestFullscreen) screen.requestFullscreen().catch(() => {});
  });

  function announce(n) {
    if (!voice || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(`Token number ${n}`);
      u.lang = 'en-IN'; u.rate = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { /* speech is a convenience */ }
  }
  function advance() {
    const q = queues[shopId];
    if (q.serving < q.issued) { q.serving += 1; announce(q.serving); }
    if (q.mine && q.serving >= q.mine) { stopSim(); if (q.serving === q.mine) navigator.vibrate?.(200); }
    update();
  }
  function startSim() { stopSim(); timer = setInterval(advance, prefersReducedMotion() ? 4000 : 2500); }
  function stopSim() { if (timer) { clearInterval(timer); timer = null; } }

  function guestView(p, q, open, hour) {
    const per = MIN_PER_PARTY[shopId];
    if (!open) {
      const other = shops.find((o) => isOpen(o, ctx.state.day, hour));
      return [el('p', { class: 'lw-line' }, `${p.name} is closed at ${formatHour(hour)}.`),
        other ? el('button', { class: 'btn btn--ghost btn--sm', type: 'button', on: { click: () => { shopId = other.id; select.value = other.id; stopSim(); update(); } } }, `See ${other.short || other.name}, open now`)
          : el('p', { class: 'note' }, 'None of the token eateries is open at this hour. Move the clock above.')];
    }
    if (!q.mine) {
      return [
        el('p', { class: 'lw-count' }, el('b', {}, String(waiting(q))), ' parties waiting'),
        el('p', { class: 'lw-line' }, `About ${waiting(q) * per} min at ${p.name}`),
        el('p', { class: 'lw-ask' }, 'How many are you?'),
        el('div', { class: 'chips', role: 'group', 'aria-label': 'Party size' }, ...PARTY.map((label, i) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(q.party === i),
          on: { click: () => { q.party = i; update(); } } }, label))),
        el('button', { class: 'btn lw-main', type: 'button', id: 'lw-take', on: { click: () => { q.issued += 1; q.mine = q.issued; startSim(); update(); } } }, 'Take a token')
      ];
    }
    const ahead = Math.max(0, q.mine - q.serving - 1), turn = q.serving >= q.mine;
    if (turn) {
      return [el('p', { class: 'lw-label2' }, 'Your token'), el('p', { class: 'lw-token is-turn' }, String(q.mine)),
        el('p', { class: 'lw-line lw-turn' }, 'It is your turn. Please go to the counter.'),
        el('button', { class: 'btn btn--ghost lw-main', type: 'button', on: { click: () => { q.mine = null; update(); } } }, 'Done')];
    }
    // While waiting: what is open within a short walk. This is where the waiting time becomes spending.
    const near = ctx.places.filter((o) => o.id !== p.id && o.type !== 'stay' && isOpen(o, ctx.state.day, hour))
      .map((o) => ({ o, km: distanceKm(p, o) })).filter((x) => x.km < 0.7).sort((a, b) => a.km - b.km).slice(0, 2);
    const span = Math.max(1, q.mine - q.startedAt - 1), done = Math.min(1, Math.max(0.06, (span - ahead) / span)); // share of the line already served
    return [el('p', { class: 'lw-label2' }, `Your token · table for ${PARTY[q.party]}`), el('p', { class: 'lw-token' }, String(q.mine)),
      el('p', { class: 'lw-line' }, el('b', {}, `${ahead} ahead of you`), ` · about ${ahead * per} min`),
      el('div', { class: 'lw-progress', role: 'img', 'aria-label': `${ahead} parties ahead` }, el('span', { style: { width: `${Math.round(done * 100)}%` } })),
      near.length ? el('p', { class: 'lw-ask' }, 'While you wait, a short walk away:') : '',
      near.length ? el('ul', { class: 'lw-near' }, ...near.map(({ o, km }) => el('li', {}, el('a', { href: ctx.placeUrl(o.id) }, o.short || o.name), ` · ${formatKm(km)}`))) : '',
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button', on: { click: () => { q.mine = null; stopSim(); update(); } } }, 'Leave the queue')];
  }

  function vendorView(q, open) {
    return [
      el('p', { class: 'lw-label2' }, 'Now serving'),
      el('p', { class: 'lw-token' }, String(q.serving)),
      el('p', { class: 'lw-line' }, el('b', {}, `${waiting(q)} waiting`), q.mine && q.serving < q.mine ? ` · the guest holds ${q.mine}` : ''),
      el('button', { class: 'btn lw-main', type: 'button', id: 'lw-next', disabled: !open || waiting(q) === 0, on: { click: advance } }, 'Call next'),
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'lw-walkin', disabled: !open, on: { click: () => { q.issued += 1; q.walkIn = q.issued; update(); } } }, 'Add a walk-in'),
      el('p', { class: 'note' }, q.walkIn ? `Paper token ${q.walkIn} given at the counter. It joins the same line.` : 'One button runs the queue. Walk-ins without a phone get a paper token.')
    ];
  }

  function update() {
    const { day, hour } = ctx.state;
    // Darshan: a level first, minutes second, and the best hour of the day.
    const w = wait(hour, day);
    const now = $('#lw-darshan-now');
    now.textContent = w === null ? 'Temple closed' : `${LEVEL_NAME[LEVEL(w)]} · ~${w} min`;
    now.className = `lw-big${w === null ? '' : ` lw-level--${LEVEL(w)}`}`;
    $('#lw-darshan-at').textContent = `at ${formatHour(hour)}${festival ? ', Chithirai festival crowd' : ''}`;
    const hours = [];
    for (let h = 5; h < 22; h += 1) hours.push(h);
    $('#lw-bars').replaceChildren(...hours.map((h) => {
      const v = wait(h + 0.5, day);
      const pct = v === null ? 0 : Math.min(100, (v / 140) * 100);
      return el('div', { class: `lw-bar${Math.floor(hour) === h ? ' is-now' : ''}${v === null ? ' is-closed' : ` lw-level--${LEVEL(v)}`}`, title: `${formatHour(h)}: ${v === null ? 'closed' : `~${v} min`}` },
        el('span', { class: 'lw-fill', style: { height: `${Math.max(pct, v === null ? 0 : 6)}%` } }),
        el('small', {}, h % 3 === 2 ? formatHour(h).replace(' ', '') : ''));
    }));
    const best = hours.map((h) => [h, wait(h + 0.5, day)]).filter(([, v]) => v !== null).sort((a, b) => a[1] - b[1])[0];
    $('#lw-best').textContent = best ? `Best time today: around ${formatHour(best[0])}, about ${best[1]} min.` : '';

    // Token queue on its three screens
    const p = ctx.places.find((x) => x.id === shopId);
    const q = queues[shopId];
    if (q.mine && q.startedAt === undefined) q.startedAt = q.serving;
    if (!q.mine) q.startedAt = undefined;
    const open = isOpen(p, day, hour);
    $('#lw-guest').replaceChildren(...guestView(p, q, open, hour).filter(Boolean));
    $('#lw-vendor').replaceChildren(...vendorView(q, open));
    $('#lw-serving').textContent = open ? String(q.serving) : '—';
    $('#lw-screen-name').textContent = p.name;
    $('#lw-upnext').textContent = open ? `Next: ${[1, 2, 3].map((k) => q.serving + k).filter((n) => n <= q.issued).join(' · ') || '—'}` : `Closed at ${formatHour(hour)}`;
  }

  update();
  return {
    update,
    /** Live figures for one shop, for the guide: null when the shop has no token queue. */
    queue(id) {
      const q = queues[id];
      return q ? { waiting: waiting(q), minutes: waiting(q) * MIN_PER_PARTY[id] } : null;
    }
  };
}
