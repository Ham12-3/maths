import { describe, expect, it } from 'vitest';
import { ProgressStore } from './progress';

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    raw: m,
  };
}

describe('ProgressStore', () => {
  it('starts as not started', () => {
    const p = new ProgressStore(memory());
    expect(p.status('pythagoras')).toBe('not-started');
    expect(p.get('pythagoras')).toEqual({ visited: [], solved: [], done: false, last: undefined });
  });

  it('tracks visits, the last position and solved questions', () => {
    const p = new ProgressStore(memory());
    p.visit('pythagoras', 'hook');
    p.visit('pythagoras', 'explain', 3);
    p.solve('pythagoras', 2);
    p.solve('pythagoras', 0);
    p.solve('pythagoras', 2);
    const g = p.get('pythagoras');
    expect(p.status('pythagoras')).toBe('in-progress');
    expect(g.visited).toEqual(['hook', 'explain']);
    expect(g.last).toEqual({ section: 'explain', step: 3 });
    expect(g.solved).toEqual([0, 2]);
  });

  it('is done only after the recap with every question solved', () => {
    const p = new ProgressStore(memory());
    p.visit('linear', 'recap');
    p.solve('linear', 0);
    expect(p.checkDone('linear', 2)).toBe(false);
    p.solve('linear', 1);
    expect(p.checkDone('linear', 2)).toBe(true);
    expect(p.status('linear')).toBe('done');
  });

  it('persists between instances and can be reset', () => {
    const store = memory();
    const a = new ProgressStore(store);
    a.visit('trig', 'explore');
    const b = new ProgressStore(store);
    expect(b.status('trig')).toBe('in-progress');
    b.reset('trig');
    expect(new ProgressStore(store).status('trig')).toBe('not-started');
  });

  it('survives corrupt or failing storage', () => {
    const bad = { getItem: () => '{not json', setItem: () => {
      throw new Error('quota');
    } };
    const p = new ProgressStore(bad);
    expect(p.status('x')).toBe('not-started');
    expect(() => p.visit('x', 'hook')).not.toThrow();
    expect(p.status('x')).toBe('in-progress');
  });
});
