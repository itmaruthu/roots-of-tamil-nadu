// Live wait: one token queue seen on three screens (the guest's phone, the owner's phone, the shop's TV),
// and a darshan-wait estimate for the Meenakshi temple.
// Prototype: the queue lives in this browser and the darshan figure is an illustrative pattern.
// In the pilot the same three pages read one row per shop from a realtime database.
import { el, $, prefersReducedMotion } from './dom.js';
import { formatHour, isOpen } from './hours.js';
import { distanceKm, formatKm } from './geo.js';
import { combo } from './combo.js';

const TOKEN_SHOPS = ['konar-kadai', 'new-janani-mess', 'murugan-idli-shop', 'muthukumar-bun-parotta', 'jaya-vilas'];
const MIN_PER_PARTY = { 'konar-kadai': 5, 'new-janani-mess': 4, 'murugan-idli-shop': 3, 'muthukumar-bun-parotta': 4, 'jaya-vilas': 6 };
const PARTY = ['1–2', '3–4', '5 or more'];
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
  const fresh = (i) => ({ serving: 30 + i * 7, issued: 36 + i * 9, mine: null, party: 0, walkIn: null, paused: false });
  const queues = Object.fromEntries(shops.map((p, i) => [p.id, fresh(i)]));
  let shopId = shops[0].id;
  let timer = null, voice = false;

  const waiting = (q) => q.issued - q.serving;
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

  // ----- token queue -----
  const select = $('#lw-shop');
  for (const p of shops) select.append(el('option', { value: p.id }, p.name));
  select.addEventListener('change', () => { shopId = select.value; stopSim(); update(); });
  // What happens when a place floods: the line grows past what a token can honestly promise.
  $('#lw-rush')?.addEventListener('click', () => { queues[shopId].issued += 14; update(); });
  $('#lw-calm')?.addEventListener('click', () => { stopSim(); shops.forEach((p, i) => { queues[p.id] = fresh(i); }); update(); });
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
      const mins = waiting(q) * per, level = LEVEL(mins);
      const head = [el('p', { class: 'lw-count' }, el('b', {}, String(waiting(q))), ' parties waiting'),
        el('p', { class: `lw-line lw-verdict lw-level--${level}` }, el('b', {}, LEVEL_NAME[level]), ` · about ${mins} min at ${p.name}`)];
      if (level === 'long' || q.paused) {
        // The honest answer to a flooded place: say so, then offer a quieter hour and a shorter line nearby.
        const alts = shops.filter((o) => o.id !== p.id && isOpen(o, ctx.state.day, hour) && !queues[o.id].paused)
          .map((o) => ({ o, m: waiting(queues[o.id]) * MIN_PER_PARTY[o.id], km: distanceKm(p, o) })).filter((x) => x.m < mins).sort((a, b) => a.m - b.m).slice(0, 2);
        const later = quietHour(p, hour);
        return [...head,
          el('p', { class: 'lw-warn' }, q.paused ? 'The house is full, so the owner has paused new tokens. Nobody is kept waiting on a false promise.' : 'A long line right now. You do not have to stand in it:'),
          later === null ? '' : el('p', { class: 'lw-line' }, el('b', {}, 'Go later: '), `it usually eases around ${formatHour(later)}.`),
          alts.length ? el('p', { class: 'lw-ask' }, 'Go nearby, shorter line now:') : '',
          alts.length ? el('ul', { class: 'lw-quiet-list' }, ...alts.map(({ o, m, km }) => el('li', {}, el('button', { type: 'button', class: 'lw-quiet-btn',
            on: { click: () => { shopId = o.id; select.value = o.id; stopSim(); update(); } } }, el('b', {}, o.short || o.name),
            el('span', { class: `lw-level--${LEVEL(m)}` }, `~${m} min`), el('small', {}, `${formatKm(km)} away`))))) : '',
          q.paused ? '' : el('button', { class: 'btn btn--ghost lw-main', type: 'button', id: 'lw-take', on: { click: () => { q.issued += 1; q.mine = q.issued; startSim(); update(); } } }, `Wait here anyway: take a token`)];
      }
      return [
        ...head,
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

  // The next hour today, within opening hours, outside the lunch and dinner rush. Illustrative, like the darshan pattern.
  function quietHour(p, hour) {
    const rush = (h) => (h >= 12.5 && h < 14.5) || (h >= 19.5 && h < 21.5);
    for (let h = Math.ceil(hour * 2) / 2 + 0.5; h < 24; h += 0.5) if (!rush(h) && isOpen(p, ctx.state.day, h) && (rush(hour) || h >= hour + 1.5)) return h;
    return null;
  }

  function vendorView(q, open) {
    return [
      el('p', { class: 'lw-label2' }, 'Now serving'),
      el('p', { class: 'lw-token' }, String(q.serving)),
      el('p', { class: 'lw-line' }, el('b', {}, `${waiting(q)} waiting`), q.mine && q.serving < q.mine ? ` · the guest holds ${q.mine}` : ''),
      el('button', { class: 'btn lw-main', type: 'button', id: 'lw-next', disabled: !open || waiting(q) === 0, on: { click: advance } }, 'Call next'),
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'lw-walkin', disabled: !open, on: { click: () => { q.issued += 1; q.walkIn = q.issued; update(); } } }, 'Add a walk-in'),
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'lw-pause', 'aria-pressed': String(q.paused), disabled: !open, on: { click: () => { q.paused = !q.paused; update(); } } }, q.paused ? 'Resume tokens' : 'House full: pause tokens'),
      el('p', { class: 'note' }, q.walkIn ? `Paper token ${q.walkIn} given at the counter. It joins the same line.` : 'One button runs the queue. Walk-ins without a phone get a paper token.')
    ];
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
    /** Darshan wait for a temple at the clock's hour, for the guide. */
    darshan(t) { const { day, hour } = ctx.state; return wait(hour, day, t); },
    queue(id) {
      const q = queues[id];
      return q ? { waiting: waiting(q), minutes: waiting(q) * MIN_PER_PARTY[id] } : null;
    }
  };
}
