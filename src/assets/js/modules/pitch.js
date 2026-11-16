// Pitch guide: a step-by-step bar for presenting Roots live. Start it with ?pitch=1 on any page.
// It walks one family's homecoming, then the live city, in the order of the five-minute demo.
import { el } from './dom.js';

const ROOT = new URL('../../../', import.meta.url);
const FAMILY = 'roots.html?district=sivaganga&village=Kanadukathan&temple=Ayyanar&family=Raman&from=Singapore&days=5';
const STEPS = [
  { t: 'The one line', url: 'index.html',
    say: 'We scale the state\'s 200-seat Reaching Your Roots scheme to every Tamil family abroad, with Madurai\'s live 24-hour city as the first stop.' },
  { t: 'Plan a homecoming', url: FAMILY, hash: 'roots-plan',
    say: 'The Raman family in Singapore, from Kanadukathan in Sivaganga. Every day shows See, Eat, Shop, Stay and the government service to book.' },
  { t: 'The share moment and the price', url: FAMILY, hash: 'roots-extras',
    say: 'The roots card goes to the family WhatsApp group. The price is in Singapore dollars, and the split shows what reaches local people, the government and Roots.' },
  { t: 'The Ooru Nanbar', url: FAMILY, hash: 'your-nanbar',
    say: 'A verified friend in the village: the heart of the idea, and income for a villager from every visit.' },
  { t: 'The 24-hour city', url: 'index.html', hash: 'clock',
    say: 'Tap 4 am, then 1 am: halwa at dawn, parotta at night. The live layer serves every traveller.' },
  { t: 'A temple page', url: 'places/meenakshi-amman-temple.html',
    say: 'The "Why visit" story, the bus from Mattuthavani, "Near me" distances, health and safety.' },
  { t: 'The ask', url: 'index.html', hash: 'homecoming',
    say: 'Partner with the NRT Welfare Board to scale Reaching Your Roots, and pilot in Madurai with TN Tourism.' }
];

const save = (i) => { try { sessionStorage.setItem('pitch', String(i)); } catch { /* private mode: the bar still works on this page */ } };
const clear = () => { try { sessionStorage.removeItem('pitch'); } catch { /* nothing stored */ } };
const read = () => { try { return sessionStorage.getItem('pitch'); } catch { return null; } };
const page = (u) => u.pathname.replace(/index\.html$/, '');
const query = (u) => { const q = new URLSearchParams(u.search); q.delete('pitch'); q.sort(); return q.toString(); };

const asked = new URLSearchParams(location.search).get('pitch');
let at = asked !== null ? Math.max(0, (Number(asked) || 1) - 1) : Number(read()) || 0;
at = Math.min(at, STEPS.length - 1);
save(at);

const bar = el('div', { class: 'pitch', role: 'region', 'aria-label': 'Pitch guide' });
document.body.append(bar);
document.body.classList.add('has-pitch');

function seek(hash) {
  if (!hash) { scrollTo({ top: 0 }); return; }
  let tries = 0;
  const t = setInterval(() => {
    const node = document.getElementById(hash);
    if (node && !node.hidden) { clearInterval(t); setTimeout(() => node.scrollIntoView({ block: 'start' }), 500); }
    if (++tries > 20) clearInterval(t);
  }, 250);
}

function go(i) {
  if (i < 0 || i >= STEPS.length) return;
  at = i; save(i);
  const target = new URL(STEPS[i].url, ROOT);
  if (page(target) === page(location) && query(target) === query(location)) { draw(); seek(STEPS[i].hash); return; }
  location.href = target.href;
}

function quit() {
  clear();
  bar.remove();
  document.body.classList.remove('has-pitch');
}

function draw() {
  const s = STEPS[at];
  bar.replaceChildren(
    el('p', { class: 'pitch-n' }, `${at + 1} / ${STEPS.length}`),
    el('div', { class: 'pitch-say' }, el('b', {}, s.t), el('span', {}, s.say)),
    el('div', { class: 'pitch-nav' },
      el('button', { type: 'button', class: 'pitch-btn', disabled: at === 0, on: { click: () => go(at - 1) } }, 'Back'),
      el('button', { type: 'button', class: 'pitch-btn pitch-btn--next', disabled: at === STEPS.length - 1, on: { click: () => go(at + 1) } }, 'Next'),
      el('button', { type: 'button', class: 'pitch-btn pitch-btn--x', 'aria-label': 'Close the pitch guide', on: { click: quit } }, '×')));
}

document.addEventListener('keydown', (e) => {
  if (!bar.isConnected || e.target.closest('input, select, textarea, [contenteditable]')) return;
  if (e.key === 'ArrowRight') go(at + 1);
  if (e.key === 'ArrowLeft') go(at - 1);
});

draw();
seek(STEPS[at].hash);
