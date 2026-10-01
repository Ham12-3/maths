import { describe, expect, it } from 'vitest';
import { add3, cross3, dot3, len2, len3, norm2, perp2, sub3, v2, v3 } from './vec';
import { angleDeg, clamp, fmt, hypotenuse, isRightTriangle, magnet, shortSide, snap, unitCircle } from './geometry';
import {
  derivative,
  linear,
  poly,
  polyDerivative,
  polyIntegral,
  quadVertex,
  sample,
  standardToVertex,
  tangentAt,
  vertexToStandard,
} from './functions';
import { bisect, discriminant, findRoots, solveQuadratic, vertexRoots } from './roots';
import { riemannRects, riemannSum, simpson } from './riemann';
import { dashPath, pathLength, trimPath } from './path';

describe('vectors', () => {
  it('adds and subtracts 3D vectors component by component', () => {
    expect(add3(v3(2, 1, 3), v3(1, 2, -1))).toEqual(v3(3, 3, 2));
    expect(sub3(v3(3, 3, 2), v3(1, 2, -1))).toEqual(v3(2, 1, 3));
  });
  it('vector addition is commutative', () => {
    const u = v3(1.5, -2, 4);
    const w = v3(-3, 0.5, 2);
    expect(add3(u, w)).toEqual(add3(w, u));
  });
  it('computes lengths (Pythagoras in 2D and 3D)', () => {
    expect(len2(v2(3, 4))).toBe(5);
    expect(len3(v3(2, 3, 6))).toBe(7);
  });
  it('dot and cross products', () => {
    expect(dot3(v3(1, 2, 3), v3(4, -5, 6))).toBe(12);
    expect(cross3(v3(1, 0, 0), v3(0, 1, 0))).toEqual(v3(0, 0, 1));
  });
  it('normalises and rotates 2D vectors', () => {
    expect(len2(norm2(v2(10, -7)))).toBeCloseTo(1, 12);
    expect(norm2(v2(0, 0))).toEqual(v2(0, 0));
    expect(perp2(v2(1, 0))).toEqual(v2(-0, 1));
  });
});

