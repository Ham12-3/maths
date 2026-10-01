/**
 * Lesson 1 — Pythagoras' theorem.
 * Squares grow off each side of a right triangle; the two small squares break into unit
 * tiles that fly over and exactly fill the big one.
 */
import { Mesh, PlaneGeometry, Vector3 } from 'three';
import { C, tc } from '../core/colors';
import { drawOn, fadeIn, flash, hiddenLabel, popLabel, pulse, thicken } from '../core/anim';
import { Fill, Stroke, Z, basicMaterial, rightAnglePoints } from '../core/draw';
import type { Label } from '../core/labels';
import { defineExplain, type LessonDef, type Timeline } from '../core/lesson-types';
import { DUR, EASE } from '../core/motion';
import type { Rect2D } from '../core/scene-manager';
import type { Stage } from '../core/stage';
import { clamp, fmt, fmtTex, hypotenuse, snap } from '../math/geometry';
import type { V2 } from '../math/vec';

type Side = 'a' | 'b' | 'c';
const SIDES: Side[] = ['a', 'b', 'c'];

const A = tc('a', 'a');
const B = tc('b', 'b');
const Cc = tc('c', 'c');
const A2 = tc('a', 'a^2');
const B2 = tc('b', 'b^2');
const C2 = tc('c', 'c^2');

/** Everything the figure covers, with some breathing room. */
function fitRect(a: number, b: number, squares = true, pad = 1.2): Rect2D {
  const r = squares ? { x0: -b, x1: a + b, y0: -a, y1: a + b } : { x0: 0, x1: a, y0: 0, y1: b };
  const p = pad + 0.08 * Math.max(r.x1 - r.x0, r.y1 - r.y0);
  return { x0: r.x0 - p, x1: r.x1 + p, y0: r.y0 - p, y1: r.y1 + p };
}

/** A right triangle (right angle at the origin) with optional squares on each side. */
class Figure {
  a: number;
  b: number;
  readonly grow: Record<Side, number> = { a: 1, b: 1, c: 1 };
  readonly tri: Fill;
  readonly edge: Record<Side, Stroke>;
  readonly mark: Stroke;
  readonly sq: Record<Side, Fill>;
  readonly sqLine: Record<Side, Stroke>;
  readonly side: Record<Side, Label>;
  readonly area: Record<Side, Label>;

  constructor(
    private stage: Stage,
    a: number,
    b: number,
    private squares = true,
  ) {
    this.a = a;
    this.b = b;
    const px = (n: number) => stage.px(n);
    this.tri = stage.add(new Fill(C.ink, 0.06, Z.fill));
    this.sq = {} as Record<Side, Fill>;
    this.sqLine = {} as Record<Side, Stroke>;
    this.edge = {} as Record<Side, Stroke>;
    this.side = {} as Record<Side, Label>;
    this.area = {} as Record<Side, Label>;
    for (const s of SIDES) {
      if (squares) {
        this.sq[s] = stage.add(new Fill(C[s], 0.26, Z.fill - 0.1));
        this.sqLine[s] = stage.add(new Stroke([], { color: C[s], width: px(2.5), closed: true, z: Z.line - 0.1 }));
        this.area[s] = stage.labels.add({ text: '', color: C[s], className: 'area-label' });
      }
      this.edge[s] = stage.add(new Stroke([], { color: C[s], width: px(6), z: Z.line }));
      const anchor = s === 'a' ? 'above' : s === 'b' ? 'right' : 'center';
      this.side[s] = stage.labels.add({ text: s, color: C[s], className: 'side-label', anchor });
    }
    this.mark = stage.add(new Stroke([], { color: C.ink, width: px(2.5), z: Z.line, opacity: 0.8 }));
    this.redraw();
  }

  get c(): number {
    return hypotenuse(this.a, this.b);
  }

  set(a: number, b: number): void {
    this.a = a;
    this.b = b;
    this.redraw();
  }

