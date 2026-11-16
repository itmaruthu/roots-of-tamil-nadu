// Mobile menu: close it after choosing a link, on Escape, or when tapping outside.
const menu = document.querySelector('.nav-menu');
if (menu) {
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.open = false; });
  document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
}

// Pitch guide: a step-by-step bar for live demos. Start it with ?pitch=1; it follows across pages until closed.
let pitching = null;
try { pitching = sessionStorage.getItem('pitch'); } catch { /* storage unavailable */ }
if (new URLSearchParams(location.search).has('pitch') || pitching !== null) import('./modules/pitch.js');
