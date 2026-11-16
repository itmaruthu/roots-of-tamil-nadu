// Trip price estimate for a homecoming: a rough, honest range in rupees and the family's home currency.
// Figures are planning assumptions for the pilot, not quotes. Flights to India are not included.

export const TIERS = {
  simple: { label: 'Simple', note: 'Lodges and messes', room: 1800, meal: 400, cabUp: 1 },
  comfortable: { label: 'Comfortable', note: 'Good hotels and restaurants', room: 3000, meal: 700, cabUp: 1 },
  premium: { label: 'Premium', note: 'Heritage hotels, larger cab', room: 7500, meal: 1800, cabUp: 1.25 }
};

// Cab per day by group size, with driver and fuel for about 250 km (government-permitted taxis).
const cabFor = (people) => (people <= 4 ? { kind: 'Sedan', day: 3000 } : people <= 7 ? { kind: 'SUV', day: 4000 } : { kind: 'Tempo Traveller', day: 6000 });

export const NANBAR_DAY = 2500;      // Ooru Nanbar, per day with the family
export const NANBAR_DAYS = 2;        // village day and one more
export const COORDINATION_FEE = 5000; // Roots coordination fee, per family
const TEMPLE = 1500;                 // pongal or abhishekam at the kuladeivam, flowers, priest's dakshina
const EXPERIENCE = 200;              // entry tickets and small experiences, per person per day

// Approximate rupees per unit. Shown as approximate; families check the rate before they pay.
export const RATES_AS_OF = 'November 2026';
export const CURRENCIES = {
  INR: { name: 'Indian rupee', rate: 1 },
  USD: { name: 'US dollar', rate: 88 },
  GBP: { name: 'British pound', rate: 116 },
  EUR: { name: 'Euro', rate: 102 },
  SGD: { name: 'Singapore dollar', rate: 68 },
  MYR: { name: 'Malaysian ringgit', rate: 21 },
  AED: { name: 'UAE dirham', rate: 24 },
  SAR: { name: 'Saudi riyal', rate: 23.5 },
  QAR: { name: 'Qatari riyal', rate: 24 },
  KWD: { name: 'Kuwaiti dinar', rate: 287 },
  OMR: { name: 'Omani rial', rate: 229 },
  CAD: { name: 'Canadian dollar', rate: 63 },
  AUD: { name: 'Australian dollar', rate: 58 },
  NZD: { name: 'New Zealand dollar', rate: 51 },
  LKR: { name: 'Sri Lankan rupee', rate: 0.29 },
  MUR: { name: 'Mauritian rupee', rate: 1.9 },
  ZAR: { name: 'South African rand', rate: 5 }
};

const PLACES_TO_CURRENCY = [
  [/singapore/, 'SGD'],
  [/malaysia|kuala lumpur|\bkl\b|penang|ipoh|johor|klang|seremban/, 'MYR'],
  [/dubai|abu dhabi|sharjah|ajman|\buae\b|emirates|al ain/, 'AED'],
  [/saudi|riyadh|jeddah|dammam|khobar|jubail/, 'SAR'],
  [/qatar|doha/, 'QAR'],
  [/kuwait/, 'KWD'],
  [/oman|muscat|salalah/, 'OMR'],
  [/canada|toronto|vancouver|montreal|ottawa|calgary|brampton|scarborough|mississauga/, 'CAD'],
  [/\buk\b|united kingdom|england|britain|london|birmingham|manchester|leicester|croydon|scotland|wales/, 'GBP'],
  [/australia|sydney|melbourne|perth|brisbane|adelaide|canberra/, 'AUD'],
  [/new zealand|auckland|wellington/, 'NZD'],
  [/sri lanka|colombo|jaffna|kandy|batticaloa|trincomalee/, 'LKR'],
  [/mauritius|port louis/, 'MUR'],
  [/south africa|durban|johannesburg|cape town|pietermaritzburg/, 'ZAR'],
  [/germany|berlin|munich|frankfurt|france|paris|netherlands|amsterdam|ireland|dublin|italy|spain|belgium|switzerland|zurich|geneva|europe|reunion|réunion/, 'EUR'],
  [/\busa?\b|united states|america|new york|new jersey|california|texas|dallas|houston|chicago|seattle|bay area|san jose|atlanta|boston/, 'USD']
];

/** Guess the family's home currency from "Travelling from"; USD when unsure. */
export function currencyFor(from) {
  const s = (from || '').toLowerCase();
  for (const [re, code] of PLACES_TO_CURRENCY) if (re.test(s)) return code;
  return 'USD';
}

/** Line items for a trip. Nights = days - 1: the family flies home on the last evening. */
export function estimate({ days, people, tier = 'comfortable', kids = false }) {
  const t = TIERS[tier] || TIERS.comfortable;
  const nights = Math.max(1, days - 1);
  const rooms = Math.max(1, Math.ceil(people / (kids ? 3 : 2)));
  const cab = cabFor(people);
  const lines = [
    { k: 'stay', label: `Stay: ${rooms} room${rooms > 1 ? 's' : ''} × ${nights} nights`, amt: rooms * nights * t.room },
    { k: 'cab', label: `${cab.kind} with driver × ${days} days`, amt: Math.round(cab.day * t.cabUp) * days },
    { k: 'nanbar', label: `Ooru Nanbar × ${NANBAR_DAYS} days`, amt: NANBAR_DAY * NANBAR_DAYS },
    { k: 'meals', label: `Meals for ${people} × ${days} days`, amt: t.meal * people * days },
    { k: 'temple', label: 'Kuladeivam offering, entry tickets and experiences', amt: TEMPLE + EXPERIENCE * people * days },
    { k: 'fee', label: 'Roots coordination fee', amt: COORDINATION_FEE }
  ];
  const total = lines.reduce((s, l) => s + l.amt, 0);
  return { lines, total, perDay: total / days, perPerson: total / people, nights, rooms };
}

/** Round to a sensible figure for an estimate: nearest 100 rupees, or a whole unit abroad. */
export function money(inr, code = 'INR') {
  const c = CURRENCIES[code] || CURRENCIES.INR;
  const v = inr / c.rate;
  const rounded = code === 'INR' ? Math.round(v / 100) * 100 : v >= 1000 ? Math.round(v / 10) * 10 : Math.round(v);
  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(rounded);
  } catch {
    return `${code} ${rounded.toLocaleString('en')}`;
  }
}
