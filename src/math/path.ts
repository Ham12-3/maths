/** Polyline helpers used for "draw-on" and dashed strokes. */
import type { V2 } from './vec';

export function pathLength(pts: readonly V2[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as V2;
    const b = pts[i] as V2;
    L += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return L;
}

/** The first `t` (0..1) of the path, measured by length. */
export function trimPath(pts: readonly V2[], t: number): V2[] {
  if (pts.length < 2 || t >= 1) return pts.map((p) => ({ x: p.x, y: p.y }));
  if (t <= 0) return [];
  const target = pathLength(pts) * t;
  const first = pts[0] as V2;
  const out: V2[] = [{ x: first.x, y: first.y }];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as V2;
    const b = pts[i] as V2;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + seg >= target) {
      const k = seg === 0 ? 0 : (target - acc) / seg;
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
      return out;
    }
    acc += seg;
    out.push({ x: b.x, y: b.y });
  }
  return out;
}

/** Split a path into dashes of length `on`, separated by gaps of length `off`. */
export function dashPath(pts: readonly V2[], on: number, off: number): V2[][] {
  const dashes: V2[][] = [];
  if (pts.length < 2 || on <= 0 || off < 0) return dashes;
  let drawing = true;
  let left = on;
  const first = pts[0] as V2;
  let cur: V2[] = [{ x: first.x, y: first.y }];
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1] as V2;
    const b = pts[i] as V2;
    let seg = Math.hypot(b.x - a.x, b.y - a.y);
    while (seg > 1e-12) {
      if (seg < left) {
        left -= seg;
        if (drawing) cur.push({ x: b.x, y: b.y });
        seg = 0;
      } else {
        const k = left / seg;
        const p = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
        if (drawing) {
          cur.push(p);
          dashes.push(cur);
        } else cur = [p];
        drawing = !drawing;
        seg -= left;
        a = p;
        left = drawing ? on : off;
        if (left === 0) {
          // zero-length gap: start the next dash straight away
          drawing = true;
          left = on;
          cur = [p];
        }
      }
    }
  }
  if (drawing && cur.length > 1) dashes.push(cur);
  return dashes;
}
