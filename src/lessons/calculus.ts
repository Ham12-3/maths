/**
 * Lesson 6 — A first taste of calculus.
 * A tangent line slides along a curve to show the derivative (slope at a point); then
 * Riemann rectangles get thinner and thinner until they fill the area under the curve.
 */
import { Vector3 } from 'three';
import { C, tc } from '../core/colors';
import { drawOn, fadeIn, flash, hiddenLabel, pop, popLabel, shrunk, switchAt } from '../core/anim';
import { Dot, Fill, Stroke, Z } from '../core/draw';
import type { Label } from '../core/labels';
import { defineExplain, type LessonDef, type Timeline } from '../core/lesson-types';
import { DUR, EASE } from '../core/motion';
import type { Rect2D } from '../core/scene-manager';
import type { Stage } from '../core/stage';
import { poly, polyDerivative, polyIntegral, sample } from '../math/functions';
import { clamp, fmt, fmtTex, snap } from '../math/geometry';
import { riemannRects, riemannSum } from '../math/riemann';
import type { V2 } from '../math/vec';

/** f(x) = 0.3x³ − 1.8x² + 2.4x + 2: a hill, a valley, and positive on [0, 5]. */
const COEFFS = [2, 2.4, -1.8, 0.3];
const f = poly(COEFFS);
const df = poly(polyDerivative(COEFFS));
const F = poly(polyIntegral(COEFFS));
const A = 0;
const B = 5;
export const EXACT_AREA = F(B) - F(A); // 11.875
/** Where the curve is flat (f'(x) = 0). */
const FLAT = [(3.6 - Math.sqrt(3.6 * 3.6 - 4 * 0.9 * 2.4)) / 1.8, (3.6 + Math.sqrt(3.6 * 3.6 - 4 * 0.9 * 2.4)) / 1.8];

const RECT: Rect2D = { x0: -0.9, x1: 6.1, y0: -1, y1: 7.6 };
const FX = tc('curve', 'f(x)');
const DFX = tc('slope', "f'(x)");
const AREA = tc('area', '\\text{Area}');

function slopeWord(m: number): string {
  if (Math.abs(m) < 0.06) return 'flat';
  return m > 0 ? 'uphill' : 'downhill';
}

/** The curve, a tangent with its rise/run staircase, and Riemann rectangles. */
class CalcFig {
  /** Where the tangent touches. */
  x = 4;
  /** Number of rectangles (rounded when drawn). */
  n = 5;
  /** 0..1: rectangles rise one after another. */
  reveal = 1;
  readonly curve: Stroke;
  readonly area: Fill;
  readonly rects: Fill;
  readonly tops: Stroke;
  readonly tangent: Stroke;
  readonly run: Stroke;
  readonly rise: Stroke;
  readonly point: Dot;
  readonly slopeLabel: Label;
  readonly sumLabel: Label;
  readonly edges: Stroke[];
  readonly flats: Dot[];

  constructor(stage: Stage) {
    const px = (n: number) => stage.px(n);
    stage.axes(RECT, { labelEvery: 1, xName: '$x$', yName: '$y$' });
    this.area = stage.add(new Fill(C.area, 0.22, Z.fill));
    const curvePts = sample(f, A - 0.6, B + 0.55, 160);
    this.area.setBand(
      sample(f, A, B, 120),
      sample(() => 0, A, B, 120),
    );
    this.rects = stage.add(new Fill(C.area, 0.55, Z.area));
    this.tops = stage.add(new Stroke([], { color: C.area, width: px(2.5), z: Z.area + 0.1 }));
    this.curve = stage.add(new Stroke(curvePts, { color: C.curve, width: px(5), z: Z.line }));
    this.edges = [A, B].map((x) =>
      stage.add(new Stroke([{ x, y: 0 }, { x, y: f(x) }], { color: C.area, width: px(2), dash: [px(6), px(6)], z: Z.line - 0.1 })),
    );
    this.tangent = stage.add(new Stroke([], { color: C.slope, width: px(4), z: Z.line + 0.2 }));
    this.run = stage.add(new Stroke([], { color: C.a, width: px(3.5), z: Z.line + 0.3 }));
    this.rise = stage.add(new Stroke([], { color: C.b, width: px(3.5), z: Z.line + 0.3 }));
    this.point = stage.add(new Dot(C.ink, px(7), Z.point + 0.2));
    this.flats = FLAT.map((x) => {
      const d = stage.add(new Dot(C.slope, px(9), Z.point));
      d.at({ x, y: f(x) });
      return d;
    });
    this.slopeLabel = stage.labels.add({ text: '', color: C.slope });
    this.sumLabel = stage.labels.add({ text: '', at: { x: 2.65, y: 6.6 }, className: 'big-label' });
    this.redraw();
  }

