// Live wait: the crowd at an eatery, set by the owner with one tap and seen on the guest's phone,
// a table request for a family at a chosen time, and a darshan-wait estimate for each temple.
// The table request is real and needs no server: it goes to the owner on WhatsApp with a one-tap answer link
// (table.html), and the owner's answer comes back to the guest as a WhatsApp message whose link updates this page.
// The crowd status follows an illustrative pattern; in the pilot it is shared through a realtime database.
import { el, $, store } from './dom.js';
import { ownerPhone, showPhone, cleanPhone, newRef, requestMessage, replyMessage, readReply, decode, laterTimes, wa, HOLD_MIN } from './table.js';
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
// Phones and tablets: a touch screen without a mouse. Desktops have no SMS app to hand the message to.
const onPhone = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
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
  // ----- the family table: one request at a time, kept on this phone so it survives the trip to WhatsApp -----
  const STORE = 'roots-table';
  const save = () => {
    const q = Object.values(queues).find((x) => x.book);
    store.set(STORE, q ? { s: q.book.req.p.id, n: q.book.req.n, t: q.book.req.t, g: q.book.req.g, r: q.book.req.r, state: q.book.state, at: q.book.at } : null);
  };
  const setBook = (id, book) => { for (const q of Object.values(queues)) q.book = null; if (id) queues[id].book = book; save(); };
  // An answer from the owner, from a link or a pasted code. Returns a sentence for the guest, or null when it does not match.
  function applyAnswer(ans) {
    let req = ans.req, q = req && queues[req.p.id];
    if (!req) { q = Object.values(queues).find((x) => x.book && (ans.r ? x.book.req.r === ans.r : x.book.state === "asked")); req = q && q.book.req; }
    if (!req || !q) return null;
    const state = ans.a === 'full' ? 'full' : 'yes';
    const at = ans.a === 'alt' ? (ans.at ?? req.t) : req.t;
    setBook(req.p.id, { req, state, at, moved: ans.a === 'alt' });
    shopId = req.p.id; select.value = shopId;
    return state === 'full' ? `${req.p.name} is full at ${formatHour(req.t)}.` : `Table confirmed at ${formatHour(at)}.`;
  }
  const copyBtn = (label, text) => el('button', { class: 'chip', type: 'button', on: { click: async (ev) => {
    const btn = ev.currentTarget;
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; } catch { btn.textContent = 'Copy not available'; }
  } } }, label);

  function guestView(p, q, open, hour) {
    const b = q.book;
    // A held table matters even when the clock says the shop is closed now.
    if (!open && !(b && b.state === 'yes')) {
      const other = shops.find((o) => isOpen(o, ctx.state.day, hour));
      return [el('p', { class: 'lw-line' }, `${p.name} is closed at ${formatHour(hour)}.`),
        other ? el('button', { class: 'btn btn--ghost btn--sm', type: 'button', on: { click: () => go(other.id) } }, `See ${other.short || other.name}, open now`)
          : el('p', { class: 'note' }, 'None of these eateries is open at this hour. Move the clock above.')];
    }
    const out = [];
    if (open) {
      const key = statusOf(p.id, hour), st = STATUS[key];
      out.push(el('p', { class: 'lw-label2' }, `${p.name} · right now`),
        el('p', { class: `lw-status lw-level--${st.level}` }, st.name),
        el('p', { class: 'lw-line' }, st.line),
        el('p', { class: 'note' }, q.manual && q.manual.hour === Math.floor(hour) ? 'Set by the owner just now.' : 'From the usual pattern at this hour. The owner updates it with one tap.'));
      if (key === 'full' && !(b && b.state === 'yes')) {
        const alts = shops.filter((o) => o.id !== p.id && isOpen(o, ctx.state.day, hour)).map((o) => ({ o, k: statusOf(o.id, hour), km: distanceKm(p, o) }))
          .filter((x) => x.k !== 'full').sort((a, c) => ORDER.indexOf(a.k) - ORDER.indexOf(c.k) || a.km - c.km).slice(0, 2);
        const later = quietHour(p, hour);
        if (later !== null) out.push(el('p', { class: 'lw-line' }, el('b', {}, 'Go later: '), `it usually eases around ${formatHour(later)}.`));
        if (alts.length) out.push(el('p', { class: 'lw-ask' }, 'Go nearby, easier now:'), el('ul', { class: 'lw-quiet-list' }, ...alts.map(({ o, k, km }) => el('li', {},
          el('button', { type: 'button', class: 'lw-quiet-btn', on: { click: () => go(o.id) } }, el('b', {}, o.short || o.name),
            el('span', { class: `lw-level--${STATUS[k].level}` }, STATUS[k].name), el('small', {}, `${formatKm(km)} away`))))));
      }
    }
    if (b && b.state === 'asked') {
      const msg = requestMessage(b.req), phone = ownerPhone(p), text = encodeURIComponent(msg);
      const paste = el('textarea', { class: 'input lw-paste', id: 'lw-paste', rows: '3', placeholder: 'Paste the owner\'s reply here' });
      const pasteMsg = el('p', { class: 'note', 'aria-live': 'polite' });
      out.push(el('div', { class: 'lw-book' },
        el('p', { class: 'lw-label2' }, `Request ${b.req.r} · waiting for the owner`),
        el('p', { class: 'lw-ask' }, `Table for ${b.req.n} at ${formatHour(b.req.t)}`),
        el('ol', { class: 'lw-how' },
          el('li', {}, `Press send in WhatsApp. It goes to the owner on ${showPhone(phone)}.`),
          el('li', {}, 'The owner answers with one tap, and the answer comes back to your WhatsApp.'),
          el('li', {}, 'Tap the link in that answer: this page shows your table.')),
        el('div', { class: 'chips' },
          el('a', { class: 'chip', href: wa(phone, msg), target: '_blank', rel: 'noopener noreferrer' }, 'Open WhatsApp again'),
          // SMS and call open in a new window so this page stays put; they only appear on phones, where an SMS app exists.
          onPhone ? el('a', { class: 'chip', href: `sms:+${phone}?&body=${text}`, target: '_blank', rel: 'noopener noreferrer' }, 'Send as SMS') : '',
          onPhone ? el('a', { class: 'chip', href: `tel:+${phone}`, target: '_blank', rel: 'noopener noreferrer' }, 'Call the owner') : '',
          copyBtn('Copy the message', msg)),
        el('p', { class: 'lw-ask' }, 'Link will not open? Paste the reply'),
        paste,
        el('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'lw-paste-go', on: { click: () => {
          const ans = readReply(paste.value, ctx.places);
          const said = ans && applyAnswer(ans);
          if (said) update(); else pasteMsg.textContent = 'That does not look like the owner\'s answer to this request. Paste the whole message, or just the owner\'s words such as "Yes", "Full" or "2:30 pm".';
        } } }, 'Update my table'),
        pasteMsg,
        el('button', { class: 'btn btn--ghost btn--sm', type: 'button', on: { click: () => { setBook(null); update(); } } }, 'Cancel the request')));
      return out;
    }
    if (b && b.state === 'yes') {
      out.push(el('div', { class: 'lw-book lw-book--yes' },
        el('p', { class: 'lw-label2' }, `${p.name} · answered by the owner`),
        el('p', { class: 'lw-ask' }, `Confirmed: table for ${b.req.n} today at ${formatHour(b.at)}`),
        b.moved ? el('p', { class: 'note' }, `You asked for ${formatHour(b.req.t)}; the owner offered ${formatHour(b.at)} instead.`) : '',
        el('p', { class: 'lw-code' }, b.req.r),
        el('p', { class: 'note' }, `Show this code at the counter. The table is held for ${HOLD_MIN} minutes after the time, then given to the next family.`),
        el('div', { class: 'chips' },
          el('a', { class: 'chip', href: wa(ownerPhone(p), `Roots table ${b.req.r}: sorry, we cannot come at ${formatHour(b.at)}. Please give the table to another family.`), target: '_blank', rel: 'noopener noreferrer',
            on: { click: () => setTimeout(() => { setBook(null); update(); }, 0) } }, 'Cancel and tell the owner'))));
      return out;
    }
    if (!open) return out;
    const times = slots(p, hour);
    if (b && b.state === 'full') out.push(el('p', { class: 'lw-warn' }, `The owner says ${p.name} is full at ${formatHour(b.req.t)}. Pick another time or a place nearby.`));
    if (!times.length) { out.push(el('p', { class: 'note' }, 'Too close to closing time to hold a table today.')); return out; }
    if (!times.includes(q.slot)) q.slot = times[0];
    const people = el('select', { class: 'select', id: 'lw-people', 'aria-label': 'People', on: { change: (e) => { q.people = Number(e.target.value); } } },
      ...Array.from({ length: 19 }, (_, n) => el('option', { value: String(n + 2), selected: q.people === n + 2 }, `${n + 2} people`)));
    const mine = el('input', { class: 'input', id: 'lw-mobile', type: 'tel', inputmode: 'tel', autocomplete: 'tel', maxlength: '16', placeholder: 'Your mobile, for the owner\'s answer',
      'aria-label': 'Your mobile number', value: store.get('roots-mobile', '') });
    const err = el('p', { class: 'note lw-err', 'aria-live': 'polite' });
    out.push(el('div', { class: 'lw-book' }, el('p', { class: 'lw-ask' }, 'Coming with family? Ask for a table'), people,
      el('div', { class: 'chips', role: 'group', 'aria-label': 'Time' }, ...times.map((h) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(q.slot === h),
        on: { click: () => { q.slot = h; update(); } } }, formatHour(h)))),
      mine, err,
      // The request leaves this page as a WhatsApp message to the owner's own phone: no server and no app in between.
      el('a', { class: 'btn lw-main', id: 'lw-ask-table', href: wa(ownerPhone(p), ''), target: '_blank', rel: 'noopener noreferrer', on: { click: (e) => {
        const g = cleanPhone(mine.value);
        if (!g) { e.preventDefault(); err.textContent = 'Please enter your mobile number, so the owner can send the answer to you.'; mine.focus(); return; }
        store.set('roots-mobile', mine.value.trim());
        const req = { p, n: Number(people.value), t: q.slot, g, r: newRef() };
        e.currentTarget.href = wa(ownerPhone(p), requestMessage(req));
        setTimeout(() => { setBook(p.id, { req, state: 'asked', at: req.t }); update(); }, 0);
      } } }, 'Ask the owner on WhatsApp'),
      el('p', { class: 'note' }, `Goes to the owner's WhatsApp on ${showPhone(ownerPhone(p))}. The answer comes back to your number.`)));
    return out;
  }

  // The owner's phone, as the demo shows it: the same request and the same three answers as table.html.
  function vendorView(p, q, open, hour) {
    const key = statusOf(p.id, hour), b = q.book;
    const out = [el('p', { class: 'lw-ask' }, 'How is it now? One tap.'),
      el('div', { class: 'lw-taps', role: 'group', 'aria-label': 'Crowd now' }, ...ORDER.map((k) => el('button', { type: 'button', class: `lw-tap lw-level--${STATUS[k].level}`, dataset: { status: k },
        'aria-pressed': String(open && key === k), disabled: !open, on: { click: () => { q.manual = { status: k, hour: Math.floor(hour) }; update(); } } }, STATUS[k].name)))];
    if (b && b.state === 'asked') {
      const req = b.req, next = laterTimes(p, ctx.state.day, req.t, 6).find((h) => !rush(h)) ?? laterTimes(p, ctx.state.day, req.t, 1)[0] ?? null;
      // Each answer opens WhatsApp to the guest with the reply written; in this demo the guest's phone also updates at once.
      const answer = (id, cls, label, a, at) => el('a', { class: `btn btn--sm ${cls}`, id, href: wa(req.g, replyMessage(req, a, at)), target: '_blank', rel: 'noopener noreferrer',
        on: { click: () => setTimeout(() => { applyAnswer({ req, a, at }); update(); }, 0) } }, label);
      out.push(el('div', { class: 'lw-book' }, el('p', { class: 'lw-label2' }, `Arrives on WhatsApp, ${showPhone(ownerPhone(p))}`),
        el('pre', { class: 'lw-msg' }, requestMessage(req)),
        el('p', { class: 'lw-ask' }, `Family of ${req.n} at ${formatHour(req.t)}`),
        answer('lw-yes', '', 'Yes, hold the table', 'yes'),
        next === null ? '' : answer('lw-offer', 'btn--ghost', `Offer ${formatHour(next)} instead`, 'alt', next),
        answer('lw-no', 'btn--ghost', 'Sorry, full', 'full'),
        el('p', { class: 'note' }, `Each answer opens WhatsApp to the guest on +${showPhone(req.g)} with the reply written. The link in the request opens the same three buttons on the owner's own phone.`)));
    } else if (b && b.state === 'yes') {
      out.push(el('div', { class: 'lw-book lw-book--yes' }, el('p', { class: 'lw-label2' }, 'Tables held today'), el('p', { class: 'lw-ask' }, `${formatHour(b.at)} · family of ${b.req.n} · ${b.req.r}`)));
    } else out.push(el('p', { class: 'note' }, `No table requests yet. They arrive as a WhatsApp message on ${showPhone(ownerPhone(p))}.`));
    out.push(el('p', { class: 'note' }, 'No new app: the request opens a page with three buttons, and the answer goes back to the guest on WhatsApp.'));
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

  const saved = store.get(STORE, null);
  if (saved) {
    const req = decode(new URLSearchParams({ s: saved.s, n: saved.n, t: saved.t, g: saved.g, r: saved.r }).toString(), ctx.places);
    if (req && queues[req.p.id]) { queues[req.p.id].book = { req, state: saved.state, at: saved.at ?? req.t, moved: saved.at != null && saved.at !== req.t }; shopId = req.p.id; select.value = shopId; }
  }
  function readHash() {
    if (!location.hash.startsWith('#table=')) return;
    const req = decode(location.hash.slice(7), ctx.places);
    if (req && req.a && queues[req.p.id]) {
      applyAnswer({ req, a: req.a, at: req.at });
      update();
      document.getElementById('live-wait')?.scrollIntoView({ block: 'start' });
    }
  }
  window.addEventListener('hashchange', readHash);
  readHash();
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
