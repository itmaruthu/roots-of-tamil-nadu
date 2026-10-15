// Place page: live open/closed pill, today's row highlighted, distance from the visitor.
import { $ } from './modules/dom.js';
import { nowInMadurai, status } from './modules/hours.js';
import { el } from './modules/dom.js';
import { distanceKm, formatKm } from './modules/geo.js';
import { planFor, nearestHub, niceStop } from './modules/bus.js';

const BUS_URL = new URL('../../data/bus.json', import.meta.url);
let busData = null;
async function loadBus() {
  if (!busData) { const r = await fetch(BUS_URL, { credentials: 'same-origin' }); busData = r.ok ? await r.json() : null; }
  return busData;
}

function renderPlan(box, plan, hub, place, me) {
  const ta = (n) => (busData.ta[n] ? ` (${busData.ta[n]})` : '');
  const parts = [];
  const toPlace = distanceKm(me, place);
  if (toPlace < 0.8) { box.replaceChildren(el('p', { class: 'bus-head' }, `You're ${formatKm(toPlace)} away. It's a short walk.`)); return; }
  parts.push(el('p', { class: 'bus-head' }, hub.km < 0.15 ? `You're at ${niceStop(hub.name)}${ta(hub.name)}.` : `Walk ${formatKm(hub.km)} to ${niceStop(hub.name)}${ta(hub.name)}, your nearest main stop.`));
  if (!plan) { parts.push(el('p', {}, 'Your nearest stop is this place\'s own stop, so walking is quickest.')); box.replaceChildren(...parts); return; }
  parts.push(el('p', { class: 'bus-head' }, plan.direct ? 'Direct bus' : 'One change'));
  parts.push(el('ol', { class: 'bus-legs' }, ...plan.legs.map((l, i) => el('li', {},
    `${i ? 'Change at' : 'From'} `, el('b', {}, niceStop(l.from)), ': bus ',
    ...l.buses.flatMap((b) => [el('span', { class: 'busno' }, b), ' ']),
    `to ${niceStop(l.to)}${ta(l.to)} · ${l.stops} stops`))));
  parts.push(el('a', { class: 'bus-more', href: plan.url, target: '_blank', rel: 'noopener noreferrer' }, 'Full route and live buses on MaduraiOne'));
  box.replaceChildren(...parts);
}

const DATA_URL = new URL('../../data/places.json', import.meta.url);
const id = $('main')?.dataset.placeId;

for (const img of document.querySelectorAll('img')) {
  if (img.complete && img.naturalWidth === 0 && img.currentSrc) img.remove();
  else img.addEventListener('error', () => img.remove(), { once: true });
}

async function init() {
  const res = await fetch(DATA_URL, { credentials: 'same-origin' });
  if (!res.ok) return;
  const { places } = await res.json();
  const place = places.find((p) => p.id === id);
  if (!place) return;

  const tick = () => {
    const { day, hour } = nowInMadurai();
    const st = status(place, day, hour);
    const live = $('#live');
    live.className = `live status--${st.state}`;
    live.textContent = `Now in Madurai: ${st.text}`;
    document.querySelector(`#hours tr[data-day="${day}"]`)?.classList.add('is-today');
  };
  tick();
  setInterval(tick, 60_000);

  const busFromMe = () => {
    const box = $('#bus-plan');
    if (!box) return;
    if (!('geolocation' in navigator)) { box.prepend(el('p', { class: 'note' }, 'Location is not available in this browser.')); return; }
    const original = [...box.childNodes].map((n) => n.cloneNode(true));
    box.replaceChildren(el('p', { class: 'note' }, 'Finding buses from where you are…'));
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const data = await loadBus();
      if (!data) { box.replaceChildren(el('p', { class: 'note' }, 'Bus data could not be loaded.')); return; }
      const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!data.places[id]) { box.replaceChildren(el('p', { class: 'note' }, 'City buses do not run here. See Getting there above, or use Google Maps transit.')); return; }
      const hub = nearestHub(data, me);
      if (hub.km > 15) { box.replaceChildren(el('p', { class: 'note' }, `You seem to be outside Madurai (${formatKm(hub.km)} from the nearest city stop). The plan works once you're in the city.`)); return; }
      renderPlan(box, planFor(data, id, hub.name), hub, place, me);
    }, () => { box.replaceChildren(...original, el('p', { class: 'note' }, 'Location permission was not given, so this shows buses from the three main bus stands.')); }, { timeout: 8000, maximumAge: 300000 });
  };
  $('#bus-me')?.addEventListener('click', busFromMe);

  $('#near-me')?.addEventListener('click', () => {
    const out = $('#from-you');
    if (!('geolocation' in navigator)) { out.textContent = ' · Location is not available in this browser.'; return; }
    out.textContent = ' · Finding you…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        out.textContent = ` · ${formatKm(distanceKm(me, place))} from you`;
      },
      () => { out.textContent = ' · Location permission was not given.'; },
      { timeout: 8000, maximumAge: 300000 }
    );
  });
}

init().catch((e) => console.error(e));
