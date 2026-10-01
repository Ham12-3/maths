/**
 * Drawing primitives. 2D shapes live on the z = 0 plane (a small z offset sets layering);
 * strokes are real triangles so they can be any thickness on every GPU.
 * Every object owns its own geometry + material, so `disposeObject` can free it safely.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  RingGeometry,
  ShapeUtils,
  SphereGeometry,
  Vector2,
  Vector3,
  type ColorRepresentation,
} from 'three';
import type { V2 } from '../math/vec';
import { dashPath, trimPath } from '../math/path';
import type { Rect2D } from './scene-manager';

/** Layer depths for 2D scenes (bigger = in front). */
export const Z = {
  grid: -2,
  fill: -1,
  area: -0.5,
  line: 0,
  shape: 0.5,
  point: 1,
  handle: 2,
} as const;

export function basicMaterial(color: ColorRepresentation, opacity = 1): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: DoubleSide,
  });
}

/** Free GPU memory for an object tree and detach it. */
export function disposeObject(root: Object3D): void {
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as Material | Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
  root.removeFromParent();
}

/** A mesh whose triangle list is rewritten in place (grows its buffer when needed). */
class DynamicMesh extends Mesh<BufferGeometry, MeshBasicMaterial> {
  private capacity = 0;

  constructor(color: ColorRepresentation, opacity: number, z: number) {
    super(new BufferGeometry(), basicMaterial(color, opacity));
    this.position.z = z;
    this.frustumCulled = false;
    this.ensure(6);
    this.geometry.setDrawRange(0, 0);
  }

  /** xy holds triangle vertices as flat x, y pairs. */
  protected writeTriangles(xy: number[]): void {
    const n = xy.length / 2;
    this.ensure(n);
    const attr = this.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < n; i++) {
      arr[i * 3] = xy[i * 2] as number;
      arr[i * 3 + 1] = xy[i * 2 + 1] as number;
      arr[i * 3 + 2] = 0;
    }
    attr.needsUpdate = true;
    this.geometry.setDrawRange(0, n);
  }

  private ensure(n: number): void {
    if (n <= this.capacity) return;
    const cap = Math.max(n, this.capacity * 2, 6);
    const old = this.geometry;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(cap * 3), 3));
    this.geometry = g;
    old.dispose();
    this.capacity = cap;
  }

  get opacity(): number {
    return this.material.opacity;
  }
  set opacity(v: number) {
    this.material.opacity = v;
  }
  setColor(c: ColorRepresentation): void {
    this.material.color.set(c);
  }
}

export interface StrokeOpts {
  color: ColorRepresentation;
  width: number;
  opacity?: number;
  z?: number;
  closed?: boolean;
  /** [dash length, gap length] in world units */
  dash?: [number, number];
}

/** A thick polyline with mitred corners. Animate `draw` (0..1) to make it draw itself. */
export class Stroke extends DynamicMesh {
  private pts: V2[] = [];
  private _draw = 1;
  private _width: number;
  closed: boolean;
  dash?: [number, number];

  constructor(points: V2[], opts: StrokeOpts) {
    super(opts.color, opts.opacity ?? 1, opts.z ?? Z.line);
    this._width = opts.width;
    this.closed = opts.closed ?? false;
    this.dash = opts.dash;
    this.setPoints(points);
  }

  setPoints(points: V2[]): this {
    this.pts = points.map((p) => ({ x: p.x, y: p.y }));
    this.rebuild();
    return this;
  }

  get points(): V2[] {
    return this.pts;
  }

  get draw(): number {
    return this._draw;
  }
  set draw(t: number) {
    this._draw = t;
    this.rebuild();
  }

  /** Line thickness in world units (tweenable). */
  get width(): number {
    return this._width;
  }
  set width(w: number) {
    this._width = w;
    this.rebuild();
  }

  rebuild(): void {
    let path = this.pts;
    if (this.closed && path.length > 2) path = [...path, path[0] as V2];
    if (this._draw < 1) path = trimPath(path, Math.max(0, this._draw));
    const paths = this.dash ? dashPath(path, this.dash[0], this.dash[1]) : [path];
    const out: number[] = [];
    const closedLoop = this.closed && this._draw >= 1 && !this.dash;
    for (const p of paths) strokeTriangles(p, this._width / 2, closedLoop, out);
    this.writeTriangles(out);
  }
}

