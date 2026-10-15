// Geography: real coordinates, distances and a simple equirectangular projection.
// Pure functions, shared by the browser map and the build-time locator maps.

export const MEENAKSHI = { lat: 9.9195045, lng: 78.1193418 };

export const VIEWS = {
  old:    { label: 'Old city', halfKm: 1.4 },
  city:   { label: 'City',     halfKm: 5.5 },
  region: { label: 'Region',   halfKm: 15, center: { lat: 9.975, lng: 78.135 } }
};

// Half-widths (km) of the concentric street squares around the temple. Approximate.
export const RINGS = [
  { name: 'Chithirai', km: 0.17 },
  { name: 'Avani Moola', km: 0.3 },
  { name: 'Masi', km: 0.5 },
  { name: 'Veli', km: 0.8 }
];

// Approximate course of the Vaigai through the city (for orientation only).
export const VAIGAI = [
  [9.952, 78.02], [9.942, 78.06], [9.934, 78.095], [9.9295, 78.115], [9.927, 78.13],
  [9.922, 78.15], [9.915, 78.17], [9.905, 78.2], [9.893, 78.24]
];

const KM_PER_DEG_LAT = 110.6;
const kmPerDegLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);

export function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Main bus stands (locations checked against map listings, October 2026).
export const BUS_STANDS = [
  { name: 'Periyar Bus Stand', ta: 'பெரியார் பேருந்து நிலையம்', lat: 9.915244, lng: 78.111584, serves: 'city and town buses' },
  { name: 'MGR Bus Stand, Mattuthavani', ta: 'மாட்டுத்தாவணி பேருந்து நிலையம்', lat: 9.943495, lng: 78.156384, serves: 'long-distance and city buses' },
  { name: 'Arappalayam Bus Stand', ta: 'ஆரப்பாளையம் பேருந்து நிலையம்', lat: 9.934933, lng: 78.103466, serves: 'buses towards Dindigul and Theni, and city buses' },
  { name: 'Anna Bus Stand', ta: 'அண்ணா பேருந்து நிலையம்', lat: 9.924598, lng: 78.138551, serves: 'city buses, near the Government Hospital' },
  { name: 'Palanganatham Bus Stand', ta: 'பழங்காநத்தம் பேருந்து நிலையம்', lat: 9.906319, lng: 78.094129, serves: 'city buses' }
];

export function nearestStand(pt) {
  return BUS_STANDS.map((s) => ({ ...s, km: distanceKm(pt, s) })).sort((a, b) => a.km - b.km)[0];
}

export function formatKm(km) {
  return km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/** Returns project(lat,lng) -> [x,y] in a size×size box for a view. */
export function projector(viewKey, size = 600, center = VIEWS[viewKey].center || MEENAKSHI, width = size) {
  const half = VIEWS[viewKey].halfKm;
  const scale = size / 2 / half; // px per km
  const kx = kmPerDegLng(center.lat);
  const fn = (lat, lng) => [
    width / 2 + (lng - center.lng) * kx * scale,
    size / 2 - (lat - center.lat) * KM_PER_DEG_LAT * scale
  ];
  fn.scale = scale;
  fn.center = center;
  return fn;
}

export function nearest(place, places, count = 5) {
  return places
    .filter((p) => p.id !== place.id)
    .map((p) => ({ place: p, km: distanceKm(place, p) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, count);
}
