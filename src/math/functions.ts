/** Function evaluation helpers. Each returns a plain (x) => y function. */
import type { V2 } from './vec';

export type Fn = (x: number) => number;

export const linear = (m: number, c: number): Fn => (x) => m * x + c;

/** Vertex form y = a(x − h)² + k */
export const quadVertex = (a: number, h: number, k: number): Fn => (x) => a * (x - h) * (x - h) + k;

/** Convert vertex form to y = ax² + bx + c. */
export function vertexToStandard(a: number, h: number, k: number): { a: number; b: number; c: number } {
  return { a, b: -2 * a * h, c: a * h * h + k };
}

/** Convert y = ax² + bx + c to vertex form (a must not be 0). */
export function standardToVertex(a: number, b: number, c: number): { a: number; h: number; k: number } {
  if (a === 0) throw new RangeError('Not a quadratic: a = 0');
  const h = -b / (2 * a);
  return { a, h, k: c - (b * b) / (4 * a) };
}

/** Polynomial from coefficients, lowest power first: [c0, c1, c2] → c0 + c1·x + c2·x². */
export const poly =
  (coeffs: readonly number[]): Fn =>
  (x) => {
    let y = 0;
    for (let i = coeffs.length - 1; i >= 0; i--) y = y * x + (coeffs[i] ?? 0);
    return y;
  };

/** Exact derivative coefficients of a polynomial (same ordering as `poly`). */
export const polyDerivative = (coeffs: readonly number[]): number[] => coeffs.slice(1).map((c, i) => c * (i + 1));

/** Exact antiderivative coefficients (constant of integration 0). */
export const polyIntegral = (coeffs: readonly number[]): number[] => [0, ...coeffs.map((c, i) => c / (i + 1))];

/** Central-difference numerical derivative. */
export const derivative = (f: Fn, x: number, h = 1e-4): number => (f(x + h) - f(x - h)) / (2 * h);

/** Evenly spaced samples of f on [x0, x1]; n is the number of intervals (n + 1 points). */
export function sample(f: Fn, x0: number, x1: number, n: number): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    pts.push({ x, y: f(x) });
  }
  return pts;
}

/** Tangent line to f at x0, as y = m x + c. */
export function tangentAt(f: Fn, x0: number): { m: number; c: number } {
  const m = derivative(f, x0);
  return { m, c: f(x0) - m * x0 };
}
