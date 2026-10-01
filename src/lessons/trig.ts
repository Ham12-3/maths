/**
 * Lesson 4 — Trigonometry: the unit circle and the sine wave.
 * A point travels round the circle while its height unrolls into a sine wave beside it.
 */
import { Vector3 } from 'three';
import { C, tc } from '../core/colors';
import { drawOn, flash, hiddenLabel, pop, popLabel, shrunk } from '../core/anim';
import { Dot, Stroke, Z, arcPoints } from '../core/draw';
import type { Label } from '../core/labels';
import { defineExplain, type LessonDef, type Timeline } from '../core/lesson-types';
import { DUR, EASE } from '../core/motion';
import type { Rect2D } from '../core/scene-manager';
import type { Stage } from '../core/stage';
import { angleDeg, degToRad, fmt, fmtTex, snap } from '../math/geometry';
import type { V2 } from '../math/vec';

/** Circle radius in world units (it stands for 1). */
const R = 2;
/** Where the wave starts, and world units per radian along it. */
const X0 = 3.2;
const WAVE_K = 1;
const RECT: Rect2D = { x0: -4, x1: X0 + 2 * Math.PI * WAVE_K + 1.3, y0: -3.2, y1: 3.2 };
const TH = tc('angle', '\\theta');
const SIN = `${tc('b', '\\sin')} ${TH}`;
const COS = `${tc('a', '\\cos')} ${TH}`;

const waveX = (deg: number) => X0 + degToRad(deg) * WAVE_K;

/** Fixed scenery: axes, the wave's axis, degree marks and the ±1 guides. */
function scenery(stage: Stage, opts: { bounds?: boolean } = {}) {
  const w = stage.px(2);
  const axis = { color: C.axis, width: w, z: Z.grid + 0.5 };
  stage.add(new Stroke([{ x: -2.8, y: 0 }, { x: RECT.x1 + 0.3, y: 0 }], axis));
  stage.add(new Stroke([{ x: 0, y: -2.7 }, { x: 0, y: 2.7 }], axis));
  stage.add(new Stroke([{ x: X0, y: -2.7 }, { x: X0, y: 2.7 }], axis));
  for (const deg of [90, 180, 270, 360]) {
    stage.add(new Stroke([{ x: waveX(deg), y: -0.1 }, { x: waveX(deg), y: 0.1 }], axis));
    stage.labels.add({ text: `${deg}°`, at: { x: waveX(deg), y: 0 }, anchor: 'below', className: 'tick', decorative: true });
  }
  stage.labels.add({ text: '1', at: { x: X0, y: R }, anchor: 'left', className: 'tick', decorative: true });
  stage.labels.add({ text: '−1', at: { x: X0, y: -R }, anchor: 'left', className: 'tick', decorative: true });
  stage.labels.add({ text: '$\\theta$', at: { x: RECT.x1 - 0.4, y: 0 }, anchor: 'above', className: 'axis-name' });
  const dash: [number, number] = [stage.px(8), stage.px(7)];
  const bounds = [R, -R].map((y) =>
    stage.add(new Stroke([{ x: X0, y }, { x: waveX(360), y }], { color: C.muted, width: stage.px(2), dash, opacity: opts.bounds ? 0.5 : 0 })),
  );
  return { bounds };
}

class TrigFig {
  deg: number;
  /** Draw the wave from 0° up to the current angle. */
  showWave = true;
  readonly circle: Stroke;
  readonly radius: Stroke;
  readonly arc: Stroke;
  readonly cos: Stroke;
  readonly sin: Stroke;
  readonly link: Stroke;
  readonly wave: Stroke;
  readonly P: Dot;
  readonly W: Dot;
  readonly thetaLabel: Label;
  readonly sinLabel: Label;
  readonly cosLabel: Label;

