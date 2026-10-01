# Motion Maths

An interactive maths tutor for learners aged 13–18. Every idea is something you **see moving**
and **move yourself**: drag the corners of a triangle, turn a line, push a parabola around,
spin a point round a circle, grab arrows in 3D, and slide a tangent along a curve.

Six lessons, each in five parts:

| # | Lesson | What moves |
|---|--------|-----------|
| 1 | Pythagoras | Squares grow off each side; the small squares break into tiles that exactly fill the big one |
| 2 | Straight lines | `y = mx + c` turns and slides; a rise-over-run staircase shows the slope |
| 3 | Quadratics | Drag the vertex; roots pop in and out as the curve crosses the x-axis |
| 4 | Sine and the circle | A point goes round the unit circle while its height unrolls into a sine wave |
| 5 | Vectors in 3D | Draggable 3D arrows, tip-to-tail addition, orbit camera |
| 6 | Calculus | A tangent slides along a curve (derivative); rectangles thin out to fill the area (integral) |

Each lesson runs **Hook → Explore → Explain → Practise → Recap**. Progress is saved in the
browser (`localStorage`), so there is no backend.

## Running it

Requires Node 20+ (tested on Node 22).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest unit tests
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

`.npmrc` sets `legacy-peer-deps=true` to work around an npm 10 bug with Vitest's optional peer
dependencies — `npm install` needs no extra flags.

You can deep-link to any part of a lesson: `#/lesson/<id>/<section>/<step>`, for example
`#/lesson/quadratics/explain/5`.

## Using it

- **Drag** anything with a white ring (mouse, touch or pen). It glows when you hover it.
- **Keyboard**: `Tab` reaches every control, including the draggable points; arrow keys move
  the focused point (in 3D, `Shift + ↑/↓` moves it nearer or further).
- Explain steps and intros have **play / pause / replay** and a **scrubber** to drag through
  the animation.
- **Motion: full / reduced** (top right) follows the operating-system setting by default. With
  reduced motion every animation jumps to its end and simply fades in.

## How it's built

- **Vite + TypeScript** (strict), **Three.js** for every scene (orthographic camera for 2D,
  perspective with orbit controls for 3D), **GSAP** timelines for all motion, **KaTeX** for
  maths, **Vitest** for tests.

```
src/
  main.ts                router (#/ and #/lesson/:id/:section/:step)
  core/
    lesson-types.ts      the lesson engine interface (start here)
    runner.ts            runs a lesson through its five sections
    stage.ts             everything a lesson puts on screen; clear() frees it all
    scene-manager.ts     the one WebGL renderer, cameras, resize, render loop
    draw.ts              2D strokes/fills/dots/arrows/grids, 3D arrows
    drag.ts              raycast dragging, snapping, hover glow, keyboard proxies
    labels.ts            crisp HTML labels pinned to world positions
    anim.ts              shared GSAP helpers (pop, drawOn, fadeIn, switchAt…)
    colors.ts motion.ts  colour roles, easing/duration constants, reduced motion
    ui.ts tex.ts         panel widgets, KaTeX helpers
    progress.ts          localStorage progress
  math/                  pure maths helpers + tests
  lessons/               one file per lesson + index.ts (the registry)
  ui/                    home screen and lesson-screen layout
```

### Design rules the code follows

- **Colour roles** (`core/colors.ts`): one colour per quantity in every lesson — blue for
  `a`/x/run/across, orange for `b`/y/rise/height, purple for `c`/results, green for slope,
  pink for intercept, teal for curves, yellow for angles, red for roots, indigo for area.
  Use `C.role` in scenes and `tc('role', tex)` in equations; never raw hex.
- **Easing** (`core/motion.ts`): `EASE.move` (power2.inOut) for moves, `EASE.appear`
  (back.out) for things appearing, consistent `DUR` durations, `STAGGER` between related items.
- **One idea moves at a time**: sequence a timeline rather than animating everything at once.
- **Memory**: one renderer for the whole app. Everything a lesson creates goes through its
  `Stage`, which disposes geometries, materials, labels, handles, listeners and tweens when
  you change section or leave the lesson. `devicePixelRatio` is capped at 2 and rendering
  pauses while the tab is hidden.

