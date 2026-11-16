// Trip price estimate for a homecoming: a rough, honest range in rupees and the family's home currency.
// Figures are planning assumptions for the pilot, not quotes. Flights to India are not included.

export const TIERS = {
  simple: { label: 'Simple', note: 'Lodges and messes', room: 1800, meal: 400, cabUp: 1 },
  comfortable: { label: 'Comfortable', note: 'Good hotels and restaurants', room: 3000, meal: 700, cabUp: 1 },
  premium: { label: 'Premium', note: 'Heritage hotels, larger cab', room: 7500, meal: 1800, cabUp: 1.25 }
};

// Cab per day by group size, with driver and fuel for about 250 km (government-permitted taxis).
const VEHICLES = [[4, 'Sedan', 3000], [7, 'SUV', 4000], [12, 'Tempo Traveller', 6000], [20, 'Mini coach', 9000], [35, 'Coach', 14000], [50, 'Large coach', 18000]];
const cabFor = (people) => { const [, kind, day] = VEHICLES.find(([seats]) => people <= seats) || VEHICLES.at(-1); return { kind, day }; };
const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export const NANBAR_DAY = 2500;      // Ooru Nanbar, per day with the family
// The village day and one more; on long stays, about one day in four.
export const nanbarDays = (days) => Math.min(days, Math.max(2, Math.ceil(days / 4)));
export const COORDINATION_FEE = 5000; // Roots coordination fee, per family
const TEMPLE = 1500;                 // pongal or abhishekam at the kuladeivam, flowers, priest's dakshina
const TICKETS = 100;                 // government monument, museum and darshan tickets, per person per day
const EXPERIENCE = 100;              // small local experiences, per person per day
export const COMMISSION = 0.12;      // paid by hosts out of their price, not added to the family's bill
const GST_TRAVEL = 5;                // % on hotel rooms up to ₹7,500, restaurant meals and cabs
const GST_FEE = 18;                  // % on the Roots coordination fee

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
  [/\bindia\b|chennai|bengaluru|bangalore|mumbai|delhi|hyderabad|kolkata|pune/, 'INR'],
  [/switzerland|zurich|geneva/, 'EUR'],
  [/singapore/, 'SGD'],
  [/malaysia|kuala lumpur|\bkl\b|penang|ipoh|johor|klang|seremban/, 'MYR'],
  [/dubai|abu dhabi|sharjah|ajman|\buae\b|emirates|al ain/, 'AED'],
  [/saudi|riyadh|jeddah|dammam|khobar|jubail/, 'SAR'],
  [/qatar|doha/, 'QAR'],
  [/kuwait/, 'KWD'],
  [/\boman\b|muscat|salalah/, 'OMR'],
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
  const nights = days - 1;
  const withNanbar = nanbarDays(days);
  const rooms = Math.max(1, Math.ceil(people / (kids ? 3 : 2)));
  const cab = cabFor(people);
  const lines = [
    { k: 'stay', label: nights ? `Stay: ${pl(rooms, 'room')} × ${pl(nights, 'night')}` : 'Stay: none, a day visit', amt: rooms * nights * t.room },
    { k: 'cab', label: `${cab.kind} with driver × ${pl(days, 'day')}`, amt: Math.round(cab.day * t.cabUp) * days },
    { k: 'nanbar', label: `Ooru Nanbar × ${pl(withNanbar, 'day')}`, amt: NANBAR_DAY * withNanbar },
    { k: 'meals', label: `Meals for ${people} × ${pl(days, 'day')}`, amt: t.meal * people * days },
    { k: 'temple', label: 'Kuladeivam offering, entry tickets and experiences', amt: TEMPLE + (TICKETS + EXPERIENCE) * people * days },
    { k: 'fee', label: 'Roots coordination fee', amt: COORDINATION_FEE }
  ];
  const total = lines.reduce((s, l) => s + l.amt, 0);
  return { lines, total, perDay: total / days, perPerson: total / people, nights, rooms, tickets: TICKETS * people * days };
}

/**
 * Where the family's money goes: local people, the government, and Roots.
 * Illustrative: prices are treated as GST-inclusive and every hotel, restaurant and cab as GST-registered.
 */
export function split(e) {
  const amt = (k) => e.lines.find((l) => l.k === k).amt;
  const booked = amt('stay') + amt('cab') + amt('nanbar') + amt('meals');
  const gst = (amt('stay') + amt('cab') + amt('meals')) * GST_TRAVEL / (100 + GST_TRAVEL) + amt('fee') * GST_FEE / (100 + GST_FEE);
  const gov = gst + e.tickets;
  const roots = amt('fee') * 100 / (100 + GST_FEE) + booked * COMMISSION;
  const local = e.total - gov - roots;
  const pct = (v) => Math.round((v / e.total) * 100);
  return [
    { k: 'local', label: 'Local people', note: 'Your Ooru Nanbar, village cooks, hotels, drivers and the temple', amt: local, pct: 100 - pct(gov) - pct(roots) },
    { k: 'gov', label: 'Government', note: 'GST, and tickets for monuments, museums and darshan', amt: gov, pct: pct(gov) },
    { k: 'roots', label: 'Roots', note: 'Coordination fee, and a 12% commission paid by hosts', amt: roots, pct: pct(roots) }
  ];
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