  /** Corner points: right angle O, end of side a (X) and end of side b (Y). */
  corners(): { O: V2; X: V2; Y: V2 } {
    return { O: { x: 0, y: 0 }, X: { x: this.a, y: 0 }, Y: { x: 0, y: this.b } };
  }

  /** The four corners of the square on a side (scaled outwards by its grow factor). */
  squarePts(s: Side, g = this.grow[s]): V2[] {
    const { O, X, Y } = this.corners();
    const { a, b } = this;
    if (s === 'a') return [O, X, { x: a, y: -a * g }, { x: 0, y: -a * g }];
    if (s === 'b') return [Y, O, { x: -b * g, y: 0 }, { x: -b * g, y: b }];
    return [X, Y, { x: b * g, y: b + a * g }, { x: a + b * g, y: a * g }];
  }

  centre(s: Side): V2 {
    const p = this.squarePts(s, 1);
    return { x: p.reduce((t, q) => t + q.x, 0) / 4, y: p.reduce((t, q) => t + q.y, 0) / 4 };
  }

  redraw(): void {
    const { O, X, Y } = this.corners();
    this.tri.setConvex([O, X, Y]);
    this.edge.a.setPoints([O, X]);
    this.edge.b.setPoints([O, Y]);
    this.edge.c.setPoints([X, Y]);
    const size = Math.min(0.45, Math.min(this.a, this.b) * 0.18);
    const m = rightAnglePoints(O, { x: 1, y: 0 }, { x: 0, y: 1 }, size);
    this.mark.setPoints(m);
    this.side.a.at({ x: this.a / 2, y: 0 });
    this.side.b.at({ x: 0, y: this.b / 2 });
    const c = this.c;
    const off = this.stage.px(26); // just outside the hypotenuse
    this.side.c.at({ x: this.a / 2 + (this.b / c) * off, y: this.b / 2 + (this.a / c) * off });
    if (!this.squares) return;
    for (const s of SIDES) {
      const pts = this.squarePts(s);
      this.sq[s].setConvex(pts);
      this.sqLine[s].setPoints(pts);
      this.sqLine[s].visible = this.grow[s] > 0.01;
      this.area[s].at(this.centre(s));
    }
  }

  /** Tween a square growing outwards from its side. */
  growSquare(tl: Timeline, s: Side, at?: gsap.Position, dur: number = DUR.slow): void {
    tl.fromTo(this.grow, { [s]: 0 }, { [s]: 1, duration: dur, ease: EASE.move, onUpdate: () => this.redraw() }, at);
  }

  hideAll(): void {
    for (const s of SIDES) {
      this.grow[s] = 0;
      this.edge[s].draw = 0;
      hiddenLabel(this.side[s]);
      if (this.squares) hiddenLabel(this.area[s]);
    }
    this.tri.opacity = 0;
    this.mark.draw = 0;
    this.redraw();
  }

  setSideText(mode: 'names' | 'values' | 'both'): void {
    for (const s of SIDES) {
      const v = s === 'a' ? this.a : s === 'b' ? this.b : this.c;
      const val = s === 'c' && !Number.isInteger(Number(v.toFixed(6))) ? `≈ ${fmt(v)}` : `= ${fmt(v)}`;
      this.side[s].setText(mode === 'names' ? `$${s}$` : mode === 'values' ? fmt(v) : `$${s}$ ${val}`);
    }
  }

  setAreaText(withNames: boolean): void {
    if (!this.squares) return;
    for (const s of SIDES) {
      const v = s === 'a' ? this.a : s === 'b' ? this.b : this.c;
      const area = fmt(v * v);
      this.area[s].setText(withNames ? `$${s}^2$ = ${area}` : area);
    }
  }
}

