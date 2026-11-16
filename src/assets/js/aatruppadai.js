// The Aatruppadai page: the guide on its own, quick needs, a five-line "way" to send to a friend,
// and tips that travellers leave for whoever comes next.
import { el, $, icon, store, t, isTa } from './modules/dom.js';
import { nowInMadurai } from './modules/hours.js';
import { initConcierge } from './modules/concierge.js';
import { combo } from './modules/combo.js';
import { distanceKm, MEENAKSHI } from './modules/geo.js';
import { TYPES } from './modules/catalog.js';

const DATA = (name) => new URL(`../../data/${name}.json`, import.meta.url);
const PLACE_URL = (id) => new URL(`../../places/${id}.html`, import.meta.url).href;
const SITE = new URL('../../aatruppadai.html', import.meta.url).href;
const TIPS = 'roots-waypoints';

// [icon, English label, Tamil label, the question it asks]
const NEEDS = [
  ['locate', 'Places near me', 'அருகிலுள்ள இடங்கள்', 'Places to visit near me'], ['meal', 'Food near me', 'அருகில் உணவு', 'Best food near me'], ['star', 'Famous food here', 'இங்கே பிரபல உணவு', 'Famous food near me'],
  ['clock', 'Open right now', 'இப்போது திறந்தவை', 'What is open now?'], ['temple', 'Temples near me', 'அருகிலுள்ள கோயில்கள்', 'temples near me'], ['car', 'A safe cab', 'பாதுகாப்பான வண்டி', 'How do I get a safe cab?'],
  ['health', 'Hospital or help', 'மருத்துவமனை / உதவி', 'hospital'], ['route', 'I have 3 hours', '3 மணி நேரம் உள்ளது', 'I have 3 hours'], ['pin', 'Find my roots', 'என் வேர்களைத் தேடு', 'how do I find my native village'],
  ['bag', 'Shopping', 'கடைகள்', 'where to shop'], ['stay', 'Where to stay', 'தங்குமிடம்', 'where to stay'], ['heritage', 'Festivals', 'திருவிழாக்கள்', 'which festivals now']
];

async function init() {
  const [data, dist] = await Promise.all([fetch(DATA('places')).then((r) => r.json()), fetch(DATA('districts')).then((r) => r.json())]);
  const now = nowInMadurai();
  const state = { day: now.day, hour: now.hour, me: null };
  setInterval(() => { const n = nowInMadurai(); state.day = n.day; state.hour = n.hour; }, 30_000);
  const voice = initVoice((q) => guide?.ask(q));
  const ctx = { state, places: data.places.filter((p) => !p.city), allPlaces: data.places, cities: data.cities || [], placeUrl: PLACE_URL, onAnswer: voice.speak };
  const guide = initConcierge(ctx);

  // Quick needs, and the "show me the way" buttons in the text, ask the guide.
  const ask = (q) => { guide?.ask(q); $('#cc-log').scrollIntoView({ block: 'nearest' }); };
  $('#aat-needs').append(...NEEDS.map(([ic, label, ta, q]) => el('button', { type: 'button', class: 'aat-need', on: { click: () => ask(q) } }, icon(ic), el('span', {}, t(label, ta)))));
  for (const b of document.querySelectorAll('[data-ask]')) b.addEventListener('click', () => ask(b.dataset.ask));

  initVerse(data, dist);
  initTips(data);
}

