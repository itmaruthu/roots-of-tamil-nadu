// Language: pages that carry Tamil text (they set data-langs on <html>) offer a switch between English and Tamil.
// Elements hold their Tamil wording in data-ta; the English nodes are kept aside so the switch can go back.
const root = document.documentElement;
const offersTamil = (root.dataset.langs || '').includes('ta');
let lang = 'en';
try { lang = offersTamil && localStorage.getItem('roots-lang') === 'ta' ? 'ta' : 'en'; } catch { /* storage unavailable: English */ }
root.dataset.lang = lang;
function applyLang() {
  if (lang !== 'ta') return;
  root.lang = 'ta';
  for (const n of document.querySelectorAll('[data-ta]')) { n.textContent = n.dataset.ta; if (!n.closest('[lang="en"]')) n.lang = 'ta'; }
  for (const n of document.querySelectorAll('[data-ta-ph]')) n.placeholder = n.dataset.taPh;
}
applyLang();
const langBtn = document.querySelector('#lang-btn');
if (langBtn && offersTamil) {
  langBtn.hidden = false;
  langBtn.textContent = lang === 'ta' ? 'English' : 'தமிழ்';
  langBtn.lang = lang === 'ta' ? 'en' : 'ta';
  langBtn.setAttribute('aria-label', lang === 'ta' ? 'Switch to English' : 'தமிழுக்கு மாற்று (switch to Tamil)');
  langBtn.addEventListener('click', () => {
    try { localStorage.setItem('roots-lang', lang === 'ta' ? 'en' : 'ta'); } catch { /* cannot remember the choice */ }
    location.reload(); // every label, list and message is redrawn in the chosen language
  });
}

// Mobile menu: close it after choosing a link, on Escape, or when tapping outside.
const menu = document.querySelector('.nav-menu');
if (menu) {
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.open = false; });
  document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
}

// Pitch guide: a step-by-step bar for live demos. Start it with ?pitch=1 or #pitch; it follows across pages until closed.
let pitching = null;
try { pitching = sessionStorage.getItem('pitch'); } catch { /* storage unavailable */ }
if (new URLSearchParams(location.search).has('pitch') || location.hash === '#pitch' || pitching !== null) import('./modules/pitch.js');