## Adding a new lesson

A lesson is a plain object that satisfies `LessonDef` (see `src/core/lesson-types.ts`).
Create `src/lessons/my-lesson.ts`:

```ts
import { C, tc } from '../core/colors';
import { drawOn, popLabel } from '../core/anim';
import { Dot, Stroke } from '../core/draw';
import { defineExplain, type LessonDef } from '../core/lesson-types';
import type { Rect2D } from '../core/scene-manager';

const RECT: Rect2D = { x0: -5, x1: 5, y0: -5, y1: 5 }; // the part of the 2D world to show

export const myLesson: LessonDef = {
  meta: { id: 'my-lesson', title: 'My lesson', blurb: 'One line for the home card.', accent: 'curve' },
  view: { kind: '2d', rect: RECT }, // or { kind: '3d', position: [x, y, z], target: [x, y, z] }

  // 1. Hook: a 5–10 second timeline.
  hook: {
    caption: 'Something intriguing in one sentence.',
    play(stage) {
      stage.axes(RECT, { xName: '$x$', yName: '$y$' });
      const line = stage.add(new Stroke([{ x: -4, y: -4 }, { x: 4, y: 4 }], { color: C.curve, width: stage.px(5) }));
      const tl = stage.timeline();
      drawOn(tl, line, 0, 1.5);
      return tl;
    },
  },

  // 2. Explore: free play. Add handles with stage.drag.add(), sliders with stage.ui.slider().
  explore: {
    caption: 'Drag the point.',
    setup(stage) {
      const dot = stage.add(new Dot(C.b, stage.px(8)));
      stage.drag.add({
        name: 'Point', at: { x: 0, y: 0 }, color: C.b, radius: stage.px(10),
        onMove: (p) => dot.at(p),
      });
    },
  },

  // 3. Explain: setup() builds everything once (hidden); each step animates it.
  //    eq pieces that are new compared with the previous step animate in one by one.
  explain: defineExplain({
    setup(stage) {
      const label = stage.labels.add({ text: 'Hello', at: { x: 0, y: 2 } });
      label.inner.style.opacity = '0';
      return { label };
    },
    steps: [
      { caption: 'Step one.', eq: ['y'], play: (stage, { label }) => popLabel(stage.timeline(), label, 0) },
      // … 4 to 8 steps in total
    ],
  }),

  // 4. Practise: 3–5 questions. input is 'choice', 'slider' or 'drag'.
  practice: [
    {
      prompt: 'What is $2 + 2$?',
      input: { kind: 'choice', options: ['$3$', '$4$'], answer: 1 },
      hint: 'Count on from 2.',
      setup: () => ({}), // may return check(), onInput(), hint() and success() timelines
    },
    // …
  ],

  // 5. Recap: key points, the key formula and a replayable mini-animation.
  recap: {
    points: ['Point one.'],
    eq: `${tc('curve', 'y')} = x`,
    play: (stage) => stage.timeline(),
  },

  dispose() {}, // only needed if the module keeps its own state
};
```

Then register it in `src/lessons/index.ts` (array order = home-screen order) and add a card
icon in `src/ui/home.ts`. `npm test` checks every lesson has 4–8 explain steps, 3–5 practice
questions, valid answers, balanced `$…$` maths and no broken TeX escapes.

### Tips

- Text fields (captions, prompts, hints, recap points) accept `$inline maths$` and `**bold**`.
- In TypeScript strings write TeX with a double backslash: `'\\theta'` (a single `\t` is a tab).
- Build state in `setup()` with things hidden, and use `fromTo` tweens in steps, so Next/Back
  and the scrubber always land on a consistent picture.
- For a state change partway through a timeline, use `switchAt()` from `core/anim.ts` instead
  of `tl.call()` — it reverses correctly when the learner scrubs backwards.
- In the dev server, `window.__tutor.memory()` shows live GPU geometries/textures and
  `__tutor.scrub(0..1000)` jumps the current animation.
