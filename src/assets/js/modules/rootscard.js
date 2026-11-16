// Family roots story card: a 1080 × 1350 image (4:5, right for WhatsApp and Instagram) drawn on a canvas
// in the site's heritage style. Nothing is uploaded: the image is made in the browser and shared or saved from it.

const W = 1080, H = 1350, PAD = 84;
const C = { lime: '#FBFAF7', stone2: '#F2EEE7', granite: '#1B1613', stone: '#5E5650', kavi: '#9C2A1C', zari: '#B58A2E', line: '#E3DDD3', peacock: '#0F5257' };
const F = {
  display: "'Bodoni Moda', 'Didot', Georgia, serif",
  text: "'Hind Madurai', system-ui, sans-serif",
  tamil: "'Noto Serif Tamil', 'Hind Madurai', serif"
};
// Tamil Nadu's extent, for placing district centres on the little map.
const BOX = { n: 13.6, s: 8.0, w: 76.2, e: 80.4 };

const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Wait for the fonts the card uses, so the first drawing is not in a fallback face. */
async function fonts() {
  if (!document.fonts?.load) return;
  await Promise.allSettled([
    document.fonts.load(`500 40px ${F.display}`),
    document.fonts.load(`italic 500 40px ${F.display}`),
    document.fonts.load(`600 40px ${F.display}`),
    document.fonts.load(`400 40px ${F.text}`),
    document.fonts.load(`600 40px ${F.text}`),
    document.fonts.load(`600 40px ${F.tamil}`, 'தமிழ்'),
    document.fonts.load(`400 40px ${F.text}`, 'தமிழ்')
  ]);
}

/** Largest font size (down to min) at which text fits the width. */
function fit(ctx, text, font, size, max, min = 28) {
  let s = size;
  ctx.font = font(s);
  while (s > min && ctx.measureText(text).width > max) { s -= 2; ctx.font = font(s); }
  return s;
}

function stripes(ctx, y, h) {
  for (let x = 0, i = 0; x < W; x += 36, i++) {
    ctx.fillStyle = i % 2 ? '#F4EEE4' : C.kavi;
    ctx.fillRect(x, y, 36, h);
  }
}

