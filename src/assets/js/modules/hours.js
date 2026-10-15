// Opening-hours logic. Hours are decimal IST hours; a range may run past 24 (after midnight).

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAYS_SHORT = DAYS.map((d) => d.slice(0, 3));
const IST_OFFSET_H = 5.5;

/** Current { day, hour } in Madurai (IST), whatever the visitor's own time zone. */
export function nowInMadurai(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_H * 3600_000);
  return { day: ist.getUTCDay(), hour: ist.getUTCHours() + ist.getUTCMinutes() / 60 };
}

export function hoursFor(place, day) {
  const override = place.days && place.days[String(day)];
  return override || place.h;
}

export function is24h(ranges) {
  return ranges.length === 1 && ranges[0][0] === 0 && ranges[0][1] === 24;
}

/** Returns the matching range and the comparable hour, or null when closed. */
function activeRange(place, day, hour) {
  for (const r of hoursFor(place, day)) {
    if (hour >= r[0] && hour < r[1]) return { r, x: hour };
  }
  // A range from yesterday that runs past midnight (e.g. 8 am–1 am).
  for (const r of hoursFor(place, (day + 6) % 7)) {
    if (r[1] > 24 && hour + 24 >= r[0] && hour + 24 < r[1]) return { r, x: hour + 24 };
  }
  return null;
}

export const isOpen = (place, day, hour) => !!activeRange(place, day, hour);

export function formatHour(x) {
  x = ((x % 24) + 24) % 24;
  let h = Math.floor(x);
  let m = Math.round((x - h) * 60);
  if (m === 60) { h = (h + 1) % 24; m = 0; }
  if (h === 0 && m === 0) return 'midnight';
  if (h === 12 && m === 0) return 'noon';
  const ap = h < 12 ? 'am' : 'pm';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${ap}`;
}

/** Human status: { state: 'open'|'soon'|'closed', text } */
export function status(place, day, hour) {
  const today = hoursFor(place, day);
  if (is24h(today)) return { state: 'open', text: 'Open 24 hours' };
  const active = activeRange(place, day, hour);
  if (active) {
    const left = active.r[1] - active.x;
    return left <= 1
      ? { state: 'soon', text: `Closes soon · ${formatHour(active.r[1])}` }
      : { state: 'open', text: `Open until ${formatHour(active.r[1])}` };
  }
  if (!today.length) return { state: 'closed', text: `Closed on ${DAYS[day]}s` };
  const next = today.map((r) => r[0]).filter((s) => s > hour).sort((a, b) => a - b)[0];
  if (next !== undefined) {
    return { state: 'closed', text: `${next - hour <= 1 ? 'Opens soon · ' : 'Opens '}${formatHour(next)}` };
  }
  const tomorrow = hoursFor(place, (day + 1) % 7);
  if (!tomorrow.length) return { state: 'closed', text: `Closed for today · shut ${DAYS[(day + 1) % 7]}` };
  return { state: 'closed', text: `Closed for today · opens ${formatHour(tomorrow[0][0])} tomorrow` };
}
