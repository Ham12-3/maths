/**
 * Lesson 3 — Quadratics, y = a(x − h)² + k.
 * Drag the vertex to reshape the parabola; roots pop into view when the curve crosses the
 * x-axis and shrink away when it lifts off.
 */
import gsap from 'gsap';
import { Vector3 } from 'three';
import { C, tc } from '../core/colors';
import { drawOn, flash, hiddenLabel, pop, popLabel, shrunk } from '../core/anim';
import { Dot, Stroke, Z } from '../core/draw';
import type { Label } from '../core/labels';
import { defineExplain, type LessonDef, type Timeline } from '../core/lesson-types';
import { DUR, EASE, d } from '../core/motion';
import type { Rect2D } from '../core/scene-manager';
import type { Stage } from '../core/stage';
import { quadVertex, sample, vertexToStandard } from '../math/functions';
import { clamp, fmt, fmtTex, snap } from '../math/geometry';
import { vertexRoots } from '../math/roots';
import type { V2 } from '../math/vec';

const RECT: Rect2D = { x0: -7, x1: 7, y0: -6, y1: 8 };
const A = tc('slope', 'a');
const H = tc('a', 'h');
const K = tc('b', 'k');
const VERTEX_FORM = `y = ${A}(x - ${H})^2 + ${K}`;

/** The visible part of the parabola, sampled finely. */
function parabolaPoints(a: number, h: number, k: number, r: Rect2D): V2[] {
  const pad = (r.x1 - r.x0) / 2;
  let lo = r.x0 - pad;
  let hi = r.x1 + pad;
  if (Math.abs(a) > 1e-6) {
    const bound = a > 0 ? r.y1 + pad - k : r.y0 - pad - k;
    const s = Math.sqrt(Math.max(0, bound / a));
    lo = Math.max(lo, h - s);
    hi = Math.min(hi, h + s);
  }
  return sample(quadVertex(a, h, k), lo, hi, 160);
}

/** ax² + bx + c written the way a person would: no 1x², no + 0x, no + −3. */
export function standardTex(a: number, b: number, c: number): string {
  const terms: [number, string][] = [
    [a, 'x^2'],
    [b, 'x'],
    [c, ''],
  ];
  let out = '';
  for (const [k, v] of terms) {
    const n = Number(k.toFixed(2));
    if (n === 0) continue;
    const mag = Math.abs(n) === 1 && v ? '' : fmtTex(Math.abs(n));
    out += out ? ` ${n < 0 ? '-' : '+'} ${mag}${v}` : `${n < 0 ? '-' : ''}${mag}${v}`;
  }
  return out || '0';
}

/** Vertex-form equation with live, coloured numbers. */
function eqTex(a: number, h: number, k: number): string {
  const aPart = a === 1 ? '' : a === -1 ? '-' : fmtTex(a);
  const inner = h === 0 ? 'x' : `(x ${h > 0 ? '-' : '+'} ${tc('a', fmtTex(Math.abs(h)))})`;
  const sq = `${tc('slope', aPart)}${inner}^2`;
  return k === 0 ? `y = ${sq}` : `y = ${sq} ${k < 0 ? '-' : '+'} ${tc('b', fmtTex(Math.abs(k)))}`;
}

function rootsText(roots: number[]): string {
  if (roots.length === 0) return 'No roots — the curve never touches the $x$-axis.';
  if (roots.length === 1) return `**1 root**: it just touches the $x$-axis at $x = ${fmtTex(roots[0] as number)}$.`;
  return `**2 roots**: it crosses the $x$-axis at $x = ${fmtTex(roots[0] as number)}$ and $x = ${fmtTex(roots[1] as number)}$.`;
}

class Parabola {
  a: number;
  h: number;
  k: number;
  readonly curve: Stroke;
  readonly axis: Stroke;
  readonly vertex: Dot;
  readonly vertexLabel: Label;
  readonly rootDots: Dot[];
  readonly rootLabels: Label[];
  /** Root markers react on their own (pop in / shrink away); when false they stay hidden. */
  reactiveRoots = true;
  private shown = [false, false];
  roots: number[] = [];