function map(ctx, x, y, w, h, districts, home) {
  ctx.fillStyle = C.stone2;
  ctx.fillRect(x, y, w, h);
  const sx = (lng) => x + 28 + ((lng - BOX.w) / (BOX.e - BOX.w)) * (w - 56);
  const sy = (lat) => y + 28 + ((BOX.n - lat) / (BOX.n - BOX.s)) * (h - 56);
  ctx.fillStyle = C.line;
  ctx.strokeStyle = '#CFC6B8';
  for (const d of districts) {
    if (d.id === home.id) continue;
    ctx.beginPath(); ctx.arc(sx(d.lng), sy(d.lat), 7, 0, Math.PI * 2); ctx.fillStyle = '#D8CFC2'; ctx.fill();
  }
  // Pin on the family's district: a drop with a lime-wash centre.
  const px = sx(home.lng), py = sy(home.lat);
  ctx.fillStyle = 'rgba(156,42,28,.16)';
  ctx.beginPath(); ctx.arc(px, py, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.kavi;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.bezierCurveTo(px - 20, py - 24, px - 20, py - 52, px, py - 52);
  ctx.bezierCurveTo(px + 20, py - 52, px + 20, py - 24, px, py);
  ctx.fill();
  ctx.fillStyle = C.lime;
  ctx.beginPath(); ctx.arc(px, py - 36, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.stone;
  ctx.font = `600 20px ${F.text}`;
  ctx.textAlign = 'center';
  ctx.fillText('TAMIL NADU', x + w / 2, y + h - 14);
  ctx.textAlign = 'left';
}

/**
 * Draw the card.
 * @param {HTMLCanvasElement} canvas
 * @param {{family:string, village:string, taluk:string, temple:string, from:string, days:number, d:object, districts:object[], site:string}} o
 */
export async function drawCard(canvas, o) {
  await fonts();
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.lime; ctx.fillRect(0, 0, W, H);
  stripes(ctx, 0, 22);
  stripes(ctx, H - 22, 22);

  // Header: the line and the name.
  ctx.fillStyle = C.kavi;
  ctx.font = `600 24px ${F.text}`;
  ctx.fillText('ROOTS OF TAMIL NADU', PAD, 112);
  ctx.textAlign = 'right';
  ctx.font = `600 30px ${F.tamil}`;
  ctx.fillText('யாதும் ஊரே', W - PAD, 114);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.line; ctx.fillRect(PAD, 140, W - PAD * 2, 2);

  const max = W - PAD * 2;
  let y = 250;
  const who = o.family ? `The ${o.family} family` : 'Our family';
  let s = fit(ctx, who, (n) => `500 ${n}px ${F.display}`, 76, max, 44);
  ctx.fillStyle = C.granite; ctx.fillText(who, PAD, y);
  y += 64;
  ctx.font = `italic 500 40px ${F.display}`; ctx.fillStyle = C.stone;
  ctx.fillText('is coming home to', PAD, y);
  y += 30 + 104;
  const village = o.village ? title(o.village) : o.d.name;
  s = fit(ctx, village, (n) => `600 ${n}px ${F.display}`, 120, max, 56);
  ctx.fillStyle = C.kavi; ctx.fillText(village, PAD, y);
  y += Math.round(s * 0.2) + 56;
  ctx.font = `400 34px ${F.text}`; ctx.fillStyle = C.granite;
  let where = `${o.d.name} district`;
  // Add the taluk when it says something new and the line still fits beside the Tamil name.
  if (o.taluk && o.taluk.toLowerCase() !== o.d.name.toLowerCase() && ctx.measureText(`${title(o.taluk)} taluk, ${where}`).width < max - 260) where = `${title(o.taluk)} taluk, ${where}`;
  ctx.fillText(where, PAD, y);
  const wDistrict = ctx.measureText(where).width;
  ctx.font = `600 32px ${F.tamil}`; ctx.fillStyle = C.stone;
  ctx.fillText(`  ·  ${o.d.ta}`, PAD + wDistrict, y);

  // Lower half: map on the left, kuladeivam and journey on the right.
  const top = 640, mapW = 400, mapH = 470;
  map(ctx, PAD, top, mapW, mapH, o.districts, o.d);
  const rx = PAD + mapW + 48, rw = W - PAD - rx;
  let ry = top + 30;
  const label = (en, ta) => {
    ctx.font = `600 22px ${F.text}`; ctx.fillStyle = C.zari;
    ctx.fillText(en.toUpperCase(), rx, ry);
    const w = ctx.measureText(en.toUpperCase()).width;
    ctx.font = `600 22px ${F.tamil}`; ctx.fillText(`  ${ta}`, rx + w, ry);
    ry += 54;
  };
  const value = (text, size = 44) => {
    const n = fit(ctx, text, (k) => `500 ${k}px ${F.display}`, size, rw, 26);
    ctx.fillStyle = C.granite; ctx.fillText(text, rx, ry);
    ry += Math.max(n, 30) + 46;
  };
  label('Kuladeivam', 'குலதெய்வம்');
  value(o.temple ? title(o.temple) : 'Our family temple');
  label('Coming from', 'எங்கிருந்து');
  value(o.from ? title(o.from) : 'Far away');
  label('Homecoming', 'வருகை');
  value(`${o.days} ${o.days === 1 ? 'day' : 'days'} with our Ooru Nanbar`, 36);

  // Footer.
  ctx.fillStyle = C.line; ctx.fillRect(PAD, H - 160, W - PAD * 2, 2);
  ctx.font = `italic 500 34px ${F.display}`; ctx.fillStyle = C.granite;
  ctx.fillText('Bringing the Tamil world home', PAD, H - 102);
  ctx.font = `400 24px ${F.text}`; ctx.fillStyle = C.stone;
  const site = o.site.replace(/^https?:\/\//, '').replace(/\/$/, '');
  fit(ctx, `Find your roots: ${site}`, (n) => `400 ${n}px ${F.text}`, 24, max, 16);
  ctx.fillText(`Find your roots: ${site}`, PAD, H - 62);
  return canvas;
}

/** Share the card as an image where the browser can; otherwise save it. */
export async function shareCard(canvas, name, text) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('Could not make the image');
  const file = new File([blob], `${name}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  saveBlob(blob, `${name}.png`);
  return 'saved';
}

export async function saveCard(canvas, name) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  if (blob) saveBlob(blob, `${name}.png`);
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
