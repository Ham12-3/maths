/**
 * The lesson engine. Takes a LessonDef and runs it through Hook → Explore → Explain →
 * Practise → Recap on a single Stage, wiring captions, KaTeX equations, the timeline
 * scrubber, Next/Back navigation, practice feedback and saved progress.
 */
import gsap from 'gsap';
import { C } from './colors';
import { SECTIONS, SECTION_NAMES, type LessonDef, type QuestionRuntime, type SectionId, type StepDef } from './lesson-types';
import { DUR, EASE, motion } from './motion';
import type { ProgressStore } from './progress';
import type { SceneManager } from './scene-manager';
import { Stage } from './stage';
import { renderTex, richHtml, setRich } from './tex';
import { ICONS, type LessonViewRefs } from '../ui/lesson-view';

export interface RunnerOptions {
  /** Called with a new hash route (e.g. next lesson or home). */
  navigate(route: string): void;
  next?: LessonDef;
  onSectionChange?(section: SectionId, step: number): void;
}

export class LessonRunner {
  private stage: Stage;
  private section: SectionId = 'hook';
  private step = 0;
  private q = 0;
  private tl: gsap.core.Timeline | null = null;
  private scrubbing = false;
  private solvedNow = false;
  private offMotion: () => void;
  private disposed = false;
  /** Panel/celebration tweens owned by the runner (killed on every section change). */
  private chrome = new Set<gsap.core.Animation>();

  constructor(
    private lesson: LessonDef,
    private sm: SceneManager,
    private v: LessonViewRefs,
    private progress: ProgressStore,
    private opts: RunnerOptions,
  ) {
    this.stage = new Stage(sm, v.host, v.labelLayer, v.keyLayer, v.controls);
    gsap.ticker.add(this.sync);
    this.offMotion = motion.onChange((reduced) => {
      if (reduced && this.tl && this.tl.progress() < 1) this.tl.progress(1);
    });

    v.playBtn.addEventListener('click', this.togglePlay);
    v.replayBtn.addEventListener('click', this.replay);
    v.scrub.addEventListener('input', this.onScrub);
    v.scrub.addEventListener('pointerdown', () => (this.scrubbing = true));
    v.scrub.addEventListener('pointerup', () => (this.scrubbing = false));
    v.scrub.addEventListener('change', () => (this.scrubbing = false));
    v.backBtn.addEventListener('click', () => this.back());
    v.nextBtn.addEventListener('click', () => this.next());
    for (const [s, b] of v.tabs) b.addEventListener('click', () => this.goto(s, 0));
  }

  get current(): { section: SectionId; step: number } {
    return { section: this.section, step: this.section === 'practise' ? this.q : this.step };
  }

  goto(section: SectionId, index = 0): void {
    if (this.disposed) return;
    this.killTimeline();
    this.killChrome();
    gsap.set([this.v.host, this.v.panelBody], { opacity: 1 });
    this.stage.clear();
    this.v.question.replaceChildren();
    this.v.recap.replaceChildren();
    this.v.stepIndicator.replaceChildren();
    this.v.equation.replaceChildren();
    this.v.equation.hidden = true;
    this.section = section;
    this.step = 0;
    this.q = 0;

    const def = this.lesson[section === 'practise' ? 'practice' : section];
    const sectionView = Array.isArray(def) ? def[index]?.view : def.view;
    this.stage.view(sectionView ?? this.lesson.view);

    for (const [s, b] of this.v.tabs) {
      if (s === section) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
      b.classList.toggle('visited', this.progress.get(this.lesson.meta.id).visited.includes(s));
    }
    this.v.sectionTitle.textContent = SECTION_NAMES[section];
    this.v.root.dataset.section = section;
    this.progress.visit(this.lesson.meta.id, section, index);

    switch (section) {
      case 'hook':
        this.runHook();
        break;
      case 'explore':
        this.runExplore();
        break;
      case 'explain':
        this.runStep(Math.min(index, this.lesson.explain.steps.length - 1));
        break;
      case 'practise':
        this.runQuestion(Math.min(index, this.lesson.practice.length - 1));
        break;
      case 'recap':
        this.runRecap();
        break;
    }
    this.v.tabs.get(section)?.classList.add('visited');
    this.opts.onSectionChange?.(section, this.current.step);
    this.updateNav();
    this.sectionFade();
  }

