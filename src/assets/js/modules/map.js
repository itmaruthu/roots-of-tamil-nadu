// Interactive SVG map drawn from real coordinates. No third-party tiles or trackers.
// Two modes: a flat plan, and a tilted 3D view where temples rise as gopurams and other places stand as pins.
import { svg, spriteUrl } from './dom.js';
import { projector, VIEWS, RINGS, VAIGAI, MEENAKSHI } from './geo.js';
import { TYPES } from './catalog.js';

const H = 600;

// Short names shown on the map for the landmarks visitors plan around.
export const LANDMARKS = {
  'meenakshi-amman-temple': 'Meenakshi',
  'thiruparankundram-murugan-temple': 'Thiruparankundram',
  'kallazhagar-temple-alagar-kovil': 'Alagar Kovil',
  'pazhamudircholai-murugan-temple': 'Pazhamudircholai',
  'pandi-muneeswarar-temple': 'Pandi Kovil',
  'keeladi-museum': 'Keeladi',
  'samanar-hills': 'Samanar Hills',
  'yoga-narasimha-temple-yanaimalai': 'Yanaimalai',
  'vandiyur-mariamman-teppakulam': 'Teppakulam',
  'alanganallur-jallikattu-vadivasal': 'Alanganallur jallikattu',
  'avaniyapuram-jallikattu': 'Avaniyapuram jallikattu',
  'palamedu-jallikattu-vadivasal': 'Palamedu jallikattu',
  'jallikattu-arena-alanganallur': 'Jallikattu Arena',
  'pathu-thoon-ten-pillars': 'Ten Pillars'
};
const STAR = new Set(['keeladi-museum', 'alanganallur-jallikattu-vadivasal', 'avaniyapuram-jallikattu', 'palamedu-jallikattu-vadivasal', 'jallikattu-arena-alanganallur', 'pathu-thoon-ten-pillars']);
const BIG = new Set(['meenakshi-amman-temple', 'thiruparankundram-murugan-temple', 'kallazhagar-temple-alagar-kovil', 'pazhamudircholai-murugan-temple', 'pandi-muneeswarar-temple']);

/**
 * @param {SVGSVGElement} root
 * @param {{ places, view, selected, isOpen:(p)=>boolean, onSelect:(id)=>void, me?:{lat,lng}, tilt?:boolean }} opts
 */