  get slope(): number {
    return df(this.x);
  }

  get count(): number {
    return Math.max(1, Math.round(this.n));
  }

  get estimate(): number {
    return riemannSum(f, A, B, this.count, 'left');
  }

  redraw(): void {
    const { x } = this;
    const y = f(x);
    const m = df(x);
    // Tangent: a fixed length either side of the point.
    const half = 1.6 / Math.sqrt(1 + m * m);
    this.tangent.setPoints([
      { x: x - half, y: y - m * half },
      { x: x + half, y: y + m * half },
    ]);
    const corner = { x: x + 1, y };
    this.run.setPoints([{ x, y }, corner]);
    this.rise.setPoints([corner, { x: x + 1, y: y + m }]);
    this.point.at({ x, y });
    // Put the label in the corner the tangent leaves empty (upper right when going downhill).
    const side = m < 0 ? 1 : -1;
    this.slopeLabel
      .at({ x: x + side * 0.25, y: y + 0.55 })
      .setAnchor(m < 0 ? 'right' : 'left')
      .setText(`slope = ${fmt(m)} (${slopeWord(m)})`);
    this.drawRects();
  }

  drawRects(): void {
    const rs = riemannRects(f, A, B, this.count, 'left');
    const gap = Math.min(0.04, (B - A) / this.count / 8);
    const k = rs.length;
    const shown = rs.map((r, i) => {
      const t = clamp(this.reveal * (k + 2) - i, 0, 1);
      return { x: r.x + gap / 2, y: 0, w: r.width - gap, h: r.height * t };
    });
    this.rects.setRects(shown);
    const tops: V2[] = [];
    for (const r of shown) tops.push({ x: r.x - gap / 2, y: r.h }, { x: r.x + r.w + gap / 2, y: r.h });
    this.tops.setPoints(tops);
    this.sumLabel.setText(`$${AREA} \\approx ${fmtTex(this.estimate)}$ with ${this.count} rectangle${this.count === 1 ? '' : 's'}`);
  }

  /** Show only the slope part, only the area part, or neither. */
  mode(m: 'slope' | 'area' | 'curve'): void {
    const slope = m === 'slope';
    const area = m === 'area';
    for (const o of [this.tangent, this.run, this.rise, this.point]) o.visible = slope;
    this.slopeLabel.el.hidden = !slope;
    for (const o of [this.rects, this.tops, this.area, ...this.edges]) o.visible = area;
    this.sumLabel.el.hidden = !area;
    for (const d of this.flats) d.visible = false;
  }

  slideTo(tl: Timeline, x: number, at?: gsap.Position, dur: number = DUR.slow, ease: string = EASE.move): void {
    tl.to(this, { x, duration: dur, ease, onUpdate: () => this.redraw() }, at);
  }

  thinTo(tl: Timeline, n: number, at?: gsap.Position, dur = 0.8): void {
    tl.to(this, { n, duration: dur, ease: 'power1.inOut', onUpdate: () => this.drawRects() }, at);
  }
}

