// Health & safety: emergency numbers, live map searches for hospitals, clinics and pharmacies,
// and the main 24-hour hospital emergency departments in Madurai.
// Shared by the Node build (place pages, health page) and the browser (homecoming plans).
// We deliberately do not copy third-party listings: "open 24 hours" claims for shops go stale,
// so visitors get a live map search from their own location instead.

export const EMERGENCY = [
  { n: '108', label: 'Ambulance (Tamil Nadu, free)' },
  { n: '112', label: 'Any emergency: police, fire, ambulance' },
  { n: '104', label: 'Medical helpline' },
  { n: '1363', label: 'Tourist helpline' },
  { n: '1091', label: 'Women in distress' }
];

export const MADURAI_HOSPITALS = [
  { name: 'Government Rajaji Hospital (casualty)', area: 'Panagal Road', note: 'Government hospital, 24-hour casualty, free treatment' },
  { name: 'Apollo Specialty Hospitals', area: 'Lake View Road, KK Nagar', note: 'Private, 24-hour emergency' },
  { name: 'Vadamalayan Hospitals', area: 'Chinna Chokkikulam', note: 'Private, 24-hour emergency' }
];

export const SEARCHES = [
  { q: '24 hour hospital', label: '24-hour hospitals', icon: 'health' },
  { q: 'clinic open now', label: 'Clinics open now', icon: 'health' },
  { q: 'pharmacy open now', label: 'Pharmacies open now', icon: 'health' }
];

/** Google Maps search centred on a point, or on the visitor's own location when no point is given. */
export function mapSearch(q, lat, lng) {
  return lat != null
    ? `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${lat},${lng},14z`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${q} near me`)}`;
}

export function hospitalSearch(h, city = 'Madurai') {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${h.name.replace(/ \(.*\)$/, '')}, ${h.area}, ${city}`)}`;
}

export const PHARMACY_TIP = 'At night, the pharmacy inside a 24-hour hospital is the safest bet: standalone shops listed as "24 hours" are sometimes shut. Call before you go.';
