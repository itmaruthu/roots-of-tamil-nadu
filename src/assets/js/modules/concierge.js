// Aatruppadai, the Roots guide (prototype). It answers in the browser from everything Roots knows:
// every place in every city, the famous foods and crafts of all 38 districts, festivals, homecoming and
// prices, and (with permission) the visitor's own location. Simple English and a few Tamil keywords.
// It does not go to the internet: what Roots does not know, it says so. In production the same
// answers are served on WhatsApp, with a language model for free-form questions.
import { el, $, store } from './dom.js';
import { isOpen, status, formatHour, hoursFor, is24h } from './hours.js';
import { darshanWait } from './livewait.js';
import { distanceKm, formatKm, MEENAKSHI } from './geo.js';
import { TYPES } from './catalog.js';
import { EMERGENCY } from './health.js';
import { estimate, money } from './cost.js';

const DATA = (name) => new URL(`../../../data/${name}.json`, import.meta.url);
const PAGE = (path) => new URL(`../../../${path}`, import.meta.url).href;

const SUGGESTIONS = ['Places to visit near me', 'Best food near me', 'Famous food of Madurai', 'I have 3 hours in Madurai', 'Famous food in Thanjavur',
  'What to see in Trichy?', 'How long is the queue at Konar Kadai?', 'How do I get a safe cab?', 'இப்போ என்ன திறந்திருக்கு?'];

// Dishes people ask for by name, and where Roots sends them.
const DISHES = [
  [['jigarthanda', 'jil jil'], 'Jigarthanda', ['famous-jigarthanda']],
  [['kari dosa', 'kari dosai', 'kari thosai'], 'Kari dosai', ['konar-kadai', 'p-power-hotel']],
  [['parotta', 'porotta', 'paratha', 'salna'], 'Parotta', ['muthukumar-bun-parotta', 'sulthan-hotel']],
  [['halwa', 'alwa', 'nei mittai'], 'Halwa', ['prema-vilas', 'aathi-kalathu-nei-mittai-kadai']],
  [['sambar idli', 'sambar'], 'Sambar idli', ['ratna-cafe-triplicane']],
  [['idli', 'idly', 'pongal vadai'], 'Idli', ['murugan-idli-shop', 'rayars-mess-mylapore', 'ratna-cafe-triplicane']],
  [['paruthi paal', 'cottonseed', 'cotton seed'], 'Paruthi paal', ['thirumalai-madai-paruthi-paal']],
  [['butter bun', 'bun butter'], 'Butter bun', ['kalapilla-tea-shop', 'lakshmi-butter-bun-sellur']],
  [['chukka', 'mutton'], 'Mutton chukka and mutton meals', ['hotel-sri-janakiram', 'new-janani-mess', 'p-power-hotel', 'sulthan-hotel']],
  [['ayirai', 'fish curry', 'fish'], 'Ayirai fish curry', ['jaya-vilas']],
  [['butter dosa', 'ghee roast', 'dosa', 'dosai'], 'Dosai', ['parthasarathy-vilas-thiruvanaikaval', 'konar-kadai']],
  [['chandrakala', 'suryakala'], 'Chandrakala', ['bombay-sweets-thanjavur']],
  [['degree coffee', 'filter coffee', 'coffee', 'kaapi'], 'Degree coffee', ['sri-mangalambika-vilas-kumbakonam']],
  [['macaroon', 'macaron'], 'Thoothukudi macaroon', ['ganesh-bakery-thoothukudi']],
  [['ice cream', 'icecream'], 'Ice cream', ['michaels-ice-cream-trichy', 'famous-jigarthanda']]
];

// Other names people use for the cities and districts.
const ALIAS = { trichy: 'tiruchirappalli', tiruchi: 'tiruchirappalli', tiruchy: 'tiruchirappalli', srirangam: 'tiruchirappalli', tanjore: 'thanjavur', tanjavur: 'thanjavur',
  tuticorin: 'thoothukudi', tiruchendur: 'thoothukudi', madras: 'chennai', mylapore: 'chennai', kanyakumari: 'kanniyakumari', nellai: 'tirunelveli', kovai: 'coimbatore',
  ooty: 'nilgiris', kanchipuram: 'kancheepuram', villupuram: 'viluppuram', tirupattur: 'tirupathur', sivagangai: 'sivaganga', chettinad: 'sivaganga', karaikudi: 'sivaganga',
  kodaikanal: 'dindigul', rameswaram: 'ramanathapuram', rameshwaram: 'ramanathapuram', mahabalipuram: 'chengalpattu', mamallapuram: 'chengalpattu', pudukottai: 'pudukkottai',
  tiruvarur: 'tiruvarur', thiruvarur: 'tiruvarur', thiruvallur: 'tiruvallur', tirunelveli: 'tirunelveli', nagercoil: 'kanniyakumari' };

