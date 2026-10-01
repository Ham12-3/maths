/**
 * Lesson 5 — Vectors in 3D.
 * Draggable arrows in 3D space; vector addition shown tip-to-tail, then as a parallelogram.
 * Uses the perspective camera with orbit controls.
 */
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  GridHelper,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import { C, tc } from '../core/colors';
import { hiddenLabel, popLabel } from '../core/anim';
import { Arrow3D, sphere } from '../core/draw';
import type { Label } from '../core/labels';
import { defineExplain, type LessonDef, type Timeline } from '../core/lesson-types';
import { DUR, EASE } from '../core/motion';
import type { View3D } from '../core/scene-manager';
import type { Stage } from '../core/stage';
import { clamp, fmt, fmtTex, snap } from '../math/geometry';
import { len3, type V3 } from '../math/vec';

const VIEW: View3D = { kind: '3d', position: [4.9, 5.4, 10.2], target: [1, 1.3, 0.6] };
const HOOK_VIEW: View3D = { ...VIEW, orbit: false };
const U = `${tc('a', '\\vec{u}')}`;
const Vv = `${tc('b', '\\vec{v}')}`;
const SUM = `${tc('c', '\\vec{u} + \\vec{v}')}`;

const col = (v: V3, role?: 'a' | 'b' | 'c'): string => {
  const body = `\\begin{pmatrix} ${fmtTex(v.x)} \\\\ ${fmtTex(v.y)} \\\\ ${fmtTex(v.z)} \\end{pmatrix}`;
  return role ? tc(role, body) : body;
};
const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Grid on the floor, three axes and their names. */
function space(stage: Stage) {
  const grid = new GridHelper(10, 10, C.gridMajor, C.grid);
  stage.add(grid);
  const axisColor = C.axis;
  for (const [dir, name] of [
    [v3(1, 0, 0), 'x'],
    [v3(0, 1, 0), 'y'],
    [v3(0, 0, 1), 'z'],
  ] as const) {
    const a = new Arrow3D(axisColor, 0.025).set(dir.clone().multiplyScalar(-4.5), dir.clone().multiplyScalar(4.8));
    stage.add(a);
    stage.labels.add({ text: `$${name}$`, at: dir.clone().multiplyScalar(5.2), className: 'axis-name' });
  }
  stage.add(sphere(C.ink, 0.07));
}

/** A dashed line from a point straight down to the floor, so you can judge depth. */
class Drop {
  readonly line: Line<BufferGeometry, LineDashedMaterial>;
  constructor(stage: Stage, color: string) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(6), 3));
    this.line = new Line(g, new LineDashedMaterial({ color, dashSize: 0.15, gapSize: 0.1, transparent: true, opacity: 0.8 }));
    stage.add(this.line);
    this.set(v3(0, 0, 0));
  }
  set(p: Vector3): void {
    const a = this.line.geometry.getAttribute('position') as BufferAttribute;
    a.setXYZ(0, p.x, p.y, p.z);
    a.setXYZ(1, p.x, 0, p.z);
    a.needsUpdate = true;
    this.line.geometry.computeBoundingSphere();
    this.line.computeLineDistances();
    this.line.visible = Math.abs(p.y) > 0.01;
  }
}

/** Two vectors from the origin, plus everything needed to show their sum. */
class VecFig {
  u: Vector3;
  v: Vector3;
  /** 0 → v sits at the origin, 1 → v's tail sits on u's tip. */
  slide = 0;
  /** 0..1: how much of the result arrow is drawn. */
  result = 0;
  /** 0..1: the second path (u after v) and the parallelogram. */
  para = 0;
  readonly uA: Arrow3D;
  readonly vA: Arrow3D;
  readonly vMoved: Arrow3D;
  readonly uMoved: Arrow3D;
  readonly sum: Arrow3D;
  readonly sheet: Mesh<BufferGeometry, MeshBasicMaterial>;
  readonly uLabel: Label;
  readonly vLabel: Label;
  readonly sumLabel: Label;
  readonly drops: Drop[];