/* ----- Voice: ask aloud, and hear the answer. Both use the phone's own speech service. ----- */
function initVoice(ask) {
  const mic = $('#cc-mic'), micText = $('#cc-mic-text'), speakBtn = $('#cc-speak'), note = $('#cc-voice-note');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const idle = () => t('Speak your question', 'கேள்வியைப் பேசுங்கள்');
  let reading = store.get('roots-read-aloud', false), listening = false;

  if (Recognition) {
    mic.hidden = false; micText.textContent = idle();
    const rec = new Recognition();
    rec.lang = isTa() ? 'ta-IN' : 'en-IN'; rec.interimResults = false; rec.maxAlternatives = 1;
    const stop = () => { listening = false; mic.setAttribute('aria-pressed', 'false'); micText.textContent = idle(); };
    rec.addEventListener('result', (e) => {
      const said = e.results[0]?.[0]?.transcript?.trim();
      if (said) { note.textContent = ''; ask(said.slice(0, 200)); } else note.textContent = t('I did not catch that. Please try again.', 'சரியாகக் கேட்கவில்லை. மீண்டும் முயலுங்கள்.');
    });
    rec.addEventListener('error', (e) => {
      note.textContent = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? t('The microphone is blocked. Allow it in your browser, or type your question.', 'மைக்ரோஃபோன் தடுக்கப்பட்டுள்ளது. உலாவியில் அனுமதியுங்கள், அல்லது கேள்வியை எழுதுங்கள்.')
        : t('I could not hear you. Please try again, or type your question.', 'கேட்க முடியவில்லை. மீண்டும் முயலுங்கள், அல்லது கேள்வியை எழுதுங்கள்.');
    });
    rec.addEventListener('end', stop);
    mic.addEventListener('click', () => {
      if (listening) { rec.stop(); return; }
      try {
        speechSynthesis?.cancel();
        rec.start(); listening = true; mic.setAttribute('aria-pressed', 'true');
        micText.textContent = t('Listening… tap to stop', 'கேட்கிறேன்… நிறுத்தத் தொடுங்கள்');
        note.textContent = t('Your browser\'s own speech service turns your voice into text.', 'உங்கள் உலாவியின் குரல் சேவை உங்கள் பேச்சை எழுத்தாக மாற்றுகிறது.');
      } catch { stop(); }
    });
  } else {
    note.textContent = t('Voice questions need Chrome or Safari on a phone. You can still type.', 'குரல் கேள்விக்கு கைபேசியில் Chrome அல்லது Safari தேவை. எழுதியும் கேட்கலாம்.');
  }

  const canSpeak = 'speechSynthesis' in window;
  if (canSpeak) {
    speakBtn.hidden = false; speakBtn.setAttribute('aria-pressed', String(reading));
    speakBtn.addEventListener('click', () => {
      reading = !reading; store.set('roots-read-aloud', reading); speakBtn.setAttribute('aria-pressed', String(reading));
      if (!reading) speechSynthesis.cancel();
    });
  }
  return {
    /** Read an answer aloud when the visitor has asked for that. Tamil text is read with a Tamil voice where the phone has one. */
    speak(text) {
      if (!canSpeak || !reading || !text) return;
      try {
        const u = new SpeechSynthesisUtterance(text.replace(/→/g, '').slice(0, 700));
        u.lang = /[\u0B80-\u0BFF]/.test(text.slice(0, 80)) ? 'ta-IN' : 'en-IN'; u.rate = 0.95;
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      } catch { /* reading aloud is a convenience */ }
    }
  };
}

