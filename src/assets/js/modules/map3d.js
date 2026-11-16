// The Explore map in real 3D (WebGL, three.js). Places stand at their real coordinates on a ground plane
// measured in kilometres. Temples are modelled as gopurams; the sun and moon follow the 24-hour clock.
// Markers and names are HTML laid over the canvas, so they stay focusable and readable by screen readers.
// What is real: positions and distances. What is stylised: tower heights, hills, the river's width.
import * as THREE from '../vendor/three.module.min.js';
import { VIEWS, RINGS, VAIGAI, MEENAKSHI } from './geo.js';
import { TYPES } from './catalog.js';
import { skyAt } from './sky.js';
import { el, icon } from './dom.js';
import { LANDMARKS, STAR, BIG } from './map.js';

const KM_LAT = 110.6;
const KM_LNG = 111.32 * Math.cos((MEENAKSHI.lat * Math.PI) / 180);
const RAD = Math.PI / 180;
// World: x east, z south, y up, in km from the Meenakshi temple.
const world = (lat, lng) => [(lng - MEENAKSHI.lng) * KM_LNG, -(lat - MEENAKSHI.lat) * KM_LAT];
const HILLS = /hills|malai|kodaikanal|sathuragiri|thiruparankundram|pazhamudircholai|kallazhagar|kazhugumalai|dindigul-rock|thirumayam-fort/;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A gopuram about `1` wide and `tiers * 0.52` tall: tapering storeys, a barrel roof and kalasams. */
function gopuramParts(tiers) {
  const parts = [];
  const plinth = new THREE.BoxGeometry(1.5, 0.3, 1.1); plinth.translate(0, 0.15, 0);
  parts.push(['plinth', plinth]);
  let y = 0.3;
  for (let i = 0; i < tiers; i++) {
    const h = 0.52 * (1 - i * 0.035);
    const r0 = 0.66 * (1 - 0.13 * i), r1 = 0.66 * (1 - 0.13 * (i + 1));
    const g = new THREE.CylinderGeometry(r1, r0, h, 4, 1); // four sides: a square storey
    g.rotateY(Math.PI / 4); g.scale(1.35, 1, 1); g.translate(0, y + h / 2, 0);
    parts.push([i % 2 ? 'tierB' : 'tierA', g]);
    y += h;
  }
  const rTop = 0.66 * (1 - 0.13 * tiers);
  const roof = new THREE.CylinderGeometry(rTop * 0.62, rTop * 0.62, rTop * 1.9, 10, 1);
  roof.rotateZ(Math.PI / 2); roof.translate(0, y + rTop * 0.2, 0);
  parts.push(['cap', roof]);
  for (const dx of [-0.5, 0, 0.5]) {
    const k = new THREE.ConeGeometry(rTop * 0.14, rTop * 0.5, 6); k.translate(dx * rTop * 1.4, y + rTop * 1.0, 0);
    parts.push(['gold', k]);
  }
  return { parts, height: y + rTop * 1.3 };
}

