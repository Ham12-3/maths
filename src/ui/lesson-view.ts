/** Builds the lesson screen DOM and returns references the runner drives. */
import { SECTIONS, SECTION_NAMES, type LessonDef, type SectionId } from '../core/lesson-types';
import { motion } from '../core/motion';

export interface LessonViewRefs {
  root: HTMLElement;
  stageWrap: HTMLElement;
  host: HTMLElement;
  labelLayer: HTMLElement;
  keyLayer: HTMLElement;
  burstLayer: HTMLElement;
  panel: HTMLElement;
  panelBody: HTMLElement;
  sectionTitle: HTMLElement;
  stepIndicator: HTMLElement;
  caption: HTMLElement;
  equation: HTMLElement;
  controls: HTMLElement;
  question: HTMLElement;
  recap: HTMLElement;
  timeline: HTMLElement;
  playBtn: HTMLButtonElement;
  replayBtn: HTMLButtonElement;
  scrub: HTMLInputElement;
  backBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  tabs: Map<SectionId, HTMLButtonElement>;
  motionToggle: HTMLButtonElement;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, attrs: Record<string, string> = {}) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

export const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
  replay:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" fill="currentColor"/></svg>',
};

export function buildLessonView(lesson: LessonDef, index: number): LessonViewRefs {
  const root = el('div', 'lesson-screen');

  const top = el('header', 'topbar');
  const back = el('a', 'btn btn-ghost home-link', { href: '#/' });
  back.innerHTML = '<span aria-hidden="true">←</span> All lessons';
  const title = el('h1', 'lesson-title');
  title.innerHTML = `<span class="lesson-num">${index + 1}</span> ${lesson.meta.title}`;
  const nav = el('nav', 'sections', { 'aria-label': 'Lesson sections' });
  const tabs = new Map<SectionId, HTMLButtonElement>();
  SECTIONS.forEach((s, i) => {
    const b = el('button', 'section-tab', { type: 'button' });
    b.innerHTML = `<span class="tab-num" aria-hidden="true">${i + 1}</span><span class="tab-name">${SECTION_NAMES[s]}</span>`;
    b.dataset.section = s;
    tabs.set(s, b);
    nav.appendChild(b);
  });
  const motionToggle = el('button', 'btn btn-ghost motion-toggle', { type: 'button' });
  const syncToggle = () => {
    motionToggle.setAttribute('aria-pressed', String(motion.reduced));
    motionToggle.textContent = motion.reduced ? 'Motion: reduced' : 'Motion: full';
  };
  syncToggle();
  motionToggle.addEventListener('click', () => {
    motion.set(!motion.reduced);
    syncToggle();
  });
  top.append(back, title, nav, motionToggle);

  const main = el('main', 'lesson-main', { id: 'main' });
  const stageWrap = el('section', 'stage-wrap', { 'aria-label': 'Animation area' });
  const host = el('div', 'stage-host');
  const labelLayer = el('div', 'label-layer');
  const keyLayer = el('div', 'key-layer');
  const burstLayer = el('div', 'burst-layer', { 'aria-hidden': 'true' });
  host.append(labelLayer, keyLayer, burstLayer);
  stageWrap.appendChild(host);

  const panel = el('aside', 'panel', { 'aria-label': 'Lesson panel' });
  const panelHead = el('div', 'panel-head');
  const sectionTitle = el('h2', 'section-title');
  const stepIndicator = el('div', 'step-indicator');
  panelHead.append(sectionTitle, stepIndicator);
  const panelBody = el('div', 'panel-body');
  const caption = el('p', 'caption', { 'aria-live': 'polite' });
  const equation = el('div', 'equation', { role: 'math' });
  const controls = el('div', 'controls');
  const question = el('div', 'question');
  const recap = el('div', 'recap');
  panelBody.append(caption, equation, controls, question, recap);

  const timeline = el('div', 'timeline-controls', { role: 'group', 'aria-label': 'Animation controls' });
  const playBtn = el('button', 'icon-btn', { type: 'button', 'aria-label': 'Pause animation' });
  playBtn.innerHTML = ICONS.pause;
  const replayBtn = el('button', 'icon-btn', { type: 'button', 'aria-label': 'Replay animation' });
  replayBtn.innerHTML = ICONS.replay;
  const scrub = el('input', 'scrub', {
    type: 'range',
    min: '0',
    max: '1000',
    step: '1',
    value: '0',
    'aria-label': 'Animation position',
  });
  timeline.append(playBtn, replayBtn, scrub);

  const navRow = el('div', 'nav-row');
  const backBtn = el('button', 'btn btn-ghost', { type: 'button' });
  backBtn.textContent = 'Back';
  const nextBtn = el('button', 'btn btn-primary', { type: 'button' });
  nextBtn.textContent = 'Next';
  navRow.append(backBtn, nextBtn);

  panel.append(panelHead, panelBody, timeline, navRow);
  main.append(stageWrap, panel);
  root.append(top, main);

  return {
    root,
    stageWrap,
    host,
    labelLayer,
    keyLayer,
    burstLayer,
    panel,
    panelBody,
    sectionTitle,
    stepIndicator,
    caption,
    equation,
    controls,
    question,
    recap,
    timeline,
    playBtn,
    replayBtn,
    scrub,
    backBtn,
    nextBtn,
    tabs,
    motionToggle,
  };
}
