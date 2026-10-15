// The sky above the clock: colour by hour, sun or moon on an arc, stars at night.

const STOPS = [
  [0, '#0B0920', '#231C47'], [4.5, '#14113A', '#3B2D63'], [5.75, '#3B2D63', '#D9774E'],
  [6.75, '#F0A35E', '#FBD9A0'], [8.5, '#7FBCE6', '#D6ECF8'], [16, '#78B5E0', '#E9E4CF'],
  [17.75, '#E2774B', '#F6C36A'], [18.75, '#4A2E6B', '#C0597A'], [20, '#16123A', '#33285C'], [24, '#0B0920', '#231C47']
];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, k) => rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * k));
const css = (c) => `rgb(${c.join(',')})`;
const luminance = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;

export function initSky(stars) {
  // Deterministic pseudo-random star field.
  for (let s = 0; s < 46; s++) {
    const r1 = Math.abs(Math.sin(s * 12.9898) * 43758.5453) % 1;
    const r2 = Math.abs(Math.sin(s * 78.233) * 43758.5453) % 1;
    const star = document.createElement('i');
    star.style.setProperty('left', `${(r1 * 100).toFixed(2)}%`);
    star.style.setProperty('top', `${(r2 * 55).toFixed(2)}%`);
    star.style.setProperty('opacity', String(0.35 + (s % 5) / 8));
    stars.append(star);
  }
}

/** Paints the sky for an hour. Returns true when the sky is light (use dark text). */
export function paintSky(sky, orb, stars, hour) {
  let i = 0;
  while (i < STOPS.length - 2 && hour >= STOPS[i + 1][0]) i++;
  const [h0, t0, b0] = STOPS[i];
  const [h1, t1, b1] = STOPS[i + 1];
  const k = (hour - h0) / (h1 - h0);
  const top = mix(t0, t1, k);
  const bottom = mix(b0, b1, k);
  sky.style.setProperty('background', `linear-gradient(180deg, ${css(top)}, ${css(bottom)})`);

  const day = hour >= 6 && hour <= 18.5;
  const f = day ? (hour - 6) / 12.5 : ((hour < 6 ? hour + 24 : hour) - 18.5) / 11.5;
  orb.style.setProperty('left', `${8 + f * 84}%`);
  orb.style.setProperty('top', `${74 - Math.sin(Math.PI * f) * 50}%`);
  orb.style.setProperty('background', day ? '#FFD36B' : '#F4EEDC');
  orb.style.setProperty('box-shadow', day
    ? '0 0 34px 12px rgba(255,200,90,0.55)'
    : 'inset -9px -3px 0 0 rgba(30,25,60,0.35), 0 0 20px 4px rgba(240,235,220,0.25)');
  stars.style.setProperty('opacity', day ? '0' : hour >= 19.5 || hour < 5 ? '1' : '0.4');
  return luminance(bottom) > 0.62;
}