const GENERIC = new Set(['hotel', 'temple', 'shop', 'mess', 'kadai', 'stall', 'stalls', 'madurai', 'market', 'original', 'famous', 'board', 'butter', 'the', 'sri', 'tea',
  'street', 'road', 'cafe', 'church', 'museum', 'palace', 'house', 'park', 'beach', 'trichy', 'thanjavur', 'chennai', 'kumbakonam', 'thoothukudi', 'nagar', 'bazaar', 'makers', 'sweets', 'coffee', 'silk', 'silks', 'murugan', 'vilas', 'lady',
  'heritage', 'government', 'grand', 'vegetable', 'flower', 'central', 'textiles', 'jewellery', 'groceries', 'spices', 'sarees', 'bangles', 'vessels', 'nature', 'hills', 'falls',
  'biodiversity', 'site', 'sanctuary', 'bird', 'archaeological', 'basilica', 'snows', 'showroom', 'handicrafts', 'weavers', 'society', 'brass', 'lamp', 'cream', 'bakery',
  'memorial', 'tank', 'fort', 'rock', 'gateway', 'arena', 'pillars', 'falls', 'handloom', 'amman', 'south', 'east', 'west', 'north', 'main', 'city', 'town', 'village', 'with', 'from']);
const STOP = new Set(['what', 'where', 'when', 'which', 'with', 'from', 'that', 'this', 'there', 'have', 'does', 'about', 'tell', 'show', 'give', 'want', 'need', 'please', 'good', 'best', 'near', 'nearby',
  'some', 'many', 'much', 'long', 'time', 'will', 'your', 'they', 'them', 'city', 'place', 'places', 'visit', 'tamil', 'nadu', 'roots', 'today', 'now', 'open', 'like', 'know', 'famous']);
// Everyday names for well-known places.
const NICKNAMES = [[['big temple', 'periya kovil', 'peruvudaiyar', 'brihadeeswara', 'brihadisvara'], 'brihadeeswarar-temple-thanjavur'], [['rock fort', 'malaikottai', 'ucchi pillayar'], 'rockfort-ucchi-pillayar-temple'],
  [['nayak mahal', 'nayakkar mahal', 'thirumalai nayak'], 'thirumalai-nayakkar-mahal'], [['alagar kovil', 'azhagar kovil', 'alagar koil', 'kallazhagar'], 'kallazhagar-temple-alagar-kovil'],
  [['meenakshi'], 'meenakshi-amman-temple'], [['srirangam', 'ranganathaswamy'], 'srirangam-ranganathaswamy-temple'], [['darasuram', 'airavatesvara'], 'airavatesvara-temple-darasuram'],
  [['fort st george', 'fort st. george', 'fort saint george'], 'fort-st-george-museum'], [['egmore museum', 'government museum'], 'government-museum-egmore'], [['keeladi', 'keezhadi'], 'keeladi-museum']];
