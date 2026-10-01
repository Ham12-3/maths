/** Small geometry + number helpers used by the lessons. */

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Round to the nearest multiple of `step` (and tidy floating point noise). */
export function snap(v: number, step: number): number {
  if (step <= 0) return v;
  const r = Math.round(v / step) * step;
  const tidy = Number(r.toFixed(10));
  return tidy === 0 ? 0 : tidy; // never return -0
}

/** Like snap, but only pulls the value in when it is within `radius` of a multiple of `step`. */
export function magnet(v: number, step: number, radius: number): number {
  const s = snap(v, step);
  return Math.abs(s - v) <= radius ? s : v;
}

export const hypotenuse = (a: number, b: number): number => Math.sqrt(a * a + b * b);

/** Missing short side of a right triangle, given the hypotenuse c and the other short side. */
export function shortSide(c: number, other: number): number {
  const d = c * c - other * other;
  if (d < 0) throw new RangeError('The hypotenuse must be the longest side');
  return Math.sqrt(d);
}

/** True when the three lengths (any order) make a right-angled triangle. */
export function isRightTriangle(x: number, y: number, z: number, tol = 1e-9): boolean {
  const [a, b, c] = [x, y, z].sort((p, q) => p - q) as [number, number, number];
  return Math.abs(a * a + b * b - c * c) <= tol * Math.max(1, c * c);
}

export const degToRad = (d: number): number => (d * Math.PI) / 180;
export const radToDeg = (r: number): number => (r * 180) / Math.PI;

/** Angle of the point (x, y) measured anticlockwise from the positive x-axis, in [0, 360). */
export function angleDeg(x: number, y: number): number {
  const d = radToDeg(Math.atan2(y, x));
  const n = ((d % 360) + 360) % 360;
  return Math.abs(n - 360) < 1e-9 ? 0 : n;
}

/** Point on the unit circle at `deg` degrees. Rounds tiny values to exactly 0. */
export function unitCircle(deg: number): { x: number; y: number } {
  const r = degToRad(deg);
  const tidy = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
  return { x: tidy(Math.cos(r)), y: tidy(Math.sin(r)) };
}

/** Format a number for display: rounds, drops trailing zeros and uses a real minus sign. */
export function fmt(v: number, dp = 2): string {
  const n = Number(v.toFixed(dp));
  if (n === 0) return '0';
  return n.toString().replace('-', '−');
}

/** Same as fmt but with a plain hyphen-minus, for KaTeX input. */
export function fmtTex(v: number, dp = 2): string {
  const n = Number(v.toFixed(dp));
  return n === 0 ? '0' : n.toString();
}
