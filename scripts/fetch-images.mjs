#!/usr/bin/env node
// Downloads the Wikimedia Commons photos listed in places.json, saves them under
// src/assets/img/places/, and records author + licence in src/data/credits.json.
// After running, places use the self-hosted copy (faster, no third-party requests)
// and the footer shows full attribution. Run on a machine with internet access:
//   npm run images
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('..', import.meta.url);
const DATA = new URL('src/data/places.json', ROOT);
const CREDITS = new URL('src/data/credits.json', ROOT);
const OUT = new URL('src/assets/img/places/', ROOT);
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'RootsOfTamilNadu/1.0 (site build script)';
const WIDTH = 1600;

const strip = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const data = JSON.parse(await readFile(DATA, 'utf8'));
const credits = JSON.parse(await readFile(CREDITS, 'utf8').catch(() => '{}'));
const files = [...new Set(['Meenakshi Amman Temple - Gateway Tower, Madurai.jpg', ...data.places.filter((p) => p.image).map((p) => p.image.file)])];
await mkdir(OUT, { recursive: true });

for (const file of files) {
  const params = new URLSearchParams({ action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(WIDTH), format: 'json', origin: '*' });
  const meta = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } }).then((r) => r.json());
  const page = Object.values(meta.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) { console.warn(`✗ ${file}: not found on Commons`); continue; }
  const m = info.extmetadata || {};
  const license = strip(m.LicenseShortName?.value) || 'see file page';
  if (!/^(CC|Public domain|PD|GFDL)/i.test(license)) { console.warn(`✗ ${file}: licence "${license}" not recognised, skipped`); continue; }
  const slug = file.replace(/\.[a-z]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ext = (info.thumburl.match(/\.(jpe?g|png|webp)$/i) || ['.jpg'])[0].toLowerCase();
  const bytes = Buffer.from(await fetch(info.thumburl, { headers: { 'User-Agent': UA } }).then((r) => r.arrayBuffer()));
  await writeFile(new URL(`${slug}${ext}`, OUT), bytes);
  credits[file] = { artist: strip(m.Artist?.value) || 'Unknown', license, page: info.descriptionurl, local: `assets/img/places/${slug}${ext}` };
  for (const p of data.places) if (p.image?.file === file) p.image.local = credits[file].local;
  console.log(`✓ ${file} — ${credits[file].artist}, ${license}`);
}

await writeFile(CREDITS, JSON.stringify(credits, null, 2) + '\n');
await writeFile(DATA, JSON.stringify(data, null, 2) + '\n');
console.log('Done. Run `npm run build` to use the self-hosted images.');
if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = 0;