/** Unit tiles for an integer triangle, ready to fly from the small squares into the big one. */
function makeTiles(stage: Stage, fig: Figure) {
  const { a, b } = fig;
  const c = Math.round(fig.c);
  const { X, Y } = fig.corners();
  const u = { x: (Y.x - X.x) / c, y: (Y.y - X.y) / c };
  const v = { x: b / c, y: a / c };
  const angle = Math.atan2(u.y, u.x) % (Math.PI / 2);
  const geo = new PlaneGeometry(0.9, 0.9);
  const make = (color: string, x: number, y: number) => {
    const m = new Mesh(geo, basicMaterial(color, 0.85));
    m.position.set(x, y, Z.shape);
    return stage.add(m);
  };
  const aTiles: Mesh[] = [];
  const bTiles: Mesh[] = [];
  for (let j = 0; j < a; j++) for (let i = 0; i < a; i++) aTiles.push(make(C.a, i + 0.5, -(j + 0.5)));
  for (let j = 0; j < b; j++) for (let i = 0; i < b; i++) bTiles.push(make(C.b, -(i + 0.5), j + 0.5));
  // Slots in the c-square: a-tiles take an a×a corner block, b-tiles fill the rest.
  const slot = (i: number, j: number) => new Vector3(X.x + (i + 0.5) * u.x + (j + 0.5) * v.x, X.y + (i + 0.5) * u.y + (j + 0.5) * v.y, Z.shape);
  const aSlots: Vector3[] = [];
  const bSlots: Vector3[] = [];
  for (let j = 0; j < c; j++)
    for (let i = 0; i < c; i++) (i < a && j < a ? aSlots : bSlots).push(slot(i, j));

  const all = [...aTiles, ...bTiles];
  return {
    aTiles,
    bTiles,
    all,
    hide() {
      for (const t of all) t.scale.setScalar(0);
    },
    /** Tiles appear inside their own square, one by one. */
    appear(tl: Timeline, which: 'a' | 'b', at?: gsap.Position) {
      const ts = which === 'a' ? aTiles : bTiles;
      tl.fromTo(
        ts.map((t) => t.scale),
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1, duration: 0.35, ease: EASE.appear, stagger: which === 'a' ? 0.07 : 0.045 },
        at,
      );
    },
    /** Fly one colour of tiles into its slots in the big square. */
    fly(tl: Timeline, which: 'a' | 'b', at?: gsap.Position) {
      const ts = which === 'a' ? aTiles : bTiles;
      const slots = which === 'a' ? aSlots : bSlots;
      const st = which === 'a' ? 0.07 : 0.045;
      tl.to(
        ts.map((t) => t.position),
        { x: (i: number) => slots[i]!.x, y: (i: number) => slots[i]!.y, duration: 1, ease: EASE.move, stagger: st },
        at,
      );
      tl.to(ts.map((t) => t.rotation), { z: angle, duration: 1, ease: EASE.move, stagger: st }, '<');
      tl.to(ts.map((t) => t.scale), { x: 1.12, y: 1.12, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1, stagger: st }, '<');
    },
  };
}

// ------------------------------------------------------------------ lesson

const HOOK_RECT: Rect2D = { x0: -5.2, x1: 8.2, y0: -4.2, y1: 9 };

/** Shared hook/recap animation: build the figure, then the tiles prove it. */
function proofAnimation(stage: Stage, withLabels: boolean): Timeline {
  const fig = new Figure(stage, 3, 4);
  fig.hideAll();
  fig.setSideText('names');
  fig.setAreaText(false);
  const tiles = makeTiles(stage, fig);
  tiles.hide();
  const sum = stage.labels.add({
    tex: `${tc('a', '9')} + ${tc('b', '16')} = ${tc('c', '25')}`,
    at: { x: 1.5, y: 7.4 },
    anchor: 'above',
    className: 'big-label',
  });
  hiddenLabel(sum);

  const tl = stage.timeline();
  drawOn(tl, [fig.edge.a, fig.edge.b, fig.edge.c], 0, 0.7);
  fadeIn(tl, fig.tri, 0.3, 0.06);
  tl.fromTo(fig.mark, { draw: 0 }, { draw: 1, duration: 0.4 }, '>-0.1');
  if (withLabels) popLabel(tl, [fig.side.a, fig.side.b, fig.side.c], '<');
  fig.growSquare(tl, 'a', '>+0.1', 0.7);
  fig.growSquare(tl, 'b', '>-0.25', 0.7);
  fig.growSquare(tl, 'c', '>-0.25', 0.8);
  popLabel(tl, [fig.area.a, fig.area.b, fig.area.c], '>');
  tiles.appear(tl, 'a', '>+0.2');
  tiles.appear(tl, 'b', '<+0.3');
  tl.to([fig.sq.a, fig.sq.b], { opacity: 0.06, duration: 0.4 }, '>');
  tl.to([fig.area.a.inner, fig.area.b.inner], { opacity: 0, duration: 0.3 }, '<');
  tiles.fly(tl, 'a', '>');
  tiles.fly(tl, 'b', '>-0.2');
  popLabel(tl, sum, '>-0.1');
  pulse(tl, sum.inner, '>');
  return tl;
}

