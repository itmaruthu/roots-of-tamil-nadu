// Family table requests that travel by WhatsApp, with no server in between.
// The request rides to the owner inside a link; the owner's one-tap answer rides back to the guest
// inside another link, plus a short code the guest can paste if the link cannot be opened.
import { formatHour, isOpen } from './hours.js';

// One demo number stands in for every owner until the pilot; then each eatery carries "wa" in places.json.
export const DEMO_OWNER = '916380465605';
export const ownerPhone = (p) => p.wa || DEMO_OWNER;
export const showPhone = (n) => String(n).replace(/^91(\d{5})(\d{5})$/, '$1 $2');
export const HOLD_MIN = 10;

/** An Indian mobile as 91XXXXXXXXXX, or an international number as digits; null when it does not look like one. */
export function cleanPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(d)) return `91${d}`;
  if (/^0[6-9]\d{9}$/.test(d)) return `91${d.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(d)) return d;
  if (/^[1-9]\d{10,14}$/.test(d) && !d.startsWith('91')) return d;
  return null;
}
export const newRef = () => `R-${Math.floor(100 + Math.random() * 900)}`;
const hhmm = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

/** Where links in the messages point: this site when it is public, otherwise its published address. */
export function siteRoot() {
  const local = new URL('../../../', import.meta.url);
  let top = false;
  try { top = window.self === window.top; } catch { /* inside a frame from another site */ }
  const isPublic = /^https?:$/.test(local.protocol) && !/^(localhost|127\.|10\.|192\.168\.|\[)/.test(local.hostname);
  if (top && isPublic) return local.href;
  const site = document.documentElement.dataset.site;
  return site ? site.replace(/\/?$/, '/') : local.href;
}

// A request is { s: eatery id, n: people, t: hour, g: guest phone, r: reference }; an answer adds a (yes, alt or full) and at.
export function encode(o) {
  return new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])).toString();
}
export function decode(str, places) {
  const q = new URLSearchParams(String(str || '').replace(/^#?(table=)?/, ''));
  const p = places.find((x) => x.id === q.get('s'));
  const n = Number(q.get('n')), t = Number(q.get('t')), r = q.get('r') || '', g = cleanPhone(q.get('g'));
  const a = q.get('a'), at = Number(q.get('at'));
  if (!p || !(n >= 1 && n <= 50) || !(t >= 0 && t < 24.5) || !/^R-\d{3}$/.test(r) || !g) return null;
  if (a && !['yes', 'alt', 'full'].includes(a)) return null;
  if (a === 'alt' && !(at >= 0 && at < 24.5)) return null;
  return { p, n, t, r, g, a: a || null, at: a === 'alt' ? at : a === 'yes' ? t : null };
}
const plain = (req) => ({ s: req.p.id, n: req.n, t: req.t, g: req.g, r: req.r });

export const answerLink = (req) => `${siteRoot()}table.html#${encode(plain(req))}`;
export const statusLink = (req, a, at) => `${siteRoot()}index.html#table=${encode({ ...plain(req), a, at: a === 'alt' ? at : undefined })}`;

export function requestMessage(req) {
  return [`Roots of Tamil Nadu · table request ${req.r}`,
    `${req.p.name}: family of ${req.n}, today at ${formatHour(req.t)}`,
    `Guest: +${showPhone(req.g)}`,
    `Answer with one tap: ${answerLink(req)}`].join('\n');
}

export function replyMessage(req, a, at) {
  const first = {
    yes: `${req.p.name}: YES, your table for ${req.n} is held today at ${formatHour(req.t)}. Show ${req.r} at the counter; we hold it for ${HOLD_MIN} minutes.`,
    alt: `${req.p.name}: no table at ${formatHour(req.t)}, but we can seat your family of ${req.n} at ${formatHour(at)}. Show ${req.r} at the counter; we hold it for ${HOLD_MIN} minutes. Reply here if that time does not suit you.`,
    full: `${req.p.name}: sorry, we are full at ${formatHour(req.t)}. Please try another time, or a place nearby.`
  }[a];
  const time = a === 'alt' ? at : req.t;
  return [first, `See it in Roots: ${statusLink(req, a, at)}`, `Code: ROOTS ${req.r} ${a.toUpperCase()} ${hhmm(time)}`].join('\n');
}

/** Read an answer from pasted text: the status link, or the "ROOTS R-123 YES 14:30" code. */
export function readReply(text, places) {
  const link = String(text).match(/#table=(\S+)/);
  if (link) { const req = decode(link[1], places); if (req && req.a) return { r: req.r, a: req.a, at: req.at, req }; }
  const m = String(text).match(/ROOTS\s+(R-\d{3})\s+(YES|ALT|FULL)(?:\s+(\d{1,2}):(\d{2}))?/i);
  if (!m) return plainReply(text);
  return { r: m[1].toUpperCase(), a: m[2].toLowerCase(), at: m[3] ? Number(m[3]) + Number(m[4]) / 60 : null, req: null };
}

// An owner who simply typed an answer: "Yes", "Full", "Sorry, no", "2:30 pm", "சரி", "இடம் இல்லை". Applies to the request waiting on this phone.
function plainReply(text) {
  const t = String(text).trim();
  if (!t || t.length > 300) return null;
  // The last time named is the one offered: "no table at 1:30, come at 3 pm".
  const tm = [...t.matchAll(/(?:^|\s)(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?(?=\s|$|[.,!])/gi)].filter((m) => m[2] || m[3]).pop();
  let at = null;
  if (tm) {
    let h = Number(tm[1]) % 12 + (/pm/i.test(tm[3] || "") ? 12 : 0);
    if (!tm[3] && h < 7) h += 12; // "2:30" at an eatery means the afternoon
    at = h + Number(tm[2] || 0) / 60;
  }
  const no = /\b(no|full|sorry|cannot|can't)\b/i.test(t) || t.includes("இல்லை");
  const yes = /\b(yes|ok|okay|confirmed|sure)\b/i.test(t) || t.includes("சரி") || t.includes("ஆம்");
  if (at !== null && !(no && !yes && !/\b(at|come|instead)\b/i.test(t))) return { r: null, a: "alt", at, req: null };
  if (no) return { r: null, a: "full", at: null, req: null };
  if (yes) return { r: null, a: "yes", at: null, req: null };
  return null;
}

/** Half-hour times after `from` when the eatery is open: what an owner can offer instead. */
export function laterTimes(p, day, from, count = 4) {
  const out = [];
  for (let h = Math.round(from * 2) / 2 + 0.5; h < 24 && out.length < count; h += 0.5) if (isOpen(p, day, h) && isOpen(p, day, h + 0.25)) out.push(h);
  return out;
}

export const wa = (phone, text) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
