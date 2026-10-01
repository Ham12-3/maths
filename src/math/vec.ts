/** Plain 2D/3D vector maths. Works with any {x, y(, z)} object, including THREE vectors. */
export interface V2 {
  x: number;
  y: number;
}
export interface V3 extends V2 {
  z: number;
}

export const v2 = (x: number, y: number): V2 => ({ x, y });
export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });

export const add2 = (a: V2, b: V2): V2 => v2(a.x + b.x, a.y + b.y);
export const sub2 = (a: V2, b: V2): V2 => v2(a.x - b.x, a.y - b.y);
export const scale2 = (a: V2, k: number): V2 => v2(a.x * k, a.y * k);
export const dot2 = (a: V2, b: V2): number => a.x * b.x + a.y * b.y;
export const len2 = (a: V2): number => Math.hypot(a.x, a.y);
export const dist2 = (a: V2, b: V2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp2 = (a: V2, b: V2, t: number): V2 => v2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
/** Rotate 90° anticlockwise. */
export const perp2 = (a: V2): V2 => v2(-a.y, a.x);
export function norm2(a: V2): V2 {
  const l = len2(a);
  return l === 0 ? v2(0, 0) : v2(a.x / l, a.y / l);
}

export const add3 = (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub3 = (a: V3, b: V3): V3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale3 = (a: V3, k: number): V3 => v3(a.x * k, a.y * k, a.z * k);
export const dot3 = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const len3 = (a: V3): number => Math.hypot(a.x, a.y, a.z);
export const cross3 = (a: V3, b: V3): V3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const lerp3 = (a: V3, b: V3, t: number): V3 =>
  v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
export const equals3 = (a: V3, b: V3, eps = 1e-9): boolean =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.z - b.z) < eps;
