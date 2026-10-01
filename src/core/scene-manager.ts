import {
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Camera,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { C } from './colors';

export interface Rect2D {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface View2D {
  kind: '2d';
  rect: Rect2D;
}
export interface View3D {
  kind: '3d';
  position: [number, number, number];
  target: [number, number, number];
  /** Allow the learner to orbit the camera (default true). */
  orbit?: boolean;
}
export type ViewSpec = View2D | View3D;

type FrameFn = (dt: number) => void;

/**
 * Owns the single WebGL renderer, both cameras, resizing and the render loop.
 * One instance lives for the whole app so WebGL contexts are never leaked; lessons get a
 * fresh `Stage` (see stage.ts) whose disposal frees everything they created.
 */
export class SceneManager {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly ortho = new OrthographicCamera(-1, 1, 1, -1, -100, 100);
  readonly persp = new PerspectiveCamera(42, 1, 0.1, 500);
  readonly raycaster = new Raycaster();
  controls: OrbitControls | null = null;
  mode: '2d' | '3d' = '2d';
  width = 1;
  height = 1;

  private rect: Rect2D = { x0: -5, x1: 5, y0: -5, y1: 5 };
  private host: HTMLElement | null = null;
  private ro: ResizeObserver | null = null;
  private frameFns = new Set<FrameFn>();
  private raf = 0;
  private last = 0;
  private running = false;

  constructor() {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(C.bg, 1);
    this.renderer.domElement.className = 'stage-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.ortho.position.set(0, 0, 50);
    this.persp.position.set(6, 5, 8);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get camera(): Camera {
    return this.mode === '2d' ? this.ortho : this.persp;
  }

  /** Put the canvas inside `host` and start rendering. */
  attach(host: HTMLElement): void {
    this.host = host;
    host.prepend(this.canvas);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.start();
  }

  /** Stop rendering and remove the canvas. Scene contents must already be disposed by the Stage. */
  detach(): void {
    this.stop();
    this.ro?.disconnect();
    this.ro = null;
    this.setControls(false);
    this.canvas.remove();
    this.host = null;
    this.frameFns.clear();
    this.renderer.renderLists.dispose();
  }

  setView(view: ViewSpec): void {
    if (view.kind === '2d') {
      this.mode = '2d';
      this.setControls(false);
      this.setRect(view.rect);
    } else {
      this.mode = '3d';
      this.persp.position.set(...view.position);
      this.persp.lookAt(new Vector3(...view.target));
      this.setControls(view.orbit !== false, view.target);
    }
  }

  /** Visible world rectangle for 2D. The rect is always fully visible (letterboxed to fit). */
  get view2D(): Rect2D {
    return { ...this.rect };
  }

  setRect(rect: Rect2D): void {
    this.rect = { ...rect };
    this.applyRect();
  }

  /** World units per CSS pixel (2D). */
  get worldPerPixel(): number {
    return (this.ortho.top - this.ortho.bottom) / Math.max(1, this.height);
  }

  onFrame(fn: FrameFn): () => void {
    this.frameFns.add(fn);
    return () => this.frameFns.delete(fn);
  }

  /** Normalised device coords for a pointer event. */
  toNdc(clientX: number, clientY: number, out = new Vector2()): Vector2 {
    const r = this.canvas.getBoundingClientRect();
    return out.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  /** Intersect the pointer ray with a plane. Returns null if parallel. */
  pointerOnPlane(clientX: number, clientY: number, plane: Plane, out = new Vector3()): Vector3 | null {
    this.raycaster.setFromCamera(this.toNdc(clientX, clientY), this.camera);
    return this.raycaster.ray.intersectPlane(plane, out);
  }

  /** CSS pixel position (relative to the canvas) of a world point. */
  toScreen(p: Vector3, out = new Vector3()): { x: number; y: number; behind: boolean } {
    out.copy(p).project(this.camera);
    return { x: ((out.x + 1) / 2) * this.width, y: ((1 - out.y) / 2) * this.height, behind: out.z > 1 };
  }

  pick(clientX: number, clientY: number, objects: Object3D[]) {
    this.raycaster.setFromCamera(this.toNdc(clientX, clientY), this.camera);
    return this.raycaster.intersectObjects(objects, false);
  }

  get memory() {
    return { ...this.renderer.info.memory, programs: this.renderer.info.programs?.length ?? 0 };
  }

  private setControls(on: boolean, target?: [number, number, number]): void {
    if (!on) {
      this.controls?.dispose();
      this.controls = null;
      return;
    }
    if (!this.controls) {
      this.controls = new OrbitControls(this.persp, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.minDistance = 4;
      this.controls.maxDistance = 30;
      this.controls.enablePan = false;
    }
    if (target) this.controls.target.set(...target);
    this.controls.update();
  }

  private resize(): void {
    if (!this.host) return;
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();
    this.applyRect();
    this.render(0);
  }

  private applyRect(): void {
    const { x0, x1, y0, y1 } = this.rect;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const aspect = this.width / this.height;
    let hw = (x1 - x0) / 2;
    let hh = (y1 - y0) / 2;
    if (hw / hh > aspect) hh = hw / aspect;
    else hw = hh * aspect;
    this.ortho.left = cx - hw;
    this.ortho.right = cx + hw;
    this.ortho.top = cy + hh;
    this.ortho.bottom = cy - hh;
    this.ortho.updateProjectionMatrix();
  }

  private start(): void {
    if (this.running || !this.host || document.hidden) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.render(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Draw one frame immediately (used by tests/debugging while the loop is paused). */
  renderOnce(): void {
    this.render(0);
  }

  private render(dt: number): void {
    this.controls?.update();
    for (const fn of this.frameFns) fn(dt);
    this.renderer.render(this.scene, this.camera);
  }

  /** Pause rendering while the tab is hidden; resume when visible again. */
  private onVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };
}