  next(): void {
    const { explain, practice } = this.lesson;
    switch (this.section) {
      case 'hook':
        return this.goto('explore');
      case 'explore':
        return this.goto('explain', 0);
      case 'explain':
        return this.step < explain.steps.length - 1 ? this.goto('explain', this.step + 1) : this.goto('practise', 0);
      case 'practise':
        return this.q < practice.length - 1 ? this.goto('practise', this.q + 1) : this.goto('recap');
      case 'recap':
        return this.opts.navigate(this.opts.next ? `#/lesson/${this.opts.next.meta.id}` : '#/');
    }
  }

  back(): void {
    const { explain, practice } = this.lesson;
    switch (this.section) {
      case 'hook':
        return;
      case 'explore':
        return this.goto('hook');
      case 'explain':
        return this.step > 0 ? this.goto('explain', this.step - 1) : this.goto('explore');
      case 'practise':
        return this.q > 0 ? this.goto('practise', this.q - 1) : this.goto('explain', explain.steps.length - 1);
      case 'recap':
        return this.goto('practise', practice.length - 1);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.killTimeline();
    this.killChrome();
    gsap.ticker.remove(this.sync);
    this.offMotion();
    gsap.killTweensOf([this.v.host, this.v.panelBody, this.v.stageWrap]);
    this.stage.dispose();
    this.lesson.dispose();
  }

  // ------------------------------------------------------------------ sections

  private runHook(): void {
    setRich(this.v.caption, this.lesson.hook.caption);
    this.bindTimeline(this.lesson.hook.play(this.stage));
  }

  private runExplore(): void {
    setRich(this.v.caption, this.lesson.explore.caption);
    this.showTimeline(false);
    this.lesson.explore.setup(this.stage);
    if (!motion.reduced) {
      const pulses = this.stage.timeline({ delay: 0.4 });
      this.stage.drag.list.forEach((h, i) => pulses.add(h.attention(), i * 0.15));
    }
  }

  private runStep(k: number): void {
    const { steps, setup } = this.lesson.explain;
    this.step = k;
    const state = setup(this.stage);
    // Fast-forward earlier steps so Next/Back always land on a consistent picture.
    for (let i = 0; i < k; i++) {
      const t = (steps[i] as StepDef<unknown>).play(this.stage, state);
      t.progress(1);
      t.kill();
    }
    const step = steps[k] as StepDef<unknown>;
    setRich(this.v.caption, step.caption);
    const prevEq = lastEq(steps, k - 1);
    const eq = step.eq ?? prevEq;
    const fresh = this.renderEquation(eq, prevEq);
    const tl = step.play(this.stage, state);
    if (fresh.length) {
      tl.fromTo(
        fresh,
        { opacity: 0, y: 10, scale: 0.85 },
        { opacity: 1, y: 0, scale: 1, duration: DUR.base, ease: EASE.appear, stagger: 0.18 },
        step.eqAt ?? (tl.duration() > 0 ? '>-0.1' : 0),
      );
    }
    this.renderDots(steps.length, k, 'Step', (i) => this.goto('explain', i));
    this.bindTimeline(tl);
  }

  private runQuestion(k: number): void {
    this.q = k;
    this.solvedNow = false;
    const def = this.lesson.practice[k];
    if (!def) return;
    const solved = this.progress.get(this.lesson.meta.id).solved;
    this.renderDots(this.lesson.practice.length, k, 'Question', (i) => this.goto('practise', i), solved);
    setRich(this.v.caption, def.prompt);
    this.showTimeline(false);
    const rt: QuestionRuntime = def.setup(this.stage);
    const input = def.input;
    const box = this.v.question;
    const feedback = document.createElement('div');
    feedback.className = 'feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    const answer = (value: number, source?: HTMLElement) => {
      const ok = rt.check ? rt.check(value) : input.kind === 'choice' && value === input.answer;
      if (ok) this.onCorrect(rt, feedback, def.explain, source);
      else this.onWrong(rt, feedback, def.hint, source);
    };

    if (input.kind === 'choice') {
      const group = document.createElement('div');
      group.className = 'options';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Answer options');
      input.options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'option';
        b.innerHTML = `<span class="option-key" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span>${richHtml(opt)}</span>`;
        b.addEventListener('click', () => {
          if (this.solvedNow) return;
          answer(i, b);
        });
        group.appendChild(b);
      });
      box.appendChild(group);
    } else if (input.kind === 'slider') {
      const s = this.stage.ui.slider({
        label: input.label,
        name: input.name,
        min: input.min,
        max: input.max,
        step: input.step,
        value: input.value,
        color: input.color,
        format: input.format,
        onInput: (v) => rt.onInput?.(v),
      });
      rt.onInput?.(input.value);
      const check = this.stage.ui.button('Check my answer', () => !this.solvedNow && answer(s.get(), s.el), 'primary');
      check.classList.add('check-btn');
    } else {
      const check = this.stage.ui.button('Check my answer', () => !this.solvedNow && answer(0, check), 'primary');
      check.classList.add('check-btn');
      if (this.stage.drag.count) this.stage.ui.note('Tip: you can also select a point with Tab and move it with the arrow keys.');
    }
    box.appendChild(feedback);
    if (!motion.reduced) {
      const pulses = this.stage.timeline({ delay: 0.3 });
      this.stage.drag.list.forEach((h, i) => pulses.add(h.attention(), i * 0.15));
    }
  }

  private onCorrect(rt: QuestionRuntime, fb: HTMLElement, explain: string | undefined, source?: HTMLElement): void {
    this.solvedNow = true;
    this.progress.solve(this.lesson.meta.id, this.q);
    fb.className = 'feedback good';
    fb.innerHTML = `<strong>Yes, that's right!</strong> ${explain ? richHtml(explain) : ''}`;
    source?.classList.add('is-correct');
    this.v.question.querySelectorAll<HTMLButtonElement>('.option').forEach((b) => (b.disabled = b !== source));
    this.v.controls.querySelectorAll<HTMLButtonElement | HTMLInputElement>('.check-btn, input').forEach((b) => (b.disabled = true));
    this.stage.drag.list.forEach((h) => h.setEnabled(false));
    const dots = this.v.stepIndicator.querySelectorAll('.dot');
    dots[this.q]?.classList.add('solved');
    this.burst(C.good);
    const extra = rt.success?.();
    if (extra) this.bindTimeline(extra);
    this.updateNav();
    if (!motion.reduced) this.own(gsap.fromTo(fb, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: DUR.quick, ease: EASE.appear }));
  }

  private onWrong(rt: QuestionRuntime, fb: HTMLElement, hint: string, source?: HTMLElement): void {
    fb.className = 'feedback hint';
    fb.innerHTML = `<strong>Not quite.</strong> ${richHtml(hint)}`;
    if (source?.classList.contains('option')) {
      source.classList.add('is-wrong');
      (source as HTMLButtonElement).disabled = true;
    }
    if (!motion.reduced && source) this.own(gsap.fromTo(source, { x: -6 }, { x: 0, duration: 0.45, ease: 'elastic.out(1, 0.3)' }));
    const h = rt.hint?.();
    if (h) this.bindTimeline(h);
  }

  private runRecap(): void {
    const r = this.lesson.recap;
    setRich(this.v.caption, 'Here is everything from this lesson on one screen.');
    this.v.equation.hidden = false;
    const eqEl = document.createElement('span');
    eqEl.className = 'eq-token';
    renderTex(eqEl, `\\displaystyle ${r.eq}`);
    this.v.equation.appendChild(eqEl);
    const ul = document.createElement('ul');
    ul.className = 'recap-list';
    for (const p of r.points) {
      const li = document.createElement('li');
      li.innerHTML = richHtml(p);
      ul.appendChild(li);
    }
    const done = this.progress.checkDone(this.lesson.meta.id, this.lesson.practice.length);
    const status = document.createElement('p');
    status.className = done ? 'recap-status done' : 'recap-status';
    const solved = this.progress.get(this.lesson.meta.id).solved.length;
    status.innerHTML = done
      ? '<strong>Lesson complete!</strong> Great work.'
      : `You have solved ${solved} of ${this.lesson.practice.length} practice questions. Solve them all to complete the lesson.`;
    this.v.recap.append(ul, status);
    if (!done) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-ghost';
      b.textContent = 'Go to practice';
      b.addEventListener('click', () => {
        const unsolved = this.lesson.practice.findIndex((_, i) => !this.progress.get(this.lesson.meta.id).solved.includes(i));
        this.goto('practise', Math.max(0, unsolved));
      });
      this.v.recap.appendChild(b);
    } else this.burst(C.c);
    if (!motion.reduced)
      this.own(gsap.fromTo(ul.children, { opacity: 0, x: 12 }, { opacity: 1, x: 0, stagger: 0.12, duration: DUR.base, ease: EASE.move }));
    this.bindTimeline(r.play(this.stage));
  }

  // ------------------------------------------------------------------ equation

  /** Render equation pieces; returns the elements that are new and should animate in. */
  private renderEquation(eq: string[] | undefined, prev: string[] | undefined): HTMLElement[] {
    const box = this.v.equation;
    box.replaceChildren();
    if (!eq || !eq.length) {
      box.hidden = true;
      return [];
    }
    box.hidden = false;
    let common = 0;
    if (prev) while (common < eq.length && common < prev.length && eq[common] === prev[common]) common++;
    const fresh: HTMLElement[] = [];
    eq.forEach((tok, i) => {
      const span = document.createElement('span');
      span.className = 'eq-token';
      renderTex(span, `\\displaystyle ${tok}`);
      box.appendChild(span);
      if (i >= common) {
        span.style.opacity = '0';
        fresh.push(span);
      }
    });
    return fresh;
  }

  // ------------------------------------------------------------------ timeline controls

  private bindTimeline(tl: gsap.core.Timeline): void {
    if (this.tl && this.tl !== tl) this.tl.kill();
    this.tl = this.stage.track(tl);
    this.showTimeline(true);
    if (motion.reduced) {
      // Reduced motion: skip straight to the end state and simply fade it in.
      tl.progress(1).pause();
      this.own(gsap.fromTo(this.v.host, { opacity: 0.25 }, { opacity: 1, duration: 0.35, ease: 'none', overwrite: 'auto' }));
    } else tl.play(0);
  }

  private own<T extends gsap.core.Animation>(a: T): T {
    this.chrome.add(a);
    void a.then(() => this.chrome.delete(a));
    return a;
  }

  private killChrome(): void {
    for (const a of this.chrome) a.kill();
    this.chrome.clear();
    this.v.burstLayer.replaceChildren();
  }

  private killTimeline(): void {
    this.tl?.kill();
    this.tl = null;
  }

  private showTimeline(on: boolean): void {
    this.v.timeline.hidden = !on;
  }

  private togglePlay = (): void => {
    const tl = this.tl;
    if (!tl) return;
    if (tl.progress() >= 1) tl.restart();
    else tl.paused(!tl.paused());
  };

  private replay = (): void => {
    this.tl?.restart();
    if (this.tl && motion.reduced) this.bindTimeline(this.tl);
  };

  private onScrub = (): void => {
    const tl = this.tl;
    if (!tl) return;
    this.scrubbing = true;
    tl.pause();
    tl.progress(Number(this.v.scrub.value) / 1000);
  };

  /** Keep the scrubber and play button in sync with the timeline (runs on GSAP's ticker). */
  private sync = (): void => {
    const tl = this.tl;
    if (!tl || this.v.timeline.hidden) return;
    if (!this.scrubbing) {
      const v = String(Math.round(tl.progress() * 1000));
      if (this.v.scrub.value !== v) this.v.scrub.value = v;
    }
    this.v.scrub.style.setProperty('--fill', `${tl.progress() * 100}%`);
    const playing = !tl.paused() && tl.progress() < 1;
    const label = playing ? 'Pause animation' : tl.progress() >= 1 ? 'Play animation again' : 'Play animation';
    if (this.v.playBtn.getAttribute('aria-label') !== label) {
      this.v.playBtn.setAttribute('aria-label', label);
      this.v.playBtn.innerHTML = playing ? ICONS.pause : ICONS.play;
    }
  };

  // ------------------------------------------------------------------ chrome

  private renderDots(n: number, current: number, noun: string, go: (i: number) => void, solved: number[] = []): void {
    const wrap = this.v.stepIndicator;
    wrap.replaceChildren();
    const text = document.createElement('span');
    text.className = 'step-text';
    text.textContent = `${noun} ${current + 1} of ${n}`;
    const dots = document.createElement('div');
    dots.className = 'dots';
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot';
      if (i === current) b.setAttribute('aria-current', 'step');
      if (i < current && noun === 'Step') b.classList.add('past');
      if (solved.includes(i)) b.classList.add('solved');
      b.setAttribute('aria-label', `${noun} ${i + 1}${solved.includes(i) ? ' (solved)' : ''}`);
      b.addEventListener('click', () => go(i));
      dots.appendChild(b);
    }
    wrap.append(text, dots);
  }

  private updateNav(): void {
    const { explain, practice } = this.lesson;
    const back = this.v.backBtn;
    const next = this.v.nextBtn;
    back.disabled = this.section === 'hook';
    let label = 'Next';
    switch (this.section) {
      case 'hook':
        label = 'Start exploring';
        break;
      case 'explore':
        label = 'Explain it to me';
        break;
      case 'explain':
        label = this.step < explain.steps.length - 1 ? 'Next step' : 'Start practising';
        break;
      case 'practise':
        if (this.q < practice.length - 1) label = this.solvedNow ? 'Next question' : 'Skip question';
        else label = 'See the recap';
        break;
      case 'recap':
        label = this.opts.next ? `Next lesson: ${this.opts.next.meta.title}` : 'Back to all lessons';
        break;
    }
    next.textContent = label;
    next.classList.toggle('btn-attention', this.section === 'practise' && this.solvedNow);
    const i = SECTIONS.indexOf(this.section);
    back.setAttribute('aria-label', i === 0 ? 'Back' : `Back (${this.section === 'explore' ? 'Hook' : 'previous'})`);
  }

  private sectionFade(): void {
    this.own(
      gsap.fromTo(
        [this.v.host, this.v.panelBody],
        { opacity: 0 },
        { opacity: 1, duration: motion.reduced ? 0.2 : 0.35, ease: 'power1.out', overwrite: true },
      ),
    );
  }

  /** A small celebratory burst of dots (a simple glow when motion is reduced). */
  private burst(color: string): void {
    const layer = this.v.burstLayer;
    if (motion.reduced) {
      this.own(gsap.fromTo(this.v.stageWrap, { boxShadow: `inset 0 0 0 4px ${color}` }, { boxShadow: 'inset 0 0 0 0px transparent', duration: 1.2 }));
      return;
    }
    const w = this.sm.width;
    const h = this.sm.height;
    const n = 18;
    for (let i = 0; i < n; i++) {
      const dot = document.createElement('span');
      dot.className = 'burst-dot';
      dot.style.background = i % 3 === 0 ? C.c : i % 3 === 1 ? color : C.angle;
      layer.appendChild(dot);
      const a = (i / n) * Math.PI * 2;
      const r = Math.min(w, h) * (0.22 + Math.random() * 0.12);
      this.own(gsap.fromTo(
        dot,
        { x: w / 2, y: h / 2, scale: 0, opacity: 1 },
        {
          x: w / 2 + Math.cos(a) * r,
          y: h / 2 + Math.sin(a) * r,
          scale: 1,
          opacity: 0,
          duration: 0.9,
          ease: 'power2.out',
          onComplete: () => dot.remove(),
        },
      ));
    }
  }
}

function lastEq(steps: StepDef<unknown>[], upTo: number): string[] | undefined {
  for (let i = upTo; i >= 0; i--) {
    const e = steps[i]?.eq;
    if (e) return e;
  }
  return undefined;
}
