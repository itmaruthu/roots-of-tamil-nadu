#!/usr/bin/env node
// Validates src/data/places.json. Used by the build and in CI: `npm run validate`.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { TYPES } from '../src/assets/js/modules/catalog.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIRED = ['id', 'name', 'type', 'lat', 'lng', 'area', 'address', 'h', 'hours', 'story'];
// Madurai and day trips within ~100 km — catches swapped or mistyped coordinates.
const BOUNDS = { lat: [9.0, 10.9], lng: [77.2, 79.1] };

export function validate(data) {
  const errors = [];
  const ids = new Set();
  if (!Array.isArray(data.places) || !data.places.length) return ['places must be a non-empty array'];
  for (const [i, p] of data.places.entries()) {
    const at = `places[${i}] ${p.id || ''}`;
    for (const k of REQUIRED) if (p[k] === undefined || p[k] === '') errors.push(`${at}: missing "${k}"`);
    if (p.id && !SLUG.test(p.id)) errors.push(`${at}: id must be a lowercase slug`);
    if (ids.has(p.id)) errors.push(`${at}: duplicate id`);
    ids.add(p.id);
    if (!TYPES[p.type]) errors.push(`${at}: unknown type "${p.type}"`);
    if (p.diet && !['veg', 'nonveg'].includes(p.diet)) errors.push(`${at}: diet must be veg or nonveg`);
    if (!(p.lat >= BOUNDS.lat[0] && p.lat <= BOUNDS.lat[1] && p.lng >= BOUNDS.lng[0] && p.lng <= BOUNDS.lng[1])) errors.push(`${at}: coordinates outside the Madurai region`);
    const checkRanges = (ranges, label) => {
      if (!Array.isArray(ranges)) { errors.push(`${at}: ${label} must be an array`); return; }
      for (const r of ranges) {
        if (!Array.isArray(r) || r.length !== 2 || !(r[0] >= 0 && r[0] < 24 && r[1] > r[0] && r[1] <= 30)) errors.push(`${at}: bad range ${JSON.stringify(r)} in ${label}`);
      }
    };
    checkRanges(p.h, 'h');
    for (const [d, ranges] of Object.entries(p.days || {})) {
      if (!/^[0-6]$/.test(d)) errors.push(`${at}: days key "${d}" must be 0-6`);
      checkRanges(ranges, `days.${d}`);
    }
    if (p.image && (!p.image.file || !p.image.alt)) errors.push(`${at}: image needs file and alt text`);
    if (typeof p.story === 'string' && p.story.length > 400) errors.push(`${at}: story longer than 400 characters`);
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = JSON.parse(await readFile(new URL('../src/data/places.json', import.meta.url), 'utf8'));
  const errors = validate(data);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`places.json OK: ${data.places.length} places`);
}
