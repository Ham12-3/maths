/** Learner progress, saved in localStorage. */
import type { SectionId } from './lesson-types';

export type Status = 'not-started' | 'in-progress' | 'done';

export interface LessonProgress {
  visited: SectionId[];
  /** Indices of practice questions answered correctly. */
  solved: number[];
  done: boolean;
  last?: { section: SectionId; step: number };
}

type KV = Pick<Storage, 'getItem' | 'setItem'>;

function memoryStorage(): KV {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

function defaultStorage(): KV {
  try {
    const s = globalThis.localStorage;
    const probe = '__probe__';
    s.setItem(probe, probe);
    s.removeItem(probe);
    return s;
  } catch {
    return memoryStorage(); // private mode / blocked storage: keep progress for this visit only
  }
}

export class ProgressStore {
  private data: Record<string, LessonProgress> = {};

  constructor(
    private storage: KV = defaultStorage(),
    private key = 'mathsTutor.progress.v1',
  ) {
    try {
      const raw = storage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') this.data = parsed as Record<string, LessonProgress>;
    } catch {
      this.data = {};
    }
  }

  get(id: string): LessonProgress {
    const p = this.data[id];
    return {
      visited: [...(p?.visited ?? [])],
      solved: [...(p?.solved ?? [])],
      done: p?.done ?? false,
      last: p?.last,
    };
  }

  status(id: string): Status {
    const p = this.data[id];
    if (!p) return 'not-started';
    return p.done ? 'done' : 'in-progress';
  }

  visit(id: string, section: SectionId, step = 0): void {
    const p = this.get(id);
    if (!p.visited.includes(section)) p.visited.push(section);
    p.last = { section, step };
    this.put(id, p);
  }

  solve(id: string, question: number): void {
    const p = this.get(id);
    if (!p.solved.includes(question)) p.solved.push(question);
    p.solved.sort((a, b) => a - b);
    this.put(id, p);
  }

  /** A lesson is done once the recap is reached with every practice question solved. */
  checkDone(id: string, questionCount: number): boolean {
    const p = this.get(id);
    const done = p.visited.includes('recap') && p.solved.length >= questionCount;
    if (done && !p.done) {
      p.done = true;
      this.put(id, p);
    }
    return p.done || done;
  }

  reset(id?: string): void {
    if (id) delete this.data[id];
    else this.data = {};
    this.save();
  }

  private put(id: string, p: LessonProgress): void {
    this.data[id] = p;
    this.save();
  }

  private save(): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(this.data));
    } catch {
      /* quota or blocked storage: progress stays in memory */
    }
  }
}