  constructor(stage: Stage, deg: number) {
    this.deg = deg;
    const px = (n: number) => stage.px(n);
    this.circle = stage.add(new Stroke(arcPoints(0, 0, R, 0, Math.PI * 2, 96), { color: C.ink, width: px(3), opacity: 0.55 }));
    this.arc = stage.add(new Stroke([], { color: C.angle, width: px(3.5), z: Z.line + 0.1 }));
    this.radius = stage.add(new Stroke([], { color: C.ink, width: px(3.5), z: Z.line + 0.1 }));
    this.cos = stage.add(new Stroke([], { color: C.a, width: px(5), z: Z.line + 0.2 }));
    this.sin = stage.add(new Stroke([], { color: C.b, width: px(5), z: Z.line + 0.2 }));
    this.link = stage.add(new Stroke([], { color: C.b, width: px(2), dash: [px(6), px(6)], opacity: 0.6 }));
    this.wave = stage.add(new Stroke([], { color: C.b, width: px(5), z: Z.line + 0.1 }));
    this.P = stage.add(new Dot(C.angle, px(8), Z.point + 0.2));
    this.W = stage.add(new Dot(C.b, px(7), Z.point + 0.2));
    this.thetaLabel = stage.labels.add({ text: '', color: C.angle });
    this.sinLabel = stage.labels.add({ text: '', color: C.b });
    this.cosLabel = stage.labels.add({ text: '', color: C.a });
    this.redraw();
  }

  get p(): V2 {
    const r = degToRad(this.deg);
    return { x: R * Math.cos(r), y: R * Math.sin(r) };
  }

  redraw(): void {
    const wrapped = ((this.deg % 360) + 360) % 360;
    // Exactly 360°, 720°… shows the whole turn; beyond that the wave starts again.
    const upto = this.deg > 0 && wrapped < 1e-9 ? 360 : wrapped;
    const r = degToRad(upto);
    const P = this.p;
    this.radius.setPoints([{ x: 0, y: 0 }, P]);
    this.arc.setPoints(upto > 0.5 ? arcPoints(0, 0, R * 0.32, 0, r, 48) : []);
    this.cos.setPoints([{ x: 0, y: 0 }, { x: P.x, y: 0 }]);
    this.sin.setPoints([{ x: P.x, y: 0 }, P]);
    this.P.at(P);
    const W = { x: waveX(upto), y: P.y };
    this.W.at(W);
    this.W.visible = this.showWave;
    this.link.setPoints(this.showWave ? [P, W] : []);
    const pts: V2[] = [];
    if (this.showWave) {
      for (let d = 0; d < upto; d += 3) pts.push({ x: waveX(d), y: R * Math.sin(degToRad(d)) });
      pts.push(W);
    }
    this.wave.setPoints(pts);
    const mid = r / 2;
    this.thetaLabel.at({ x: R * 0.55 * Math.cos(mid), y: R * 0.55 * Math.sin(mid) }).setText(`$\\theta$ = ${fmt(upto, 0)}°`);
    const s = Math.sin(r);
    const c = Math.cos(r);
    // Keep each label on the outside of the line it describes.
    this.sinLabel.at({ x: P.x, y: P.y / 2 }).setAnchor(c >= 0 ? 'right' : 'left').setText(`sin = ${fmt(s)}`);
    this.cosLabel.at({ x: P.x / 2, y: 0 }).setAnchor(s >= 0 ? 'below' : 'above').setText(`cos = ${fmt(c)}`);
  }

  /** Tween the angle. */
  turn(tl: Timeline, to: number, at?: gsap.Position, dur: number = DUR.slow, ease: string = EASE.move): void {
    tl.to(this, { deg: to, duration: dur, ease, onUpdate: () => this.redraw() }, at);
  }

  hideAll(): void {
    this.circle.draw = 0;
    this.radius.draw = 0;
    this.arc.opacity = 0;
    this.cos.draw = 0;
    this.sin.draw = 0;
    this.link.opacity = 0;
    this.wave.opacity = 0;
    shrunk(this.P, this.W);
    hiddenLabel(this.thetaLabel, this.sinLabel, this.cosLabel);
  }
}

/** Drag P round the circle (snaps to 5°); arrow keys turn it by 5°. */
function pointHandle(stage: Stage, fig: TrigFig, onChange: () => void, step = 5) {
  return stage.drag.add({
    name: 'Point P on the circle',
    at: fig.p,
    color: C.angle,
    radius: stage.px(10),
    constrain: (q) => {
      const deg = snap(angleDeg(q.x, q.y), step) % 360;
      const r = degToRad(deg);
      return new Vector3(R * Math.cos(r), R * Math.sin(r), 0);
    },
    onArrow: (dir) => {
      const deg = fig.deg + (dir === 'up' || dir === 'right' ? step : -step);
      const r = degToRad(deg);
      return new Vector3(R * Math.cos(r), R * Math.sin(r), 0);
    },
    onMove: (q) => {
      fig.deg = angleDeg(q.x, q.y);
      fig.redraw();
      onChange();
    },
    describe: () => `angle ${fmt(fig.deg, 0)} degrees, sine ${fmt(Math.sin(degToRad(fig.deg)))}`,
  });
}

