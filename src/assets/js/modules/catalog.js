// Place types: label, sprite icon, colour token, filter group and schema.org type.
// Pure data, shared by the browser and the Node build script.

export const TYPES = {
  temple:   { label: 'Temple',          group: 'temple',   schema: 'HinduTemple' },
  heritage: { label: 'Heritage',        group: 'heritage', schema: 'TouristAttraction' },
  market:   { label: 'Flower market',   group: 'market',   schema: 'TouristAttraction' },
  grocery:  { label: 'Groceries & spices', group: 'market', schema: 'TouristAttraction' },
  dress:    { label: 'Dress & sarees',  group: 'market',   schema: 'TouristAttraction' },
  jewel:    { label: 'Jewellery & bangles', group: 'market', schema: 'TouristAttraction' },
  homeware: { label: 'Home & crafts',   group: 'market',   schema: 'TouristAttraction' },
  vegetable:{ label: 'Vegetable market', group: 'market',  schema: 'TouristAttraction' },
  meal:     { label: 'Meals',           group: 'eat',      schema: 'Restaurant' },
  sweet:    { label: 'Sweets & snacks', group: 'eat',      schema: 'FoodEstablishment' },
  drink:    { label: 'Drinks',          group: 'eat',      schema: 'FoodEstablishment' },
  stay:     { label: 'Stay',            group: 'stay',     schema: 'Hotel' },
  nature:   { label: 'Nature & falls',  group: 'trips',    schema: 'TouristAttraction' }
};

export const GROUPS = {
  eat:      { label: 'Eat & drink', icon: 'meal' },
  temple:   { label: 'Temples',     icon: 'temple' },
  heritage: { label: 'Heritage',    icon: 'heritage' },
  stay:     { label: 'Stays',       icon: 'stay' },
  market:   { label: 'Markets & shopping', icon: 'bag' },
  trips:    { label: 'Day trips (100 km)', icon: 'route' }
};

export const groupOf = (place) => (place.trip ? 'trips' : TYPES[place.type].group);

/** Hot-linkable Wikimedia Commons thumbnail (redirects to upload.wikimedia.org). */
export function commonsImage(file, width = 960) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=${width}`;
}
export function commonsPage(file) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;
}

/** Image source for a place: a self-hosted copy (scripts/fetch-images.mjs) wins over the Commons link. */
export function imageSrc(place, width = 960, base = '') {
  if (!place.image) return null;
  if (place.image.local) return base + (width <= 480 && place.image.thumb ? place.image.thumb : place.image.local);
  return commonsImage(place.image.file, width);
}

export function directionsUrl(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
}
// Public-transport directions; Google Maps starts from the visitor's current location.
export function busUrl(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=transit`;
}

export function osmUrl(place) {
  return `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=17/${place.lat}/${place.lng}`;
}