describe('geometry', () => {
  it('finds the hypotenuse and missing short sides', () => {
    expect(hypotenuse(3, 4)).toBe(5);
    expect(hypotenuse(6, 8)).toBe(10);
    expect(shortSide(13, 12)).toBe(5);
    expect(() => shortSide(3, 4)).toThrow(RangeError);
  });
  it('recognises right-angled triangles in any order', () => {
    expect(isRightTriangle(3, 4, 5)).toBe(true);
    expect(isRightTriangle(13, 5, 12)).toBe(true);
    expect(isRightTriangle(4, 5, 6)).toBe(false);
    expect(isRightTriangle(1.5, 2, 2.5)).toBe(true);
  });
  it('snaps and clamps', () => {
    expect(snap(3.26, 0.5)).toBe(3.5);
    expect(snap(-0.2, 0.5)).toBe(0);
    expect(Object.is(snap(-0.2, 0.5), -0)).toBe(false);
    expect(snap(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(magnet(2.95, 1, 0.1)).toBe(3);
    expect(magnet(2.7, 1, 0.1)).toBe(2.7);
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
  });
  it('measures angles anticlockwise in [0, 360)', () => {
    expect(angleDeg(1, 0)).toBe(0);
    expect(angleDeg(0, 1)).toBeCloseTo(90);
    expect(angleDeg(-1, 0)).toBeCloseTo(180);
    expect(angleDeg(0, -1)).toBeCloseTo(270);
    expect(angleDeg(1, -1e-15)).toBe(0);
  });
  it('places points on the unit circle', () => {
    expect(unitCircle(0)).toEqual({ x: 1, y: 0 });
    expect(unitCircle(90)).toEqual({ x: 0, y: 1 });
    expect(unitCircle(180)).toEqual({ x: -1, y: 0 });
    expect(unitCircle(30).y).toBeCloseTo(0.5, 12);
  });
  it('formats numbers for display', () => {
    expect(fmt(3)).toBe('3');
    expect(fmt(2.5)).toBe('2.5');
    expect(fmt(-1.239)).toBe('−1.24');
    expect(fmt(-0.0001)).toBe('0');
  });
});

describe('functions', () => {
  it('evaluates straight lines', () => {
    const f = linear(2, 1);
    expect([f(-2), f(0), f(2)]).toEqual([-3, 1, 5]);
  });
  it('evaluates vertex-form quadratics and converts forms', () => {
    const f = quadVertex(2, 1, -8);
    expect(f(1)).toBe(-8);
    expect(f(3)).toBe(0);
    const s = vertexToStandard(2, 1, -8);
    expect(s).toEqual({ a: 2, b: -4, c: -6 });
    expect(standardToVertex(s.a, s.b, s.c)).toEqual({ a: 2, h: 1, k: -8 });
    expect(() => standardToVertex(0, 1, 1)).toThrow(RangeError);
  });
  it('evaluates polynomials, derivatives and integrals', () => {
    const coeffs = [2, 1.2, -0.9, 0.15];
    const f = poly(coeffs);
    expect(f(0)).toBe(2);
    expect(f(2)).toBeCloseTo(2, 12);
    const d = polyDerivative(coeffs);
    expect(d).toHaveLength(3);
    [1.2, -1.8, 0.45].forEach((c, i) => expect(d[i]).toBeCloseTo(c, 12));
    const F = poly(polyIntegral(coeffs));
    expect(F(5) - F(0)).toBeCloseTo(10.9375, 10);
  });
  it('numerical derivative matches the exact one', () => {
    const coeffs = [2, 1.2, -0.9, 0.15];
    const f = poly(coeffs);
    const df = poly(polyDerivative(coeffs));
    for (const x of [0, 0.5, 2, 3.7, 5]) expect(derivative(f, x)).toBeCloseTo(df(x), 6);
    const t = tangentAt((x) => x * x, 3);
    expect(t.m).toBeCloseTo(6, 6);
    expect(t.c).toBeCloseTo(-9, 6);
  });
  it('samples n + 1 evenly spaced points', () => {
    const pts = sample((x) => x * x, 0, 2, 4);
    expect(pts).toHaveLength(5);
    expect(pts[2]).toEqual({ x: 1, y: 1 });
  });
});

describe('roots', () => {
  it('solves quadratics with 2, 1 or 0 real roots', () => {
    expect(solveQuadratic(1, -2, -3)).toEqual([-1, 3]);
    expect(solveQuadratic(1, -2, 1)).toEqual([1]);
    expect(solveQuadratic(1, 0, 4)).toEqual([]);
    expect(solveQuadratic(0, 2, -4)).toEqual([2]);
    expect(solveQuadratic(0, 0, 4)).toEqual([]);
  });
  it('is numerically stable for tiny roots', () => {
    const [r1, r2] = solveQuadratic(1, -1e8, 1);
    expect(r1).toBeCloseTo(1e-8, 15);
    expect(r2).toBeCloseTo(1e8, 0);
  });
  it('computes the discriminant', () => {
    expect(discriminant(1, -2, -3)).toBe(16);
  });
  it('finds roots of vertex-form quadratics', () => {
    expect(vertexRoots(1, 1, -4)).toEqual([-1, 3]);
    expect(vertexRoots(1, 2, 0)).toEqual([2]);
    expect(vertexRoots(1, 1, 3)).toEqual([]);
    expect(vertexRoots(-2, 0, 2)).toEqual([-1, 1]);
    expect(vertexRoots(0, 0, 2)).toEqual([]);
  });
  it('bisects and scans for roots', () => {
    expect(bisect((x) => x * x - 2, 0, 2)).toBeCloseTo(Math.SQRT2, 9);
    expect(() => bisect((x) => x * x + 1, -1, 1)).toThrow(RangeError);
    const df = poly([1.2, -1.8, 0.45]);
    const r = findRoots(df, 0, 5);
    expect(r).toHaveLength(2);
    expect(r[0]).toBeCloseTo((1.8 - Math.sqrt(1.08)) / 0.9, 8);
    expect(findRoots((x) => x, -1, 1, 4)).toEqual([0]);
  });
});

describe('riemann sums', () => {
  const sq = (x: number) => x * x;
  it('builds left, right and middle rectangles', () => {
    expect(riemannSum(sq, 0, 1, 4, 'left')).toBeCloseTo(0.21875, 12);
    expect(riemannSum(sq, 0, 1, 4, 'right')).toBeCloseTo(0.46875, 12);
    expect(riemannSum(sq, 0, 1, 4, 'mid')).toBeCloseTo(0.328125, 12);
    const rects = riemannRects(sq, 0, 2, 4);
    expect(rects).toHaveLength(4);
    expect(rects[1]).toEqual({ x: 0.5, width: 0.5, height: 0.25 });
  });
  it('gets closer to the true area as rectangles get thinner', () => {
    const f = poly([2, 1.2, -0.9, 0.15]);
    const exact = 10.9375;
    const errs = [5, 20, 100, 1000].map((n) => Math.abs(riemannSum(f, 0, 5, n) - exact));
    for (let i = 1; i < errs.length; i++) expect(errs[i]).toBeLessThan(errs[i - 1] as number);
    expect(errs[3]).toBeLessThan(0.01);
  });
  it('simpson is (near) exact for cubics', () => {
    expect(simpson(poly([2, 1.2, -0.9, 0.15]), 0, 5, 10)).toBeCloseTo(10.9375, 10);
    expect(simpson(Math.sin, 0, Math.PI, 101)).toBeCloseTo(2, 6);
  });
  it('rejects nonsense rectangle counts', () => {
    expect(() => riemannRects(sq, 0, 1, 0)).toThrow(RangeError);
    expect(() => riemannRects(sq, 0, 1, Number.NaN)).toThrow(RangeError);
  });
});

describe('paths', () => {
  const L = [v2(0, 0), v2(4, 0), v2(4, 3)];
  it('measures path length', () => {
    expect(pathLength(L)).toBe(7);
  });
  it('trims a path by length', () => {
    expect(trimPath(L, 0)).toEqual([]);
    expect(trimPath(L, 1)).toEqual(L);
    expect(trimPath(L, 2 / 7)).toEqual([v2(0, 0), v2(2, 0)]);
    const t = trimPath(L, 5 / 7);
    expect(t).toHaveLength(3);
    expect(t[2]!.x).toBeCloseTo(4);
    expect(t[2]!.y).toBeCloseTo(1);
  });
  it('splits a path into dashes', () => {
    const d = dashPath([v2(0, 0), v2(10, 0)], 2, 1);
    expect(d).toHaveLength(4); // 0-2, 3-5, 6-8, 9-10
    expect(d[1]).toEqual([v2(3, 0), v2(5, 0)]);
    expect(d[3]).toEqual([v2(9, 0), v2(10, 0)]);
    const corner = dashPath(L, 5, 1);
    expect(corner[0]).toHaveLength(3); // dash bends round the corner
  });
});
