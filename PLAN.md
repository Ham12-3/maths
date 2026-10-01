# Build plan

## File structure

```
index.html
src/
  main.ts                 boot: palette → CSS vars, router (#/ and #/lesson/:id/:section?)
  styles.css
  core/
    colors.ts             colour roles (one colour per quantity, shared by every lesson)
    motion.ts             easing/duration constants, reduced-motion preference
    scene-manager.ts      single WebGLRenderer, ortho + perspective cameras, resize, loop, visibility pause
    stage.ts              per-section container: scene root, labels, drag handles, panel UI, gsap context; clear() disposes all
    draw.ts               2D primitives (thick strokes, fills, dots, arrows, grid) + 3D arrows
    labels.ts             HTML labels pinned to world positions (crisp text + KaTeX)
    drag.ts               raycast dragging, snapping, hover glow, keyboard proxies
    ui.ts                 panel widgets (sliders, readouts, buttons)
    tex.ts                KaTeX helpers, rich text with $…$
    anim.ts               small GSAP helpers (pop, fade, draw-on)
    progress.ts           localStorage progress store
    lesson-types.ts       the lesson engine interface
    runner.ts             runs a lesson: hook → explore → explain → practise → recap
  ui/
    home.ts, lesson-view.ts
  math/                   pure helpers + *.test.ts (vec, functions, roots, riemann, geometry, path)
  lessons/
    index.ts              registry (order)
    pythagoras.ts linear.ts quadratics.ts trig.ts vectors3d.ts calculus.ts
```

## Lesson engine interface

```ts
interface LessonDef {
  meta: { id; title; blurb; accent };
  view: ViewSpec;                                  // '2d' rect or '3d' camera
  hook:    { caption; play(stage): Timeline };     // 5–10 s intro
  explore: { caption; setup(stage): void };        // free play
  explain: { setup(stage): S; steps: { caption; eq?: string[]; play(stage, s): Timeline }[] };
  practice: { prompt; input: choice|slider|drag; hint; setup(stage): { check?, onInput?, hint?(), success?() } }[];
  recap:   { points; eq; play(stage): Timeline };
  dispose(): void;
}
```

The runner owns one `Stage` per section; `stage.clear()` kills tweens and disposes every
geometry, material, label, handle and listener, so switching section/lesson cannot leak.
Explain steps are rebuilt from `setup()` and earlier steps are fast-forwarded, so Next/Back
always land on a consistent state.

## Build order

1. Scaffold (Vite, TS strict, Vitest), math helpers + tests.
2. Core: scene manager, stage, draw, labels, drag, UI, runner, home screen.
3. Lesson 1 Pythagoras end to end → verify in browser (console clean, memory flat) + tests.
4. Lessons 2–6, verifying each the same way.
5. README, final build/test pass.