function strokeTriangles(raw: V2[], hw: number, closed: boolean, out: number[]): void {
  const p: V2[] = [];
  for (const q of raw) {
    const last = p[p.length - 1];
    if (!last || Math.hypot(q.x - last.x, q.y - last.y) > 1e-9) p.push(q);
  }
  const n = p.length;
  if (n < 2) return;
  const first = p[0] as V2;
  const lastP = p[n - 1] as V2;
  const loop = closed && n > 2 && Math.hypot(first.x - lastP.x, first.y - lastP.y) < 1e-9;
  const L: V2[] = [];
  const R: V2[] = [];
  const dir = (a: V2, b: V2): V2 => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  };
  for (let i = 0; i < n; i++) {
    const cur = p[i] as V2;
    let dIn: V2 | null = i > 0 ? dir(p[i - 1] as V2, cur) : loop ? dir(p[n - 2] as V2, cur) : null;
    let dOut: V2 | null = i < n - 1 ? dir(cur, p[i + 1] as V2) : loop ? dir(cur, p[1] as V2) : null;
    dIn ??= dOut;
    dOut ??= dIn;
    const a = dIn as V2;
    const b = dOut as V2;
    let mx = -a.y - b.y;
    let my = a.x + b.x;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) {
      mx = -b.y;
      my = b.x;
    } else {
      mx /= ml;
      my /= ml;
    }
    const cos = mx * -b.y + my * b.x;
    const len = hw / Math.max(cos, 0.3);
    L.push({ x: cur.x + mx * len, y: cur.y + my * len });
    R.push({ x: cur.x - mx * len, y: cur.y - my * len });
  }
  for (let i = 0; i < n - 1; i++) {
    const l0 = L[i] as V2;
    const r0 = R[i] as V2;
    const l1 = L[i + 1] as V2;
    const r1 = R[i + 1] as V2;
    out.push(l0.x, l0.y, r0.x, r0.y, l1.x, l1.y, r0.x, r0.y, r1.x, r1.y, l1.x, l1.y);
  }
}

/** A filled 2D shape. */
export class Fill extends DynamicMesh {
  constructor(color: ColorRepresentation, opacity = 0.35, z: number = Z.fill) {
    super(color, opacity, z);
  }

  /** Any simple polygon (concave allowed). */
  setPolygon(pts: V2[]): this {
    if (pts.length < 3) {
      this.writeTriangles([]);
      return this;
    }
    const contour = pts.map((p) => new Vector2(p.x, p.y));
    const tris = ShapeUtils.triangulateShape(contour, []);
    const out: number[] = [];
    for (const t of tris) for (const i of t) out.push((contour[i] as Vector2).x, (contour[i] as Vector2).y);
    this.writeTriangles(out);
    return this;
  }

  /** Convex polygon (fan triangulation, cheapest). */
  setConvex(pts: V2[]): this {
    const out: number[] = [];
    const o = pts[0];
    if (o) {
      for (let i = 1; i < pts.length - 1; i++) {
        const b = pts[i] as V2;
        const c = pts[i + 1] as V2;
        out.push(o.x, o.y, b.x, b.y, c.x, c.y);
      }
    }
    this.writeTriangles(out);
    return this;
  }

  /** Region between two polylines with matching sample counts (e.g. curve and x-axis). */
  setBand(top: V2[], bottom: V2[]): this {
    const out: number[] = [];
    const n = Math.min(top.length, bottom.length);
    for (let i = 0; i < n - 1; i++) {
      const t0 = top[i] as V2;
      const t1 = top[i + 1] as V2;
      const b0 = bottom[i] as V2;
      const b1 = bottom[i + 1] as V2;
      out.push(t0.x, t0.y, b0.x, b0.y, t1.x, t1.y, b0.x, b0.y, b1.x, b1.y, t1.x, t1.y);
    }
    this.writeTriangles(out);
    return this;
  }

