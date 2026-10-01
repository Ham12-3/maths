/** Root finding. Roots are returned sorted, with repeated roots reported once. */
import type { Fn } from './functions';

const EPS = 1e-12;

/** Real roots of ax² + bx + c = 0 (falls back to the linear case when a = 0). */
export function solveQuadratic(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < EPS) {
    if (Math.abs(b) < EPS) return [];
    return [-c / b];
  }
  const disc = b * b - 4 * a * c;
  if (disc < -EPS) return [];
  if (Math.abs(disc) <= EPS) return [-b / (2 * a)];
  const s = Math.sqrt(disc);
  // Numerically stable form (avoids cancellation).
  const q = -0.5 * (b + (b < 0 ? -s : s));
  return [q / a, c / q].sort((p, r) => p - r);
}

/** Discriminant b² − 4ac: > 0 two roots, = 0 one root, < 0 none. */
export const discriminant = (a: number, b: number, c: number): number => b * b - 4 * a * c;

/** Roots of a(x − h)² + k = 0. */
export function vertexRoots(a: number, h: number, k: number): number[] {
  if (Math.abs(a) < EPS) return [];
  const r = -k / a;
  if (r < -EPS) return [];
  if (Math.abs(r) <= EPS) return [h];
  const s = Math.sqrt(r);
  return [h - s, h + s];
}

/** Bisection on [lo, hi]; f(lo) and f(hi) must have opposite signs. */
export function bisect(f: Fn, lo: number, hi: number, tol = 1e-10, maxIter = 200): number {
  let flo = f(lo);
  const fhi = f(hi);
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (Math.sign(flo) === Math.sign(fhi)) throw new RangeError('f(lo) and f(hi) must have opposite signs');
  for (let i = 0; i < maxIter && hi - lo > tol; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (fm === 0) return mid;
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Find all sign-change roots of f on [x0, x1] by scanning n intervals then bisecting. */
export function findRoots(f: Fn, x0: number, x1: number, n = 400): number[] {
  const roots: number[] = [];
  let px = x0;
  let py = f(px);
  for (let i = 1; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = f(x);
    if (py === 0) roots.push(px);
    else if (y !== 0 && Math.sign(py) !== Math.sign(y)) roots.push(bisect(f, px, x));
    px = x;
    py = y;
  }
  if (py === 0) roots.push(px);
  return roots.filter((r, i) => i === 0 || Math.abs(r - (roots[i - 1] as number)) > 1e-7);
}
