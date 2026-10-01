/**
 * A Stage is everything one lesson puts on screen. The runner calls `clear()` between
 * sections/steps and `dispose()` when leaving the lesson: every tween, mesh, material,
 * label, handle, panel widget and listener created through the stage is released.
 */
import gsap from 'gsap';
import { AmbientLight, DirectionalLight, Group, HemisphereLight, type Object3D } from 'three';
import { C } from './colors';
import { DragController } from './drag';
import { Stroke, Z, disposeObject, gridLines } from './draw';
import { LabelLayer } from './labels';
import type { Rect2D, SceneManager, ViewSpec } from './scene-manager';
import { PanelUI } from './ui';

type Animation = gsap.core.Timeline | gsap.core.Tween;

export interface AxesOpts {
  step?: number;
  /** Label every n-th grid line (0 = no numbers). */
  labelEvery?: number;
  majorEvery?: number;
  xName?: string;
  yName?: string;
  /** Hide the y axis (e.g. when the y axis is not meaningful). */
  noY?: boolean;
}

export class Stage {
  readonly root = new Group();
  readonly labels: LabelLayer;
  readonly drag: DragController;
  readonly ui: PanelUI;
  private anims = new Set<Animation>();
  private cleanups: (() => void)[] = [];
  private frameOffs: (() => void)[] = [];

  constructor(
    readonly sm: SceneManager,
    host: HTMLElement,
    labelLayer: HTMLElement,
    keyLayer: HTMLElement,
    controls: HTMLElement,
  ) {
    this.root.name = 'stage-root';
    sm.scene.add(this.root);
    this.labels = new LabelLayer(sm, labelLayer);
    this.drag = new DragController(sm, host, keyLayer, (g) => this.root.add(g));
    this.ui = new PanelUI(controls);
  }

  /** Switch camera mode/framing. 3D views also get soft lighting. */
  view(v: ViewSpec): void {
    this.sm.setView(v);
    if (v.kind === '3d') {
      const hemi = new HemisphereLight('#dfe6ff', '#1a1f38', 1.4);
      const amb = new AmbientLight('#ffffff', 0.35);
      const dir = new DirectionalLight('#ffffff', 1.6);
      dir.position.set(5, 9, 6);
      this.add(hemi, amb, dir);
    }
  }

  add<T extends Object3D>(first: T, ...more: Object3D[]): T {
    this.root.add(first, ...more);
    return first;
  }

  /** Convert "screen pixels" to world units for 2D scenes (relative to a 700px tall view). */
  px(n: number): number {
    const r = this.sm.view2D;
    return (n * (r.y1 - r.y0)) / 700;
  }

  timeline(vars?: gsap.TimelineVars): gsap.core.Timeline {
    return this.track(gsap.timeline(vars));
  }

  /** A tracked gsap.to (killed automatically on clear). */
  to(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
    return this.track(gsap.to(target, vars));
  }

  track<T extends Animation>(a: T): T {
    this.anims.add(a);
    // Forget finished one-off tweens so long sessions don't accumulate them.
    if (a instanceof gsap.core.Tween) void a.then(() => this.anims.delete(a));
    return a;
  }

  onFrame(fn: (dt: number) => void): void {
    this.frameOffs.push(this.sm.onFrame(fn));
  }

  listen<K extends keyof WindowEventMap>(target: Window, type: K, fn: (e: WindowEventMap[K]) => void): void;
  listen(target: EventTarget, type: string, fn: (e: Event) => void): void;
  listen(target: EventTarget, type: string, fn: (e: Event) => void): void {
    target.addEventListener(type, fn);
    this.cleanups.push(() => target.removeEventListener(type, fn));
  }

  /** Run something when the stage is cleared. */
  defer(fn: () => void): void {
    this.cleanups.push(fn);
  }

  /** Grid, axes and tick numbers for a 2D rect. */
  axes(rect: Rect2D, o: AxesOpts = {}): Group {
    const step = o.step ?? 1;
    const g = new Group();
    g.add(gridLines(rect, step, o.majorEvery ?? 0));
    const w = this.px(2);
    if (rect.y0 <= 0 && rect.y1 >= 0)
      g.add(new Stroke([{ x: rect.x0, y: 0 }, { x: rect.x1, y: 0 }], { color: C.axis, width: w, z: Z.grid + 0.5 }));
    if (!o.noY && rect.x0 <= 0 && rect.x1 >= 0)
      g.add(new Stroke([{ x: 0, y: rect.y0 }, { x: 0, y: rect.y1 }], { color: C.axis, width: w, z: Z.grid + 0.5 }));
    const every = o.labelEvery ?? 1;
    if (every > 0) {
      const lab = (text: string, x: number, y: number, anchor: 'below' | 'left') =>
        this.labels.add({ text, at: { x, y }, anchor, className: 'tick', decorative: true });
      for (let i = Math.ceil(rect.x0 / step); i <= Math.floor(rect.x1 / step); i++) {
        if (i === 0 || i % every !== 0) continue;
        const x = i * step;
        if (x <= rect.x0 + step * 0.4 || x >= rect.x1 - step * 0.4) continue;
        lab(String(Number(x.toFixed(4))).replace('-', '−'), x, 0, 'below');
      }
      if (!o.noY)
        for (let j = Math.ceil(rect.y0 / step); j <= Math.floor(rect.y1 / step); j++) {
          if (j === 0 || j % every !== 0) continue;
          const y = j * step;
          if (y <= rect.y0 + step * 0.4 || y >= rect.y1 - step * 0.4) continue;
          lab(String(Number(y.toFixed(4))).replace('-', '−'), 0, y, 'left');
        }
    }
    if (o.xName) this.labels.add({ text: o.xName, at: { x: rect.x1 - step * 0.3, y: 0 }, anchor: 'above', className: 'axis-name' });
    if (o.yName && !o.noY)
      this.labels.add({ text: o.yName, at: { x: 0, y: rect.y1 - step * 0.3 }, anchor: 'right', className: 'axis-name' });
    this.add(g);
    return g;
  }

  /** Remove everything created since the last clear. */
  clear(): void {
    for (const a of this.anims) a.kill();
    this.anims.clear();
    for (const off of this.frameOffs) off();
    this.frameOffs = [];
    for (const fn of this.cleanups.splice(0)) fn();
    this.drag.clear();
    this.labels.clear();
    this.ui.clear();
    for (const child of [...this.root.children]) {
      gsap.killTweensOf(child);
      disposeObject(child);
    }
  }

  dispose(): void {
    this.clear();
    this.drag.dispose();
    this.labels.dispose();
    this.root.removeFromParent();
  }
}