  constructor(
    private stage: Stage,
    a: number,
    h: number,
    k: number,
    opts: { roots?: boolean } = {},
    private rect: Rect2D = RECT,
  ) {
    this.reactiveRoots = opts.roots ?? true;
    this.a = a;
    this.h = h;
    this.k = k;
    const px = (n: number) => stage.px(n);
    this.axis = stage.add(new Stroke([], { color: C.muted, width: px(2), dash: [px(8), px(8)], opacity: 0.6, z: Z.line - 0.2 }));
    this.curve = stage.add(new Stroke([], { color: C.curve, width: px(5), z: Z.line }));
    this.vertex = stage.add(new Dot(C.ink, px(7)));
    this.vertexLabel = stage.labels.add({ text: '', anchor: 'below', className: 'tick big-tick' });
    this.rootDots = [0, 1].map(() => {
      const dot = stage.add(new Dot(C.root, px(9), Z.point + 0.1));
      dot.scale.setScalar(0);
      return dot;
    });
    this.rootLabels = [0, 1].map(() => {
      const l = stage.labels.add({ text: '', color: C.root, anchor: 'below', offset: [0, 16] });
      l.inner.style.opacity = '0';
      return l;
    });
    this.redraw();
  }

  get f() {
    return quadVertex(this.a, this.h, this.k);
  }

  set(a: number, h: number, k: number): void {
    this.a = a;
    this.h = h;
    this.k = k;
    this.redraw();
  }

  redraw(): void {
    const { a, h, k } = this;
    this.curve.setPoints(parabolaPoints(a, h, k, this.rect));
    this.axis.setPoints([
      { x: h, y: this.rect.y0 - 2 },
      { x: h, y: this.rect.y1 + 2 },
    ]);
    this.vertex.at({ x: h, y: k });
    this.vertexLabel.at({ x: h, y: k });
    this.vertexLabel.setText(`vertex (${fmt(h)}, ${fmt(k)})`);
    // Tiny values count as touching, so a vertex dragged onto the axis gives exactly one root.
    this.roots = vertexRoots(a, h, Math.abs(k) < 1e-9 ? 0 : k);
    this.roots.forEach((r, i) => {
      (this.rootDots[i] as Dot).at({ x: r, y: 0 });
      (this.rootLabels[i] as Label).at({ x: r, y: 0 }).setText(`x = ${fmt(r)}`);
    });
    if (this.reactiveRoots) this.reactRoots();
    else this.hideRoots();
  }

  private hideRoots(): void {
    for (let i = 0; i < 2; i++) {
      gsap.killTweensOf([(this.rootDots[i] as Dot).scale, (this.rootLabels[i] as Label).inner]);
      this.shown[i] = false;
      (this.rootDots[i] as Dot).scale.setScalar(0);
      (this.rootLabels[i] as Label).inner.style.opacity = '0';
    }
  }

  /** Scrub-safe switch: roots start reacting at `at` (and hide again if scrubbed back). */
  rootsOn(tl: Timeline, at?: gsap.Position): void {
    const flag = { v: 0 };
    tl.fromTo(
      flag,
      { v: 0 },
      {
        v: 1,
        duration: 0.01,
        immediateRender: false,
        onUpdate: () => {
          const on = flag.v > 0.5;
          if (on !== this.reactiveRoots) {
            this.reactiveRoots = on;
            this.redraw();
          }
        },
      },
      at,
    );
  }

  /** Pop root markers in when they appear and shrink them when they vanish. */
  private reactRoots(): void {
    for (let i = 0; i < 2; i++) {
      const want = i < this.roots.length;
      if (want === this.shown[i]) continue;
      this.shown[i] = want;
      const dot = this.rootDots[i] as Dot;
      const label = this.rootLabels[i] as Label;
      this.stage.to(dot.scale, {
        x: want ? 1 : 0,
        y: want ? 1 : 0,
        z: want ? 1 : 0,
        duration: d(want ? 0.45 : 0.25),
        ease: want ? EASE.appear : EASE.leave,
        overwrite: 'auto',
      });
      this.stage.to(label.inner, { opacity: want ? 1 : 0, scale: want ? 1 : 0.6, duration: d(0.3), overwrite: 'auto' });
    }
  }