  constructor(stage: Stage, u: Vector3, v: Vector3) {
    this.u = u.clone();
    this.v = v.clone();
    this.uA = stage.add(new Arrow3D(C.a, 0.06));
    this.vA = stage.add(new Arrow3D(C.b, 0.06));
    this.vMoved = stage.add(new Arrow3D(C.b, 0.06));
    this.uMoved = stage.add(new Arrow3D(C.a, 0.045));
    this.sum = stage.add(new Arrow3D(C.c, 0.075));
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(18), 3));
    this.sheet = stage.add(new Mesh(g, new MeshBasicMaterial({ color: C.c, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false })));
    this.uLabel = stage.labels.add({ tex: '\\vec{u}', color: C.a });
    this.vLabel = stage.labels.add({ tex: '\\vec{v}', color: C.b });
    this.sumLabel = stage.labels.add({ tex: '\\vec{u} + \\vec{v}', color: C.c });
    this.drops = [new Drop(stage, C.a), new Drop(stage, C.b), new Drop(stage, C.c)];
    this.redraw();
  }

  get total(): Vector3 {
    return this.u.clone().add(this.v);
  }

  redraw(): void {
    const O = v3(0, 0, 0);
    const { u, v } = this;
    const T = this.total;
    this.uA.set(O, u);
    this.vA.set(O, v);
    // The sliding copy of v, from the origin towards u's tip.
    const tail = u.clone().multiplyScalar(this.slide);
    this.vMoved.set(tail, tail.clone().add(v));
    this.vMoved.visible = this.slide > 0.001;
    this.vA.opacity = this.slide > 0.001 ? 0.3 : 1;
    this.sum.set(O, T);
    this.sum.grow = this.result;
    this.sum.visible = this.result > 0.001;
    this.uMoved.set(v, T);
    this.uMoved.grow = this.para;
    this.uMoved.visible = this.para > 0.001;
    const pos = this.sheet.geometry.getAttribute('position') as BufferAttribute;
    const quad = [O, u, T, O, T, v];
    quad.forEach((p, i) => pos.setXYZ(i, p.x, p.y, p.z));
    pos.needsUpdate = true;
    this.sheet.geometry.computeBoundingSphere();
    this.sheet.material.opacity = 0.16 * this.para;
    this.uLabel.at(u.clone().multiplyScalar(0.55).add(v3(0, 0.35, 0)));
    this.vLabel.at((this.slide > 0.5 ? u.clone().add(v.clone().multiplyScalar(0.55)) : v.clone().multiplyScalar(0.55)).add(v3(0, 0.35, 0)));
    this.sumLabel.at(T.clone().multiplyScalar(0.5).add(v3(0, -0.35, 0)));
    this.sumLabel.el.hidden = this.result < 0.5;
    this.drops[0]!.set(u);
    this.drops[1]!.set(this.slide > 0.5 ? T : v);
    this.drops[2]!.set(T);
    this.drops[2]!.line.visible = this.result > 0.99 && Math.abs(T.y) > 0.01;
  }

  /** v slides to u's tip, then the result grows. */
  addTipToTail(tl: Timeline, at?: gsap.Position): void {
    tl.to(this, { slide: 1, duration: DUR.slow, ease: EASE.move, onUpdate: () => this.redraw() }, at);
    tl.to(this, { result: 1, duration: DUR.slow, ease: EASE.move, onUpdate: () => this.redraw() }, '>+0.15');
  }

  hideAll(): void {
    this.uA.grow = 0; // a zero-length arrow draws nothing
    this.vA.grow = 0;
    for (const d of this.drops) d.line.material.opacity = 0;
    hiddenLabel(this.uLabel, this.vLabel, this.sumLabel);
  }

  showDrops(tl: Timeline, at?: gsap.Position): void {
    tl.to(
      this.drops.map((d) => d.line.material),
      { opacity: 0.8, duration: 0.4 },
      at,
    );
  }

  growArrow(tl: Timeline, which: 'u' | 'v', at?: gsap.Position): void {
    const arrow = which === 'u' ? this.uA : this.vA;
    tl.fromTo(arrow, { grow: 0 }, { grow: 1, duration: DUR.base, ease: EASE.move }, at);
    popLabel(tl, which === 'u' ? this.uLabel : this.vLabel, '>-0.1');
  }
}

