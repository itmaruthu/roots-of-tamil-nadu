// The Ooru Nanbar page: a request for a "We found your village" report, an earnings calculator for villagers,
// and the sample profiles. Nothing is sent by this page itself: the request opens the visitor's own email.
import { el, $, t } from './modules/dom.js';
import { locality } from './modules/locality.js';

const NANBAR_URL = new URL('../../data/nanbars.json', import.meta.url);
const DIST_URL = new URL('../../data/districts.json', import.meta.url);
const EMAIL = document.querySelector('script[data-email]')?.dataset.email || '';

// Planned pilot rates, still to be confirmed with the team. What the Ooru Nanbar keeps, after the Roots share.
const RATES = { visit: 2200, report: 700, task: 400 };
const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/* ----- The village report request ----- */
const form = $('#nb-form');
locality({ district: $('#nb-district'), taluk: $('#nb-taluk'), village: $('#nb-village') });
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const f = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
  f.taluk = $('#nb-taluk').value.trim(); f.village = $('#nb-village').value.trim();
  const lines = ['Village report request', `Family: ${f.family}`, `Village: ${f.village}${f.taluk ? `, ${f.taluk} taluk` : ''}, ${f.district} district`,
    `Elder's name: ${f.elder || '-'}`, `Kuladeivam: ${f.temple || '-'}`, `Also remembered: ${f.more || '-'}`];
  const text = lines.join('\n');
  const mail = `mailto:${EMAIL}?subject=${encodeURIComponent(`Village report: ${f.family}, ${f.village}`)}&body=${encodeURIComponent(text)}`;
  const copy = el('button', { class: 'btn btn--ghost btn--sm', type: 'button', on: { click: async (ev) => {
    try { await navigator.clipboard.writeText(text); ev.currentTarget.textContent = t('Copied', 'நகலெடுக்கப்பட்டது'); } catch { ev.currentTarget.textContent = t('Copy not available', 'நகலெடுக்க முடியவில்லை'); }
  } } }, t('Copy my request', 'என் கோரிக்கையை நகலெடு'));
  const box = $('#nb-sent');
  box.replaceChildren(
    el('p', { class: 'nb-sent-h' }, t(`Your request for ${f.village} is ready.`, `${f.village} ஊருக்கான உங்கள் கோரிக்கை தயார்.`)),
    el('p', { class: 'note' }, t(`One last step: send it to ${EMAIL}. A Roots coordinator replies once we have found the village details, or within 10 days.`,
      `கடைசி படி: இதை ${EMAIL} முகவரிக்கு அனுப்புங்கள். ஊர் விவரங்களைக் கண்டறிந்தவுடன், அல்லது 10 நாட்களுக்குள், Roots ஒருங்கிணைப்பாளர் பதிலளிப்பார்.`)),
    el('pre', { class: 'nb-sent-text' }, text),
    el('div', { class: 'chips' }, el('a', { class: 'btn btn--sm', href: mail }, t('Send by email', 'மின்னஞ்சலில் அனுப்பு')), copy));
  box.hidden = false;
  box.scrollIntoView({ block: 'nearest' });
});

/* ----- What an Ooru Nanbar can earn in a year ----- */
const visits = $('#nb-visits'), reports = $('#nb-reports'), tasks = $('#nb-tasks');
function earn() {
  const v = Number(visits.value), r = Number(reports.value), k = Number(tasks.value);
  $('#nb-visits-out').textContent = t(`${v} ${v === 1 ? 'family' : 'families'}`, `${v} குடும்பங்கள்`);
  $('#nb-reports-out').textContent = t(`${r} ${r === 1 ? 'report' : 'reports'}`, `${r} அறிக்கைகள்`);
  $('#nb-tasks-out').textContent = t(`${k} a month`, `மாதம் ${k}`);
  const parts = [v * RATES.visit, r * RATES.report, k * 12 * RATES.task];
  const total = parts.reduce((a, b) => a + b, 0);
  $('#nb-total').textContent = t(`about ${rupees(total)}`, `சுமார் ${rupees(total)}`);
  $('#nb-split').textContent = t(`Welcoming families ${rupees(parts[0])} · village reports ${rupees(parts[1])} · small tasks ${rupees(parts[2])}. About ${rupees(total / 12)} a month.`,
    `குடும்பங்களை வரவேற்றல் ${rupees(parts[0])} · ஊர் அறிக்கைகள் ${rupees(parts[1])} · சிறு பணிகள் ${rupees(parts[2])}. மாதம் சுமார் ${rupees(total / 12)}.`);
}
for (const i of [visits, reports, tasks]) i.addEventListener('input', earn);
earn();

/* ----- Sample profiles ----- */
const CHECKS = [['Identity and address checked', 'அடையாளமும் முகவரியும் சரிபார்க்கப்பட்டது'], ['Met in person by the Roots team', 'Roots குழு நேரில் சந்தித்தது'], ['Vouched for by the village panchayat or temple committee', 'ஊராட்சி அல்லது கோயில் குழு உறுதியளித்தது']];
Promise.all([fetch(NANBAR_URL).then((r) => r.json()), fetch(DIST_URL).then((r) => r.json())]).then(([n, d]) => {
  $('#nb-profiles').replaceChildren(...n.nanbars.map((p) => {
    const dist = d.districts.find((x) => x.id === p.district);
    return el('li', {}, el('article', { class: 'nanbar' },
      el('div', { class: 'nanbar-top' },
        el('span', { class: 'nanbar-face', 'aria-hidden': 'true' }, p.name.charAt(0)),
        el('div', {}, el('h4', {}, p.name, ' ', el('span', { lang: 'ta' }, p.ta)),
          el('p', { class: 'nanbar-where' }, `${p.village}, ${dist ? dist.name : ''}`), el('p', { class: 'nanbar-work' }, p.work)),
        el('span', { class: 'nanbar-tag' }, t('Sample', 'மாதிரி'))),
      el('p', { class: 'nanbar-langs' }, `${t('Speaks', 'பேசும் மொழிகள்:')} ${p.langs.join(', ')}`),
      el('ul', { class: 'nanbar-knows' }, ...p.knows.map((k) => el('li', {}, k))),
      el('ul', { class: 'nanbar-checks' }, ...CHECKS.map(([en, ta]) => el('li', {}, t(en, ta))))));
  }));
}).catch(() => {});
