// "List your place" form. On Netlify the POST is captured by Netlify Forms (free tier, no server).
// Elsewhere (or in the preview) it falls back to showing the details so they can be copied or sent on WhatsApp.
import { el, $, t } from './modules/dom.js';
import { locality } from './modules/locality.js';

const form = $('#join-form');
const status = $('#join-status');
const script = document.querySelector('script[data-whatsapp]');
const waNumber = (script?.dataset.whatsapp || '').replace(/\D/g, '');

const LABELS_TA = { type: 'வகை', place: 'இடம்', owner: 'பெயர்', phone: 'கைபேசி', district: 'மாவட்டம்', taluk: 'வட்டம்', town: 'ஊர்', area: 'பகுதி', hours: 'நேரம்', diet: 'உணவு', story: 'சிறப்பு', tokens: 'டோக்கன் வசதி', voice: 'தமிழில் அழைப்பு' };
const LABELS = { type: 'Type', place: 'Place', owner: 'Name', phone: 'Mobile', district: 'District', taluk: 'Taluk', town: 'Town or village', area: 'Area', hours: 'Hours', diet: 'Food', story: 'Special', tokens: 'Live wait tokens', voice: 'Call in Tamil' };

// District, taluk and town: type or pick. The pilot is in Madurai, so that is chosen to begin with.
if (form) locality({ district: $('#j-district'), taluk: $('#j-taluk'), village: $('#j-town'), start: 'madurai' });

function waLink(text) { return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`; }

if (waNumber) {
  const wa = $('#join-wa');
  wa.href = waLink('Vanakkam! I want to list my place on Roots. (Send a voice note with your shop name, area, timings and what you serve.)');
  wa.hidden = false;
  $('#join-wa-note').hidden = true;
}

if (new URLSearchParams(location.search).get('type') === 'ooru-nanbar') {
  const r = document.querySelector('input[name="type"][value^="Ooru Nanbar"]');
  if (r) r.checked = true;
}

function details(data) {
  return Object.entries(LABELS)
    .map(([k, label]) => [t(label, LABELS_TA[k] || label), (data.get(k) || '').toString().trim()])
    .filter(([, v]) => v);
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  if (data.get('company_website')) return; // spam honeypot
  const phone = String(data.get('phone')).replace(/[^\d+]/g, '');
  data.set('phone', phone);

  status.textContent = t('Sending…', 'அனுப்புகிறது…');
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
    note.textContent = t('We have your details. A Roots team member will call you within two working days.', 'உங்கள் விவரங்கள் கிடைத்தன. Roots குழுவினர் இரண்டு வேலை நாட்களுக்குள் உங்களை அழைப்பார்கள்.');
  } else if (waNumber) {
    note.replaceChildren('This preview cannot send forms. ', el('a', { href: waLink(text), target: '_blank', rel: 'noopener noreferrer' }, 'Send these details on WhatsApp'), ' instead.');
  } else if (script?.dataset.email) {
    const mail = `mailto:${script.dataset.email}?subject=${encodeURIComponent('Roots listing request')}&body=${encodeURIComponent(text)}`;
    note.replaceChildren('One last step: ', el('a', { href: mail }, `email these details to ${script.dataset.email}`), ' and a Roots team member will call you within two working days.');
  } else {
    note.textContent = t('Demo mode: this preview does not send forms. On the live site your details go straight to the Roots team.', 'மாதிரி முறை: இந்த முன்னோட்டம் படிவங்களை அனுப்பாது. உண்மையான தளத்தில் உங்கள் விவரங்கள் நேரடியாக Roots குழுவுக்குச் செல்லும்.');
  }
  $('#join-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(text); $('#join-copy').textContent = t('Copied', 'நகலெடுக்கப்பட்டது'); } catch { $('#join-copy').textContent = t('Copy not available', 'நகலெடுக்க முடியவில்லை'); }
  };
  status.textContent = '';
  form.hidden = true;
  const done = $('#join-done');
  done.hidden = false;
  done.scrollIntoView({ block: 'start' });
});
