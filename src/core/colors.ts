/**
 * Colour roles. Every quantity keeps ONE colour across every lesson, so learners can
 * "read" a picture by colour alone. Lessons must use these names, never raw hex values.
 */
export const C = {
  /** a, x, run, "across", cos θ, vector u */
  a: '#4ea8ff',
  /** b, y, rise, height, sin θ, vector v */
  b: '#ffa94d',
  /** c (hypotenuse), any result: u + v, √(a² + b²) */
  c: '#c084fc',
  /** slope, gradient, tangent, steepness */
  slope: '#4ade80',
  /** y-intercept (the "+ c" in y = mx + c) */
  intercept: '#f472b6',
  /** a curve / function graph */
  curve: '#22d3ee',
  /** angles (θ) */
  angle: '#facc15',
  /** roots: where a graph meets the x-axis */
  root: '#f87171',
  /** area under a curve */
  area: '#818cf8',

  // Neutrals
  ink: '#eef1fb',
  muted: '#a3abc9',
  axis: '#7680a6',
  grid: '#232a45',
  gridMajor: '#323b5e',
  bg: '#0e1220',
  panel: '#151a2e',
  good: '#4ade80',
  warn: '#fbbf24',
} as const;

export type ColorRole = keyof typeof C;

/** KaTeX colour wrapper: tc('a', 'a^2') → \textcolor{#4ea8ff}{a^2} */
export const tc = (role: ColorRole, tex: string): string => `\\textcolor{${C[role]}}{${tex}}`;

/** Publish the palette as CSS custom properties (--c-a, --c-b, …) so CSS shares one source. */
export function applyPaletteToCss(root: HTMLElement = document.documentElement): void {
  for (const [k, v] of Object.entries(C)) root.style.setProperty(`--c-${k}`, v);
}