const keywords = (p) => `${p.name} ${p.short || ''}`.toLowerCase().replace(/[(),.:']/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !GENERIC.has(w));

export function initConcierge(ctx) {
  const log = $('#cc-log');
  const form = $('#cc-form');
  const input = $('#cc-input');
  if (!log || !form) return null;

  const all = ctx.allPlaces || ctx.places;
  const regions = [{ id: 'madurai', name: 'Madurai', district: 'madurai', lat: MEENAKSHI.lat, lng: MEENAKSHI.lng }, ...(ctx.cities || [])];
  const regionOf = (p) => p.city || 'madurai';
  const kb = { districts: [], airports: [], festivals: { seasons: [] }, guide: {} };
  const ready = Promise.all([
    fetch(DATA('districts')).then((r) => r.json()).then((d) => { kb.districts = d.districts; kb.airports = d.airports; }),
    fetch(DATA('festivals')).then((r) => r.json()).then((d) => { kb.festivals = d; }),
    fetch(DATA('guide')).then((r) => r.json()).then((d) => { kb.guide = d; })
  ].map((p) => p.catch(() => {})));
  let me = ctx.state.me || null;

  const chips = $('#cc-chips');
  for (const s of SUGGESTIONS) chips.append(el('button', { type: 'button', class: 'chip chip--sm', on: { click: () => ask(s) } }, s));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim().slice(0, 200);
    if (q) ask(q);
    input.value = '';
  });

  say('bot', ['Vanakkam! I\'m Aatruppadai, your guide, like the Sangam bards who showed travellers the way. Ask me where to eat, what a town is famous for, what to see near you, how long the queue is, or how to plan a homecoming. I answer from what Roots knows, for this hour in Madurai.']);

  const NEAR = ['near me', 'nearby', 'near by', 'around me', 'close to me', 'my location', 'where am i', 'from here', 'around here', 'அருகில்', 'பக்கத்தில்', 'பக்கத்துல'];
  async function ask(q) {
    say('me', [q]);
    await ready;
    const low = q.toLowerCase();
    const urgent = /hospital|emergency|doctor|ambulance|police|pharmacy|medical/.test(low); // never make someone wait for a location first
    if (NEAR.some((w) => low.includes(w)) && !me && !urgent) {
      me = ctx.state.me || null;
      if (!me) {
        const wait = say('bot', ['Finding you… Your location stays on this device.']);
        me = await locate();
        wait.remove();
        if (!me) { say('bot', ['I could not get your location, so here is the answer for Madurai. You can also name a town: "food in Thanjavur".', ...answer(q)]); return; }
      }
    }
    say('bot', answer(q));
  }
  function locate() {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition((pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
    });
  }

  function say(who, parts) {
    const bubble = el('div', { class: `cc-msg cc-msg--${who}` }, ...parts.map((p) => (typeof p === 'string' ? el('p', {}, p) : p)));
    log.append(bubble);
    log.scrollTop = who === 'bot' ? Math.max(0, bubble.offsetTop - 8) : log.scrollHeight;
    return bubble;
  }
  const more = (href, text) => el('p', {}, el('a', { href }, `${text} →`));

  /** A list of places: name, live status, distance from the anchor, and a line on why. */
  function list(places, anchor, n = 5, withStory = true) {
    const { day, hour } = ctx.state;
    return el('ul', { class: 'cc-list' }, ...places.slice(0, n).map((p) => {
      const km = anchor ? distanceKm(anchor, p) : null;
      return el('li', {}, el('a', { href: ctx.placeUrl(p.id) }, p.short || p.name),
        ` · ${status(p, day, hour).text}${km === null || km < 0.05 ? '' : ` · ${formatKm(km)}${anchor.me ? ' from you' : ''}`}`,
        withStory ? el('small', {}, p.story.length > 110 ? `${p.story.slice(0, 107)}…` : p.story) : '');
    }));
  }

  /** Where the question is about: a town named in it, else where the visitor is, else Madurai. */
  function scope(q) {
    const words = q.replace(/[^a-z஀-௿ ]/g, ' ').split(/\s+/);
    const named = regions.find((r) => q.includes(r.name.toLowerCase()) || words.some((w) => ALIAS[w] && ALIAS[w] === r.district && r.id !== 'kumbakonam'));
    if (named) return { ...regionScope(named), named: true };
    const d = kb.districts.find((x) => q.includes(x.name.toLowerCase()) || words.some((w) => ALIAS[w] === x.id));
    if (d) {
      const r = regions.find((x) => x.district === d.id && x.id !== 'kumbakonam');
      return { ...(r ? regionScope(r) : areaScope({ lat: d.lat, lng: d.lng }, d.name, d)), named: true };
    }
    const here = me || ctx.state.me;
    if (here) {
      me = here;
      const r = regions.map((x) => ({ x, km: distanceKm(me, x) })).sort((a, b) => a.km - b.km)[0];
      if (r.km < 25) return { ...regionScope(r.x), anchor: { ...me, me: true }, where: `near you in ${r.x.name}`, you: `in ${r.x.name}`, located: true };
      const nd = kb.districts.map((x) => ({ x, km: distanceKm(me, x) })).sort((a, b) => a.km - b.km)[0];
      return { ...areaScope(me, nd && nd.km < 80 ? nd.x.name : 'where you are', nd && nd.km < 80 ? nd.x : null), anchor: { ...me, me: true }, where: nd && nd.km < 80 ? `near you in ${nd.x.name} district` : 'near you', you: nd && nd.km < 80 ? `in ${nd.x.name} district` : '', located: true };
    }
    return regionScope(regions[0]);
  }
  function regionScope(r) {
    return { name: r.name, where: `in ${r.name}`, anchor: { lat: r.lat, lng: r.lng }, district: kb.districts.find((d) => d.id === r.district), region: r,
      pool: all.filter((p) => regionOf(p) === r.id) };
  }
  function areaScope(pt, name, district) {
    const near = all.map((p) => ({ p, km: distanceKm(pt, p) })).sort((a, b) => a.km - b.km);
    const pool = near.filter((x) => x.km < 45).map((x) => x.p);
    return { name, where: `around ${name}`, anchor: { lat: pt.lat, lng: pt.lng }, district, pool: pool.length ? pool : near.slice(0, 6).map((x) => x.p), far: !pool.length };
  }

  function answer(raw) {
    const q = raw.toLowerCase();
    const { day, hour } = ctx.state;
    // English words match from the start of a word ("eat" finds "eating", not "weather"); Tamil words match anywhere.
    const has = (...words) => words.some((w) => (/^[a-z]/.test(w) ? new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(q) : q.includes(w)));
    const veg = /\bveg(etarian)?\b/.test(q) || q.includes('சைவ');
    const sc = scope(q);
    const byDistance = (a, b) => distanceKm(sc.anchor, a) - distanceKm(sc.anchor, b);
    const openNow = (p) => isOpen(p, day, hour);
    const openFirst = (arr) => [...arr].sort((a, b) => (openNow(b) - openNow(a)) || byDistance(a, b));
    const group = (p) => TYPES[p.type].group;
    // Eating houses count as local only within a short ride of where the question is about.
    const eats = sc.pool.filter((p) => group(p) === 'eat' && (sc.region || distanceKm(sc.anchor, p) <= 15));
    // What the district is known for: said only when the town asked about shares the district's name.
    const known = (kind) => (sc.district && (!sc.region || sc.region.name === sc.district.name) ? `${sc.district.name} is known for: ${sc.district[kind].join('; ')}.` : '');
    const farNote = sc.far ? [`Roots has no places listed right ${sc.where} yet. The nearest are:`] : [];

    // ---- help, safety ----
    if (/^(hi|hello|hey|vanakkam|வணக்கம்)\b/.test(q) || has('who are you', 'what can you', 'help me', 'aatruppadai', 'ஆற்றுப்படை')) {
      return ['Vanakkam! I can tell you: the best food places and famous dishes of a town; what to see near you or in any of six cities; what is open at this hour; the queue at a mess and the darshan wait at a temple; safe cabs and buses; festivals; and how to plan a homecoming to your native village. Try a suggestion below.'];
    }
    if (has('emergency', 'hospital', 'doctor', 'ambulance', 'police', 'pharmacy', 'medical', 'unwell', 'sick', 'மருத்துவ')) {
      return [`Emergency numbers in Tamil Nadu: ${EMERGENCY.map((e) => `${e.n} (${e.label})`).join(', ')}.`, more(PAGE('health.html'), '24-hour hospitals, clinics and pharmacies near you')];
    }

    // ---- a place named in the question ----
    const nick = NICKNAMES.find(([keys]) => keys.some((k) => q.includes(k)));
    const named = (nick && all.find((p) => p.id === nick[1])) || all.map((p) => ({ p, score: keywords(p).filter((k) => q.includes(k)).length }))
      .filter((x) => x.score > 0).sort((a, b) => b.score - a.score)[0]?.p;

    // ---- queues and darshan ----
    if (has('wait', 'queue', 'busy', 'crowd', 'darshan', 'token', 'கூட்டம்', 'காத்திரு')) {
      if (named && named.type !== 'temple') {
        const live = openNow(named) ? ctx.liveWait?.queue(named.id) : null;
        return [live
          ? `${named.name}: ${live.waiting} parties waiting, about ${live.minutes} min. Take a token in Live wait and walk around; your phone tells you when you are next.`
          : `${named.name}: ${status(named, day, hour).text}. Busy eateries use Roots tokens: take one in the Live wait section and get an alert when you're next.`];
      }
      const temples = ctx.places.filter((p) => p.type === 'temple');
      const t = named && named.type === 'temple' && !named.city ? named : temples.find((p) => p.id === 'meenakshi-amman-temple');
      const w = darshanWait(hour, day, false, t);
      const quiet = temples.filter((p) => p.id !== t.id).map((p) => ({ p, w: darshanWait(hour, day, false, p) }))
        .filter((x) => x.w !== null && (w === null || x.w < w) && distanceKm(t, x.p) <= 15).sort((a, b) => a.w - b.w)[0];
      const tip = quiet ? ` ${quiet.p.short || quiet.p.name} is ${w === null ? 'open' : 'quieter'} now, about ${quiet.w} minutes.` : '';
      return [w === null
        ? `${t.name} is closed at ${formatHour(hour)}. Hours: ${t.hours}.${tip}`
        : `Darshan wait at ${t.name} around ${formatHour(hour)}: about ${w} minutes (estimate).${tip}`];
    }

    // ---- getting around ----
    if (has('airport', 'flight', 'fly ')) {
      const a = kb.airports.map((x) => ({ x, km: distanceKm(sc.anchor, x) })).sort((p1, p2) => p1.km - p2.km)[0];
      return [a ? `The nearest airport to ${sc.name} is ${a.x.name} airport, about ${formatKm(a.km * 1.3)} by road. At Madurai airport, use the prepaid taxi counter in the arrivals hall: you pay a fixed fare first and the receipt names the driver.` : 'Use the prepaid taxi counter in the arrivals hall.'];
    }
    if (has('cab', 'taxi', 'rental', 'rent a car', 'self drive', 'auto', 'bus', 'transport', 'டாக்ஸி', 'வாடகை', 'பேருந்து')) {
      return ['Use government-approved rides: the prepaid taxi counter in the airport arrivals hall (fixed fare, receipt names the driver), TTDC tours and coaches (toll-free 1800 425 31111), or TNSTC city buses (every Madurai place page has a "Bus route from my location" button). For self-drive, rent only a car with a black plate and yellow letters; never a white-plate private car.',
        more(PAGE('index.html#cabs'), 'How to check a cab is legal')];
    }

    // ---- Roots itself: homecoming, cost, hosts ----
    if (has('cost', 'price', 'budget', 'how much', 'expensive', 'செலவு')) {
      const e = estimate({ days: 5, people: 4, tier: 'comfortable', kids: true });
      return [`A homecoming for a family of 4, for 5 days at a comfortable level, comes to about ${money(e.total)}: stay, cab with driver, your Ooru Nanbar, meals, temple offerings and the Roots fee. Flights are not included. The planner gives your own figure in your home currency and shows how much reaches local people.`,
        more(PAGE(`roots.html${sc.district ? `?district=${sc.district.id}` : ''}`), 'Plan and price my homecoming')];
    }
    if (has('roots', 'homecoming', 'home coming', 'native', 'ancestral', 'village', 'kuladeivam', 'kula deivam', 'ooru nanbar', 'nanbar', 'grandfather', 'grandmother', 'family temple', 'சொந்த ஊர்', 'குலதெய்வ', 'ஊர்')) {
      return ['Roots brings Tamil families home. Tell us your native district, taluk and village and your kuladeivam, and you get a day-by-day trip. An Ooru Nanbar, a verified friend in your own village, meets you there, finds the old house and the family temple and introduces the elders.',
        more(PAGE(`roots.html${sc.district && sc.district.id !== 'madurai' ? `?district=${sc.district.id}` : ''}`), 'Find your roots')];
    }
    if (has('list my', 'my shop', 'my hotel', 'my mess', 'join', 'register', 'become a host', 'i am a guide', 'சேர')) {
      return ['Cooks, messes, hotels, guides, artisans and cab owners join Roots free. Fill a short form or send a Tamil voice note; a Roots person visits to verify and puts you on the map.', more(PAGE('join.html'), 'List your place')];
    }

    // ---- festivals ----
    if (has('festival', 'chithirai', 'chitirai', 'pongal', 'jallikattu', 'thiruvizha', 'when to come', 'best time', 'season', 'திருவிழா', 'பொங்கல்')) {
      if (has('chithirai', 'chitirai', 'azhagar', 'alagar')) return ['Chithirai Thiruvizha fills about two weeks of April–May in Madurai: Meenakshi is crowned and married at her temple, the great chariots are pulled round the Masi streets, and on the full moon Kallazhagar rides a golden horse into the Vaigai before lakhs of people. Dates are announced by the temple each year.', more(PAGE('index.html#chithirai'), 'The festival, day by day')];
      if (has('pongal', 'jallikattu', 'பொங்கல்')) return ['Pongal is the harvest festival, around 13–16 January: Bhogi, Thai Pongal, Mattu Pongal and Kaanum Pongal. Jallikattu follows at Avaniyapuram, Palamedu and Alanganallur, all near Madurai. Roots matches visitors with village families for Pongal.', more(PAGE('index.html#pongal'), 'Pongal in the villages')];
      const m = new Date().getMonth() + 1;
      const s = kb.festivals.seasons.find((x) => x.months.includes(m)) || kb.festivals.seasons[0];
      if (s) return [`This season in Madurai (${s.name}, ${s.range}): ${s.weather}`, el('ul', { class: 'cc-list' }, ...s.festivals.slice(0, 5).map((f) => el('li', {}, el('b', {}, f.name), ` · ${f.month} · ${f.where}`, el('small', {}, f.text)))),
        more(PAGE('index.html#festivals'), 'Festivals in every season')];
    }

    // ---- a dish by name ----
    const dish = DISHES.find(([keys]) => keys.some((k) => q.includes(k)));
    if (dish) {
      const where = dish[2].map((id) => all.find((p) => p.id === id)).filter(Boolean);
      const local = where.filter((p) => sc.pool.includes(p));
      const pick = (local.length ? [...local, ...where.filter((p) => !local.includes(p))] : where);
      return [`${dish[1]}: where Roots sends you.`, el('ul', { class: 'cc-list' }, ...pick.slice(0, 4).map((p) => el('li', {}, el('a', { href: ctx.placeUrl(p.id) }, p.short || p.name),
        ` · ${regions.find((r) => r.id === regionOf(p)).name} · ${status(p, day, hour).text}`, el('small', {}, p.story))))];
    }

    // ---- food ----
    const SHOP = [['saree', 'dress'], ['dress', 'dress'], ['cloth', 'dress'], ['sungudi', 'dress'], ['silk', 'dress'], ['jewel', 'jewel'], ['gold', 'jewel'], ['bangle', 'jewel'], ['grocer', 'grocery'], ['spice', 'grocery'], ['vegetable', 'vegetable'], ['veggies', 'vegetable'], ['vessel', 'homeware'], ['brass', 'homeware'], ['steel', 'homeware'], ['craft', 'homeware'], ['lamp', 'homeware'], ['veena', 'homeware'], ['painting', 'homeware'], ['doll', 'homeware'], ['flower', 'market'], ['malli', 'market'], ['jasmine', 'market']];
    const foodWord = has('food', 'eat', 'restaurant', 'mess', 'lunch', 'dinner', 'breakfast', 'tiffin', 'snack', 'sweet', 'hungry', 'meal', 'dish', 'cuisine', 'taste', 'சாப்பா', 'சாப்பி', 'உணவு', 'பசி');
    if (foodWord && has('famous', 'special', 'known for', 'must try', 'must-try', 'signature', 'traditional', 'local dish', 'what to eat', 'what should i eat', 'பிரபல')) {
      const lead = known('food') || `Famous food ${sc.where}:`;
      if (!eats.length) {
        const nearest = all.filter((p) => group(p) === 'eat').sort(byDistance)[0];
        return [lead, `Roots has no eating houses listed ${sc.where} yet. Your Ooru Nanbar there will take you to the right ones.`,
          nearest ? `The nearest on Roots is ${nearest.short || nearest.name}, ${formatKm(distanceKm(sc.anchor, nearest))} away.` : '',
          more(PAGE(`roots.html${sc.district ? `?district=${sc.district.id}` : ''}`), 'Plan a trip here')].filter(Boolean);
      }
      // The houses behind the dishes the town is known for come first.
      const fame = (sc.district ? sc.district.food.join(' ') : '').toLowerCase();
      const signature = new Set(DISHES.filter(([keys]) => keys.some((k) => fame.includes(k))).flatMap(([, , ids]) => ids));
      const ranked = [...eats].sort((a, b) => (signature.has(b.id) - signature.has(a.id)) || (openNow(b) - openNow(a)) || byDistance(a, b));
      return [lead, 'The places that made these dishes famous:', list(ranked, sc.anchor, 6)];
    }
    if ((foodWord || veg || has('late', 'midnight', 'இரவு')) && !SHOP.some(([w]) => q.includes(w))) {
      let pool = eats, label = `Best places to eat ${sc.where}`;
      if (veg && !has('non veg', 'non-veg', 'nonveg')) { pool = pool.filter((p) => p.diet === 'veg'); label = `Vegetarian places ${sc.where}`; }
      if (has('non veg', 'non-veg', 'nonveg', 'mutton', 'chicken', 'அசைவ')) { pool = pool.filter((p) => p.diet !== 'veg' && p.type === 'meal'); label = `Non-vegetarian meals ${sc.where}`; }
      if (has('late', 'night', 'midnight', 'இரவு')) { pool = pool.filter((p) => hoursFor(p, day).some(([, c]) => c >= 23)); label = `Serving until 11 pm or later ${sc.where}`; }
      if (has('breakfast', 'morning', 'காலை')) { pool = pool.filter((p) => isOpen(p, day, 8)); label = `Open for breakfast around 8 am ${sc.where}`; }
      if (has('sweet', 'snack', 'dessert')) { const s = pool.filter((p) => p.type === 'sweet'); if (s.length) { pool = s; label = `Sweets and snacks ${sc.where}`; } }
      if (!pool.length) return [`Roots has no match for that ${sc.where}. ${known('food')}`.trim()];
      const openCount = pool.filter(openNow).length;
      return [...farNote, `${label}, ${sc.located ? 'nearest first' : 'open ones first'}. ${openCount} of ${pool.length} are open at ${formatHour(hour)}.`, list(sc.located ? [...pool].sort(byDistance) : openFirst(pool), sc.anchor, 6)];
    }

    // ---- shopping, stays ----
    const shopType = SHOP.find(([w]) => q.includes(w))?.[1];
    if (shopType || has('shop', 'shopping', 'buy', 'market', 'souvenir', 'gift', 'கடை', 'வாங்க', 'மார்க்கெட்')) {
      const kinds = ['market', 'grocery', 'dress', 'jewel', 'homeware', 'vegetable'];
      let s = sc.pool.filter((p) => (shopType ? p.type === shopType : kinds.includes(p.type))).sort(byDistance);
      if (!s.length && shopType) s = all.filter((p) => p.type === shopType).sort(byDistance);
      const lead = known('shop');
      return s.length ? [lead, `Where to shop ${sc.where}:`, list(s, sc.anchor, 6)].filter(Boolean) : [lead || `Roots has no shops listed ${sc.where} yet.`];
    }
    if (has('stay', 'room', 'lodge', 'resort', 'sleep', 'where to stay', 'accommodation', 'தங்க')) {
      const s = sc.pool.filter((p) => p.type === 'stay').sort(byDistance);
      return s.length ? [`Places to stay ${sc.where}, all with 24-hour reception. Roots also arranges verified village homestays through your Ooru Nanbar.`, list(s, sc.anchor)]
        : [`Roots has no stays listed ${sc.where} yet. TTDC runs Hotel Tamil Nadu in most towns, and your Ooru Nanbar can arrange a village homestay.`];
    }

    // ---- one place by name ----
    if (named && !has('near', 'around', 'visit near')) {
      const g = kb.guide[named.id];
      return [`${named.name} (${named.area}): ${status(named, day, hour).text}. Hours: ${named.hours}.`, g ? g.why : named.story,
        g?.see ? `Don't miss: ${g.see.slice(0, 3).join('; ')}.` : '', g?.best ? `Best time: ${g.best}. Time needed: ${g.spend}.` : '',
        // Tips that travellers left for this place (on this device in the prototype): the guide passes them on.
        ...store.get('roots-waypoints', []).filter((t) => t.place === named.id).slice(0, 2).map((t) => `A traveller's tip${t.by ? ` (${String(t.by).slice(0, 40)})` : ''}: "${String(t.text).slice(0, 200)}"`),
        more(ctx.placeUrl(named.id), 'Photos, hours and directions')].filter(Boolean);
    }

    // ---- what to see and do ----
    const sights = sc.pool.filter((p) => ['temple', 'heritage', 'trips'].includes(group(p)));
    const hoursAsked = /(\d+)\s*(hours?|hrs?)/.exec(q)?.[1] || (has('half day', 'half a day') ? 4 : has('one day', 'a day', 'full day', 'whole day') ? 8 : null);
    if (hoursAsked) {
      const n = Number(hoursAsked) <= 2 ? 2 : Number(hoursAsked) <= 4 ? 3 : 5;
      const stops = sights.filter((p) => openNow(p) && distanceKm(sc.anchor, p) < (n <= 3 ? 6 : 25)).sort(byDistance).slice(0, n);
      const meal = eats.filter(openNow).sort(byDistance)[0];
      if (!stops.length) return [`Most sights ${sc.where} are closed at ${formatHour(hour)}. Temples usually open by 6 am and again around 4 pm.`];
      return [`With ${hoursAsked} hours ${sc.where}, starting at ${formatHour(hour)}:`, list(stops, sc.anchor, n), meal ? `Then eat at ${meal.short || meal.name}: ${meal.story}` : ''].filter(Boolean);
    }
    if (has('temple', 'kovil', 'koil', 'கோவில்', 'கோயில்')) {
      const t = sc.pool.filter((p) => p.type === 'temple');
      const o = t.filter(openNow).sort(byDistance);
      return o.length ? [`${o.length} of ${t.length} temples ${sc.where} are open at ${formatHour(hour)}:`, list(o, sc.anchor, 6)]
        : [`No temples ${sc.where} are open at ${formatHour(hour)}. Most open by 6 am and reopen around 4 pm.`, t.length ? list(t.sort(byDistance), sc.anchor, 4, false) : ''].filter(Boolean);
    }
    if (has('museum', 'heritage', 'history', 'fort', 'palace', 'monument', 'church', 'archaeolog')) {
      const h = sc.pool.filter((p) => p.type === 'heritage').sort(byDistance);
      return h.length ? [`Heritage ${sc.where}:`, list(openFirst(h), sc.anchor, 6)] : [`Roots has no heritage sites listed ${sc.where} yet.`];
    }
    if (has('falls', 'waterfall', 'hill', 'nature', 'beach', 'trek', 'forest', 'bird')) {
      const n = (sc.pool.filter((p) => p.type === 'nature').length ? sc.pool : all).filter((p) => p.type === 'nature').sort(byDistance);
      return [`Hills, falls and the outdoors ${sc.where}:`, list(n, sc.anchor, 6)];
    }
    if (has('see', 'visit', 'places', 'sight', 'things to do', 'what to do', 'explore', 'suggest', 'recommend', 'tour', 'around', 'near', 'where am i', 'பார்க்க', 'சுற்றி', 'அருகில்')) {
      const lead = sc.located ? (sc.you ? `You are ${sc.you}.` : '') : sc.district && !sc.region ? known('known') : '';
      const pick = sc.located ? [...sc.pool].filter((p) => p.type !== 'stay').sort(byDistance) : openFirst(sights);
      if (!pick.length) return [lead || `Roots has nothing listed ${sc.where} yet.`];
      return [...farNote, lead, sc.located ? `Nearest places on Roots, with what is open at ${formatHour(hour)}:` : `What to see ${sc.where}:`, list(pick, sc.anchor, 6),
        sc.district ? more(PAGE(`roots.html?district=${sc.district.id}`), `Plan days in ${sc.district.name}`) : ''].filter(Boolean);
    }
    if (has('open', 'now', 'திறந்', 'இப்போ', 'இப்ப')) {
      const o = sc.pool.filter((p) => openNow(p) && p.type !== 'stay' && !is24h(hoursFor(p, day))).sort(byDistance);
      return o.length ? [`${o.length} places ${sc.where} are open at ${formatHour(hour)}. Nearest first:`, list(o, sc.anchor, 6, false)] : ['Almost everything is resting now. Hotels and the flower market are awake; halwa returns at 4 am.'];
    }

    // ---- a town or district on its own ----
    if (sc.named && !(sc.region && sc.region.id === 'madurai')) {
      const d = sc.district;
      return [sc.region?.line ? `${sc.name}: ${sc.region.line}.` : `${d.name} (${d.ta}) is known for: ${d.known.join('; ')}.`, d ? `Food: ${d.food.join('; ')}. To take home: ${d.shop.join('; ')}.` : '',
        sc.pool.length ? list(openFirst(sc.pool.filter((p) => p.type !== 'stay')), sc.anchor, 5) : '', d ? more(PAGE(`roots.html?district=${d.id}`), `Plan a homecoming to ${d.name}`) : ''].filter(Boolean);
    }

    // ---- anything else Roots has words for ----
    const tokens = q.replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w));
    if (tokens.length) {
      const text = (p) => `${p.name} ${p.area} ${p.story} ${(p.tips || []).join(' ')} ${kb.guide[p.id] ? `${kb.guide[p.id].hook} ${kb.guide[p.id].why} ${(kb.guide[p.id].see || []).join(' ')}` : ''}`.toLowerCase();
      const hits = all.map((p) => ({ p, s: tokens.filter((t) => text(p).includes(t)).length })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || byDistance(a.p, b.p));
      if (hits.length) return ['Here is what Roots has on that:', list(hits.map((x) => x.p), null, 5)];
      const dh = kb.districts.filter((d) => tokens.some((t) => `${d.known.join(' ')} ${d.food.join(' ')} ${d.shop.join(' ')}`.toLowerCase().includes(t)));
      if (dh.length) return ['Roots knows it from these districts:', el('ul', { class: 'cc-list' }, ...dh.slice(0, 5).map((d) => el('li', {}, el('a', { href: PAGE(`roots.html?district=${d.id}`) }, d.name), el('small', {}, [...d.known, ...d.food, ...d.shop].join('; ')))))];
    }
    return ['I don\'t have that in what Roots knows yet, and I would rather say so than guess. I can tell you where to eat, what a town is famous for, what to see near you, what is open now, the queue and darshan wait, safe cabs, festivals, and how to plan a homecoming. Try a suggestion below.'];
  }
  return { ask };
}