export function createMap3d(stage, before) {
  const canvas = el('canvas', { class: 'map3d-canvas', tabindex: '0', role: 'img',
    'aria-label': '3D map of Madurai. Drag to turn, pinch or use the buttons to zoom. Arrow keys turn and tilt.' });
  const tags = el('div', { class: 'map3d-tags' });
  const north = el('span', { class: 'map3d-north', 'aria-hidden': 'true' }, 'N');
  const btn = (label, text, fn) => el('button', { type: 'button', class: 'map3d-btn', 'aria-label': label, title: label, on: { click: fn } }, text);
  const turnBtn = (...a) => { const b = btn(...a); b.classList.add('map3d-btn--turn'); return b; };
  const ctrl = el('div', { class: 'map3d-ctrl' },
    btn('Zoom in', '+', () => zoom(0.72)), btn('Zoom out', '−', () => zoom(1.38)),
    turnBtn('Turn left', '↺', () => { goal.th -= 30 * RAD; kick(); }), turnBtn('Turn right', '↻', () => { goal.th += 30 * RAD; kick(); }),
    btn('Tilt the view', '⤢', () => { goal.ph = goal.ph > 40 * RAD ? 18 * RAD : 62 * RAD; kick(); }),
    btn('Reset the view', '⌂', () => frame(viewKey, true)));
  const box = el('div', { class: 'map3d' }, canvas, tags, north, ctrl);
  stage.insertBefore(box, before);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 10, 100);
  const camera = new THREE.PerspectiveCamera(36, 2, 0.01, 2000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7f72, 0.9);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0008;
  scene.add(hemi, sun, sun.target);

  // ----- materials, shared by every marker -----
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, flatShading: true, ...o });
  const mat = {
    ground: M({ roughness: 1 }), road: M({}), river: M({ roughness: 0.35, metalness: 0.1, flatShading: false }), hill: M({ roughness: 1 }),
    wall: M({}), tank: M({ roughness: 0.3, flatShading: false }), stemOpen: M({}), stemShut: M({}), me: M({ color: 0x2f80ed, emissive: 0x2f80ed, emissiveIntensity: 0.5 }),
    ring: M({ emissiveIntensity: 0.6 }),
    open: { plinth: M({}), tierA: M({}), tierB: M({}), cap: M({}), gold: M({ metalness: 0.6, roughness: 0.35 }) },
    shut: { plinth: M({}), tierA: M({}), tierB: M({}), cap: M({}), gold: M({}) }
  };
  const grid = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.09 }));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 48), mat.ground);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground, grid);

  // River: a ribbon along the Vaigai's approximate course.
  const river = new THREE.Mesh(new THREE.BufferGeometry(), mat.river);
  river.receiveShadow = true; scene.add(river);
  function buildRiver(width) {
    const pts = VAIGAI.map(([la, ln]) => world(la, ln));
    const pos = [], idx = [];
    pts.forEach(([x, z], i) => {
      const [ax, az] = pts[Math.max(0, i - 1)], [bx, bz] = pts[Math.min(pts.length - 1, i + 1)];
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
      const nx = (-dz / L) * width / 2, nz = (dx / L) * width / 2;
      pos.push(x + nx, 0, z + nz, x - nx, 0, z - nz);
      if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
    });
    river.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    river.geometry = g;
  }

  // The old city: the four street squares as roads, and the temple with its four great towers.
  const city = new THREE.Group(); scene.add(city);
  for (const ring of RINGS) {
    const w = 0.016, h = ring.km;
    for (const [sx, sz, lx, lz] of [[0, -h, 2 * h + w, w], [0, h, 2 * h + w, w], [-h, 0, w, 2 * h + w], [h, 0, w, 2 * h + w]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(lx, 0.002, lz), mat.road); m.position.set(sx, 0.001, sz); m.receiveShadow = true; city.add(m);
    }
  }
  const big = gopuramParts(6), small = gopuramParts(3);
  const complex = new THREE.Group(); scene.add(complex);
  {
    const half = 0.12; // the temple walls are about 240 m square
    for (const [sx, sz, lx, lz] of [[0, -half, 2 * half, 0.006], [0, half, 2 * half, 0.006], [-half, 0, 0.006, 2 * half], [half, 0, 0.006, 2 * half]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(lx, 0.014, lz), mat.wall); m.position.set(sx, 0.007, sz); m.castShadow = true; complex.add(m);
    }
    for (const [sx, sz, turn] of [[0, -half, 0], [0, half, 0], [-half, 0, 1], [half, 0, 1]]) {
      const g = new THREE.Group();
      for (const [role, geo] of big.parts) { const m = new THREE.Mesh(geo, mat.open[role]); m.userData.role = role; m.castShadow = true; g.add(m); }
      g.scale.setScalar(0.05); g.position.set(sx, 0, sz); g.rotation.y = turn * Math.PI / 2; complex.add(g);
    }
    for (const [sx, sz] of [[-0.02, 0.01], [0.03, 0.01]]) { // the two golden vimanas over the shrines
      const v = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 8), mat.open.gold); v.position.set(sx, 0.015, sz); v.castShadow = true; complex.add(v);
    }
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.002, 0.036), mat.tank); tank.position.set(-0.045, 0.002, 0.055); complex.add(tank); // Golden Lotus tank
  }

  const hills = new THREE.Group(), markers = new THREE.Group();
  scene.add(hills, markers);
  const hillGeo = new THREE.ConeGeometry(1, 0.55, 9, 1); hillGeo.translate(0, 0.275, 0);
  const stemGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6); stemGeo.translate(0, 0.5, 0);
  const footGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12);
  const selRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 40), mat.ring); selRing.rotation.x = Math.PI / 2; scene.add(selRing);
  const meDot = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), mat.me); meDot.visible = false; scene.add(meDot);

  // ----- camera: turn (th), tilt from overhead (ph), distance (r) around a target on the ground -----
  let viewKey = null, half = 15, unit = 1;
  const cam = { th: -0.35, ph: 0.4, r: 60, x: 0, z: 0 }, goal = { ...cam };
  let raf = 0, last = 0, w = 1, h = 1;
  const clamp = () => {
    goal.ph = Math.min(80 * RAD, Math.max(8 * RAD, goal.ph));
    goal.r = Math.min(half * 6, Math.max(half * 0.35, goal.r));
  };
  function frame(key, animate) {
    const v = VIEWS[key], [cx, cz] = world((v.center || MEENAKSHI).lat, (v.center || MEENAKSHI).lng);
    Object.assign(goal, { th: -0.35, ph: 63 * RAD, r: v.halfKm * (key === 'old' ? 0.62 : 1) * (w < 520 ? 4.2 : 2.9), x: cx, z: cz });
    if (!animate || reduced()) Object.assign(cam, goal);
    kick();
  }
  function zoom(k) { goal.r *= k; kick(); }
  function kick() { clamp(); if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }
  function tick(t) {
    raf = 0;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t;
    const k = reduced() ? 1 : 1 - Math.exp(-dt * 7);
    let moving = false;
    for (const key of ['th', 'ph', 'r', 'x', 'z']) {
      const d = goal[key] - cam[key];
      if (Math.abs(d) > (key === 'r' || key === 'x' || key === 'z' ? half * 0.0005 : 0.0005)) { cam[key] += d * k; moving = true; } else cam[key] = goal[key];
    }
    draw();
    if (moving) raf = requestAnimationFrame(tick);
  }
  function draw() {
    const s = Math.sin(cam.ph);
    camera.position.set(cam.x + cam.r * s * Math.sin(cam.th), cam.r * Math.cos(cam.ph), cam.z + cam.r * s * Math.cos(cam.th));
    camera.lookAt(cam.x, 0, cam.z);
    camera.near = cam.r * 0.02; camera.far = cam.r * 40; camera.updateProjectionMatrix();
    scene.fog.near = cam.r * 2.2; scene.fog.far = cam.r * 9;
    renderer.render(scene, camera);
    place();
    north.style.setProperty('transform', `rotate(${(cam.th / RAD).toFixed(1)}deg)`);
  }

  // ----- HTML markers and names, placed over the canvas each frame -----
  const items = new Map(); // id → { p, group, chip, tag, top, open, parts[] }
  const v3 = new THREE.Vector3();
  function place() {
    const taken = [];
    const list = [...items.values()].filter((it) => it.group.visible);
    for (const it of list) {
      v3.set(it.group.position.x, it.top * it.group.scale.y, it.group.position.z).project(camera);
      it.sx = (v3.x + 1) / 2 * w; it.sy = (1 - v3.y) / 2 * h; it.depth = v3.z;
      it.on = v3.z < 1 && it.sx > -20 && it.sx < w + 20 && it.sy > -20 && it.sy < h + 20;
    }
    list.sort((a, b) => b.depth - a.depth);
    list.forEach((it, i) => {
      it.chip.hidden = !it.on;
      if (!it.on) { if (it.tag) it.tag.hidden = true; return; }
      it.chip.style.setProperty('transform', `translate(${it.sx.toFixed(1)}px, ${it.sy.toFixed(1)}px) translate(-50%, -50%)`);
      it.chip.style.setProperty('z-index', String(i + 1));
    });
    // Names: the selected place first, then the great temples; a name that would overlap another is left out.
    const named = list.filter((it) => it.tag && it.on).sort((a, b) => (b.sel - a.sel) || (BIG.has(b.p.id) - BIG.has(a.p.id)) || (b.depth < a.depth ? 1 : -1));
    for (const it of named) {
      const tw = it.tag.textContent.length * 7.4 + 8, x = it.sx, y = it.sy - 26;
      const clash = taken.some((q) => Math.abs(q.x - x) < (q.w + tw) / 2 && Math.abs(q.y - y) < 17);
      it.tag.hidden = clash && !it.sel;
      if (it.tag.hidden) continue;
      taken.push({ x, y, w: tw });
      it.tag.style.setProperty('transform', `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`);
    }
  }

  function makeItem(p, onSelect) {
    const group = new THREE.Group();
    const [x, z] = world(p.lat, p.lng);
    group.position.set(x, 0, z);
    const parts = [];
    let top;
    if (p.type === 'temple') {
      const model = BIG.has(p.id) ? big : small, s = BIG.has(p.id) ? 2.1 : 1.3;
      const body = new THREE.Group(); body.scale.setScalar(s);
      for (const [role, geo] of model.parts) { const m = new THREE.Mesh(geo, mat.open[role]); m.userData.role = role; m.castShadow = true; body.add(m); parts.push(m); }
      group.add(body); top = model.height * s * 0.62;
    } else {
      const stem = new THREE.Mesh(stemGeo, mat.stemOpen); stem.castShadow = true; stem.userData.stem = true;
      const foot = new THREE.Mesh(footGeo, mat.stemOpen); foot.position.y = 0.02; foot.userData.stem = true;
      group.add(stem, foot); parts.push(stem, foot); top = 1;
    }
    markers.add(group);
    const kind = TYPES[p.type].group;
    const chip = el('button', { type: 'button', class: `chip3d marker--${kind}${p.type === 'temple' ? ' chip3d--temple' : ''}${STAR.has(p.id) ? ' is-star' : ''}`,
      on: { click: () => onSelect(p.id) } }, p.type === 'temple' ? '' : icon(p.type));
    tags.append(chip);
    return { p, group, chip, tag: null, top, parts, kind };
  }

  // ----- pointer, wheel and keyboard -----
  const touches = new Map();
  let pinch = 0, active = false;
  canvas.addEventListener('pointerdown', (e) => {
    active = true; touches.set(e.pointerId, { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' });
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-grabbing');
    if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  canvas.addEventListener('pointermove', (e) => {
    const t = touches.get(e.pointerId); if (!t) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y; t.x = e.clientX; t.y = e.clientY;
    if (touches.size === 2) {
      const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) goal.r *= pinch / d;
      pinch = d; goal.ph -= dy * 0.003;
    } else {
      goal.th -= dx * 0.006;
      if (!t.touch) goal.ph -= dy * 0.005; // on touch, an up-down swipe scrolls the page instead
    }
    clamp(); cam.th = goal.th; cam.ph = goal.ph; cam.r = goal.r; kick();
  });
  const lift = (e) => { touches.delete(e.pointerId); pinch = 0; if (!touches.size) canvas.classList.remove('is-grabbing'); };
  canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', lift);
  box.addEventListener('pointerleave', () => { active = false; });
  canvas.addEventListener('wheel', (e) => {
    if (!active && !e.ctrlKey) return; // scroll the page until the map has been clicked
    e.preventDefault(); zoom(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: ['th', -0.2], ArrowRight: ['th', 0.2], ArrowUp: ['ph', -0.12], ArrowDown: ['ph', 0.12] }[e.key];
    if (step) { e.preventDefault(); goal[step[0]] += step[1]; kick(); }
    else if (e.key === '+' || e.key === '=') zoom(0.8);
    else if (e.key === '-') zoom(1.25);
  });
  function resize() {
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height) return;
    w = r.width; h = r.height; renderer.setSize(w, h, false); camera.aspect = w / h;
    if (viewKey) kick();
  }
  resize();
  new ResizeObserver(resize).observe(box);

  // ----- colours from the site's theme, light from the clock -----
  const C = new THREE.Color(), C2 = new THREE.Color();
  function theme(hour) {
    const css = getComputedStyle(box), tok = (n) => css.getPropertyValue(n).trim() || '#888';
    const sky = skyAt(hour), night = !sky.day, lift = Math.sin(Math.PI * sky.f);
    const temple = tok('--temple'), surface = tok('--surface-2'), muted = tok('--muted');
    mat.ground.color.set(surface).lerp(C.set('#B9C48A'), 0.35);
    mat.road.color.set(surface).lerp(C.set(tok('--gold')), 0.45);
    mat.river.color.set('#3B82C4').lerp(C.set(surface), 0.25);
    mat.tank.color.set('#2F8F83'); mat.wall.color.set(muted).lerp(C.set(surface), 0.4);
    mat.hill.color.set('#6E8B4E').lerp(C.set(muted), 0.25).lerp(C2.set(surface), 0.15);
    mat.stemOpen.color.set(tok('--ink')); mat.stemShut.color.set(muted).lerp(C.set(surface), 0.5);
    mat.ring.color.set(tok('--accent')); mat.ring.emissive.set(tok('--accent'));
    grid.material.color.set(tok('--ink'));
    mat.open.plinth.color.set(muted).lerp(C.set(surface), 0.3);
    // Painted towers: ochre and lime-wash storeys under a teal roof, as the gopurams are painted.
    mat.open.tierA.color.set('#D99A2B').lerp(C.set(temple), 0.2);
    mat.open.tierB.color.set('#F3E3C3');
    mat.open.cap.color.set('#2E7F86');
    mat.open.gold.color.set('#E2B33C');
    for (const role of ['tierA', 'tierB', 'cap', 'gold']) { // lamps: open temples glow after dark
      mat.open[role].emissive.set('#F2A531'); mat.open[role].emissiveIntensity = night ? 0.4 : 0;
    }
    for (const role of Object.keys(mat.shut)) mat.shut[role].color.set(muted).lerp(C.set(surface), 0.55);
    // Sky, sun and moon
    const bottom = C.setRGB(sky.bottom[0] / 255, sky.bottom[1] / 255, sky.bottom[2] / 255, THREE.SRGBColorSpace);
    scene.background = bottom.clone(); scene.fog.color.copy(bottom);
    const angle = Math.PI * sky.f; // rises in the east, sets in the west
    sun.position.set(cam.x + Math.cos(angle) * half * 3, (0.25 + lift) * half * 2.4, cam.z + half * 1.1);
    sun.target.position.set(cam.x, 0, cam.z);
    sun.color.set(night ? '#9DB4E8' : lift < 0.35 ? '#FFC98A' : '#FFF4E0');
    sun.intensity = night ? 0.6 : 1.0 + lift * 1.6;
    hemi.intensity = night ? 0.34 : 0.55 + lift * 0.45;
    hemi.color.set(night ? '#7F8FC4' : '#ffffff');
    const sc = sun.shadow.camera, e = half * 1.5;
    Object.assign(sc, { left: -e, right: e, top: e, bottom: -e, near: half * 0.1, far: half * 12 }); sc.updateProjectionMatrix();
    box.classList.toggle('is-night', night);
  }

  let first = true;
  return {
    show(on) { box.hidden = !on; },
    /** @param {{ places, view, selected, isOpen, onSelect, me, hour }} o */
    update(o) {
      if (o.view !== viewKey) {
        viewKey = o.view; half = VIEWS[viewKey].halfKm; unit = half * 0.05;
        buildRiver(Math.max(0.22, half * 0.035));
        river.position.y = half * 0.0006; selRing.position.y = half * 0.001;
        // A kilometre grid on the ground gives the eye a scale.
        const step = viewKey === 'old' ? 0.25 : viewKey === 'city' ? 1 : viewKey === 'region' ? 5 : 10, n = Math.ceil((half * 5) / step), pts = [];
        for (let i = -n; i <= n; i++) pts.push(i * step, 0, -n * step, i * step, 0, n * step, -n * step, 0, i * step, n * step, 0, i * step);
        grid.geometry.dispose(); grid.geometry = new THREE.BufferGeometry(); grid.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        grid.position.y = half * 0.0004;
        city.visible = half < 20; complex.visible = viewKey === 'old';
        frame(viewKey, !first);
        if (first && !reduced()) { cam.ph = 12 * RAD; cam.r = goal.r * 1.5; cam.th = goal.th - 0.5; } // open with a slow descent
        first = false;
      }
      theme(o.hour);
      const seen = new Set(o.places.map((p) => p.id));
      hills.clear();
      for (const p of o.places) {
        let it = items.get(p.id);
        if (!it) { it = makeItem(p, o.onSelect); items.set(p.id, it); }
        const open = o.isOpen(p), sel = p.id === o.selected, star = STAR.has(p.id);
        it.sel = sel;
        const s = unit * (it.p.type === 'temple' ? 1 : (open ? 1.25 : 0.85) * (star ? 1.3 : 1));
        it.group.scale.setScalar(s);
        it.group.visible = !(viewKey === 'old' && p.id === 'meenakshi-amman-temple');
        for (const m of it.parts) m.material = m.userData.stem ? (open ? mat.stemOpen : mat.stemShut) : mat[open ? 'open' : 'shut'][m.userData.role];
        it.chip.className = `chip3d marker--${it.kind}${p.type === 'temple' ? ' chip3d--temple' : ''}${star ? ' is-star' : ''}${open ? ' is-open' : ''}${sel ? ' is-selected' : ''}`;
        it.chip.setAttribute('aria-label', `${p.name}, ${open ? 'open' : 'closed'}`);
        it.chip.setAttribute('aria-pressed', String(sel));
        const name = viewKey === 'trips' ? (p.trip ? p.short || p.name : p.id === 'meenakshi-amman-temple' ? 'Madurai' : null) : LANDMARKS[p.id];
        const text = sel ? (name || p.short || p.name) : name;
        if (text) { if (!it.tag) { it.tag = el('span', { class: 'tag3d' }); tags.append(it.tag); } it.tag.textContent = text; it.tag.classList.toggle('is-selected', sel); }
        else if (it.tag) { it.tag.remove(); it.tag = null; }
        if (sel) { selRing.visible = true; selRing.position.x = it.group.position.x; selRing.position.z = it.group.position.z; selRing.scale.setScalar(unit * (p.type === 'temple' ? 2.3 : 0.6)); }
        if (HILLS.test(p.id) && viewKey !== 'old') { // a stylised hill behind places that stand on or under one
          const hm = new THREE.Mesh(hillGeo, mat.hill); hm.castShadow = true; hm.receiveShadow = true;
          hm.position.set(it.group.position.x + unit * 0.6, 0, it.group.position.z - unit * 2.8);
          hm.scale.set(unit * 4.6, unit * (3 + (p.id.length % 3)), unit * 3.4); hm.rotation.y = p.id.length;
          hills.add(hm);
        }
      }
      for (const [id, it] of items) if (!seen.has(id)) { it.group.visible = false; it.chip.hidden = true; if (it.tag) it.tag.hidden = true; }
      if (!seen.has(o.selected)) selRing.visible = false;
      if (viewKey === 'old' && o.selected === 'meenakshi-amman-temple') { selRing.visible = true; selRing.position.x = 0; selRing.position.z = 0; selRing.scale.setScalar(0.2); }
      // Meenakshi's own marker is replaced by the modelled complex in the old-city view, but stays selectable.
      const mk = items.get('meenakshi-amman-temple');
      if (mk && viewKey === 'old' && seen.has(mk.p.id)) { mk.group.visible = true; for (const m of mk.parts) m.visible = false; mk.top = 0.2 / unit; } else if (mk) { for (const m of mk.parts) m.visible = true; mk.top = big.height * 2.1 * 0.62; }
      for (const g of complex.children) g.traverse((m) => { if (m.isMesh && m.userData.role) m.material = mat[mk && o.isOpen(mk.p) ? 'open' : 'shut'][m.userData.role]; });
      meDot.visible = !!o.me;
      if (o.me) { const [x, z] = world(o.me.lat, o.me.lng); meDot.position.set(x, unit * 0.35, z); meDot.scale.setScalar(unit); }
      kick();
    }
  };
}