export const pythagoras: LessonDef = {
  meta: {
    id: 'pythagoras',
    title: 'Pythagoras',
    blurb: 'Watch two squares break apart and exactly fill a bigger one.',
    accent: 'c',
  },
  view: { kind: '2d', rect: HOOK_RECT },

  hook: {
    caption: 'Two small squares… one big square. Watch what happens to the little tiles.',
    play: (stage) => proofAnimation(stage, false),
  },

  explore: {
    caption: `Drag the two glowing corners to change sides ${'$a$'} and ${'$b$'}. Watch the three squares — the two small areas always add up to the big one.`,
    view: { kind: '2d', rect: fitRect(3, 4) },
    setup(stage) {
      const fig = new Figure(stage, 3, 4);
      const eq = stage.ui.readout('readout big');
      const c = stage.ui.readout('readout');
      stage.ui.note('Challenge: find another pair of sides where $c$ comes out as a whole number.');
      const refresh = () => {
        fig.setSideText('both');
        fig.setAreaText(true);
        const { a, b } = fig;
        const cc = fig.c;
        eq.tex(
          `${tc('a', fmtTex(a))}^2 + ${tc('b', fmtTex(b))}^2 = ${tc('a', fmtTex(a * a))} + ${tc('b', fmtTex(b * b))} = ${tc('c', fmtTex(a * a + b * b))}`,
        );
        const whole = Math.abs(cc - Math.round(cc)) < 1e-9;
        c.set(`So $${Cc} = \\sqrt{${fmtTex(a * a + b * b)}}$ ${whole ? '=' : '≈'} **${fmt(cc)}**${whole ? ' — a whole number!' : ''}`);
      };
      const reframe = () => {
        const from = stage.sm.view2D;
        const to = fitRect(fig.a, fig.b);
        stage.to(from, { ...to, duration: 0.6, ease: EASE.move, onUpdate: () => stage.sm.setRect(from) });
      };
      const sideConstrain = (axis: 'x' | 'y') => (p: Vector3) => {
        const v = clamp(snap(axis === 'x' ? p.x : p.y, 0.5), 1, 5);
        return axis === 'x' ? new Vector3(v, 0, 0) : new Vector3(0, v, 0);
      };
      stage.drag.add({
        name: 'Corner at the end of side a',
        at: { x: fig.a, y: 0 },
        color: C.a,
        radius: stage.px(9),
        constrain: sideConstrain('x'),
        onMove: (p) => {
          fig.set(p.x, fig.b);
          refresh();
        },
        onEnd: reframe,
        describe: () => `a = ${fmt(fig.a)}`,
      });
      stage.drag.add({
        name: 'Corner at the top of side b',
        at: { x: 0, y: fig.b },
        color: C.b,
        radius: stage.px(9),
        constrain: sideConstrain('y'),
        onMove: (p) => {
          fig.set(fig.a, p.y);
          refresh();
        },
        onEnd: reframe,
        describe: () => `b = ${fmt(fig.b)}`,
      });
      refresh();
    },
  },

  explain: defineExplain({
    view: { kind: '2d', rect: HOOK_RECT },
    setup(stage) {
      const fig = new Figure(stage, 3, 4);
      fig.hideAll();
      fig.setSideText('names');
      fig.setAreaText(false);
      const tiles = makeTiles(stage, fig);
      tiles.hide();
      const slots: Stroke[] = [];
      // Faint 5×5 grid inside the big square so learners can count its area too.
      const { X, Y } = fig.corners();
      const u = { x: (Y.x - X.x) / 5, y: (Y.y - X.y) / 5 };
      const v = { x: 4 / 5, y: 3 / 5 };
      for (let k = 1; k < 5; k++) {
        const p0 = { x: X.x + k * u.x, y: X.y + k * u.y };
        const q0 = { x: X.x + k * v.x, y: X.y + k * v.y };
        slots.push(new Stroke([p0, { x: p0.x + 5 * v.x, y: p0.y + 5 * v.y }], { color: C.c, width: stage.px(1.5), opacity: 0.5 }));
        slots.push(new Stroke([q0, { x: q0.x + 5 * u.x, y: q0.y + 5 * u.y }], { color: C.c, width: stage.px(1.5), opacity: 0.5 }));
      }
      slots.forEach((s) => {
        s.draw = 0;
        stage.add(s);
      });
      const sum = stage.labels.add({
        tex: `${tc('a', '9')} + ${tc('b', '16')} = ${tc('c', '25')}`,
        at: { x: 4, y: 7 },
        anchor: 'above',
        className: 'big-label',
      });
      const formula = stage.labels.add({
        tex: `${Cc} = \\sqrt{${tc('a', '3')}^2 + ${tc('b', '4')}^2} = \\sqrt{25} = ${tc('c', '5')}`,
        at: { x: -2.2, y: 7.6 },
        className: 'big-label',
      });
      hiddenLabel(sum, formula);
      return { fig, tiles, slots, sum, formula };
    },
    steps: [
      {
        caption: 'This is a **right-angled triangle**. One corner is a perfect square corner, called the **right angle**.',
        play(stage, { fig }) {
          const tl = stage.timeline();
          drawOn(tl, [fig.edge.a, fig.edge.b, fig.edge.c], 0, 0.8);
          fadeIn(tl, fig.tri, 0.4, 0.06);
          tl.fromTo(fig.mark, { draw: 0 }, { draw: 1, duration: 0.5, ease: EASE.draw }, '>');
          tl.fromTo(fig.mark, { opacity: 0.8 }, { opacity: 1, duration: 0.25, yoyo: true, repeat: 3 }, '>');
          return tl;
        },
      },
      {
        caption: `The two shorter sides are called ${'$' + A + '$'} and ${'$' + B + '$'}. The longest side, opposite the right angle, is ${'$' + Cc + '$'}. It's called the **hypotenuse**.`,
        play(stage, { fig }) {
          const tl = stage.timeline();
          popLabel(tl, fig.side.a, 0);
          thicken(tl, fig.edge.a, '<');
          popLabel(tl, fig.side.b, '>+0.2');
          thicken(tl, fig.edge.b, '<');
          popLabel(tl, fig.side.c, '>+0.3');
          thicken(tl, fig.edge.c, '<');
          return tl;
        },
      },
      {
        caption: `Build a square on side ${'$' + A + '$'}. Its area is ${'$' + A + '\\times' + A + '$'}, written ${'$' + A2 + '$'}. Here ${'$' + A + '= 3$'}, so it holds **9** little tiles.`,
        eq: [A2],
        play(stage, { fig, tiles }) {
          fig.setAreaText(false);
          const tl = stage.timeline();
          fig.growSquare(tl, 'a', 0);
          tiles.appear(tl, 'a', '>');
          popLabel(tl, fig.area.a, '>');
          return tl;
        },
      },
      {
        caption: `Do the same on side ${'$' + B + '$'}: ${'$' + B2 + '= 4 \\times 4 = 16$'} tiles.`,
        eq: [A2, '+', B2],
        play(stage, { fig, tiles }) {
          const tl = stage.timeline();
          fig.growSquare(tl, 'b', 0);
          tiles.appear(tl, 'b', '>');
          popLabel(tl, fig.area.b, '>');
          return tl;
        },
      },
      {
        caption: `And on the hypotenuse ${'$' + Cc + '$'}: ${'$' + C2 + '= 5 \\times 5 = 25$'}. Hmm… is ${'$9 + 16$'} the same as ${'$25$'}?`,
        eq: [A2, '+', B2, '\\overset{?}{=}', C2],
        play(stage, { fig, slots }) {
          const tl = stage.timeline();
          fig.growSquare(tl, 'c', 0);
          drawOn(tl, slots, '>-0.2', 0.4);
          popLabel(tl, fig.area.c, '>');
          return tl;
        },
      },
      {
        caption: 'Break the two small squares into tiles and slide them across. They fill the big square **exactly** — no gaps, nothing left over!',
        eq: [A2, '+', B2, '=', C2],
        play(stage, { fig, tiles, sum }) {
          const tl = stage.timeline();
          tl.to([fig.sq.a, fig.sq.b], { opacity: 0.06, duration: 0.4 }, 0);
          tl.to([fig.area.a.inner, fig.area.b.inner, fig.area.c.inner], { opacity: 0, duration: 0.3 }, 0);
          tiles.fly(tl, 'a', '>');
          tiles.fly(tl, 'b', '>-0.2');
          popLabel(tl, sum, '>');
          return tl;
        },
      },
      {
        caption: `This works for **every** right-angled triangle. So if you know ${'$' + A + '$'} and ${'$' + B + '$'}, you can always find the hypotenuse.`,
        eq: [Cc, '=', `\\sqrt{${A2} + ${B2}}`],
        eqAt: 0.2,
        play(stage, { formula, sum, fig }) {
          const tl = stage.timeline();
          tl.to(sum.inner, { opacity: 0, duration: 0.3 }, 0);
          popLabel(tl, formula, 0.4);
          thicken(tl, fig.edge.c, '>');
          return tl;
        },
      },
    ],
  }),

  practice: [
    {
      prompt: `A right-angled triangle has short sides ${'$' + A + ' = 6$'} and ${'$' + B + ' = 8$'}. How long is the hypotenuse ${'$' + Cc + '$'}?`,
      input: { kind: 'choice', options: ['$10$', '$14$', '$48$', '$100$'], answer: 0 },
      hint: 'Square the short sides and add them: $6^2 + 8^2 = 36 + 64$. Then take the square root of the answer.',
      explain: '$\\sqrt{36 + 64} = \\sqrt{100} = 10$.',
      view: { kind: '2d', rect: fitRect(6, 8) },
      setup(stage) {
        const fig = new Figure(stage, 6, 8);
        fig.setSideText('values');
        fig.side.c.setText('?');
        fig.setAreaText(false);
        hiddenLabel(fig.area.a, fig.area.b, fig.area.c);
        return {
          hint() {
            fig.area.c.setText('36 + 64 = ?');
            const tl = stage.timeline();
            flash(tl, [fig.sq.a, fig.sq.b], 0, 0.08);
            popLabel(tl, fig.area.a, 0);
            popLabel(tl, fig.area.b, '>+0.2');
            popLabel(tl, fig.area.c, '>+0.4');
            return tl;
          },
          success() {
            fig.side.c.setText('10');
            fig.area.c.setText('100');
            const tl = stage.timeline();
            popLabel(tl, [fig.area.a, fig.area.b, fig.area.c, fig.side.c], 0);
            return tl;
          },
        };
      },
    },
    {
      prompt: `Side ${'$' + A + '$'} is fixed at 3. Drag the top corner until the hypotenuse is exactly ${'$' + Cc + ' = 5$'}.`,
      input: { kind: 'drag' },
      hint: '$c^2 = 25$ and $a^2 = 9$, so $b^2$ must be $25 - 9 = 16$. Which number times itself makes 16?',
      explain: '$b = 4$, because $3^2 + 4^2 = 9 + 16 = 25 = 5^2$.',
      view: { kind: '2d', rect: fitRect(3, 6) },
      setup(stage) {
        const fig = new Figure(stage, 3, 2);
        const refresh = () => {
          fig.setSideText('both');
          fig.setAreaText(true);
        };
        refresh();
        stage.drag.add({
          name: 'Top corner of side b',
          at: { x: 0, y: 2 },
          color: C.b,
          radius: stage.px(9),
          constrain: (p) => new Vector3(0, clamp(snap(p.y, 0.5), 1, 6), 0),
          onMove: (p) => {
            fig.set(3, p.y);
            refresh();
          },
          describe: () => `b = ${fmt(fig.b)}, c is about ${fmt(fig.c)}`,
        });
        return {
          check: () => Math.abs(fig.b - 4) < 1e-6,
          hint() {
            const tl = stage.timeline();
            flash(tl, fig.sq.c, 0, 0.08);
            pulse(tl, fig.area.c.inner, 0);
            pulse(tl, fig.area.a.inner, '>');
            return tl;
          },
        };
      },
    },
    {
      prompt: `Here ${'$' + B + ' = 12$'}. Use the slider to choose ${'$' + A + '$'} so that the hypotenuse is exactly ${'$' + Cc + ' = 13$'}.`,
      input: { kind: 'slider', label: `Side $${A}$`, name: 'side a', min: 1, max: 12, step: 1, value: 2, color: C.a },
      hint: 'Work backwards: $a^2 = c^2 - b^2 = 13^2 - 12^2 = 169 - 144$. What number squared gives that?',
      explain: '$a = 5$, since $5^2 + 12^2 = 25 + 144 = 169 = 13^2$.',
      view: { kind: '2d', rect: fitRect(12, 12, false) },
      setup(stage) {
        const fig = new Figure(stage, 2, 12, false);
        stage.labels.add({ text: 'Target: $c = 13$', at: { x: 9, y: 11.5 }, className: 'big-label' });
        return {
          onInput(v) {
            fig.set(v, 12);
            fig.setSideText('both');
          },
          check: (v) => v === 5,
          hint() {
            const tl = stage.timeline();
            flash(tl, fig.edge.c, 0, 0.3);
            pulse(tl, fig.side.c.inner, 0);
            return tl;
          },
        };
      },
    },
    {
      prompt: 'Which set of side lengths makes a right-angled triangle?',
      input: { kind: 'choice', options: ['$4,\\ 5,\\ 6$', '$3,\\ 4,\\ 5$', '$2,\\ 3,\\ 4$', '$5,\\ 6,\\ 7$'], answer: 1 },
      hint: 'Square the two smaller numbers and add them. Does that equal the biggest number squared? For example $4^2 + 5^2 = 41$, but $6^2 = 36$, so not that one.',
      explain: '$3^2 + 4^2 = 9 + 16 = 25 = 5^2$. The squares match, so it has a right angle.',
      setup(stage) {
        const fig = new Figure(stage, 3, 4);
        fig.setSideText('names');
        fig.setAreaText(true);
        for (const s of SIDES) fig.area[s].setText(`$${s}^2$`);
        return {
          hint() {
            const tl = stage.timeline();
            for (const s of SIDES) tl.fromTo(fig.grow, { [s]: 0 }, { [s]: 1, duration: 0.6, ease: EASE.move, onUpdate: () => fig.redraw() }, s === 'a' ? 0 : '>-0.2');
            return tl;
          },
        };
      },
    },
  ],

  recap: {
    points: [
      'A **right-angled triangle** has one square corner. The longest side, opposite it, is the **hypotenuse**.',
      'The squares on the two short sides always add up to the square on the hypotenuse.',
      `To find the hypotenuse: $${Cc} = \\sqrt{${A2} + ${B2}}$.`,
      `To find a short side: $${A} = \\sqrt{${C2} - ${B2}}$.`,
    ],
    eq: `${A2} + ${B2} = ${C2}`,
    play: (stage) => proofAnimation(stage, true).timeScale(1.4),
  },

  dispose() {
    /* no module-level state */
  },
};