  tweenTo(tl: Timeline, to: { a?: number; h?: number; k?: number }, at?: gsap.Position, dur: number = DUR.slow): void {
    tl.to(this, { ...to, duration: dur, ease: EASE.move, onUpdate: () => this.redraw() }, at);
  }

  hideAll(): void {
    this.curve.draw = 0;
    this.axis.draw = 0;
    shrunk(this.vertex);
    hiddenLabel(this.vertexLabel);
  }
}

/** A draggable vertex handle bound to a parabola. */
function vertexHandle(stage: Stage, p: Parabola, onChange?: () => void, limits = { x: 6, y: 6 }) {
  return stage.drag.add({
    name: 'Vertex of the parabola',
    at: { x: p.h, y: p.k },
    color: C.ink,
    radius: stage.px(10),
    constrain: (q) => new Vector3(clamp(snap(q.x, 0.5), -limits.x, limits.x), clamp(snap(q.y, 0.5), -limits.y + 1, limits.y), 0),
    onMove: (q) => {
      p.set(p.a, q.x, q.y);
      onChange?.();
    },
    describe: () => `vertex at ${fmt(p.h)}, ${fmt(p.k)}`,
  });
}

export const quadratics: LessonDef = {
  meta: {
    id: 'quadratics',
    title: 'Quadratics',
    blurb: 'Drag a parabola around and watch its roots pop in and out of existence.',
    accent: 'root',
  },
  view: { kind: '2d', rect: RECT },

  hook: {
    caption: 'Throw a ball and it flies along a curve called a parabola. Where does it land? Where does it cross the ground?',
    play(stage) {
      stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
      const p = new Parabola(stage, -0.5, -1, 6, { roots: false });
      p.hideAll();
      p.curve.draw = 1;
      p.curve.setPoints([]);
      const ball = stage.add(new Dot(C.b, stage.px(12), Z.handle));
      const start = -1 - Math.sqrt(12); // the ball starts and lands on the ground (the roots)
      const end = -1 + Math.sqrt(12);
      const throwState = { x: start };
      const f = quadVertex(-0.5, -1, 6);
      const recipe = stage.labels.add({ tex: VERTEX_FORM, at: { x: 0, y: 7 }, className: 'big-label' });
      hiddenLabel(recipe);
      const tl = stage.timeline();
      tl.fromTo(
        throwState,
        { x: start },
        {
          x: end,
          duration: 2.2,
          ease: 'none',
          onUpdate: () => {
            p.curve.setPoints(sample(f, start, throwState.x, 80));
            ball.at({ x: throwState.x, y: f(throwState.x) });
          },
        },
      );
      tl.to(ball.scale, { x: 1.6, y: 0.5, duration: 0.12, yoyo: true, repeat: 1 }, '>');
      tl.to(ball.material, { opacity: 0, duration: 0.3 }, '>');
      p.rootsOn(tl, '>');
      p.tweenTo(tl, { a: 0.6, h: 0, k: -3 }, '>', 1.2);
      p.tweenTo(tl, { k: 2 }, '>+0.4', 1);
      p.tweenTo(tl, { k: 0 }, '>+0.3', 0.8);
      popLabel(tl, recipe, '>+0.2');
      return tl;
    },
  },

  explore: {
    caption: `Drag the white **vertex** to move the curve, and use the slider to change its shape. Watch the red **roots** appear and disappear.`,
    setup(stage) {
      stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
      const p = new Parabola(stage, 1, 0, -3);
      const eq = stage.ui.readout('readout big');
      const std = stage.ui.readout('readout');
      const roots = stage.ui.readout('readout');
      const refresh = () => {
        eq.tex(eqTex(p.a, p.h, p.k));
        if (p.a === 0) std.set('With $a = 0$ there is no squared part, so it is just a flat line.');
        else {
          const s = vertexToStandard(p.a, p.h, p.k);
          std.set(`Multiplied out: $y = ${standardTex(s.a, s.b, s.c)}$`);
        }
        roots.set(rootsText(p.roots));
      };
      stage.ui.slider({
        label: `Shape $${A}$`,
        name: 'a, the stretch',
        min: -3,
        max: 3,
        step: 0.25,
        value: 1,
        color: C.slope,
        format: (v) => fmt(v),
        onInput: (v) => {
          // Glide to the new shape; text and roots follow along.
          stage.to(p, {
            a: v,
            duration: 0.3,
            ease: 'power2.out',
            overwrite: 'auto',
            onUpdate: () => {
              p.redraw();
              refresh();
            },
            onComplete: refresh,
          });
        },
      });
      vertexHandle(stage, p, refresh);
      refresh();
    },
  },

  explain: defineExplain({
    setup(stage) {
      stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
      const xs = [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5];
      const dots = xs.map((x) => {
        const dot = stage.add(new Dot(C.ink, stage.px(6)).at({ x, y: x * x }));
        dot.scale.setScalar(0);
        return dot;
      });
      const squares = [
        stage.labels.add({ text: '$(-2)^2 = 4$', at: { x: -2, y: 4 }, anchor: 'left' }),
        stage.labels.add({ text: '$2^2 = 4$', at: { x: 2, y: 4 }, anchor: 'right' }),
      ];
      hiddenLabel(...squares);
      // Roots stay hidden until the step about roots.
      const p = new Parabola(stage, 1, 0, 0, { roots: false });
      p.hideAll();
      const formula = stage.labels.add({ text: '', at: { x: 4.3, y: 6.5 }, className: 'big-label' });
      hiddenLabel(formula);
      return { dots, squares, p, formula };
    },
    steps: [
      {
        caption: 'Squaring a number always gives a positive answer: $(-2)^2 = 4$ and $2^2 = 4$. Here are the points of $y = x^2$.',
        eq: ['y', '=', 'x^2'],
        eqAt: 0,
        play(stage, { dots, squares }) {
          const tl = stage.timeline();
          pop(tl, dots, 0.2, 0.35);
          popLabel(tl, squares, '>');
          return tl;
        },
      },
      {
        caption: 'Join them with a smooth curve. This U shape is called a **parabola**. Its lowest point is the **vertex**.',
        play(stage, { p, dots, squares }) {
          const tl = stage.timeline();
          tl.to([squares[0]!.inner, squares[1]!.inner], { opacity: 0, duration: 0.3 }, 0);
          drawOn(tl, p.curve, 0.1, 1.2);
          tl.to(
            dots.map((x) => x.scale),
            { x: 0, y: 0, z: 0, duration: 0.3, stagger: 0.03 },
            '>',
          );
          pop(tl, p.vertex, '<');
          popLabel(tl, p.vertexLabel, '>');
          return tl;
        },
      },
      {
        caption: `Add ${'$' + K + '$'} and the whole curve moves **up or down**. The vertex goes to height ${'$' + K + '$'}.`,
        eq: ['y', '=', 'x^2', '+', K],
        eqAt: 0,
        play(stage, { p }) {
          const tl = stage.timeline();
          p.tweenTo(tl, { k: 3 }, 0.3);
          p.tweenTo(tl, { k: -2 }, '>+0.3');
          return tl;
        },
      },
      {
        caption: `Swap $x^2$ for $(x - ${H})^2$ and the curve slides **sideways**. Now the vertex is at $(${H}, ${K})$.`,
        eq: ['y', '=', `(x - ${H})^2`, '+', K],
        eqAt: 0,
        play(stage, { p }) {
          const tl = stage.timeline();
          drawOn(tl, p.axis, 0, 0.6);
          p.tweenTo(tl, { h: 2.5 }, 0.4);
          p.tweenTo(tl, { h: -1.5 }, '>+0.3');
          p.tweenTo(tl, { h: 1 }, '>+0.3');
          return tl;
        },
      },
      {
        caption: `The number ${'$' + A + '$'} in front **stretches** the curve. Big ${'$' + A + '$'}: narrow. Small ${'$' + A + '$'}: wide. Negative ${'$' + A + '$'}: upside down!`,
        eq: ['y', '=', A, `(x - ${H})^2`, '+', K],
        eqAt: 0,
        play(stage, { p }) {
          const tl = stage.timeline();
          p.tweenTo(tl, { a: 3 }, 0.4, 0.9);
          p.tweenTo(tl, { a: 0.3 }, '>+0.3', 0.9);
          p.tweenTo(tl, { a: -1 }, '>+0.3', 0.9);
          p.tweenTo(tl, { a: 1 }, '>+0.3', 0.9);
          return tl;
        },
      },
      {
        caption: 'The **roots** are where the curve crosses the $x$-axis. Watch: a parabola can have **2**, **1** or **0** roots.',
        eq: [`${A}(x - ${H})^2 + ${K}`, '=', '0'],
        eqAt: 0,
        play(stage, { p }) {
          const tl = stage.timeline();
          p.rootsOn(tl, 0);
          p.tweenTo(tl, { k: 0 }, 1);
          p.tweenTo(tl, { k: 2 }, '>+0.5');
          p.tweenTo(tl, { k: -2 }, '>+0.5');
          return tl;
        },
      },
      {
        caption: `To find the roots, set $y = 0$ and solve. Here $${A} = 1$, $${H} = 1$, $${K} = -2$, so $x = 1 \\pm \\sqrt{2}$.`,
        eq: ['x', '=', H, '\\pm', `\\sqrt{\\dfrac{-${K}}{${A}}}`],
        eqAt: 0,
        play(stage, { p, formula }) {
          formula.setTex(`x = 1 \\pm \\sqrt{2} \\approx ${tc('root', '-0.41')},\\ ${tc('root', '2.41')}`);
          const tl = stage.timeline();
          popLabel(tl, formula, 0.6);
          tl.to(
            p.rootDots.map((r) => r.scale),
            { x: 1.5, y: 1.5, duration: 0.25, yoyo: true, repeat: 1, stagger: 0.15 },
            '>',
          );
          return tl;
        },
      },
    ],
  }),

  practice: [
    {
      prompt: 'Drag the vertex to the point $(2, -1)$.',
      input: { kind: 'drag' },
      hint: 'The first number is how far across (2 to the right). The second is how far up — here it is $-1$, so one step **below** the $x$-axis.',
      explain: 'The vertex is at $(2, -1)$, so the curve is $y = (x - 2)^2 - 1$.',
      setup(stage) {
        stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
        const p = new Parabola(stage, 1, -2, 2);
        vertexHandle(stage, p);
        const target = stage.add(new Dot(C.angle, stage.px(14), Z.fill).at({ x: 2, y: -1 }));
        target.material.opacity = 0;
        return {
          check: () => p.h === 2 && p.k === -1,
          hint() {
            const tl = stage.timeline();
            tl.fromTo(target.material, { opacity: 0 }, { opacity: 0.5, duration: 0.35, yoyo: true, repeat: 3 }, 0);
            return tl;
          },
        };
      },
    },
    {
      prompt: 'How many roots does $y = (x - 1)^2 + 3$ have?',
      input: { kind: 'choice', options: ['$0$', '$1$', '$2$'], answer: 0 },
      hint: 'Look at the vertex: where is it compared with the $x$-axis? Which way does the U open?',
      explain: 'The vertex $(1, 3)$ is above the axis and the U opens upwards, so it never touches the $x$-axis.',
      setup(stage) {
        stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
        const p = new Parabola(stage, 1, 1, 3);
        return {
          hint() {
            const tl = stage.timeline();
            pop(tl, p.vertex, 0, 0.3);
            popLabel(tl, p.vertexLabel, 0);
            flash(tl, p.curve, '>', 0.3);
            return tl;
          },
        };
      },
    },
    {
      prompt: 'Move the curve so that it has **exactly one** root.',
      input: { kind: 'drag' },
      hint: 'One root means the curve just **touches** the $x$-axis without crossing it. Where must the vertex be for that?',
      explain: 'With the vertex sitting on the $x$-axis, the curve touches it at exactly one point.',
      setup(stage) {
        stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
        const p = new Parabola(stage, 1, -2, 3);
        vertexHandle(stage, p);
        const ghost = stage.add(
          new Stroke(parabolaPoints(1, -2, 0, RECT), { color: C.ink, width: stage.px(3), dash: [stage.px(10), stage.px(8)], opacity: 0 }),
        );
        return {
          check: () => p.roots.length === 1,
          hint() {
            const tl = stage.timeline();
            tl.fromTo(ghost, { opacity: 0 }, { opacity: 0.6, duration: 0.4 }, 0);
            tl.to(ghost, { opacity: 0, duration: 0.4 }, '>+1.2');
            return tl;
          },
        };
      },
    },
    {
      prompt: 'What are the roots of $y = (x - 1)^2 - 4$?',
      input: {
        kind: 'choice',
        options: ['$x = -1$ and $x = 3$', '$x = 1$ and $x = -4$', '$x = -3$ and $x = 1$', '$x = 2$ and $x = -2$'],
        answer: 0,
      },
      hint: 'Roots are where the curve crosses the $x$-axis. Read them off the graph, or solve $(x - 1)^2 = 4$, so $x - 1 = \\pm 2$.',
      explain: '$x - 1 = 2$ gives $x = 3$, and $x - 1 = -2$ gives $x = -1$.',
      setup(stage) {
        stage.axes(RECT, { labelEvery: 1, majorEvery: 2, xName: '$x$', yName: '$y$' });
        const p = new Parabola(stage, 1, 1, -4);
        p.rootLabels.forEach((l) => (l.el.hidden = true));
        return {
          hint() {
            const tl = stage.timeline();
            tl.to(
              p.rootDots.map((r) => r.scale),
              { x: 1.7, y: 1.7, duration: 0.3, yoyo: true, repeat: 3, stagger: 0.2 },
              0,
            );
            return tl;
          },
        };
      },
    },
    {
      prompt: 'The vertex is at $(0, 2)$. Use the slider to set $a$ so that the curve passes through the yellow point $(1, 0)$.',
      input: { kind: 'slider', label: `Shape $${A}$`, name: 'a, the stretch', min: -3, max: 3, step: 0.5, value: 1, color: C.slope, format: (v) => fmt(v) },
      hint: 'The curve must come **down** from the vertex to reach the point, so $a$ must be negative. Try: $y = a \\times 1^2 + 2$ must equal $0$.',
      explain: '$a \\times 1^2 + 2 = 0$ gives $a = -2$.',
      setup(stage) {
        stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
        const p = new Parabola(stage, 1, 0, 2);
        stage.add(new Dot(C.angle, stage.px(10), Z.handle).at({ x: 1, y: 0 }));
        stage.labels.add({ text: '$(1, 0)$', at: { x: 1, y: 0 }, anchor: 'right', color: C.angle });
        return {
          onInput: (v) => p.set(v, 0, 2),
          check: (v) => v === -2,
          hint() {
            const tl = stage.timeline();
            flash(tl, p.curve, 0, 0.3);
            return tl;
          },
        };
      },
    },
  ],

  recap: {
    points: [
      'A quadratic makes a U-shaped curve called a **parabola**.',
      `In $${VERTEX_FORM}$ the **vertex** (the turning point) is at $(${H}, ${K})$.`,
      `$${A}$ stretches the curve. A negative $${A}$ flips it upside down.`,
      'The **roots** are where $y = 0$: where the curve meets the $x$-axis. There can be 2, 1 or 0.',
    ],
    eq: VERTEX_FORM,
    play(stage) {
      stage.axes(RECT, { labelEvery: 2, majorEvery: 2, xName: '$x$', yName: '$y$' });
      const p = new Parabola(stage, 1, 0, 3);
      p.hideAll();
      const tl = stage.timeline();
      drawOn(tl, p.curve, 0, 0.9);
      pop(tl, p.vertex, '>-0.2');
      p.tweenTo(tl, { k: -3 }, '>+0.2');
      p.tweenTo(tl, { h: 2 }, '>+0.1');
      p.tweenTo(tl, { a: -0.5, k: 4 }, '>+0.1');
      return tl;
    },
  },

  dispose() {
    /* no module-level state */
  },
};
