// Live wait: darshan wait estimate + eatery token queue with a "Now serving" display.
// Prototype: darshan figures are an illustrative model; tokens are simulated in the browser.
// In production the same UI reads crowd reports and token counts from a realtime database.
import { el, $, prefersReducedMotion } from './dom.js';
import { formatHour, isOpen } from './hours.js';

const TOKEN_SHOPS = ['konar-kadai', 'new-janani-mess', 'murugan-idli-shop', 'muthukumar-bun-parotta', 'jaya-vilas'];
const MIN_PER_PARTY = { 'konar-kadai': 5, 'new-janani-mess': 4, 'murugan-idli-shop': 3, 'muthukumar-bun-parotta': 4, 'jaya-vilas': 6 };

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
  if (!root) return { update() {} };
  let festival = false;
  const shops = TOKEN_SHOPS.map((id) => ctx.places.find((p) => p.id === id)).filter(Boolean);
  const queues = Object.fromEntries(shops.map((p, i) => [p.id, { serving: 30 + i * 7, issued: 36 + i * 9, mine: null }]));
  let shopId = shops[0].id;
  let timer = null;

  // Darshan panel
  const festivalBtn = $('#lw-festival');
  festivalBtn.addEventListener('click', () => { festival = !festival; festivalBtn.setAttribute('aria-pressed', String(festival)); update(); });

  // Token panel
  const select = $('#lw-shop');
  for (const p of shops) select.append(el('option', { value: p.id }, p.name));
  select.addEventListener('change', () => { shopId = select.value; stopSim(); update(); });
  $('#lw-take').addEventListener('click', () => {
    const q = queues[shopId];
    q.issued += 1; q.mine = q.issued;
    startSim(); update();
  });
  $('#lw-next').addEventListener('click', () => { advance(); });
  $('#lw-full').addEventListener('click', () => {
    const screen = $('#lw-screen');
    if (screen.requestFullscreen) screen.requestFullscreen().catch(() => {});
  });

  function advance() {
    const q = queues[shopId];
    if (q.serving < q.issued) q.serving += 1;
    if (q.mine && q.serving >= q.mine) stopSim();
    update();
  }
  function startSim() {
    stopSim();
    timer = setInterval(advance, prefersReducedMotion() ? 4000 : 2500);
  }
  function stopSim() { if (timer) { clearInterval(timer); timer = null; } }

  function update() {
    const { day, hour } = ctx.state;
    // Darshan
    const w = darshanWait(hour, day, festival);
    $('#lw-darshan-now').textContent = w === null ? 'Temple closed' : `~${w} min`;
    $('#lw-darshan-at').textContent = `at ${formatHour(hour)}${festival ? ', Chithirai festival crowd' : ''}`;
    const bars = $('#lw-bars');
    const hours = [];
    for (let h = 5; h < 22; h += 1) hours.push(h);
    const max = 140;
    bars.replaceChildren(...hours.map((h) => {
      const v = darshanWait(h + 0.5, day, festival);
      const pct = v === null ? 0 : Math.min(100, (v / max) * 100);
      const cur = Math.floor(hour) === h;
      return el('div', { class: `lw-bar${cur ? ' is-now' : ''}${v === null ? ' is-closed' : ''}`, title: `${formatHour(h)}: ${v === null ? 'closed' : `~${v} min`}` },
        el('span', { class: 'lw-fill', style: { height: `${Math.max(pct, v === null ? 0 : 6)}%` } }),
        el('small', {}, h % 3 === 2 ? formatHour(h).replace(' ', '') : ''));
    }));
    const best = hours.map((h) => [h, darshanWait(h + 0.5, day, festival)]).filter(([, v]) => v !== null).sort((a, b) => a[1] - b[1])[0];
    $('#lw-best').textContent = best ? `Shortest wait: around ${formatHour(best[0])} (~${best[1]} min).` : '';

    // Tokens
    const p = ctx.places.find((x) => x.id === shopId);
    const q = queues[shopId];
    const open = isOpen(p, day, hour);
    const per = MIN_PER_PARTY[shopId];
    const ahead = Math.max(0, (q.mine || q.issued + 1) - q.serving - 1);
    $('#lw-serving').textContent = String(q.serving);
    $('#lw-screen-name').textContent = p.name;
    $('#lw-upnext').textContent = `Next: ${[1, 2, 3].map((k) => q.serving + k).filter((n) => n <= q.issued).join(' · ') || '—'}`;
    $('#lw-take').disabled = !open || (q.mine && q.serving < q.mine);
    const msg = $('#lw-msg');
    if (!open) msg.textContent = `${p.name} is closed at ${formatHour(hour)}. Move the clock to see its queue.`;
    else if (q.mine && q.serving >= q.mine) msg.textContent = `It's your turn! Token ${q.mine}, please go to the counter.`;
    else if (q.mine) msg.textContent = `Your token: ${q.mine}. ${ahead} ahead of you, about ${ahead * per} min. We'll alert you when you're next.`;
    else msg.textContent = `${q.issued - q.serving} parties waiting, about ${(q.issued - q.serving) * per} min. Take a token and explore nearby instead of standing in line.`;
    msg.classList.toggle('is-turn', !!(q.mine && q.serving >= q.mine));
  }

  update();
  return { update };
}