  /** Many axis-aligned rectangles in one mesh (Riemann sums). */
  setRects(rects: { x: number; y: number; w: number; h: number }[]): this {
    const out: number[] = [];
    for (const r of rects) {
      const x1 = r.x + r.w;
      const y1 = r.y + r.h;
      out.push(r.x, r.y, x1, r.y, x1, y1, r.x, r.y, x1, y1, r.x, y1);
    }
    this.writeTriangles(out);
    return this;
  }
}

/** A solid dot (2D). */
export class Dot extends Mesh<CircleGeometry, MeshBasicMaterial> {
  constructor(color: ColorRepresentation, radius: number, z: number = Z.point) {
    super(new CircleGeometry(radius, 40), basicMaterial(color));
    this.position.z = z;
  }
  at(p: V2): this {
    this.position.x = p.x;
    this.position.y = p.y;
    return this;
  }
}

/** An outline ring (2D). */
export class Ring extends Mesh<RingGeometry, MeshBasicMaterial> {
  constructor(color: ColorRepresentation, radius: number, thickness: number, z: number = Z.point) {
    super(new RingGeometry(radius - thickness / 2, radius + thickness / 2, 48), basicMaterial(color));
    this.position.z = z;
  }
}

/** A 2D arrow from `from` to `to`. Animate `grow` (0..1) to extend it from its tail. */
export class Arrow2D extends Group {
  readonly shaft: Stroke;
  readonly head: Fill;
  private from: V2 = { x: 0, y: 0 };
  private to: V2 = { x: 1, y: 0 };
  private _grow = 1;
  headLen: number;

  constructor(from: V2, to: V2, opts: { color: ColorRepresentation; width: number; z?: number; headLen?: number }) {
    super();
    const z = opts.z ?? Z.line;
    this.headLen = opts.headLen ?? opts.width * 4;
    this.shaft = new Stroke([], { color: opts.color, width: opts.width, z });
    this.head = new Fill(opts.color, 1, z);
    this.add(this.shaft, this.head);
    this.set(from, to);
  }

  set(from: V2, to: V2): this {
    this.from = { x: from.x, y: from.y };
    this.to = { x: to.x, y: to.y };
    this.rebuild();
    return this;
  }

  get grow(): number {
    return this._grow;
  }
  set grow(t: number) {
    this._grow = t;
    this.rebuild();
  }

  setColor(c: ColorRepresentation): void {
    this.shaft.setColor(c);
    this.head.setColor(c);
  }

  get opacity(): number {
    return this.shaft.opacity;
  }
  set opacity(v: number) {
    this.shaft.opacity = v;
    this.head.opacity = v;
  }

  private rebuild(): void {
    const t = Math.max(0, this._grow);
    const tip = { x: this.from.x + (this.to.x - this.from.x) * t, y: this.from.y + (this.to.y - this.from.y) * t };
    const dx = tip.x - this.from.x;
    const dy = tip.y - this.from.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) {
      this.shaft.setPoints([]);
      this.head.setConvex([]);
      return;
    }
    const ux = dx / len;
    const uy = dy / len;
    const hl = Math.min(this.headLen, len * 0.6);
    const hw = hl * 0.55;
    const base = { x: tip.x - ux * hl, y: tip.y - uy * hl };
    this.shaft.setPoints([this.from, { x: base.x + ux * hl * 0.2, y: base.y + uy * hl * 0.2 }]);
    this.head.setConvex([tip, { x: base.x - uy * hw, y: base.y + ux * hw }, { x: base.x + uy * hw, y: base.y - ux * hw }]);
  }
}