export function drawMap(root, { places, view, selected, isOpen, onSelect, me, tilt = false }) {
  root.replaceChildren();
  const box = root.getBoundingClientRect();
  const ratio = box.width && box.height ? box.width / box.height : 1;
  const W = Math.round(H * Math.min(Math.max(ratio, 1), 2.4));
  root.setAttribute('viewBox', `0 0 ${W} ${H}`);
  root.classList.toggle('is-3d', tilt);

  const flat = projector(view, H, undefined, W);
  // Perspective: far (top) edge shrinks toward the centre and is pushed down to leave a horizon.
  const HORIZON = tilt ? H * 0.12 : 0;
  const T = (x, y) => {
    if (!tilt) return [x, y, 1];
    const t = y / H;
    const s = Math.max(0.4, 0.62 + 0.38 * t);
    return [W / 2 + (x - W / 2) * s, HORIZON + (H - HORIZON) * t * (0.62 + 0.38 * t), s];
  };
  const P = (lat, lng) => { const [x, y] = flat(lat, lng); return T(x, y); };
  const inView = ([x, y]) => x > -30 && x < W + 30 && y > -30 && y < H + 30;
  const pts = (arr) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  // Ground plane and a light km grid to give depth
  if (tilt) {
    root.append(svg('rect', { x: 0, y: 0, width: W, height: H, class: 'map-sky' }));
    root.append(svg('polygon', { points: pts([T(-W, 0), T(2 * W, 0), T(2 * W, H), T(-W, H)]), class: 'map-ground' }));
    const step = view === 'old' ? 0.25 : view === 'city' ? 1 : 2;
    const kmW = (W / flat.scale) / 2 + step, kmH = (H / flat.scale) / 2 + step;
    for (let k = -Math.ceil(kmW / step); k <= Math.ceil(kmW / step); k++) {
      const x = W / 2 + k * step * flat.scale;
      root.append(svg('line', { ...line(T(x, 0), T(x, H)), class: 'map-grid' }));
    }
    for (let k = -Math.ceil(kmH / step); k <= Math.ceil(kmH / step); k++) {
      const y = H / 2 + k * step * flat.scale;
      if (y < 0 || y > H) continue;
      root.append(svg('line', { ...line(T(-W, y), T(2 * W, y)), class: 'map-grid' }));
    }
  }

  // River
  root.append(svg('polyline', { points: pts(VAIGAI.map(([la, ln]) => P(la, ln))), class: 'map-river' }));
  const rl = P(9.9285, view === 'old' ? 78.1135 : 78.098);
  if (inView(rl)) root.append(svg('text', { x: rl[0], y: rl[1] - 8, class: 'map-label map-label--river' }, 'Vaigai (approx.)'));

  // Street squares around the temple
  const [cx, cy] = flat(MEENAKSHI.lat, MEENAKSHI.lng);
  for (const ring of RINGS) {
    const h = ring.km * flat.scale;
    const c = [T(cx - h, cy - h), T(cx + h, cy - h), T(cx + h, cy + h), T(cx - h, cy + h)];
    root.append(svg('polygon', { points: pts(c), class: `map-ring${tilt ? ' map-ring--3d' : ''}` }));
    if (view === 'old') root.append(svg('text', { x: c[0][0] + 6, y: c[0][1] + 14, class: 'map-label' }, `${ring.name} streets`));
  }

  // Scale and north
  if (!tilt) {
    const barKm = view === 'old' ? 0.5 : view === 'city' ? 2 : 5;
    root.append(
      svg('line', { x1: 20, y1: H - 24, x2: 20 + barKm * flat.scale, y2: H - 24, class: 'map-scale' }),
      svg('text', { x: 20, y: H - 32, class: 'map-label' }, `${barKm} km`)
    );
  }
  root.append(svg('text', { x: W - 20, y: 30, class: 'map-label map-label--north', 'text-anchor': 'end' }, 'N ↑'));

  // Markers, drawn back to front in 3D; closed first and selected last in 2D.
  const items = places.filter((p) => inView(flat(p.lat, p.lng))).map((p) => ({ p, pos: P(p.lat, p.lng) }));
  items.sort((a, b) => tilt
    ? a.pos[1] - b.pos[1] || (a.p.id === selected) - (b.p.id === selected)
    : (a.p.id === selected) - (b.p.id === selected) || isOpen(a.p) - isOpen(b.p));

  const labels = [];
  for (const { p, pos: [x, y, s] } of items) {
    const open = isOpen(p);
    const isSel = p.id === selected;
    const group = TYPES[p.type].group;
    const g = svg('g', {
      class: `marker marker--${group}${open ? ' is-open' : ''}${isSel ? ' is-selected' : ''}${STAR.has(p.id) ? ' is-star' : ''}`,
      transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`,
      tabindex: '0', role: 'button',
      'aria-label': `${p.name}, ${open ? 'open' : 'closed'}`,
      on: {
        click: () => onSelect(p.id),
        keydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.id); } }
      }
    }, svg('title', {}, p.name));

    let top = 0;
    if (tilt) {
      const k = s * ({ old: 1.25, city: 1.4, region: 1.55, trips: 1.5 }[view] || 1);
      g.append(svg('ellipse', { rx: 9 * k, ry: 3.2 * k, class: 'pin-shadow' }));
      if (p.type === 'temple') {
        // A gopuram: stacked tapering tiers with a kalasam on top.
        const h = (BIG.has(p.id) ? 54 : 30) * k, w = (BIG.has(p.id) ? 26 : 16) * k;
        const tiers = BIG.has(p.id) ? 5 : 3;
        for (let i = 0; i < tiers; i++) {
          const y0 = -(h * i) / tiers, y1 = -(h * (i + 1)) / tiers;
          const w0 = w * (1 - 0.13 * i), w1 = w * (1 - 0.13 * (i + 1));
          g.append(svg('polygon', { points: pts([[-w0 / 2, y0], [w0 / 2, y0], [w1 / 2, y1], [-w1 / 2, y1]]), class: `gopuram gopuram--${i % 2}` }));
        }
        g.append(svg('rect', { x: -w * 0.36, y: -h - 4 * k, width: w * 0.72, height: 5 * k, rx: 2 * k, class: 'gopuram gopuram--cap' }));
        g.append(svg('circle', { cy: -h - 6 * k, r: 2.6 * k, class: 'kalasam' }));
        top = -h - 10 * k;
      } else {
        const boost = STAR.has(p.id) ? 1.45 : 1;
        const h = (open ? 30 : 22) * k * boost, r = (open ? 10 : 7.5) * k * boost;
        g.append(svg('line', { x1: 0, y1: 0, x2: 0, y2: -h, class: 'pin-stem' }));
        if (open && p.type !== 'stay') g.append(svg('circle', { cy: -h, r, class: 'marker-pulse' }));
        g.append(svg('circle', { cy: -h, r, class: 'marker-dot' }));
        const sz = (r * 1.3) / 24;
        g.append(svg('use', { href: `${spriteUrl()}#${p.type}`, x: -12 * sz, y: -h - 12 * sz, width: 24 * sz, height: 24 * sz, class: 'marker-icon' }));
        top = -h - r;
      }
    } else {
      const r = p.id === 'meenakshi-amman-temple' ? 15 : BIG.has(p.id) || STAR.has(p.id) ? 13 : open ? 11 : 8;
      if (open && p.type !== 'stay') g.append(svg('circle', { r, class: 'marker-pulse' }));
      g.append(svg('circle', { r, class: 'marker-dot' }));
      const sz = (r * 1.3) / 24;
      g.append(svg('use', { href: `${spriteUrl()}#${p.type}`, x: -12 * sz, y: -12 * sz, width: 24 * sz, height: 24 * sz, class: 'marker-icon' }));
      top = -r;
    }
    root.append(g);
    const name = view === 'trips' ? (p.trip ? p.short || p.name : p.id === 'meenakshi-amman-temple' ? 'Madurai' : null) : LANDMARKS[p.id];
    if (name && (view !== 'old' || BIG.has(p.id) || p.id === 'pathu-thoon-ten-pillars') || isSel) labels.push({ x, y: y + top - 6, text: name || p.name, sel: isSel });
  }

  // Labels on top of everything, with a halo for legibility.
  // Nudge overlapping labels apart (simple greedy pass, nearest-first).
  const placed = [];
  for (const l of labels.sort((a, b) => b.y - a.y)) {
    const w = l.text.length * 7.2;
    let guard = 0;
    while (guard++ < 8 && placed.some((q) => Math.abs(q.x - l.x) < (q.w + w) / 2 && Math.abs(q.y - l.y) < 15)) l.y -= 15;
    placed.push({ x: l.x, y: l.y, w });
  }
  for (const l of labels) {
    root.append(svg('text', { x: l.x, y: l.y, class: `map-tag${l.sel ? ' is-selected' : ''}`, 'text-anchor': 'middle' }, l.text));
  }

  if (me) {
    const m = P(me.lat, me.lng);
    if (inView(m)) root.append(svg('circle', { cx: m[0], cy: m[1], r: 9, class: 'map-me' }), svg('text', { x: m[0] + 12, y: m[1] + 4, class: 'map-label' }, 'You'));
  }
  return VIEWS[view];
}

function line([x1, y1], [x2, y2]) { return { x1, y1, x2, y2 }; }
