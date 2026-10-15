// Small, XSS-safe DOM helpers. Data is only ever written with textContent / setAttribute,
// never innerHTML, so place names and stories cannot inject markup.

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an HTML element: el('a', { href: '/x', class: 'btn' }, 'Text', childNode) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  setAttrs(node, attrs);
  append(node, children);
  return node;
}

/** Create an SVG element. */
export function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  setAttrs(node, attrs);
  append(node, children);
  return node;
}

/** <svg><use href="sprite#id"></svg> icon from the shared sprite. */
export function icon(id, cls = 'i') {
  return svg('svg', { class: cls, 'aria-hidden': 'true', focusable: 'false' },
    svg('use', { href: `${spriteUrl()}#${id}` }));
}

let sprite;
export function spriteUrl() {
  if (!sprite) sprite = document.documentElement.dataset.sprite || new URL('../../img/icons.svg', import.meta.url).href;
  return sprite;
}

function setAttrs(node, attrs) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'on') { for (const [evt, fn] of Object.entries(value)) node.addEventListener(evt, fn); continue; }
    if (key === 'style') { for (const [prop, v] of Object.entries(value)) node.style.setProperty(prop, v); continue; }
    if (key === 'dataset') { Object.assign(node.dataset, value); continue; }
    node.setAttribute(key, value === true ? '' : String(value));
  }
}

function append(node, children) {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: keep in memory */ }
  }
};

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