/** Points along a circular arc (angles in radians). */
export function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, segments = 48): V2[] {
  const pts: V2[] = [];
  const n = Math.max(2, Math.ceil((segments * Math.abs(a1 - a0)) / (Math.PI * 2)) + 1);
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** The little square that marks a right angle at `corner`, between directions u and v. */
export function rightAnglePoints(corner: V2, u: V2, v: V2, size: number): V2[] {
  const lu = Math.hypot(u.x, u.y) || 1;
  const lv = Math.hypot(v.x, v.y) || 1;
  const a = { x: (u.x / lu) * size, y: (u.y / lu) * size };
  const b = { x: (v.x / lv) * size, y: (v.y / lv) * size };
  return [
    { x: corner.x + a.x, y: corner.y + a.y },
    { x: corner.x + a.x + b.x, y: corner.y + a.y + b.y },
    { x: corner.x + b.x, y: corner.y + b.y },
  ];
}

/** Background grid lines (thin, 1px) for a rect. Every `majorEvery` line is brighter. */
export function gridLines(rect: Rect2D, step: number, majorEvery = 0): Group {
  const g = new Group();
  const minor: number[] = [];
  const major: number[] = [];
  const push = (arr: number[], x0: number, y0: number, x1: number, y1: number) => arr.push(x0, y0, 0, x1, y1, 0);
  const i0 = Math.ceil(rect.x0 / step);
  const i1 = Math.floor(rect.x1 / step);
  for (let i = i0; i <= i1; i++) {
    if (i === 0) continue;
    const x = i * step;
    push(majorEvery && i % majorEvery === 0 ? major : minor, x, rect.y0, x, rect.y1);
  }
  const j0 = Math.ceil(rect.y0 / step);
  const j1 = Math.floor(rect.y1 / step);
  for (let j = j0; j <= j1; j++) {
    if (j === 0) continue;
    const y = j * step;
    push(majorEvery && j % majorEvery === 0 ? major : minor, rect.x0, y, rect.x1, y);
  }
  for (const [arr, color] of [
    [minor, '#1d2340'],
    [major, '#2c3558'],
  ] as const) {
    if (!arr.length) continue;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(arr), 3));
    const ls = new LineSegments(geo, new LineBasicMaterial({ color, transparent: true, depthWrite: false }));
    ls.position.z = Z.grid;
    g.add(ls);
  }
  return g;
}

// ---------------------------------------------------------------- 3D

const UP = new Vector3(0, 1, 0);

/** A solid 3D arrow (cylinder + cone). Call set(from, to) to move it. */
export class Arrow3D extends Group {
  readonly shaft: Mesh<CylinderGeometry, MeshStandardMaterial>;
  readonly head: Mesh<ConeGeometry, MeshStandardMaterial>;
  readonly from = new Vector3();
  readonly to = new Vector3();
  private _grow = 1;
  private headLen: number;

  constructor(color: ColorRepresentation, radius = 0.06) {
    super();
    this.headLen = radius * 5;
    const mat = () =>
      new MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05, emissive: new Color(color).multiplyScalar(0.18), transparent: true });
    this.shaft = new Mesh(new CylinderGeometry(radius, radius, 1, 20), mat());
    this.head = new Mesh(new ConeGeometry(radius * 2.6, this.headLen, 28), mat());
    this.add(this.shaft, this.head);
  }

  set(from: Vector3, to: Vector3): this {
    this.from.copy(from);
    this.to.copy(to);
    this.rebuild();
    return this;
  }

  get grow(): number {
    return this._grow;
  }
  set grow(t: number) {
    this._grow = t;
    this.rebuild();
  }

  get opacity(): number {
    return this.shaft.material.opacity;
  }
  set opacity(v: number) {
    this.shaft.material.opacity = v;
    this.head.material.opacity = v;
    this.visible = v > 0.001;
  }

  private rebuild(): void {
    const dir = new Vector3().subVectors(this.to, this.from).multiplyScalar(Math.max(0, this._grow));
    const len = dir.length();
    if (len < 1e-5) {
      this.shaft.visible = this.head.visible = false;
      return;
    }
    this.shaft.visible = this.head.visible = true;
    dir.normalize();
    const q = new Quaternion().setFromUnitVectors(UP, dir);
    const hl = Math.min(this.headLen, len * 0.5);
    const shaftLen = len - hl;
    this.shaft.quaternion.copy(q);
    this.shaft.scale.set(1, Math.max(shaftLen, 1e-4), 1);
    this.shaft.position.copy(this.from).addScaledVector(dir, shaftLen / 2);
    this.head.quaternion.copy(q);
    this.head.scale.set(1, hl / this.headLen, 1);
    this.head.position.copy(this.from).addScaledVector(dir, shaftLen + hl / 2);
  }
}

export function sphere(color: ColorRepresentation, radius: number): Mesh<SphereGeometry, MeshStandardMaterial> {
  return new Mesh(
    new SphereGeometry(radius, 24, 16),
    new MeshStandardMaterial({ color, roughness: 0.4, emissive: new Color(color).multiplyScalar(0.25), transparent: true }),
  );
}
