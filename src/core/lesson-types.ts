/**
 * The lesson engine interface. A lesson is a plain object (see src/lessons/*.ts) — the runner
 * (runner.ts) turns it into the five-part experience: Hook → Explore → Explain → Practise → Recap.
 */
import type { Stage } from './stage';
import type { ViewSpec } from './scene-manager';

export type SectionId = 'hook' | 'explore' | 'explain' | 'practise' | 'recap';
export const SECTIONS: readonly SectionId[] = ['hook', 'explore', 'explain', 'practise', 'recap'];
export const SECTION_NAMES: Record<SectionId, string> = {
  hook: 'Hook',
  explore: 'Explore',
  explain: 'Explain',
  practise: 'Practise',
  recap: 'Recap',
};

export type Timeline = gsap.core.Timeline;

export interface LessonMeta {
  id: string;
  title: string;
  /** One-line description for the home screen. */
  blurb: string;
  /** Colour role name used to tint the lesson card. */
  accent: string;
}

/** Hook: a 5–10 second motion graphic. */
export interface HookDef {
  caption: string;
  view?: ViewSpec;
  play(stage: Stage): Timeline;
}

/** Explore: free play with handles, sliders and camera. */
export interface ExploreDef {
  caption: string;
  view?: ViewSpec;
  setup(stage: Stage): void;
}

export interface StepDef<S> {
  /** One short sentence (plain text with $maths$). */
  caption: string;
  /**
   * The equation so far, as separate TeX pieces. Pieces that are new compared with the
   * previous step animate in one by one, so equations build up step by step.
   */
  eq?: string[];
  /** When the new equation pieces appear in the step timeline (default: at the end). */
  eqAt?: gsap.Position;
  play(stage: Stage, state: S): Timeline;
}

/** Explain: 4–8 steps. `setup` builds the scene once (things start hidden); steps animate it. */
export interface ExplainDef<S> {
  view?: ViewSpec;
  setup(stage: Stage): S;
  steps: StepDef<S>[];
}

export type QuestionInput =
  | { kind: 'choice'; options: string[]; answer: number }
  | { kind: 'slider'; label: string; name: string; min: number; max: number; step: number; value: number; color?: string; format?: (v: number) => string }
  | { kind: 'drag' };

export interface QuestionRuntime {
  /** Is the answer right? `value` is the option index (choice) or slider value; unused for drag. */
  check?(value: number): boolean;
  /** Slider questions: called as the slider moves so the scene reacts. */
  onInput?(value: number): void;
  /** Animation that shows the idea again after a wrong answer. */
  hint?(): Timeline;
  /** Extra celebration in the scene after a right answer. */
  success?(): Timeline;
}

export interface QuestionDef {
  /** The question (plain text with $maths$). */
  prompt: string;
  input: QuestionInput;
  /** Shown after a wrong answer, alongside the hint animation. */
  hint: string;
  /** Shown after a right answer. */
  explain?: string;
  view?: ViewSpec;
  setup(stage: Stage): QuestionRuntime;
}

export interface RecapDef {
  points: string[];
  /** The key formula (TeX). */
  eq: string;
  view?: ViewSpec;
  /** A short replayable mini-animation. */
  play(stage: Stage): Timeline;
}

export interface LessonDef {
  meta: LessonMeta;
  /** Default camera view for every section that doesn't set its own. */
  view: ViewSpec;
  hook: HookDef;
  explore: ExploreDef;
  explain: ExplainDef<any>;
  practice: QuestionDef[];
  recap: RecapDef;
  /** Release any module-level state. Scene objects are freed by the Stage automatically. */
  dispose(): void;
}

/** Keeps the explain state type checked inside a lesson while storing it untyped in LessonDef. */
export const defineExplain = <S>(def: ExplainDef<S>): ExplainDef<S> => def;
