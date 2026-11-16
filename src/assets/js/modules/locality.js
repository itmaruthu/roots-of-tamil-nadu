// District → taluk → town or village, as three type-and-select fields.
// Taluks and villages load per district from data/villages/<district>.json (2011 Census village directory).
import { combo } from './combo.js';

const DIST_URL = new URL('../../../data/districts.json', import.meta.url);
const VILLAGE_URL = (id) => new URL(`../../../data/villages/${id}.json`, import.meta.url);

/**
 * @param {{ district: HTMLInputElement, taluk: HTMLInputElement, village: HTMLInputElement, start?: string }} f
 *   start: a district id to choose at the outset (e.g. 'madurai').
 */
export async function locality({ district, taluk, village, start }) {
  let districts = [], taluks = {}, current = '';
  const talukOf = (name) => Object.keys(taluks).find((t) => t.toLowerCase() === name.trim().toLowerCase());

  async function choose(d) {
    current = d ? d.id : '';
    talukBox.set(''); villageBox.set('');
    taluks = {};
    for (const i of [taluk, village]) { i.disabled = !d; i.placeholder = d ? 'Loading…' : 'Choose a district first'; }
    if (!d) return;
    try { taluks = (await fetch(VILLAGE_URL(d.id)).then((r) => r.json())).taluks; } catch { taluks = {}; }
    if (current !== d.id) return; // another district was chosen meanwhile
    const has = Object.keys(taluks).length;
    taluk.placeholder = has ? `Type or choose a taluk in ${d.name}` : 'Type the taluk';
    village.placeholder = has ? 'Type or choose a town or village' : 'Type the town or village';
  }

  const districtBox = combo(district, { strict: true, strictMessage: 'Choose a district from the list',
    options: () => districts.map((d) => ({ v: d.name, hint: d.ta, id: d.id })),
    onPick: (o) => { const d = o && districts.find((x) => x.id === o.id); if ((d ? d.id : '') !== current) choose(d); } });
  const talukBox = combo(taluk, { empty: 'Not on the list? Newer taluks may be missing: keep what you typed.',
    options: () => Object.keys(taluks).map((t) => ({ v: t, hint: `${taluks[t].length} places` })),
    onPick: () => { villageBox.set(''); } });
  const villageBox = combo(village, {
    options: () => {
      const t = talukOf(taluk.value);
      const list = t ? taluks[t] : Object.entries(taluks).flatMap(([name, l]) => l.map((v) => ({ v, hint: `${name} taluk`, taluk: name })));
      // The district's own town or city comes first: the census lists villages, not cities.
      const town = districts.find((d) => d.id === current)?.name;
      return town && !list.some((o) => (o.v || o) === town) ? [{ v: town, hint: 'town or city' }, ...list] : list;
    },
    onPick: (o) => { if (o?.taluk && !taluk.value.trim()) talukBox.set(o.taluk); } });

  try { districts = (await fetch(DIST_URL).then((r) => r.json())).districts; } catch { districts = []; }
  const first = start && districts.find((d) => d.id === start);
  if (first && !district.value) { districtBox.set(first.name); await choose(first); }
}