/** The point on the curve, draggable left and right (it always stays on the curve). */
function curveHandle(stage: Stage, fig: CalcFig, onChange: () => void) {
  return stage.drag.add({
    name: 'Point on the curve',
    at: { x: fig.x, y: f(fig.x) },
    color: C.ink,
    radius: stage.px(10),
    keyStep: 0.05,
    constrain: (p) => {
      const x = clamp(snap(p.x, 0.05), A, B);
      return new Vector3(x, f(x), 0);
    },
    onArrow: (dir, p) => {
      const x = p.x + (dir === 'right' || dir === 'up' ? 0.05 : -0.05);
      return new Vector3(x, f(x), 0);
    },
    onMove: (p) => {
      fig.x = p.x;
      fig.redraw();
      onChange();
    },
    describe: () => `x = ${fmt(fig.x)}, slope ${fmt(fig.slope)}, ${slopeWord(fig.slope)}`,
  });
}

export const calculus: LessonDef = {
  meta: {
    id: 'calculus',
    title: 'Calculus: slopes and areas',
    blurb: 'Surf a tangent along a curve, then fill the space under it with ever-thinner rectangles.',
    accent: 'slope',
  },
  view: { kind: '2d', rect: RECT },

  hook: {
    caption: 'How steep is a curve at one exact point? How much space is under it? Calculus answers both questions.',
    play(stage) {
      const fig = new CalcFig(stage);
      fig.mode('curve');
      fig.curve.draw = 0;
      fig.x = 0.2;
      fig.n = 4;
      fig.redraw();
      const tl = stage.timeline();
      drawOn(tl, fig.curve, 0, 1);
      switchAt(tl, '>', () => fig.mode('slope'), () => fig.mode('curve'));
      tl.fromTo([fig.tangent], { draw: 0 }, { draw: 1, duration: 0.4 }, '>');
      fig.slideTo(tl, 4.8, '>', 3, 'sine.inOut');
      switchAt(tl, '>+0.2', () => fig.mode('area'), () => fig.mode('slope'));
      tl.fromTo(fig, { reveal: 0 }, { reveal: 1, duration: 0.8, ease: 'none', onUpdate: () => fig.drawRects() }, '>');
      fig.thinTo(tl, 10, '>+0.2', 0.6);
      fig.thinTo(tl, 25, '>+0.1', 0.6);
      fig.thinTo(tl, 80, '>+0.1', 0.8);
      return tl;
    },
  },

  explore: {
    caption: 'Choose **Slope** to slide a tangent along the curve, or **Area** to fill the space underneath with rectangles.',
    setup(stage) {
      const fig = new CalcFig(stage);
      fig.x = 1.5;
      fig.n = 8;
      fig.redraw();
      const modes = stage.ui.row();
      const slopeBox = stage.ui.row();
      const areaBox = stage.ui.row();
      slopeBox.root.classList.add('stack');
      areaBox.root.classList.add('stack');
      const slopeOut = slopeBox.readout('readout');
      const areaOut = areaBox.readout('readout');
      const xSlider = slopeBox.slider({
        label: 'Point position $x$',
        name: 'x position of the point',
        min: A,
        max: B,
        step: 0.05,
        value: fig.x,
        color: C.ink,
        format: (v) => fmt(v),
        onInput: (v) => {
          fig.x = v;
          fig.redraw();
          handle.place({ x: v, y: f(v) });
          refresh();
        },
      });
      areaBox.slider({
        label: 'Number of rectangles',
        name: 'number of rectangles',
        min: 1,
        max: 100,
        step: 1,
        value: fig.n,
        color: C.area,
        onInput: (v) => {
          fig.n = v;
          fig.drawRects();
          refresh();
        },
      });
      const refresh = () => {
        const m = fig.slope;
        slopeOut.set(`At $x = ${fmtTex(fig.x)}$ the slope is $${DFX} = ${fmtTex(m)}$: the curve is going **${slopeWord(m)}**.`);
        const est = fig.estimate;
        areaOut.set(
          `Estimate with ${fig.count} rectangles: **${fmt(est, 3)}**. True area: **${fmt(EXACT_AREA, 3)}**. Off by ${fmt(Math.abs(EXACT_AREA - est), 3)}.`,
        );
        xSlider.set(fig.x);
      };
      const setMode = (m: 'slope' | 'area') => {
        fig.mode(m);
        slopeBox.root.hidden = m !== 'slope';
        areaBox.root.hidden = m !== 'area';
        handle.setEnabled(m === 'slope');
        handle.group.visible = m === 'slope';
        slopeBtn.setAttribute('aria-pressed', String(m === 'slope'));
        areaBtn.setAttribute('aria-pressed', String(m === 'area'));
        slopeBtn.className = `btn ${m === 'slope' ? 'btn-primary' : 'btn-ghost'}`;
        areaBtn.className = `btn ${m === 'area' ? 'btn-primary' : 'btn-ghost'}`;
      };
      const slopeBtn = modes.button('Slope', () => setMode('slope'));
      const areaBtn = modes.button('Area', () => setMode('area'));
      const handle = curveHandle(stage, fig, refresh);
      setMode('slope');
      refresh();
    },
  },

  explain: defineExplain({
    setup(stage) {
      const fig = new CalcFig(stage);
      fig.mode('curve');
      fig.curve.draw = 0;
      for (const o of [fig.tangent, fig.run, fig.rise, fig.point]) o.visible = true;
      fig.tangent.draw = 0;
      fig.run.draw = 0;
      fig.rise.draw = 0;
      shrunk(fig.point);
      fig.slopeLabel.el.hidden = false;
      hiddenLabel(fig.slopeLabel);
      for (const d of fig.flats) {
        d.visible = true;
        d.scale.setScalar(0);
      }
      const hill = stage.labels.add({ text: 'top of a hill: flat', at: { x: FLAT[0]!, y: f(FLAT[0]!) }, anchor: 'above', color: C.slope });
      const valley = stage.labels.add({ text: 'bottom of a valley: flat', at: { x: FLAT[1]!, y: f(FLAT[1]!) }, anchor: 'below', color: C.slope });
      const exact = stage.labels.add({ text: `exact area = ${fmt(EXACT_AREA, 3)}`, at: { x: 2.5, y: 6.2 }, color: C.area });
      hiddenLabel(hill, valley, exact);
      return { fig, hill, valley, exact };
    },
    steps: [
      {
        caption: "Here is a curvy graph. A straight line is equally steep everywhere — but a curve's steepness keeps **changing**.",
        eq: ['y', '=', FX],
        play(stage, { fig }) {
          const tl = stage.timeline();
          drawOn(tl, fig.curve, 0, 1.6);
          return tl;
        },
      },
      {
        caption: 'A **tangent** is a straight line that just touches the curve at one point, heading the same way as the curve there.',
        play(stage, { fig }) {
          const tl = stage.timeline();
          pop(tl, fig.point, 0);
          tl.fromTo(fig.tangent, { draw: 0 }, { draw: 1, duration: 0.8, ease: EASE.draw }, '>');
          return tl;
        },
      },
      {
        caption: `The tangent's slope (rise ÷ run) tells us how steep the curve is **right there**. It is called the **derivative**, $${DFX}$.`,
        eq: [DFX, '=', '\\text{slope of the tangent}'],
        play(stage, { fig }) {
          const tl = stage.timeline();
          drawOn(tl, fig.run, 0, 0.5);
          drawOn(tl, fig.rise, '>', 0.5);
          popLabel(tl, fig.slopeLabel, '>');
          return tl;
        },
      },
      {
        caption: 'Slide the tangent along. Going **uphill**, the slope is positive. **Downhill**, it is negative. At the top of a hill or bottom of a valley it is **flat**: zero.',
        eq: ['\\text{flat}', '\\Rightarrow', `${DFX} = 0`],
        play(stage, { fig, hill, valley }) {
          const tl = stage.timeline();
          tl.to([fig.run, fig.rise], { opacity: 0, duration: 0.3 }, 0);
          fig.slideTo(tl, 0.1, 0.2, 1.4);
          fig.slideTo(tl, FLAT[0]!, '>', 1.2);
          pop(tl, fig.flats[0]!, '>');
          popLabel(tl, hill, '<');
          fig.slideTo(tl, FLAT[1]!, '>+0.4', 2);
          pop(tl, fig.flats[1]!, '>');
          popLabel(tl, valley, '<');
          fig.slideTo(tl, 4.8, '>+0.4', 1.4);
          return tl;
        },
      },
      {
        caption: 'A new question: how much **area** is there under the curve, between $x = 0$ and $x = 5$?',
        eq: [AREA, '=', '\\;?'],
        eqAt: 0,
        play(stage, { fig, hill, valley }) {
          fig.area.visible = true;
          for (const e of fig.edges) e.visible = true;
          const tl = stage.timeline();
          tl.to([hill.inner, valley.inner, fig.slopeLabel.inner], { opacity: 0, duration: 0.3 }, 0);
          tl.to([fig.tangent, fig.point.material, ...fig.flats.map((d) => d.material)], { opacity: 0, duration: 0.4 }, 0);
          fadeIn(tl, fig.area, 0.3, 0.3, 0.8);
          drawOn(tl, fig.edges, 0.3, 0.6);
          return tl;
        },
      },
      {
        caption: 'Estimate it with rectangles. Each one has area **width × height**. Add them all up.',
        eq: [AREA, '\\approx', `\\sum ${FX}\\,\\Delta x`],
        eqAt: 0,
        play(stage, { fig }) {
          fig.rects.visible = fig.tops.visible = true;
          fig.sumLabel.el.hidden = false;
          fig.n = 5;
          fig.reveal = 0;
          fig.drawRects();
          hiddenLabel(fig.sumLabel);
          const tl = stage.timeline();
          tl.fromTo(fig, { reveal: 0 }, { reveal: 1, duration: 1.8, ease: 'none', onUpdate: () => fig.drawRects() }, 0.2);
          popLabel(tl, fig.sumLabel, '>');
          return tl;
        },
      },
      {
        caption: 'Make them **thinner** and the estimate gets closer. With infinitely thin rectangles we get the exact area — the **integral**.',
        eq: [`\\int_0^5 ${FX}\\,dx`, '=', fmtTex(EXACT_AREA, 3)],
        play(stage, { fig, exact }) {
          const tl = stage.timeline();
          fig.thinTo(tl, 10, 0.2);
          fig.thinTo(tl, 25, '>+0.4');
          fig.thinTo(tl, 50, '>+0.4');
          fig.thinTo(tl, 100, '>+0.4');
          popLabel(tl, exact, '>');
          return tl;
        },
      },
    ],
  }),

  practice: [
    {
      prompt: 'Drag the point to a place where the tangent is **flat** (slope $0$).',
      input: { kind: 'drag' },
      hint: 'Flat means neither uphill nor downhill. Look for the top of the hill or the bottom of the valley.',
      explain: 'At the top of the hill (or the bottom of the valley) the tangent is flat, so the derivative is $0$.',
      setup(stage) {
        const fig = new CalcFig(stage);
        fig.x = 2;
        fig.mode('slope');
        fig.redraw();
        curveHandle(stage, fig, () => {});
        return {
          check: () => Math.abs(fig.slope) < 0.15,
          hint() {
            for (const d of fig.flats) {
              d.visible = true;
              d.scale.setScalar(0);
            }
            const tl = stage.timeline();
            pop(tl, fig.flats, 0);
            tl.to(
              fig.flats.map((d) => d.scale),
              { x: 1.6, y: 1.6, duration: 0.3, yoyo: true, repeat: 3 },
              '>',
            );
            return tl;
          },
        };
      },
    },
    {
      prompt: 'At $x = 2$, is the curve going uphill or downhill?',
      input: {
        kind: 'choice',
        options: ['Uphill (positive slope)', 'Downhill (negative slope)', 'Flat (zero slope)'],
        answer: 1,
      },
      hint: 'Imagine walking along the curve from left to right. At $x = 2$, are you climbing or going down?',
      explain: `The tangent at $x = 2$ points down: $${DFX} = ${fmtTex(df(2))}$, which is negative.`,
      setup(stage) {
        const fig = new CalcFig(stage);
        fig.x = 2;
        fig.mode('slope');
        fig.redraw();
        for (const o of [fig.tangent, fig.run, fig.rise]) o.visible = false;
        fig.slopeLabel.el.hidden = true;
        return {
          hint() {
            fig.tangent.visible = true;
            const tl = stage.timeline();
            tl.fromTo(fig.tangent, { draw: 0 }, { draw: 1, duration: 0.7 }, 0);
            fig.slideTo(tl, 1.4, '>+0.2', 0.6);
            fig.slideTo(tl, 2.6, '>', 1);
            fig.slideTo(tl, 2, '>', 0.6);
            return tl;
          },
        };
      },
    },
    {
      prompt: `Use the slider to choose how many rectangles to use, so that the estimate is within $0.2$ of the true area, $${fmtTex(EXACT_AREA, 3)}$.`,
      input: { kind: 'slider', label: 'Number of rectangles', name: 'number of rectangles', min: 1, max: 100, step: 1, value: 4, color: C.area },
      hint: 'A few wide rectangles miss lots of area (or add extra). Try many more, thinner rectangles.',
      explain: 'With lots of thin rectangles the gaps and overlaps become tiny, so the estimate gets very close.',
      setup(stage) {
        const fig = new CalcFig(stage);
        fig.mode('area');
        return {
          onInput: (v) => {
            fig.n = v;
            fig.drawRects();
          },
          check: (v) => Math.abs(riemannSum(f, A, B, v, 'left') - EXACT_AREA) <= 0.2,
          hint() {
            const tl = stage.timeline();
            flash(tl, fig.area, 0, 0.05);
            return tl;
          },
        };
      },
    },
    {
      prompt: 'What happens to the rectangle estimate as the rectangles get thinner?',
      input: {
        kind: 'choice',
        options: ['It gets closer to the true area', 'It gets further from the true area', 'It stays exactly the same', 'It shrinks to zero'],
        answer: 0,
      },
      hint: 'Watch the gaps between the rectangle tops and the curve as the rectangles get thinner.',
      explain: 'Thinner rectangles hug the curve more tightly, so the estimate creeps up to the exact area.',
      setup(stage) {
        const fig = new CalcFig(stage);
        fig.mode('area');
        fig.n = 3;
        fig.drawRects();
        return {
          hint() {
            const tl = stage.timeline();
            fig.thinTo(tl, 6, 0, 0.6);
            fig.thinTo(tl, 15, '>+0.3', 0.6);
            fig.thinTo(tl, 40, '>+0.3', 0.8);
            return tl;
          },
        };
      },
    },
  ],

  recap: {
    points: [
      `The **derivative** $${DFX}$ is the slope of the tangent: how steep the curve is at one point.`,
      'Uphill means a positive slope, downhill negative, and hilltops and valleys have slope $0$.',
      `The **integral** $\\int ${FX}\\,dx$ is the area under the curve.`,
      'Rectangles give an estimate of the area; thinner rectangles give a better one.',
    ],
    eq: `${DFX} = \\text{slope} \\qquad \\int ${FX}\\,dx = ${AREA}`,
    play(stage) {
      const fig = new CalcFig(stage);
      fig.x = 0.3;
      fig.n = 4;
      fig.mode('slope');
      fig.redraw();
      const tl = stage.timeline();
      fig.slideTo(tl, 4.7, 0.2, 2.2, 'sine.inOut');
      switchAt(tl, '>+0.2', () => fig.mode('area'), () => fig.mode('slope'));
      tl.fromTo(fig, { reveal: 0 }, { reveal: 1, duration: 0.6, ease: 'none', onUpdate: () => fig.drawRects() }, '>');
      fig.thinTo(tl, 12, '>+0.1', 0.5);
      fig.thinTo(tl, 60, '>+0.1', 0.7);
      return tl;
    },
  },

  dispose() {
    /* no module-level state */
  },
};
