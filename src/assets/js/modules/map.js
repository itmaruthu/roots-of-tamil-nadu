// Interactive SVG map drawn from real coordinates. No third-party tiles or trackers.
import { svg, spriteUrl } from './dom.js';
import { projector, VIEWS, RINGS, VAIGAI, MEENAKSHI } from './geo.js';
import { TYPES } from './catalog.js';

const SIZE = 600;

/**
 * @param {SVGSVGElement} root
 * @param {{ places, view, selected, isOpen:(p)=>boolean, onSelect:(id)=>void, me?:{lat,lng} }} opts
 */
export function drawMap(root, { places, view, selected, isOpen, onSelect, me }) {
  root.replaceChildren();
  root.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  const project = projector(view, SIZE);
  const inView = ([x, y]) => x > -20 && x < SIZE + 20 && y > -20 && y < SIZE + 20;

  // River
  const river = VAIGAI.map(([la, ln]) => project(la, ln).map((n) => n.toFixed(1)).join(',')).join(' ');
  root.append(svg('polyline', { points: river, class: 'map-river' }));
  const [rx, ry] = project(9.9285, view === 'old' ? 78.1135 : 78.098);
  if (inView([rx, ry])) root.append(svg('text', { x: rx, y: ry - 8, class: 'map-label map-label--river' }, 'Vaigai (approx.)'));

  // Street rings around the temple
  const [cx, cy] = project(MEENAKSHI.lat, MEENAKSHI.lng);
  for (const ring of RINGS) {
    const half = ring.km * project.scale;
    root.append(svg('rect', { x: cx - half, y: cy - half, width: half * 2, height: half * 2, class: 'map-ring' }));
    if (view === 'old') root.append(svg('text', { x: cx - half + 6, y: cy - half + 14, class: 'map-label' }, `${ring.name} streets`));
  }

  // Scale bar
  const barKm = view === 'old' ? 0.5 : view === 'city' ? 2 : 5;
  const barPx = barKm * project.scale;
  root.append(
    svg('line', { x1: 20, y1: SIZE - 24, x2: 20 + barPx, y2: SIZE - 24, class: 'map-scale' }),
    svg('text', { x: 20, y: SIZE - 32, class: 'map-label' }, `${barKm} km`),
    svg('text', { x: SIZE - 20, y: 30, class: 'map-label map-label--north', 'text-anchor': 'end' }, 'N ↑')
  );

  // Markers: closed first so open ones sit on top; selected last.
  const ordered = [...places].sort((a, b) =>
    (a.id === selected) - (b.id === selected) || isOpen(a) - isOpen(b));
  for (const p of ordered) {
    const [x, y] = project(p.lat, p.lng);
    if (!inView([x, y])) continue;
    const open = isOpen(p);
    const isSel = p.id === selected;
    const r = p.type === 'temple' && p.id === 'meenakshi-amman-temple' ? 15 : open ? 11 : 8;
    const g = svg('g', {
      class: `marker marker--${TYPES[p.type].group}${open ? ' is-open' : ''}${isSel ? ' is-selected' : ''}`,
      transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`,
      tabindex: '0', role: 'button',
      'aria-label': `${p.name}, ${open ? 'open' : 'closed'}`,
      on: {
        click: () => onSelect(p.id),
        keydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.id); } }
      }
    },
    svg('title', {}, p.name));
    if (open && p.type !== 'stay') g.append(svg('circle', { r, class: 'marker-pulse' }));
    g.append(svg('circle', { r, class: 'marker-dot' }));
    const s = (r * 1.3) / 24;
    g.append(svg('use', { href: `${spriteUrl()}#${p.type}`, x: -12 * s, y: -12 * s, width: 24 * s, height: 24 * s, class: 'marker-icon' }));
    root.append(g);
  }

  if (me) {
    const [mx, my] = project(me.lat, me.lng);
    if (inView([mx, my])) {
      root.append(svg('circle', { cx: mx, cy: my, r: 9, class: 'map-me' }), svg('text', { x: mx + 12, y: my + 4, class: 'map-label' }, 'You'));
    }
  }
  return VIEWS[view];
}
