import { describe, expect, it } from 'vitest';
import { LESSONS } from './index';
import { standardTex } from './quadratics';

describe('lesson definitions follow the engine rules', () => {
  it('has unique ids', () => {
    const ids = LESSONS.map((l) => l.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const lesson of LESSONS) {
    describe(lesson.meta.title, () => {
      it('has 4 to 8 explain steps, each with a caption', () => {
        const steps = lesson.explain.steps;
        expect(steps.length).toBeGreaterThanOrEqual(4);
        expect(steps.length).toBeLessThanOrEqual(8);
        for (const s of steps) expect(s.caption.trim().length).toBeGreaterThan(0);
      });

      it('has 3 to 5 practice questions with valid inputs and hints', () => {
        const qs = lesson.practice;
        expect(qs.length).toBeGreaterThanOrEqual(3);
        expect(qs.length).toBeLessThanOrEqual(5);
        for (const q of qs) {
          expect(q.prompt.length).toBeGreaterThan(0);
          expect(q.hint.length).toBeGreaterThan(0);
          if (q.input.kind === 'choice') {
            expect(q.input.options.length).toBeGreaterThanOrEqual(2);
            expect(q.input.answer).toBeGreaterThanOrEqual(0);
            expect(q.input.answer).toBeLessThan(q.input.options.length);
          }
          if (q.input.kind === 'slider') {
            expect(q.input.min).toBeLessThan(q.input.max);
            expect(q.input.value).toBeGreaterThanOrEqual(q.input.min);
            expect(q.input.value).toBeLessThanOrEqual(q.input.max);
          }
        }
      });

      it('has a hook, explore, recap and dispose', () => {
        expect(lesson.hook.caption.length).toBeGreaterThan(0);
        expect(lesson.explore.caption.length).toBeGreaterThan(0);
        expect(lesson.recap.points.length).toBeGreaterThan(0);
        expect(lesson.recap.eq.length).toBeGreaterThan(0);
        expect(typeof lesson.dispose).toBe('function');
      });

      it('balances $ signs in every caption (inline maths)', () => {
        const texts = [
          lesson.hook.caption,
          lesson.explore.caption,
          ...lesson.explain.steps.map((s) => s.caption),
          ...lesson.practice.flatMap((q) => [q.prompt, q.hint, q.explain ?? '']),
          ...lesson.recap.points,
        ];
        for (const t of texts) expect((t.match(/\$/g) ?? []).length % 2, t).toBe(0);
      });

      it('has no control characters from mistyped TeX escapes (e.g. "\\theta" → tab)', () => {
        const texts = [
          lesson.hook.caption,
          lesson.explore.caption,
          lesson.recap.eq,
          ...lesson.explain.steps.flatMap((s) => [s.caption, ...(s.eq ?? [])]),
          ...lesson.practice.flatMap((q) => [q.prompt, q.hint, q.explain ?? '', ...(q.input.kind === 'choice' ? q.input.options : [])]),
          ...lesson.recap.points,
        ];
        // eslint-disable-next-line no-control-regex
        for (const t of texts) expect(/[\t\b\f\v\r]/.test(t), JSON.stringify(t)).toBe(false);
      });
    });
  }
});

describe('quadratic formatting', () => {
  it('writes ax² + bx + c tidily', () => {
    expect(standardTex(1, 0, -3)).toBe('x^2 - 3');
    expect(standardTex(-1, 2, 0)).toBe('-x^2 + 2x');
    expect(standardTex(2, -4, -6)).toBe('2x^2 - 4x - 6');
    expect(standardTex(0.5, -1, 1)).toBe('0.5x^2 - x + 1');
    expect(standardTex(0, 0, 0)).toBe('0');
  });
});
