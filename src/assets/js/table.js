// The owner's side of a family table request: opened from the link in the WhatsApp request.
// Three big answers; each one opens WhatsApp to the guest with the reply written, so the owner types nothing.
import { el, $ } from './modules/dom.js';
import { formatHour, nowInMadurai } from './modules/hours.js';
import { decode, replyMessage, laterTimes, showPhone, wa } from './modules/table.js';

const DATA_URL = new URL('../../data/places.json', import.meta.url);
const body = $('#tb-body');
window.addEventListener('hashchange', () => location.reload());

fetch(DATA_URL).then((r) => r.json()).then((data) => {
  const req = decode(location.hash.slice(1), data.places);
  if (!req) {
    body.replaceChildren(el('p', { class: 'lw-warn' }, 'This link is incomplete, so the request cannot be read. Please ask the guest to send it again.'));
    return;
  }
  const later = laterTimes(req.p, nowInMadurai().day, req.t, 4);
  const sent = el('p', { class: 'note', 'aria-live': 'polite' });
  const answer = (cls, label, ta, a, at) => el('a', { class: `btn tb-answer ${cls}`, href: wa(req.g, replyMessage(req, a, at)), target: '_blank', rel: 'noopener noreferrer',
    on: { click: () => { sent.textContent = 'Your answer opened in WhatsApp, addressed to the guest. Press send there.'; } } }, label, el('small', { lang: 'ta' }, ta));
  body.replaceChildren(
    el('div', { class: 'panel tb-req' },
      el('p', { class: 'lw-label2' }, `${req.p.name} · request ${req.r}`),
      el('p', { class: 'tb-big' }, `Family of ${req.n}`),
      el('p', { class: 'tb-big' }, `Today at ${formatHour(req.t)}`),
      el('p', { class: 'lw-line' }, 'Guest: ', el('a', { href: `tel:+${req.g}` }, `+${showPhone(req.g)}`))),
    el('div', { class: 'tb-answers' },
      answer('', 'Yes, hold the table', 'சரி, மேசை உண்டு', 'yes'),
      later.length ? el('p', { class: 'lw-ask' }, 'Or offer another time · வேறு நேரம்') : '',
      later.length ? el('div', { class: 'tb-times' }, ...later.map((h) => answer('btn--ghost', formatHour(h), 'இந்த நேரம்', 'alt', h))) : '',
      answer('btn--ghost tb-full', 'Sorry, full', 'இடம் இல்லை', 'full')),
    sent);
}).catch(() => body.replaceChildren(el('p', { class: 'lw-warn' }, 'Could not load the request. Please check the connection and open the link again.')));
