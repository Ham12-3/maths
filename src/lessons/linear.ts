/**
 * Lesson 2 — Linear functions, y = mx + c.
 * The line turns as m changes and slides as c changes; slope is shown as a rise-over-run
 * staircase that walks along the line.
 */
import gsap from 'gsap';
import { Vector3 } from 'three';
import { C, tc } from '../core/colors';
import { drawOn, flash, hiddenLabel, pop, popLabel, shrunk, thicken } from '../core/anim';
import { Dot, Stroke, Z } from '../core/draw';
import type { Handle } from '../core/drag';
import type { Label } from '../core/labels';
import { defineExplain, type LessonDef, type Timeline } from '../core/lesson-types';
import { DUR, EASE } from '../core/motion';
import type { Rect2D } from '../core/scene-manager';
import type { Stage } from '../core/stage';
import { clamp, fmt, fmtTex, snap } from '../math/geometry';
import type { V2 } from '../math/vec';

const RECT: Rect2D = { x0: -8, x1: 8, y0: -8, y1: 8 };
const M = tc('slope', 'm');
const Ci = tc('intercept', 'c');
const RISE = tc('b', '\\text{rise}');
const RUN = tc('a', '\\text{run}');
const GENERAL = ['y', '=', `${M}x`, '+', Ci];

/** The part of y = mx + c that lies inside the rect (with a small margin). */
function clipLine(m: number, c: number, r: Rect2D): V2[] {
  const pad = Math.max(r.x1 - r.x0, r.y1 - r.y0) / 2;
  const y0 = r.y0 - pad;
  const y1 = r.y1 + pad;
  let lo = r.x0 - pad;
  let hi = r.x1 + pad;
  if (Math.abs(m) > 1e-9) {
    const xa = (y0 - c) / m;
    const xb = (y1 - c) / m;
    lo = Math.max(lo, Math.min(xa, xb));
    hi = Math.min(hi, Math.max(xa, xb));
  }
  if (lo >= hi) return [];
  return [
    { x: lo, y: m * lo + c },
    { x: hi, y: m * hi + c },
  ];
}

/** Equation text with live numbers, e.g. y = 2x + 1, coloured by role. */
function eqTex(m: number, c: number): string {
  const mPart = m === 1 ? '' : m === -1 ? '-' : fmtTex(m);
  const xTerm = m === 0 ? '' : `${tc('slope', mPart)}x`;
  if (c === 0) return `y = ${xTerm || tc('intercept', '0')}`;
  const sign = c < 0 ? '-' : '+';
  const cAbs = tc('intercept', fmtTex(Math.abs(c)));
  return xTerm ? `y = ${xTerm} ${sign} ${cAbs}` : `y = ${c < 0 ? '-' : ''}${cAbs}`;
}

/** A line with its intercept dot and a rise/run staircase. */
class LineFig {
  m: number;
  c: number;
  /** Where the staircase starts (x) and how far it runs. */
  stairX = 0;
  run = 1;
  readonly line: Stroke;
  readonly runLine: Stroke;
  readonly riseLine: Stroke;
  readonly runLabel: Label;
  readonly riseLabel: Label;
  readonly icpt: Dot;
  readonly icptLabel: Label;

  constructor(
    stage: Stage,
    m: number,
    c: number,
    private rect: Rect2D = RECT,
  ) {
    this.m = m;
    this.c = c;
    this.line = stage.add(new Stroke([], { color: C.curve, width: stage.px(5), z: Z.line }));
    this.runLine = stage.add(new Stroke([], { color: C.a, width: stage.px(4), z: Z.line + 0.1 }));
    this.riseLine = stage.add(new Stroke([], { color: C.b, width: stage.px(4), z: Z.line + 0.1 }));
    this.icpt = stage.add(new Dot(C.intercept, stage.px(8)));
    this.runLabel = stage.labels.add({ text: '', color: C.a, anchor: 'below' });
    this.riseLabel = stage.labels.add({ text: '', color: C.b, anchor: 'right' });
    this.icptLabel = stage.labels.add({ text: '', color: C.intercept, anchor: 'left' });
    this.redraw();
  }

  set(m: number, c: number): void {
    this.m = m;
    this.c = c;
    this.redraw();
  }

  y(x: number): number {
    return this.m * x + this.c;
  }