export const trig: LessonDef = {
  meta: {
    id: 'trig',
    title: 'Sine and the circle',
    blurb: 'Spin a point round a circle and watch its height draw a wave.',
    accent: 'angle',
  },
  view: { kind: '2d', rect: RECT },

  hook: {
    caption: 'Spin a point round a circle… and its height draws a wave. Sound, light and tides all move like this.',
    play(stage) {
      scenery(stage);
      const fig = new TrigFig(stage, 0);
      fig.hideAll();
      const name = stage.labels.add({ tex: `y = ${SIN}`, at: { x: waveX(180), y: 2.6 }, className: 'big-label' });
      hiddenLabel(name);
      const tl = stage.timeline();
      drawOn(tl, fig.circle, 0, 0.9);
      drawOn(tl, fig.radius, '>-0.2', 0.4);
      pop(tl, fig.P, '<');
      tl.to([fig.sin, fig.link], { draw: 1, opacity: 1, duration: 0.3 }, '>');
      tl.to(fig.wave, { opacity: 1, duration: 0.2 }, '<');
      pop(tl, fig.W, '<');
      fig.turn(tl, 360, '>', 4.5, 'none');
      popLabel(tl, name, '>-0.3');
      tl.to(fig.wave, { width: fig.wave.width * 1.6, duration: 0.3, yoyo: true, repeat: 1 }, '>');
      return tl;
    },
  },

  explore: {
    caption: `Drag the yellow point round the circle, use the slider, or press **Spin**. The height of the point (${'$' + SIN + '$'}) draws the wave.`,
    setup(stage) {
      scenery(stage, { bounds: true });
      const fig = new TrigFig(stage, 45);
      const vals = stage.ui.readout('readout big');
      let spinning = false;
      let handle: ReturnType<typeof pointHandle> | null = null;
      const slider = stage.ui.slider({
        label: `Angle $${TH}$`,
        name: 'angle theta in degrees',
        min: 0,
        max: 360,
        step: 5,
        value: 45,
        color: C.angle,
        format: (v) => `${v}°`,
        onInput: (v) => {
          fig.deg = v;
          fig.redraw();
          sync(false);
        },
      });
      const sync = (fromHandle: boolean) => {
        const r = degToRad(fig.deg);
        // Separate inline pieces so the line can wrap on narrow panels.
        vals.set(`$${TH} = ${fmt(fig.deg % 360, 0)}^\\circ$   $${SIN} = ${fmtTex(Math.sin(r))}$   $${COS} = ${fmtTex(Math.cos(r))}$`);
        if (!fromHandle) handle?.place(fig.p);
        slider.set(Math.round(fig.deg % 360));
      };
      const row = stage.ui.row();
      const spin = row.button('▶ Spin', () => {
        spinning = !spinning;
        spin.textContent = spinning ? '❚❚ Stop' : '▶ Spin';
        spin.setAttribute('aria-pressed', String(spinning));
      });
      spin.setAttribute('aria-pressed', 'false');
      stage.onFrame((dt) => {
        if (!spinning) return;
        fig.deg = (fig.deg + dt * 60) % 360;
        fig.redraw();
        sync(false);
      });
      handle = pointHandle(stage, fig, () => sync(true));
      sync(false);
    },
  },

  explain: defineExplain({
    setup(stage) {
      const { bounds } = scenery(stage);
      const fig = new TrigFig(stage, 0);
      fig.hideAll(); // the wave is computed all along but stays invisible until step 6
      const one = stage.labels.add({ text: 'radius = 1', at: { x: R / 2, y: 0 }, anchor: 'above' });
      const top = stage.labels.add({ text: '90°: top, sin = 1', at: { x: waveX(90), y: R }, anchor: 'above', color: C.b });
      const bottom = stage.labels.add({ text: '270°: bottom, sin = −1', at: { x: waveX(270), y: -R }, anchor: 'below', color: C.b });
      hiddenLabel(one, top, bottom);
      return { fig, one, bounds, top, bottom };
    },
    steps: [
      {
        caption: 'This is the **unit circle**. Its centre is at $(0, 0)$ and its radius is exactly $1$.',
        play(stage, { fig, one }) {
          const tl = stage.timeline();
          drawOn(tl, fig.circle, 0, 1.2);
          drawOn(tl, fig.radius, '>', 0.5);
          popLabel(tl, one, '>');
          pop(tl, fig.P, '<');
          return tl;
        },
      },
      {
        caption: `A point P sits on the circle. Its angle ${'$' + TH + '$'} ("theta") is measured **anticlockwise** from the right.`,
        play(stage, { fig, one }) {
          const tl = stage.timeline();
          tl.to(one.inner, { opacity: 0, duration: 0.3 }, 0);
          tl.to(fig.arc, { opacity: 1, duration: 0.2 }, 0.2);
          popLabel(tl, fig.thetaLabel, '<');
          fig.turn(tl, 50, '<', 1.4);
          return tl;
        },
      },
      {
        caption: `The **height** of P above the centre has a special name: ${'$' + SIN + '$'} (say "sine theta").`,
        eq: [SIN, '=', '\\text{height}'],
        play(stage, { fig }) {
          const tl = stage.timeline();
          drawOn(tl, fig.sin, 0, 0.6);
          popLabel(tl, fig.sinLabel, '>');
          return tl;
        },
      },
      {
        caption: `How far **across** P is from the centre is called ${'$' + COS + '$'} ("cosine theta").`,
        eq: [SIN, '=', '\\text{height}', ',\\quad', COS, '=', '\\text{across}'],
        play(stage, { fig }) {
          const tl = stage.timeline();
          drawOn(tl, fig.cos, 0, 0.6);
          popLabel(tl, fig.cosLabel, '>');
          return tl;
        },
      },
      {
        caption: 'As P travels round, its height climbs to $1$ at the top, falls to $-1$ at the bottom, then comes back.',
        play(stage, { fig }) {
          const tl = stage.timeline();
          fig.turn(tl, 90, 0, 0.6);
          tl.to(fig.sinLabel.inner, { scale: 1.3, duration: 0.2, yoyo: true, repeat: 1 }, '>');
          fig.turn(tl, 270, '>+0.2', 1.6);
          tl.to(fig.sinLabel.inner, { scale: 1.3, duration: 0.2, yoyo: true, repeat: 1 }, '>');
          fig.turn(tl, 360, '>+0.2', 0.8);
          return tl;
        },
      },
      {
        caption: `Now **unroll** the height along a line. As ${'$' + TH + '$'} goes from 0° to 360°, the height draws the **sine wave**.`,
        eq: ['y', '=', SIN],
        eqAt: 0,
        play(stage, { fig }) {
          const tl = stage.timeline();
          tl.to(fig.cos, { opacity: 0.35, duration: 0.3 }, 0);
          tl.to(fig.cosLabel.inner, { opacity: 0, duration: 0.3 }, 0);
          // Restart from 0° and unroll; the wave fades in as the turn begins.
          tl.fromTo(fig, { deg: 0 }, { deg: 360, duration: 4.5, ease: 'none', onUpdate: () => fig.redraw() }, 0.3);
          tl.to([fig.wave, fig.link], { opacity: 1, duration: 0.3 }, 0.3);
          pop(tl, fig.W, 0.3);
          return tl;
        },
      },
      {
        caption: 'After 360° P is back where it started, so the wave **repeats** forever. It always stays between $-1$ and $1$.',
        eq: ['-1', '\\le', SIN, '\\le', '1'],
        eqAt: 0,
        play(stage, { bounds, top, bottom }) {
          const tl = stage.timeline();
          tl.fromTo(bounds, { opacity: 0 }, { opacity: 0.6, duration: 0.4 }, 0);
          drawOn(tl, bounds, 0, 0.8);
          popLabel(tl, top, '>');
          popLabel(tl, bottom, '>+0.1');
          return tl;
        },
      },
    ],
  }),

  practice: [
    {
      prompt: `Use the slider to set the angle so that ${'$' + SIN + ' = 1$'} — the point is as **high** as it can go.`,
      input: { kind: 'slider', label: `Angle $${TH}$`, name: 'angle theta in degrees', min: 0, max: 360, step: 15, value: 30, color: C.angle, format: (v) => `${v}°` },
      hint: 'The height is biggest at the very top of the circle. How many degrees is a quarter turn?',
      explain: 'A quarter turn is $90°$, and $\\sin 90° = 1$.',
      setup(stage) {
        scenery(stage, { bounds: true });
        const fig = new TrigFig(stage, 30);
        return {
          onInput: (v) => {
            fig.deg = v;
            fig.redraw();
          },
          check: (v) => v === 90,
          hint() {
            const tl = stage.timeline();
            flash(tl, fig.sin, 0, 0.2);
            return tl;
          },
        };
      },
    },
    {
      prompt: 'What is $\\sin 0°$?',
      input: { kind: 'choice', options: ['$0$', '$1$', '$-1$', '$0.5$'], answer: 0 },
      hint: 'At 0° the point is on the right of the circle, exactly level with the centre. How high is it?',
      explain: 'At 0° the point is level with the centre, so its height is $0$.',
      setup(stage) {
        scenery(stage, { bounds: true });
        const fig = new TrigFig(stage, 0);
        fig.showWave = false;
        fig.redraw();
        return {
          hint() {
            const tl = stage.timeline();
            fig.turn(tl, 60, 0, 0.8);
            fig.turn(tl, 0, '>+0.3', 0.8);
            return tl;
          },
        };
      },
    },
    {
      prompt: `Drag P to the place where ${'$' + COS + ' = -1$'}.`,
      input: { kind: 'drag' },
      hint: '$\\cos$ is how far **across**. $-1$ means a whole radius to the **left** of the centre.',
      explain: 'At $180°$ the point is a full radius to the left, so $\\cos 180° = -1$.',
      setup(stage) {
        scenery(stage, { bounds: true });
        const fig = new TrigFig(stage, 45);
        fig.showWave = false;
        fig.redraw();
        pointHandle(stage, fig, () => {}, 15);
        return {
          check: () => Math.round(fig.deg) === 180,
          hint() {
            const tl = stage.timeline();
            flash(tl, fig.cos, 0, 0.2);
            return tl;
          },
        };
      },
    },
    {
      prompt: 'The sine wave always stays between which two values?',
      input: { kind: 'choice', options: ['$-1$ and $1$', '$0$ and $1$', '$0$ and $360$', '$-360$ and $360$'], answer: 0 },
      hint: 'The wave is the **height** of a point on a circle of radius 1. How high and how low can that point go?',
      explain: 'The highest point is $1$ (at 90°) and the lowest is $-1$ (at 270°).',
      setup(stage) {
        const { bounds } = scenery(stage);
        const fig = new TrigFig(stage, 360);
        return {
          hint() {
            const tl = stage.timeline();
            tl.fromTo(bounds, { opacity: 0 }, { opacity: 0.7, duration: 0.4 }, 0);
            fig.turn(tl, 450, '>', 0.8);
            fig.turn(tl, 630, '>+0.2', 1.2);
            fig.turn(tl, 720, '>+0.2', 0.6);
            return tl;
          },
        };
      },
    },
  ],

  recap: {
    points: [
      `On the unit circle, the point at angle ${'$' + TH + '$'} has height ${'$' + SIN + '$'} and across-distance ${'$' + COS + '$'}.`,
      `As ${'$' + TH + '$'} goes from 0° to 360°, the height traces the **sine wave**.`,
      'The wave repeats every 360° and always stays between $-1$ and $1$.',
      'Key values: $\\sin 0° = 0$, $\\sin 90° = 1$, $\\sin 180° = 0$, $\\sin 270° = -1$.',
    ],
    eq: `P = (${COS},\\ ${SIN})`,
    play(stage) {
      scenery(stage, { bounds: true });
      const fig = new TrigFig(stage, 0);
      fig.hideAll();
      const tl = stage.timeline();
      drawOn(tl, fig.circle, 0, 0.6);
      drawOn(tl, fig.radius, '>', 0.3);
      pop(tl, [fig.P, fig.W], '>');
      tl.to([fig.wave, fig.link, fig.arc], { opacity: 1, duration: 0.2 }, '<');
      tl.to([fig.sin, fig.cos], { draw: 1, duration: 0.3 }, '<');
      popLabel(tl, [fig.sinLabel, fig.cosLabel, fig.thetaLabel], '<');
      fig.turn(tl, 360, '>', 3, 'none');
      return tl;
    },
  },

  dispose() {
    /* no module-level state */
  },
};
