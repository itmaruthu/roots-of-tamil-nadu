// Type-and-select field: a text input with a list under it. Type to filter, or open the list and pick.
// Follows the ARIA combobox pattern: arrow keys move, Enter picks, Escape closes.
import { el, t } from './dom.js';

const MAX = 60;
let seq = 0;
const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9஀-௿]+/g, '');

/**
 * @param {HTMLInputElement} input
 * @param {{ options: () => Array<string|{v:string, hint?:string, id?:string}>, onPick?: (o: object|null) => void,
 *           strict?: boolean, strictMessage?: string, empty?: string }} cfg
 *   strict: the value must be one of the options (e.g. a district). Otherwise typed text is kept as it is.
 */
export function combo(input, cfg) {
  const id = `combo-${++seq}`;
  const list = el('ul', { class: 'combo-list', id, role: 'listbox', hidden: true });
  const wrap = input.closest('.combo');
  wrap.append(list);
  for (const [k, v] of Object.entries({ role: 'combobox', 'aria-expanded': 'false', 'aria-controls': id, 'aria-autocomplete': 'list', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false' })) input.setAttribute(k, v);

  let shown = [], active = -1, typed = false;
  const all = () => cfg.options().map((o) => (typeof o === 'string' ? { v: o } : o));

  function matches() {
    const opts = all();
    const q = typed ? norm(input.value) : '';
    if (!q) return opts;
    const starts = [], has = [];
    for (const o of opts) {
      const n = norm(o.v), h = o.hint ? norm(o.hint) : '';
      if (n.startsWith(q)) starts.push(o); else if (n.includes(q) || h.includes(q)) has.push(o);
    }
    return [...starts, ...has];
  }

  function draw() {
    const found = matches();
    shown = found.slice(0, MAX);
    active = -1;
    const rows = shown.map((o, i) => el('li', { class: 'combo-opt', role: 'option', id: `${id}-${i}`, 'aria-selected': 'false', dataset: { i: String(i) } },
      el('span', {}, o.v), o.hint ? el('small', {}, o.hint) : ''));
    if (!found.length) rows.push(el('li', { class: 'combo-note', role: 'presentation' }, cfg.strict ? t('No match. Check the spelling.', 'பொருத்தம் இல்லை. எழுத்தைச் சரிபாருங்கள்.') : t(cfg.empty || 'Not on the list? Keep what you typed.', 'பட்டியலில் இல்லையா? நீங்கள் எழுதியதையே வைத்துக்கொள்ளலாம்.')));
    else if (found.length > MAX) rows.push(el('li', { class: 'combo-note', role: 'presentation' }, t(`${found.length - MAX} more. Keep typing to narrow the list.`, `இன்னும் ${found.length - MAX} உள்ளன. தொடர்ந்து எழுதுங்கள்.`)));
    list.replaceChildren(...rows);
    list.scrollTop = 0;
  }

  function open() {
    draw();
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }
  function move(to) {
    if (!shown.length) return;
    list.children[active]?.setAttribute('aria-selected', 'false');
    active = (to + shown.length) % shown.length;
    const row = list.children[active];
    row.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', row.id);
    row.scrollIntoView({ block: 'nearest' });
  }
  function pick(o) {
    input.value = o.v;
    typed = false;
    input.setCustomValidity('');
    close();
    cfg.onPick?.(o);
  }
  /** Settle the field when the visitor leaves it: match what was typed to an option where possible. */
  function settle() {
    const text = input.value.trim();
    const exact = text ? all().find((o) => norm(o.v) === norm(text)) : null;
    if (exact) { if (typed || input.value !== exact.v) pick(exact); return; }
    if (cfg.strict) {
      const found = text ? matches() : [];
      if (found.length === 1) { pick(found[0]); return; }
      input.setCustomValidity(text ? t(cfg.strictMessage || 'Choose one from the list', 'பட்டியலிலிருந்து ஒன்றைத் தேர்வு செய்யுங்கள்') : '');
      cfg.onPick?.(null);
    } else if (typed) {
      input.value = text;
      cfg.onPick?.(text ? { v: text, free: true } : null);
    }
    typed = false;
  }

  input.addEventListener('focus', () => { typed = false; open(); });
  input.addEventListener('click', () => { if (list.hidden) open(); });
  input.addEventListener('input', () => { typed = true; input.setCustomValidity(''); open(); });
  input.addEventListener('blur', () => { close(); settle(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) open(); move(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (list.hidden) open(); move(active < 0 ? shown.length - 1 : active - 1); }
    else if (e.key === 'Enter' && !list.hidden) {
      if (active >= 0) { e.preventDefault(); pick(shown[active]); }
      else if (typed && shown.length && (cfg.strict || shown.length === 1)) { e.preventDefault(); pick(shown[0]); }
      else close();
    } else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); close(); }
  });
  // Keep focus in the input while the list is tapped or scrolled, so the tap is not lost to a blur.
  list.addEventListener('pointerdown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.combo-opt');
    if (row) pick(shown[Number(row.dataset.i)]);
  });

  return {
    /** Set the value from code (a link or another field), without opening the list. */
    set(value) { input.value = value || ''; typed = false; input.setCustomValidity(''); },
    refresh() { if (!list.hidden) draw(); }
  };
}
