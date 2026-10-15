// City bus plans from MaduraiOne's community route data (src/data/bus.json).
// Pure functions: used by the build (static default plan) and the place page (plan from the visitor's location).
import { distanceKm } from './geo.js';

const KEEP = new Set(['MGR', 'TPK', 'CMH', 'P']);
export function niceStop(name) {
  return name.split(' ').map((w) => (KEEP.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(' ');
}

export function nearestHub(data, pt) {
  return Object.entries(data.hubs)
    .map(([name, c]) => ({ name, km: distanceKm(pt, c) }))
    .sort((a, b) => a.km - b.km)[0];
}

// Returns null when the visitor's hub is the place's own stop.
export function planFor(data, placeId, hub) {
  const dest = data.places[placeId];
  if (!dest || hub === dest) return null;
  const r = data.routes[`${hub}>${dest}`];
  if (!r) return null;
  const [type, fare, , legs] = r;
  return {
    from: hub, to: dest, direct: type === 'D', fare,
    legs: legs.map(([from, to, buses, stops]) => ({ from, to, buses: buses.split(' '), stops })),
    url: `https://maduraione.in/?from=${encodeURIComponent(hub)}&to=${encodeURIComponent(dest)}`
  };
}

export function defaultHub(data, placeId) {
  return data.places[placeId] === 'PERIYAR BUS STAND' ? 'MGR BUS STAND' : 'PERIYAR BUS STAND';
}