  redraw(): void {
    const { m, c } = this;
    this.line.setPoints(clipLine(m, c, this.rect));
    const x0 = this.stairX;
    const x1 = x0 + this.run;
    const p0 = { x: x0, y: this.y(x0) };
    const corner = { x: x1, y: p0.y };
    const p1 = { x: x1, y: this.y(x1) };
    this.runLine.setPoints([p0, corner]);
    this.riseLine.setPoints([corner, p1]);
    this.runLabel.at({ x: (x0 + x1) / 2, y: p0.y });
    this.riseLabel.at({ x: x1, y: (p0.y + p1.y) / 2 });
    this.runLabel.setText(`run = ${fmt(this.run)}`);
    this.riseLabel.setText(`rise = ${fmt(m * this.run)}`);
    this.icpt.at({ x: 0, y: c });
    this.icptLabel.at({ x: 0, y: c });
    this.icptLabel.setText(`$c = ${fmtTex(c)}$`);
  }

  showStair(on: boolean): void {
    this.runLine.visible = this.riseLine.visible = on;
    this.runLabel.el.hidden = this.riseLabel.el.hidden = !on;
  }

  /** Tween m and/or c smoothly (the line turns and slides). */
  tweenTo(tl: Timeline, to: { m?: number; c?: number }, at?: gsap.Position, dur: number = DUR.slow): void {
    tl.to(this, { ...to, duration: dur, ease: EASE.move, onUpdate: () => this.redraw() }, at);
  }

  hideAll(): void {
    this.line.draw = 0;
    this.runLine.draw = 0;
    this.riseLine.draw = 0;
    shrunk(this.icpt);
    hiddenLabel(this.runLabel, this.riseLabel, this.icptLabel);
  }

  /** Staircase draws itself: across first, then up. */
  drawStair(tl: Timeline, at?: gsap.Position): void {
    drawOn(tl, this.runLine, at, 0.5);
    popLabel(tl, this.runLabel, '>-0.1');
    drawOn(tl, this.riseLine, '>', 0.5);
    popLabel(tl, this.riseLabel, '>-0.1');
  }
}

/** A plotted point with dashed guides back to both axes. */
function guidePoint(stage: Stage, p: V2) {
  const dash: [number, number] = [stage.px(8), stage.px(6)];
  const across = stage.add(new Stroke([{ x: 0, y: p.y }, p], { color: C.a, width: stage.px(2.5), dash, z: Z.line }));
  const up = stage.add(new Stroke([{ x: p.x, y: 0 }, p], { color: C.b, width: stage.px(2.5), dash, z: Z.line }));
  const dot = stage.add(new Dot(C.ink, stage.px(8)).at(p));
  const label = stage.labels.add({ text: `(${fmt(p.x)}, ${fmt(p.y)})`, at: p, anchor: 'right' });
  return { across, up, dot, label };
}

