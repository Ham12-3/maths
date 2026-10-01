/** Riemann sums: approximating the area under a curve with rectangles. */
import type { Fn } from './functions';

export type RiemannMethod = 'left' | 'right' | 'mid';

export interface Rect {
  /** Left edge of the rectangle. */
  x: number;
  width: number;
  /** Signed height (negative below the axis). */
  height: number;
}

export function riemannRects(f: Fn, a: number, b: number, n: number, method: RiemannMethod = 'left'): Rect[] {
  if (!(n >= 1) || !Number.isFinite(n)) throw new RangeError('n must be at least 1');
  const count = Math.floor(n);
  const w = (b - a) / count;
  const rects: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const x = a + i * w;
    const sx = method === 'left' ? x : method === 'right' ? x + w : x + w / 2;
    rects.push({ x, width: w, height: f(sx) });
  }
  return rects;
}

export const riemannSum = (f: Fn, a: number, b: number, n: number, method: RiemannMethod = 'left'): number =>
  riemannRects(f, a, b, n, method).reduce((s, r) => s + r.width * r.height, 0);

/** Composite Simpson's rule — a very accurate area for smooth curves. */
export function simpson(f: Fn, a: number, b: number, n = 1000): number {
  const m = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / m;
  let s = f(a) + f(b);
  for (let i = 1; i < m; i++) s += f(a + i * h) * (i % 2 === 0 ? 2 : 4);
  return (s * h) / 3;
}
