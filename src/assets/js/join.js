// "List your place" form. On Netlify the POST is captured by Netlify Forms (free tier, no server).
// Elsewhere (or in the preview) it falls back to showing the details so they can be copied or sent on WhatsApp.
import { el, $ } from './modules/dom.js';

const form = $('#join-form');
const status = $('#join-status');
const script = document.querySelector('script[data-whatsapp]');
const waNumber = (script?.dataset.whatsapp || '').replace(/\D/g, '');

const LABELS = { type: 'Type', place: 'Place', owner: 'Name', phone: 'Mobile', area: 'Area', hours: 'Hours', diet: 'Food', story: 'Special', tokens: 'Live wait tokens', voice: 'Call in Tamil' };

function waLink(text) { return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`; }

if (waNumber) {
  const wa = $('#join-wa');
  wa.href = waLink('Vanakkam! I want to list my place on Roots. (Send a voice note with your shop name, area, timings and what you serve.)');
  wa.hidden = false;
  $('#join-wa-note').hidden = true;
}

function details(data) {
  return Object.entries(LABELS)
    .map(([k, label]) => [label, (data.get(k) || '').toString().trim()])
    .filter(([, v]) => v);
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  if (data.get('company_website')) return; // spam honeypot
  const phone = String(data.get('phone')).replace(/[^\d+]/g, '');
  data.set('phone', phone);

  status.textContent = 'Sending…';
  let sent = false;
  try {
    const res = await fetch(form.getAttribute('action') || '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data).toString()
    });
    // Netlify answers 200 for a captured form; static hosts usually answer 404/405.
    // Only trust the response where a forms backend is configured (Netlify Forms), never in previews.
    sent = res.ok && script?.dataset.forms === 'netlify' && !/claude/.test(location.hostname);
  } catch { sent = false; }

  const rows = details(data);
  $('#join-summary').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]));
  const text = `Roots listing request\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}`;
  const note = $('#join-done-note');
  if (sent) {
    note.textContent = 'We have your details. A Roots team member will call you within two working days.';
  } else if (waNumber) {
    note.replaceChildren('This preview cannot send forms. ', el('a', { href: waLink(text), target: '_blank', rel: 'noopener noreferrer' }, 'Send these details on WhatsApp'), ' instead.');
  } else {
    note.textContent = 'Demo mode: this preview does not send forms. On the live site your details go straight to the Roots team.';
  }
  $('#join-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(text); $('#join-copy').textContent = 'Copied'; } catch { $('#join-copy').textContent = 'Copy not available'; }
  };
  status.textContent = '';
  form.hidden = true;
  const done = $('#join-done');
  done.hidden = false;
  done.scrollIntoView({ block: 'start' });
});