/** A draggable tip (snaps to the 0.5 grid, stays inside the box). */
function tipHandle(stage: Stage, fig: VecFig, which: 'u' | 'v', onChange: () => void) {
  const color = which === 'u' ? C.a : C.b;
  return stage.drag.add({
    name: `Tip of vector ${which}`,
    at: which === 'u' ? fig.u : fig.v,
    color,
    radius: 0.13,
    space: '3d',
    constrain: (p) => v3(clamp(snap(p.x, 0.5), -4, 4), clamp(snap(p.y, 0.5), -3, 4), clamp(snap(p.z, 0.5), -4, 4)),
    onMove: (p) => {
      if (which === 'u') fig.u.copy(p);
      else fig.v.copy(p);
      fig.redraw();
      onChange();
    },
    describe: () => {
      const p = which === 'u' ? fig.u : fig.v;
      return `at ${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}`;
    },
  });
}

/** Swing the camera part-way round the scene (used when orbit controls are off). */
function swing(stage: Stage, tl: Timeline, fromDeg: number, toDeg: number, dur: number, at?: gsap.Position) {
  const target = v3(...VIEW.target);
  const start = v3(...VIEW.position).sub(target);
  const radius = Math.hypot(start.x, start.z);
  const base = Math.atan2(start.z, start.x);
  const s = { a: fromDeg };
  tl.fromTo(
    s,
    { a: fromDeg },
    {
      a: toDeg,
      duration: dur,
      ease: 'sine.inOut',
      onUpdate: () => {
        const ang = base + (s.a * Math.PI) / 180;
        stage.sm.persp.position.set(target.x + radius * Math.cos(ang), target.y + start.y, target.z + radius * Math.sin(ang));
        stage.sm.persp.lookAt(target);
      },
    },
    at,
  );
}

