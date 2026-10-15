// "For hosts" demo: a Tamil voice note becomes a bilingual listing (simulated steps).
import { $, $$, prefersReducedMotion } from './dom.js';

const BARS = [6, 12, 18, 9, 22, 14, 7, 16, 20, 11, 5, 15, 21, 13, 8, 18, 10, 6, 14, 19, 9, 12, 7, 16, 11, 5];

export function initHostDemo() {
  const wave = $('#wave');
  if (!wave) return;
  for (const h of BARS) { const bar = document.createElement('i'); bar.style.setProperty('height', `${h}px`); wave.append(bar); }

  const make = $('#make-listing');
  const reset = $('#reset-listing');
  const timers = [];

  make.addEventListener('click', () => {
    make.disabled = true;
    const steps = $$('#steps li');
    const gap = prefersReducedMotion() ? 0 : 650;
    steps.forEach((li, i) => timers.push(setTimeout(() => {
      if (i > 0) steps[i - 1].className = 'is-done';
      li.className = 'is-active';
    }, gap * i)));
    timers.push(setTimeout(() => {
      steps[steps.length - 1].className = 'is-done';
      $('#listing').hidden = false;
      reset.hidden = false;
      $('#host-note').textContent = 'Drafted in under a minute. It goes live after a Roots field visit checks hygiene and hours.';
    }, gap * steps.length));
  });

  reset.addEventListener('click', () => {
    timers.splice(0).forEach(clearTimeout);
    $$('#steps li').forEach((li) => { li.className = ''; });
    $('#listing').hidden = true;
    reset.hidden = true;
    make.disabled = false;
    $('#host-note').textContent = 'The AI steps are simulated in this prototype.';
  });
}