/* ----- An Aatruppadai for a friend: the way to a town in five lines ----- */
function initVerse(data, dist) {
  const towns = [{ id: 'madurai', name: 'Madurai', ta: 'மதுரை', district: 'madurai', lat: MEENAKSHI.lat, lng: MEENAKSHI.lng }, ...(data.cities || [])];
  const input = $('#aat-town'), card = $('#aat-card');
  let town = towns[0];
  const box = combo(input, { strict: true, strictMessage: 'Choose a town from the list', options: () => towns.map((t) => ({ v: t.name, hint: t.ta, id: t.id })),
    onPick: (o) => { const t = o && towns.find((x) => x.id === o.id); if (t) town = t; else box.set(town.name); } });
  box.set(town.name);

  function compose() {
    const pool = data.places.filter((p) => (p.city || 'madurai') === town.id).map((p) => ({ ...p, km: distanceKm(town, p) })).sort((a, b) => a.km - b.km);
    const group = (p) => TYPES[p.type].group;
    const sights = pool.filter((p) => ['temple', 'heritage'].includes(group(p))).slice(0, 2);
    const eat = pool.find((p) => group(p) === 'eat');
    const stay = pool.find((p) => p.type === 'stay');
    const d = dist.districts.find((x) => x.id === town.district);
    const air = dist.airports.map((a) => ({ a, km: distanceKm(town, a) })).sort((x, y) => x.km - y.km)[0];
    const road = Math.max(5, Math.round((air.km * 1.3) / 5) * 5);
    const friend = $('#aat-friend').value.trim().slice(0, 40);
    const short = (p) => p.short || p.name;
    const lines = [
      ['வழிகாட்டுதல்', 'The way', `${friend ? `${friend}, if` : 'Traveller, if'} you go to ${town.name}: land at ${air.a.name} airport, about ${road} km by road. Take the prepaid taxi or the state bus, and pay only the fare on the board.`],
      ['விருந்தோம்பல்', 'Where you will be welcomed', `${eat ? `Eat at ${short(eat)}: ${eat.story}` : `Ask for ${d.food[0]}.`} ${stay ? `Rest at ${short(stay)}, or in a village home your Ooru Nanbar finds for you.` : 'Your Ooru Nanbar will find you a village home to rest in.'}`],
      ['பகிர்தல்', 'What I know', `${sights.length ? `Do not leave without seeing ${sights.map(short).join(' and ')}. ` : ''}${town.name === d.name ? `The place is known for ${d.food[0]}; take home ${d.shop[0]}.` : `${town.line}.`}`],
      ['உதவுதல்', 'If you need help', 'Call 108 for an ambulance and 1363, the tourist helpline. Ask Aatruppadai on Roots what is open at any hour.'],
      ['வாழ்வளித்தல்', 'Pass it on', 'When you come back, tell the next traveller what you found.']
    ];
    const title = `An Aatruppadai to ${town.name}`;
    const text = [`${title} · ${town.ta} ஆற்றுப்படை`, '', ...lines.map(([, en, t]) => `${en}: ${t}`), '', `From Roots of Tamil Nadu: ${SITE}`].join('\n');
    const copy = el('button', { class: 'btn btn--ghost btn--sm', type: 'button', on: { click: async (e) => {
      try { await navigator.clipboard.writeText(text); e.currentTarget.textContent = 'Copied'; } catch { e.currentTarget.textContent = 'Copy not available: select the text above'; }
    } } }, 'Copy the text');
    card.replaceChildren(
      el('p', { class: 'eyebrow', lang: 'ta' }, `${town.ta} ஆற்றுப்படை`), el('h3', {}, title),
      el('ol', { class: 'aat-lines' }, ...lines.map(([ta, en, t]) => el('li', {}, el('p', { class: 'aat-line-h' }, el('span', { lang: 'ta' }, ta), ` · ${en}`), el('p', {}, t)))),
      el('div', { class: 'chips' }, el('a', { class: 'btn btn--sm', href: `https://wa.me/?text=${encodeURIComponent(text)}`, target: '_blank', rel: 'noopener noreferrer' }, 'Send on WhatsApp'), copy));
    card.hidden = false;
  }
  $('#aat-compose').addEventListener('click', compose);
}

/* ----- Tips left for the next traveller (kept on this device in the prototype) ----- */
function initTips(data) {
  const form = $('#aat-tip-form'), input = $('#aat-tip-place'), listEl = $('#aat-tips'), msg = $('#aat-tip-msg');
  let place = null;
  const name = (p) => p.short || p.name;
  const cityOf = (p) => (data.cities || []).find((c) => c.id === p.city)?.name || 'Madurai';
  const box = combo(input, { strict: true, strictMessage: 'Choose a place from the list',
    options: () => data.places.map((p) => ({ v: name(p), hint: cityOf(p), id: p.id })), onPick: (o) => { place = o ? data.places.find((p) => p.id === o.id) : null; } });

  function draw() {
    const tips = store.get(TIPS, []);
    $('#aat-tips-empty').hidden = tips.length > 0;
    listEl.replaceChildren(...tips.map((t, i) => {
      const p = data.places.find((x) => x.id === t.place);
      return el('li', {}, el('p', { class: 'aat-tip-place' }, p ? el('a', { href: PLACE_URL(p.id) }, name(p)) : 'A place', t.by ? ` · ${t.by}` : ''), el('p', {}, t.text),
        el('button', { type: 'button', class: 'linkbtn', 'aria-label': `Remove the tip for ${p ? name(p) : 'this place'}`, on: { click: () => { const all = store.get(TIPS, []); all.splice(i, 1); store.set(TIPS, all); draw(); } } }, 'Remove'));
    }));
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity() || !place) { input.focus(); return; }
    const text = $('#aat-tip-text').value.trim().slice(0, 200);
    if (!text) return;
    const tips = store.get(TIPS, []);
    tips.unshift({ place: place.id, text, by: $('#aat-tip-by').value.trim().slice(0, 40) });
    store.set(TIPS, tips.slice(0, 30));
    msg.textContent = `Thank you. Ask Aatruppadai about ${name(place)} and it will pass your tip on.`;
    $('#aat-tip-text').value = ''; box.set(''); place = null;
    draw();
  });
  draw();
}

init().catch((err) => {
  console.error(err);
  const log = $('#cc-log'); if (log) log.textContent = 'The guide could not load. Please refresh the page.';
});