export const linear: LessonDef = {
  meta: {
    id: 'linear',
    title: 'Straight lines',
    blurb: 'Turn and slide a line, and discover the recipe y = mx + c.',
    accent: 'curve',
  },
  view: { kind: '2d', rect: RECT },

  hook: {
    caption: 'Every straight line in the world follows the same simple recipe. Watch it turn and slide…',
    play(stage) {
      stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
      const fig = new LineFig(stage, 0, 0);
      fig.hideAll();
      fig.showStair(false);
      const steps: Stroke[] = [];
      for (let i = 0; i < 6; i++) {
        const x = -6 + i * 2;
        const y = 0.5 * x + 1;
        const w = stage.px(4);
        const run = stage.add(new Stroke([{ x, y }, { x: x + 2, y }], { color: C.a, width: w, z: Z.line + 0.1 }));
        const rise = stage.add(new Stroke([{ x: x + 2, y }, { x: x + 2, y: y + 1 }], { color: C.b, width: w, z: Z.line + 0.1 }));
        run.draw = rise.draw = 0;
        steps.push(run, rise);
      }
      const recipe = stage.labels.add({ tex: GENERAL.join(' '), at: { x: -4.5, y: 6 }, className: 'big-label' });
      hiddenLabel(recipe);
      const tl = stage.timeline();
      drawOn(tl, fig.line, 0, 0.9);
      fig.tweenTo(tl, { m: 2.5 }, '>', 0.9);
      fig.tweenTo(tl, { m: -1.2 }, '>', 0.9);
      fig.tweenTo(tl, { c: 3 }, '>', 0.7);
      fig.tweenTo(tl, { c: -2 }, '>', 0.7);
      fig.tweenTo(tl, { m: 0.5, c: 1 }, '>', 0.9);
      tl.addLabel('stairs');
      tl.fromTo(steps, { draw: 0 }, { draw: 1, duration: 0.22, ease: 'none', stagger: 0.2 }, 'stairs');
      pop(tl, fig.icpt, '>-0.3');
      popLabel(tl, recipe, '>');
      return tl;
    },
  },

  explore: {
    caption: `Move the sliders, or drag the points: the **pink** point sets where the line crosses the $y$-axis, and the **green** point sets the slope.`,
    setup(stage) {
      stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
      const RUN_X = 2;
      const fig = new LineFig(stage, 1, 1);
      fig.run = RUN_X;
      fig.redraw();
      popLabel(stage.timeline(), [fig.runLabel, fig.riseLabel, fig.icptLabel], 0);
      const eq = stage.ui.readout('readout big');
      const slope = stage.ui.readout('readout');
      const target = { m: 1, c: 1 };
      let mHandle: Handle | null = null;
      let cHandle: Handle | null = null;
      /** Redraw the line and keep both handles glued to it. */
      const applyFig = () => {
        fig.redraw();
        cHandle?.place({ x: 0, y: fig.c });
        mHandle?.place({ x: RUN_X, y: fig.c + fig.m * RUN_X });
      };
      const updateText = () => {
        eq.tex(eqTex(target.m, target.c));
        const rise = tc('b', fmtTex(target.m * RUN_X));
        slope.set(`Slope $${M} = \\dfrac{${RISE}}{${RUN}} = \\dfrac{${rise}}{${tc('a', String(RUN_X))}} = ${tc('slope', fmtTex(target.m))}$`);
      };
      /** Sliders glide the line to its new place… */
      const glide = () => {
        stage.to(fig, { m: target.m, c: target.c, duration: 0.35, ease: 'power2.out', overwrite: 'auto', onUpdate: applyFig });
        updateText();
      };
      const mSlider = stage.ui.slider({
        label: `Slope $${M}$`,
        name: 'slope m',
        min: -4,
        max: 4,
        step: 0.25,
        value: 1,
        color: C.slope,
        format: (v) => fmt(v),
        onInput: (v) => {
          target.m = v;
          glide();
        },
      });
      const cSlider = stage.ui.slider({
        label: `Intercept $${Ci}$`,
        name: 'intercept c',
        min: -6,
        max: 6,
        step: 0.5,
        value: 1,
        color: C.intercept,
        format: (v) => fmt(v),
        onInput: (v) => {
          target.c = v;
          glide();
        },
      });
      /** …while dragging moves it directly under the pointer. */
      const direct = () => {
        gsap.killTweensOf(fig);
        fig.m = target.m;
        fig.c = target.c;
        applyFig();
        mSlider.set(target.m);
        cSlider.set(target.c);
        updateText();
      };
      cHandle = stage.drag.add({
        name: 'Intercept point',
        at: { x: 0, y: 1 },
        color: C.intercept,
        radius: stage.px(9),
        constrain: (p) => new Vector3(0, clamp(snap(p.y, 0.5), -6, 6), 0),
        onMove: (p) => {
          target.c = p.y;
          direct();
        },
        describe: () => `c = ${fmt(target.c)}`,
      });
      mHandle = stage.drag.add({
        name: 'Slope point at the top of the staircase',
        at: { x: RUN_X, y: 1 + RUN_X },
        color: C.slope,
        radius: stage.px(9),
        constrain: (p) => new Vector3(RUN_X, target.c + RUN_X * clamp(snap((p.y - target.c) / RUN_X, 0.25), -4, 4), 0),
        onMove: (p) => {
          target.m = (p.y - target.c) / RUN_X;
          direct();
        },
        describe: () => `slope m = ${fmt(target.m)}`,
      });
      updateText();
    },
  },

  explain: defineExplain({
    setup(stage) {
      stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
      const guide = guidePoint(stage, { x: 3, y: 2 });
      guide.across.draw = 0;
      guide.up.draw = 0;
      shrunk(guide.dot);
      hiddenLabel(guide.label);
      const xs = [-3, -2, -1, 0, 1, 2, 3];
      const dots = xs.map((x) => {
        const d = stage.add(new Dot(C.ink, stage.px(7)).at({ x, y: 2 * x + 1 }));
        d.scale.setScalar(0);
        return d;
      });
      const fig = new LineFig(stage, 2, 1);
      fig.hideAll();
      return { guide, dots, fig };
    },
    steps: [
      {
        caption: 'A graph is a map of number pairs $(x, y)$. $x$ says how far **across** to go, and $y$ says how far **up**.',
        play(stage, { guide }) {
          const tl = stage.timeline();
          drawOn(tl, guide.across, 0, 0.7);
          drawOn(tl, guide.up, '>', 0.5);
          pop(tl, guide.dot, '>-0.1');
          popLabel(tl, guide.label, '>-0.1');
          return tl;
        },
      },
      {
        caption: 'Here is a rule: $y = 2x + 1$. Put in any $x$, double it, add 1 — out comes $y$. Each dot follows the rule.',
        eq: ['y', '=', '2x', '+', '1'],
        eqAt: 0,
        play(stage, { guide, dots }) {
          const tl = stage.timeline();
          tl.to([guide.across, guide.up], { opacity: 0, duration: 0.3 }, 0);
          tl.to(guide.dot.material, { opacity: 0, duration: 0.3 }, 0);
          tl.to(guide.label.inner, { opacity: 0, duration: 0.3 }, 0);
          pop(tl, dots, 0.4, 0.4);
          return tl;
        },
      },
      {
        caption: 'Join the dots — they make a perfectly **straight line**!',
        play(stage, { fig }) {
          const tl = stage.timeline();
          drawOn(tl, fig.line, 0, 1.1);
          return tl;
        },
      },
      {
        caption: `The number on its own, $+1$, is where the line crosses the $y$-axis. It's called the **intercept**, $${Ci}$.`,
        eq: ['y', '=', '2x', '+', tc('intercept', '1')],
        play(stage, { fig }) {
          const tl = stage.timeline();
          pop(tl, fig.icpt, 0);
          popLabel(tl, fig.icptLabel, '>-0.2');
          flash(tl, fig.icpt.material, '>', 0.3);
          return tl;
        },
      },
      {
        caption: `The number in front of $x$ is the **slope** $${M}$: how steep the line is. Go 1 across (the run) and the line goes 2 up (the rise).`,
        eq: [M, '=', `\\dfrac{${RISE}}{${RUN}}`, '=', `\\dfrac{${tc('b', '2')}}{${tc('a', '1')}}`, '=', tc('slope', '2')],
        play(stage, { fig }) {
          const tl = stage.timeline();
          fig.drawStair(tl, 0);
          thicken(tl, fig.line, '>');
          return tl;
        },
      },
      {
        caption: `Change $${M}$ and the line **turns**. A bigger $${M}$ is steeper. A negative $${M}$ goes downhill.`,
        eq: GENERAL,
        eqAt: 0,
        play(stage, { fig, dots }) {
          const tl = stage.timeline();
          tl.to(
            dots.map((d) => d.scale),
            { x: 0, y: 0, z: 0, duration: 0.3, stagger: 0.03 },
            0,
          );
          fig.tweenTo(tl, { m: 4 }, 0.3);
          fig.tweenTo(tl, { m: 0.5 }, '>+0.3');
          fig.tweenTo(tl, { m: -1.5 }, '>+0.3');
          fig.tweenTo(tl, { m: 2 }, '>+0.3');
          return tl;
        },
      },
      {
        caption: `Change $${Ci}$ and the line **slides** up or down without turning. Same slope, different place.`,
        play(stage, { fig }) {
          const tl = stage.timeline();
          fig.tweenTo(tl, { c: 4 }, 0);
          fig.tweenTo(tl, { c: -3 }, '>+0.3');
          fig.tweenTo(tl, { c: 1 }, '>+0.3');
          return tl;
        },
      },
    ],
  }),

  practice: [
    {
      prompt: `Make the line $y = 3x - 2$ by matching the dashed line. The intercept is already set — use the slider to choose the slope $${M}$.`,
      input: { kind: 'slider', label: `Slope $${M}$`, name: 'slope m', min: -4, max: 4, step: 0.5, value: 1, color: C.slope, format: (v) => fmt(v) },
      hint: 'In $y = 3x - 2$ the number in front of $x$ is the slope. Go 1 across and the line should go that many up.',
      explain: 'The slope is $3$: one step across, three steps up.',
      setup(stage) {
        stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
        stage.add(
          new Stroke(clipLine(3, -2, RECT), { color: C.ink, width: stage.px(3), dash: [stage.px(10), stage.px(8)], opacity: 0.55 }),
        );
        const fig = new LineFig(stage, 1, -2);
        fig.showStair(false);
        // The staircase of the target line, revealed by the hint.
        const guide = new LineFig(stage, 3, -2);
        guide.line.visible = false;
        guide.icpt.visible = false;
        guide.icptLabel.el.hidden = true;
        guide.hideAll();
        return {
          onInput: (v) => fig.set(v, -2),
          check: (v) => v === 3,
          hint() {
            const tl = stage.timeline();
            guide.drawStair(tl, 0);
            return tl;
          },
        };
      },
    },
    {
      prompt: `Drag the pink point so the line crosses the $y$-axis at $4$.`,
      input: { kind: 'drag' },
      hint: 'The intercept is where the line crosses the up-and-down $y$-axis. Move the pink point up the axis until it reaches 4.',
      explain: 'The intercept is now $c = 4$, so the line is $y = x + 4$.',
      setup(stage) {
        stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
        const fig = new LineFig(stage, 1, -1);
        fig.showStair(false);
        const target = stage.add(new Dot(C.intercept, stage.px(14)).at({ x: 0, y: 4 }));
        target.material.opacity = 0;
        stage.drag.add({
          name: 'Intercept point',
          at: { x: 0, y: -1 },
          color: C.intercept,
          radius: stage.px(9),
          constrain: (p) => new Vector3(0, clamp(snap(p.y, 0.5), -7, 7), 0),
          onMove: (p) => fig.set(1, p.y),
          describe: () => `crosses the y-axis at ${fmt(fig.c)}`,
        });
        return {
          check: () => fig.c === 4,
          hint() {
            const tl = stage.timeline();
            tl.fromTo(target.material, { opacity: 0 }, { opacity: 0.45, duration: 0.3, yoyo: true, repeat: 3 }, 0);
            return tl;
          },
        };
      },
    },
    {
      prompt: 'What is the slope of this line? It goes through the two marked points.',
      input: { kind: 'choice', options: ['$3$', '$2$', '$\\tfrac{1}{3}$', '$6$'], answer: 0 },
      hint: 'Count from the left point to the right point: how far across (run)? How far up (rise)? Slope = rise ÷ run.',
      explain: 'From $(0, -1)$ to $(2, 5)$ the run is $2$ and the rise is $6$, so the slope is $6 \\div 2 = 3$.',
      setup(stage) {
        stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
        const fig = new LineFig(stage, 3, -1);
        fig.showStair(false);
        fig.icpt.visible = false;
        fig.icptLabel.el.hidden = true;
        for (const p of [
          { x: 0, y: -1 },
          { x: 2, y: 5 },
        ]) {
          stage.add(new Dot(C.ink, stage.px(8)).at(p));
          stage.labels.add({ text: `(${fmt(p.x)}, ${fmt(p.y)})`, at: p, anchor: 'right' });
        }
        return {
          hint() {
            fig.run = 2;
            fig.showStair(true);
            fig.runLine.draw = 0;
            fig.riseLine.draw = 0;
            fig.redraw();
            const tl = stage.timeline();
            fig.drawStair(tl, 0);
            return tl;
          },
        };
      },
    },
    {
      prompt: 'Which equation matches this line?',
      input: {
        kind: 'choice',
        options: ['$y = -x + 2$', '$y = x + 2$', '$y = 2x - 1$', '$y = -2x + 1$'],
        answer: 0,
      },
      hint: 'First find where it crosses the $y$-axis — that is $c$. Then: does it go uphill or downhill, and by how much for each step across?',
      explain: 'It crosses at $2$, and drops $1$ for every $1$ across, so $m = -1$ and $c = 2$.',
      setup(stage) {
        stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
        const fig = new LineFig(stage, -1, 2);
        fig.showStair(false);
        fig.icptLabel.el.hidden = true;
        return {
          hint() {
            fig.showStair(true);
            fig.runLine.draw = 0;
            fig.riseLine.draw = 0;
            const tl = stage.timeline();
            flash(tl, fig.icpt.material, 0, 0.2);
            fig.drawStair(tl, '>');
            return tl;
          },
        };
      },
    },
  ],

  recap: {
    points: [
      `Every straight line follows the rule $y = ${M}x + ${Ci}$.`,
      `$${M}$ is the **slope**: rise ÷ run. Bigger means steeper; negative means downhill; $0$ means flat.`,
      `$${Ci}$ is the **intercept**: where the line crosses the $y$-axis.`,
      'To find a slope from two points, divide how far up by how far across.',
    ],
    eq: GENERAL.join(' '),
    play(stage) {
      stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
      const fig = new LineFig(stage, 0.5, -1);
      fig.hideAll();
      const tl = stage.timeline();
      drawOn(tl, fig.line, 0, 0.8);
      pop(tl, fig.icpt, '>-0.2');
      popLabel(tl, fig.icptLabel, '<');
      fig.drawStair(tl, '>');
      fig.tweenTo(tl, { m: 2 }, '>+0.2');
      fig.tweenTo(tl, { c: 2 }, '>+0.1');
      fig.tweenTo(tl, { m: -1 }, '>+0.1');
      return tl;
    },
  },

  dispose() {
    /* no module-level state */
  },
};
