// Place page: live open/closed pill, today's row highlighted, distance from the visitor.
import { $ } from './modules/dom.js';
import { nowInMadurai, status } from './modules/hours.js';
import { distanceKm, formatKm } from './modules/geo.js';

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

  $('#near-me')?.addEventListener('click', () => {
    const out = $('#from-you');
    if (!('geolocation' in navigator)) { out.textContent = ' · Location is not available in this browser.'; return; }
    out.textContent = ' · Finding you…';
    navigator.geolocation.getCurrentPosition(
      (pos) => { out.textContent = ` · ${formatKm(distanceKm({ lat: pos.coords.latitude, lng: pos.coords.longitude }, place))} from you`; },
      () => { out.textContent = ' · Location permission was not given.'; },
      { timeout: 8000, maximumAge: 300000 }
    );
  });
}

init().catch((e) => console.error(e));
