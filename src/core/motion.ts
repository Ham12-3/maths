/** Motion design constants + the reduced-motion preference. */

/** Consistent easing roles. Moves glide, appearances overshoot slightly, fades are soft. */
export const EASE = {
  move: 'power2.inOut',
  appear: 'back.out(1.7)',
  fade: 'power1.out',
  leave: 'power2.in',
  draw: 'power1.inOut',
} as const;

export const DUR = {
  quick: 0.3,
  base: 0.6,
  slow: 1.1,
  draw: 0.9,
} as const;

/** Gap between related elements so the eye follows them in order. */
export const STAGGER = 0.09;

type Listener = (reduced: boolean) => void;
const STORE_KEY = 'mathsTutor.reduceMotion';

class MotionPreference {
  private system = false;
  private override: boolean | null = null;
  private listeners = new Set<Listener>();

  constructor() {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.system = mq?.matches ?? false;
    mq?.addEventListener?.('change', (e) => {
      this.system = e.matches;
      this.emit();
    });
    try {
      const v = localStorage.getItem(STORE_KEY);
      if (v === 'on') this.override = true;
      else if (v === 'off') this.override = false;
    } catch {
      /* storage blocked: follow the system setting */
    }
  }

  get reduced(): boolean {
    return this.override ?? this.system;
  }

  set(reduced: boolean): void {
    this.override = reduced;
    try {
      localStorage.setItem(STORE_KEY, reduced ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    this.emit();
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.reduced);
  }
}

export const motion = new MotionPreference();

/** Use for small UI tweens (hover glow etc.): instant when motion is reduced. */
export const d = (seconds: number): number => (motion.reduced ? 0 : seconds);