export const vectors3d: LessonDef = {
  meta: {
    id: 'vectors',
    title: 'Vectors in 3D',
    blurb: 'Grab arrows in 3D space and add them tip to tail.',
    accent: 'a',
  },
  view: VIEW,

  hook: {
    caption: 'Arrows can describe any move in space: a drone flight, a pass in football, a push. What happens when you join two moves together?',
    view: HOOK_VIEW,
    play(stage) {
      space(stage);
      const fig = new VecFig(stage, v3(3, 1, 2), v3(-1, 2.5, 1));
      fig.hideAll();
      const tl = stage.timeline();
      swing(stage, tl, -25, 20, 8.5, 0);
      fig.growArrow(tl, 'u', 0.3);
      fig.growArrow(tl, 'v', '>+0.2');
      fig.showDrops(tl, '>');
      fig.addTipToTail(tl, '>+0.3');
      popLabel(tl, fig.sumLabel, '>-0.3');
      tl.to(fig.sum.scale, { x: 1.5, z: 1.5, duration: 0.25, yoyo: true, repeat: 1 }, '>');
      return tl;
    },
  },

  explore: {
    caption: `Drag the arrow tips to move ${'$' + U + '$'} and ${'$' + Vv + '$'}. Drag empty space to turn the camera. Press **Add them** to see the sum.`,
    setup(stage) {
      space(stage);
      const fig = new VecFig(stage, v3(3, 1, 2), v3(-1, 2, 1));
      const out = stage.ui.readout('readout big');
      const len = stage.ui.readout('readout');
      let added = false;
      const refresh = () => {
        const t = fig.total;
        out.tex(`${U} + ${Vv} = ${col(fig.u, 'a')} + ${col(fig.v, 'b')} = ${col(t, 'c')}`);
        len.set(`Length of $${SUM}$ is about **${fmt(len3(t))}** units.`);
      };
      const row = stage.ui.row();
      const toggle = row.button('Add them', () => {
        added = !added;
        toggle.textContent = added ? 'Separate them' : 'Add them';
        toggle.setAttribute('aria-pressed', String(added));
        stage.to(fig, { slide: added ? 1 : 0, result: added ? 1 : 0, duration: 0.9, ease: EASE.move, overwrite: 'auto', onUpdate: () => fig.redraw() });
      }, 'primary');
      toggle.setAttribute('aria-pressed', 'false');
      row.button('Reset camera', () => {
        const cam = stage.sm.persp.position;
        const ctl = stage.sm.controls;
        stage.to(cam, {
          x: VIEW.position[0],
          y: VIEW.position[1],
          z: VIEW.position[2],
          duration: 0.8,
          ease: EASE.move,
          onUpdate: () => ctl?.update(),
        });
      });
      stage.ui.note('Keyboard: Tab to a tip, then use the arrow keys. Hold Shift with ↑/↓ to move it nearer or further.');
      tipHandle(stage, fig, 'u', refresh);
      tipHandle(stage, fig, 'v', refresh);
      refresh();
    },
  },

  explain: defineExplain({
    setup(stage) {
      space(stage);
      const fig = new VecFig(stage, v3(3, 1, 2), v3(-1, 2, 1));
      fig.hideAll();
      // The three parts of u, walked one after another: along x, up y, along z.
      const legs = [
        new Arrow3D(C.a, 0.035).set(v3(0, 0, 0), v3(3, 0, 0)),
        new Arrow3D(C.a, 0.035).set(v3(3, 0, 0), v3(3, 1, 0)),
        new Arrow3D(C.a, 0.035).set(v3(3, 1, 0), v3(3, 1, 2)),
      ];
      const legLabels = [
        stage.labels.add({ text: '3 along $x$', at: v3(1.5, 0, 0), anchor: 'below', color: C.a }),
        stage.labels.add({ text: '1 up $y$', at: v3(3, 0.5, 0), anchor: 'right', color: C.a }),
        stage.labels.add({ text: '2 along $z$', at: v3(3, 1, 1), anchor: 'right', color: C.a }),
      ];
      legs.forEach((l) => {
        l.grow = 0;
        stage.add(l);
      });
      hiddenLabel(...legLabels);
      return { fig, legs, legLabels };
    },
    steps: [
      {
        caption: `A **vector** is an arrow. It has a **length** (how far) and a **direction** (which way). This one is called ${'$' + U + '$'}.`,
        play(stage, { fig }) {
          const tl = stage.timeline();
          fig.growArrow(tl, 'u', 0.2);
          return tl;
        },
      },
      {
        caption: 'In 3D we describe it with three numbers: how far along $x$, how far up $y$, and how far along $z$.',
        eq: [U, '=', col(v3(3, 1, 2), 'a')],
        play(stage, { legs, legLabels, fig }) {
          const tl = stage.timeline();
          tl.to(fig.uA, { opacity: 0.35, duration: 0.3 }, 0);
          legs.forEach((leg, i) => {
            tl.fromTo(leg, { grow: 0 }, { grow: 1, duration: 0.7, ease: EASE.move }, i === 0 ? 0.3 : '>+0.1');
            popLabel(tl, legLabels[i] as Label, '>-0.1');
          });
          tl.to(fig.uA, { opacity: 1, duration: 0.3 }, '>+0.2');
          return tl;
        },
      },
      {
        caption: `Here is a second vector, ${'$' + Vv + '$'}. It goes $-1$ along $x$ (backwards), 2 up, and 1 along $z$.`,
        eq: [U, '=', col(v3(3, 1, 2), 'a'), ',\\quad', Vv, '=', col(v3(-1, 2, 1), 'b')],
        play(stage, { fig, legs, legLabels }) {
          const tl = stage.timeline();
          tl.to(legs, { opacity: 0, duration: 0.3 }, 0);
          tl.to(
            legLabels.map((l) => l.inner),
            { opacity: 0, duration: 0.3 },
            0,
          );
          fig.growArrow(tl, 'v', 0.3);
          fig.showDrops(tl, '>');
          return tl;
        },
      },
      {
        caption: `To add them, slide ${'$' + Vv + '$'} so its **tail** sits on the **tip** of ${'$' + U + '$'}. This is called **tip to tail**.`,
        play(stage, { fig }) {
          const tl = stage.timeline();
          tl.to(fig, { slide: 1, duration: 1.4, ease: EASE.move, onUpdate: () => fig.redraw() }, 0.2);
          return tl;
        },
      },
      {
        caption: `The answer ${'$' + SUM + '$'} is the arrow from the very **start** of ${'$' + U + '$'} to the very **end** of the moved ${'$' + Vv + '$'}.`,
        eq: [SUM, '=', '\\;?'],
        eqAt: 0,
        play(stage, { fig }) {
          const tl = stage.timeline();
          tl.to(fig, { result: 1, duration: 1.2, ease: EASE.move, onUpdate: () => fig.redraw() }, 0.2);
          popLabel(tl, fig.sumLabel, '>-0.2');
          return tl;
        },
      },
      {
        caption: 'To work it out with numbers, add each row: $3 + (-1)$, then $1 + 2$, then $2 + 1$.',
        eq: [SUM, '=', col(v3(3, 1, 2), 'a'), '+', col(v3(-1, 2, 1), 'b'), '=', col(v3(2, 3, 3), 'c')],
        eqAt: 0.3,
        play(stage, { fig }) {
          const tl = stage.timeline();
          tl.to(fig.sum.scale, { x: 1.4, z: 1.4, duration: 0.3, yoyo: true, repeat: 1 }, 0);
          return tl;
        },
      },
      {
        caption: `Order doesn't matter: going ${'$' + Vv + '$'} first, then ${'$' + U + '$'}, lands in the same place. The two paths make a **parallelogram**.`,
        eq: [`${U} + ${Vv}`, '=', `${Vv} + ${U}`],
        eqAt: 0,
        play(stage, { fig }) {
          const tl = stage.timeline();
          tl.to(fig.vA, { opacity: 1, duration: 0.3 }, 0);
          tl.to(fig, { para: 1, duration: 1.4, ease: EASE.move, onUpdate: () => fig.redraw() }, 0.3);
          return tl;
        },
      },
    ],
  }),

  practice: [
    {
      prompt: `$${U} = (1, 2, 0)$ and $${Vv} = (3, -1, 2)$. What is $${SUM}$?`,
      input: { kind: 'choice', options: ['$(4, 1, 2)$', '$(2, 1, 2)$', '$(3, -2, 0)$', '$(4, 3, 2)$'], answer: 0 },
      hint: 'Add the matching parts: first numbers together, then second numbers, then third numbers. Careful with $2 + (-1)$.',
      explain: '$(1 + 3,\\ 2 + (-1),\\ 0 + 2) = (4, 1, 2)$.',
      setup(stage) {
        space(stage);
        const fig = new VecFig(stage, v3(1, 2, 0), v3(3, -1, 2));
        return {
          hint() {
            const tl = stage.timeline();
            fig.addTipToTail(tl, 0);
            return tl;
          },
        };
      },
    },
    {
      prompt: `Here $${U} = (1, 1, 0)$. Drag the tip of $${Vv}$ so that $${SUM}$ lands on the glowing target at $(3, 3, 0)$.`,
      input: { kind: 'drag' },
      hint: `You need $${Vv} = \\text{target} - ${U}$. Work out $3 - 1$ for each of the first two parts, and keep the last part $0$.`,
      explain: `$${Vv} = (2, 2, 0)$, because $(1, 1, 0) + (2, 2, 0) = (3, 3, 0)$.`,
      setup(stage) {
        space(stage);
        const fig = new VecFig(stage, v3(1, 1, 0), v3(0, 1, 2));
        fig.slide = 1;
        fig.result = 1;
        fig.redraw();
        const target = stage.add(sphere(C.c, 0.2));
        target.position.set(3, 3, 0);
        target.material.opacity = 0.45;
        // Drag the moved copy's tip: its position is u + v.
        stage.drag.add({
          name: 'Tip of vector v',
          at: fig.total,
          color: C.b,
          radius: 0.13,
          space: '3d',
          constrain: (p) => v3(clamp(snap(p.x, 0.5), -3, 5), clamp(snap(p.y, 0.5), -3, 5), clamp(snap(p.z, 0.5), -4, 4)),
          onMove: (p) => {
            fig.v.copy(p).sub(fig.u);
            fig.redraw();
          },
          describe: () => `v is ${fmt(fig.v.x)}, ${fmt(fig.v.y)}, ${fmt(fig.v.z)}`,
        });
        return {
          check: () => fig.v.equals(v3(2, 2, 0)),
          hint() {
            const tl = stage.timeline();
            tl.to(target.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.35, yoyo: true, repeat: 3 }, 0);
            return tl;
          },
        };
      },
    },
    {
      prompt: `Which of these is **always** the same as $${SUM}$?`,
      input: {
        kind: 'choice',
        options: [`$${Vv} + ${U}$`, `$${U} - ${Vv}$`, `$2${U}$`, `$${Vv} - ${U}$`],
        answer: 0,
      },
      hint: 'Think of walking: does it matter which of the two moves you do first, if you do both?',
      explain: 'Adding works in any order — both routes round the parallelogram end at the same corner.',
      setup(stage) {
        space(stage);
        const fig = new VecFig(stage, v3(3, 1, 2), v3(-1, 2, 1));
        return {
          hint() {
            const tl = stage.timeline();
            fig.addTipToTail(tl, 0);
            tl.to(fig, { para: 1, duration: 1.2, ease: EASE.move, onUpdate: () => fig.redraw() }, '>');
            return tl;
          },
        };
      },
    },
    {
      prompt: 'The faint arrow is $\\vec{w} = (3, 4, 0)$. Use the slider to make the solid arrow exactly as **long** as $\\vec{w}$.',
      input: { kind: 'slider', label: 'Length', name: 'arrow length', min: 1, max: 8, step: 0.5, value: 2, color: C.c, format: (v) => fmt(v) },
      hint: 'The arrow and the axes make a right-angled triangle with sides 3 and 4. Remember Pythagoras: length $= \\sqrt{3^2 + 4^2}$.',
      explain: '$\\sqrt{3^2 + 4^2} = \\sqrt{25} = 5$ — Pythagoras works for vectors too!',
      setup(stage) {
        space(stage);
        const w = v3(3, 4, 0);
        const dir = w.clone().normalize();
        const ghost = stage.add(new Arrow3D(C.ink, 0.05).set(v3(0, 0, 0), w));
        ghost.opacity = 0.3;
        const arrow = stage.add(new Arrow3D(C.c, 0.07));
        const legs = [
          stage.add(new Arrow3D(C.a, 0.035).set(v3(0, 0, 0), v3(3, 0, 0))),
          stage.add(new Arrow3D(C.b, 0.035).set(v3(3, 0, 0), w)),
        ];
        legs.forEach((l) => (l.grow = 0));
        const legLabels = [
          stage.labels.add({ text: '3', at: v3(1.5, 0, 0), anchor: 'below', color: C.a }),
          stage.labels.add({ text: '4', at: v3(3, 2, 0), anchor: 'right', color: C.b }),
        ];
        hiddenLabel(...legLabels);
        return {
          onInput: (v) => arrow.set(v3(0, 0, 0), dir.clone().multiplyScalar(v)),
          check: (v) => v === 5,
          hint() {
            const tl = stage.timeline();
            tl.fromTo(legs, { grow: 0 }, { grow: 1, duration: 0.7, stagger: 0.4, ease: EASE.move }, 0);
            popLabel(tl, legLabels, '>');
            return tl;
          },
        };
      },
    },
  ],

  recap: {
    points: [
      'A **vector** has a length and a direction. In 3D it has three parts: $(x, y, z)$.',
      `To add vectors, put them **tip to tail**. The answer goes from the very start to the very end.`,
      'With numbers, just add the matching parts: $(a, b, c) + (d, e, f) = (a + d,\\ b + e,\\ c + f)$.',
      `Order doesn't matter: $${U} + ${Vv} = ${Vv} + ${U}$.`,
    ],
    eq: `${U} + ${Vv} = ${Vv} + ${U}`,
    view: HOOK_VIEW,
    play(stage) {
      space(stage);
      const fig = new VecFig(stage, v3(3, 1, 2), v3(-1, 2, 1));
      fig.hideAll();
      const tl = stage.timeline();
      swing(stage, tl, 15, -15, 6, 0);
      fig.growArrow(tl, 'u', 0.2);
      fig.growArrow(tl, 'v', '>');
      fig.addTipToTail(tl, '>+0.1');
      popLabel(tl, fig.sumLabel, '>-0.3');
      tl.to(fig, { para: 1, duration: 1, ease: EASE.move, onUpdate: () => fig.redraw() }, '>');
      return tl;
    },
  },

  dispose() {
    /* no module-level state */
  },
};
