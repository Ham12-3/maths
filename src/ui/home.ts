/** Home screen: one card per lesson with saved progress. */
import gsap from 'gsap';
import { C } from '../core/colors';
import { SECTIONS } from '../core/lesson-types';
import { motion } from '../core/motion';
import type { ProgressStore, Status } from '../core/progress';
import { LESSONS } from '../lessons';

const ICON: Record<string, string> = {
  pythagoras: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="40" width="16" height="16" fill="${C.a}" opacity=".35" stroke="${C.a}" stroke-width="2"/><rect x="6" y="20" width="16" height="20" fill="${C.b}" opacity=".35" stroke="${C.b}" stroke-width="2"/><path d="M22 40 L38 40 L22 20 Z" fill="none" stroke="${C.ink}" stroke-width="2.5" stroke-linejoin="round"/><path d="M38 40 L22 20 L44 4 L60 24 Z" fill="${C.c}" opacity=".35" stroke="${C.c}" stroke-width="2"/></svg>`,
  linear: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 56 H60 M10 60 V4" stroke="${C.axis}" stroke-width="2"/><path d="M8 54 L58 10" stroke="${C.curve}" stroke-width="3.5" stroke-linecap="round"/><path d="M20 43.5 H34 V31" fill="none" stroke="${C.slope}" stroke-width="2.5"/><circle cx="10" cy="52" r="4" fill="${C.intercept}"/></svg>`,
  quadratics: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 40 H60" stroke="${C.axis}" stroke-width="2"/><path d="M8 6 Q32 82 56 6" fill="none" stroke="${C.curve}" stroke-width="3.5" stroke-linecap="round"/><circle cx="18" cy="40" r="4" fill="${C.root}"/><circle cx="46" cy="40" r="4" fill="${C.root}"/><circle cx="32" cy="44" r="4" fill="${C.ink}"/></svg>`,
  trig: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="16" cy="32" r="12" fill="none" stroke="${C.axis}" stroke-width="2"/><path d="M16 32 L24.5 23.5" stroke="${C.angle}" stroke-width="2.5"/><path d="M24.5 23.5 V32" stroke="${C.b}" stroke-width="2.5"/><path d="M30 32 C36 14, 42 14, 46 32 S56 50, 62 32" fill="none" stroke="${C.b}" stroke-width="3"/></svg>`,
  vectors: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 52 L30 40" stroke="${C.a}" stroke-width="3.5" stroke-linecap="round"/><path d="M30 40 L44 14" stroke="${C.b}" stroke-width="3.5" stroke-linecap="round"/><path d="M8 52 L44 14" stroke="${C.c}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 0"/><circle cx="44" cy="14" r="4" fill="${C.c}"/></svg>`,
  calculus: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 56 H60" stroke="${C.axis}" stroke-width="2"/><g fill="${C.area}" opacity=".45"><rect x="8" y="34" width="8" height="22"/><rect x="16" y="28" width="8" height="28"/><rect x="24" y="30" width="8" height="26"/><rect x="32" y="36" width="8" height="20"/><rect x="40" y="32" width="8" height="24"/></g><path d="M6 36 C18 18, 28 30, 36 38 S52 26, 60 16" fill="none" stroke="${C.curve}" stroke-width="3"/><path d="M18 18 L46 34" stroke="${C.slope}" stroke-width="2.5"/></svg>`,
};

const STATUS_TEXT: Record<Status, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  done: 'Done',
};

export function mountHome(app: HTMLElement, progress: ProgressStore, rerender: () => void): () => void {
  const root = document.createElement('div');
  root.className = 'home';
  const doneCount = LESSONS.filter((l) => progress.status(l.meta.id) === 'done').length;
  root.innerHTML = `
    <header class="home-hero">
      <p class="eyebrow">Motion Maths</p>
      <h1>See maths move. <span class="grad">Then move it yourself.</span></h1>
      <p class="lede">Six short lessons. Each one starts with a little animation, lets you play, explains the idea step by step, gives you a few puzzles, and ends with a recap.</p>
      <p class="overall" aria-live="polite">${doneCount} of ${LESSONS.length} lessons complete</p>
    </header>
    <main id="main">
      <h2 class="sr-only">Lessons</h2>
      <ol class="cards" role="list"></ol>
    </main>
    <footer class="home-foot">
      <button type="button" class="btn btn-ghost reset">Reset my progress</button>
    </footer>`;
  const list = root.querySelector('.cards') as HTMLOListElement;

  LESSONS.forEach((l, i) => {
    const status = progress.status(l.meta.id);
    const p = progress.get(l.meta.id);
    const steps = SECTIONS.filter((s) => p.visited.includes(s)).length;
    const li = document.createElement('li');
    li.className = `card status-${status}`;
    li.style.setProperty('--accent', (C as Record<string, string>)[l.meta.accent] ?? C.c);
    const action = status === 'not-started' ? 'Start' : status === 'done' ? 'Review' : 'Continue';
    li.innerHTML = `
      <a class="card-link" href="#/lesson/${l.meta.id}" aria-describedby="status-${l.meta.id}">
        <span class="card-icon">${ICON[l.meta.id] ?? ''}</span>
        <span class="card-num" aria-hidden="true">${i + 1}</span>
        <span class="card-title"><span class="sr-only">Lesson ${i + 1}: </span>${l.meta.title}</span>
        <span class="card-blurb">${l.meta.blurb}</span>
        <span class="card-foot">
          <span class="pill pill-${status}" id="status-${l.meta.id}">${STATUS_TEXT[status]}${status === 'in-progress' ? ` · ${steps} of 5 parts` : ''}</span>
          <span class="card-action">${action} <span aria-hidden="true">→</span></span>
        </span>
        <span class="meter" aria-hidden="true"><span style="width:${(steps / 5) * 100}%"></span></span>
      </a>`;
    list.appendChild(li);
  });

  root.querySelector('.reset')?.addEventListener('click', () => {
    if (window.confirm('Reset progress for every lesson? This cannot be undone.')) {
      progress.reset();
      rerender();
    }
  });

  app.replaceChildren(root);
  const cards = list.querySelectorAll('.card');
  const intro = motion.reduced
    ? gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.3 })
    : gsap
        .timeline()
        .fromTo(root.querySelectorAll('.home-hero > *'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.08 })
        .fromTo(cards, { opacity: 0, y: 24, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.6)', stagger: 0.07 }, '-=0.3');

  return () => {
    intro.kill();
    root.remove();
  };
}
