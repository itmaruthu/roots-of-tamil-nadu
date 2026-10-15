// Roots concierge (prototype): answers questions from the live places data, in the browser.
// Understands simple English and a few Tamil keywords. In production the same answers are
// served on WhatsApp/Telegram, with an open-weight language model for free-form questions.
import { el, $ } from './dom.js';
import { isOpen, status, formatHour, hoursFor, is24h } from './hours.js';
import { darshanWait } from './livewait.js';
import { distanceKm, formatKm, MEENAKSHI } from './geo.js';

const SUGGESTIONS = ['What is open now?', 'Where to buy sarees?', 'Veg food near the temple', 'Which temples are open?', 'How long is the darshan wait?', 'Late-night food', 'இப்போ என்ன திறந்திருக்கு?'];

const GENERIC = new Set(['hotel', 'temple', 'shop', 'mess', 'kadai', 'stall', 'stalls', 'madurai', 'market', 'original', 'famous', 'board', 'butter', 'the', 'sri', 'tea']);
function keywords(p) {
  return p.name.toLowerCase().replace(/[(),.]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !GENERIC.has(w));
}

export function initConcierge(ctx) {
  const log = $('#cc-log');
  const form = $('#cc-form');
  const input = $('#cc-input');
  if (!log || !form) return;

  const chips = $('#cc-chips');
  for (const s of SUGGESTIONS) chips.append(el('button', { type: 'button', class: 'chip chip--sm', on: { click: () => ask(s) } }, s));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim().slice(0, 200);
    if (q) ask(q);
    input.value = '';
  });

  say('bot', [`Vanakkam! I'm the Roots concierge. Ask me what's open, where to eat, or how busy the temple is. I answer for the time on the clock above (${formatHour(ctx.state.hour)}).`]);

  function ask(q) {
    say('me', [q]);
    say('bot', answer(q));
  }

  function say(who, parts) {
    const bubble = el('div', { class: `cc-msg cc-msg--${who}` }, ...parts.map((p) => (typeof p === 'string' ? el('p', {}, p) : p)));
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
  }

  function list(places) {
    return el('ul', { class: 'cc-list' }, ...places.slice(0, 6).map((p) => {
      const st = status(p, ctx.state.day, ctx.state.hour);
      return el('li', {}, el('a', { href: ctx.placeUrl(p.id) }, p.name), ` · ${st.text}${distanceKm(MEENAKSHI, p) < 0.05 ? '' : ` · ${formatKm(distanceKm(MEENAKSHI, p))} from the temple`}`);
    }));
  }

  function answer(raw) {
    const q = raw.toLowerCase();
    const { day, hour } = ctx.state;
    const open = ctx.places.filter((p) => isOpen(p, day, hour));
    const has = (...words) => words.some((w) => q.includes(w));
    const byDistance = (a, b) => distanceKm(MEENAKSHI, a) - distanceKm(MEENAKSHI, b);

    // A specific place by name
    const named = ctx.places
      .map((p) => ({ p, score: keywords(p).filter((k) => q.includes(k)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.p;
    if (has('wait', 'queue', 'busy', 'crowd', 'darshan', 'கூட்டம்', 'காத்திரு')) {
      if (named && named.type !== 'temple') {
        return [`${named.name}: ${status(named, day, hour).text}. Busy eateries use Roots tokens: take one in the Live wait section and get an alert when you're next.`];
      }
      const w = darshanWait(hour, day, false);
      return [w === null
        ? `Meenakshi temple is closed at ${formatHour(hour)}. It opens 5 am–12:30 pm and 4–10 pm.`
        : `Darshan wait at Meenakshi temple around ${formatHour(hour)}: about ${w} minutes (estimate). Early morning, 5–7 am, is usually shortest.`];
    }
    const SHOP = [['saree', 'dress'], ['dress', 'dress'], ['cloth', 'dress'], ['sungudi', 'dress'], ['jewel', 'jewel'], ['gold', 'jewel'], ['bangle', 'jewel'], ['grocer', 'grocery'], ['spice', 'grocery'], ['vegetable', 'vegetable'], ['veggies', 'vegetable'], ['vessel', 'homeware'], ['brass', 'homeware'], ['steel', 'homeware'], ['craft', 'homeware'], ['flower', 'market'], ['malli', 'market'], ['jasmine', 'market']];
    const shopType = SHOP.find(([w]) => q.includes(w))?.[1];
    if (shopType || has('shop', 'shopping', 'buy', 'market', 'கடை', 'வாங்க', 'மார்க்கெட்')) {
      const s = ctx.places.filter((p) => (shopType ? p.type === shopType : ['market', 'grocery', 'dress', 'jewel', 'homeware', 'vegetable'].includes(p.type))).sort(byDistance);
      return [shopType ? 'Here is where Madurai shops for that:' : 'Madurai has a street for everything. Each one with its live status:', list(s)];
    }
    if (named) {
      const h = hoursFor(named, day);
      return [`${named.name} (${named.area}): ${status(named, day, hour).text}. Hours: ${named.hours}.`, named.story,
        el('p', {}, el('a', { href: ctx.placeUrl(named.id) }, 'Photos, hours and directions →'))];
    }
    if (has('veg', 'சைவ')) {
      const v = open.filter((p) => p.diet === 'veg').sort(byDistance);
      return v.length ? ['Vegetarian places open now, nearest to the temple first:', list(v)] : ['No vegetarian places are open at this hour. Prema Vilas opens at 4 am.'];
    }
    if (has('late', 'night', 'midnight', 'இரவு')) {
      const late = ctx.places.filter((p) => p.type !== 'stay' && hoursFor(p, day).some(([, c]) => c >= 23));
      return ['These keep serving until 11 pm or later:', list(late)];
    }
    if (has('breakfast', 'காலை')) {
      const b = ctx.places.filter((p) => ['meal', 'sweet'].includes(p.type) && isOpen(p, day, 8));
      return ['Open for breakfast around 8 am:', list(b)];
    }
    if (has('stay', 'hotel to stay', 'room', 'தங்க')) {
      return ['Places to stay, all with 24-hour reception:', list(ctx.places.filter((p) => p.type === 'stay'))];
    }
    if (has('temple', 'kovil', 'koil', 'கோவில்', 'கோயில்')) {
      const t = open.filter((p) => p.type === 'temple').sort(byDistance);
      return t.length ? [`${t.length} temples are open at ${formatHour(hour)}:`, list(t)] : [`No temples are open at ${formatHour(hour)}. Most open by 6 am and reopen around 4 pm.`];
    }
    if (has('open', 'now', 'திறந்', 'இப்போ', 'இப்ப')) {
      const o = open.filter((p) => p.type !== 'stay' && !is24h(hoursFor(p, day))).sort(byDistance);
      return o.length ? [`${o.length} places are open at ${formatHour(hour)}. Nearest to the temple:`, list(o)] : ['Almost everything is resting now. Hotels and the flower market are awake; halwa returns at 4 am.'];
    }
    return ['I can tell you what is open, where to find veg food or late-night food, which temples are open, or how long the darshan wait is. Try a suggestion below.'];
  }
}
