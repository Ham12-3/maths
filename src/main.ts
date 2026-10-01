import './styles.css';
import gsap from 'gsap';
import { applyPaletteToCss } from './core/colors';
import { SECTIONS, type SectionId } from './core/lesson-types';
import { ProgressStore } from './core/progress';
import { LessonRunner } from './core/runner';
import { SceneManager } from './core/scene-manager';
import { LESSONS, findLesson } from './lessons';
import { mountHome } from './ui/home';
import { buildLessonView } from './ui/lesson-view';
import type { LessonDef } from './core/lesson-types';

applyPaletteToCss();

const app = document.getElementById('app') as HTMLElement;
const progress = new ProgressStore();
let sm: SceneManager | null = null;
let teardown: (() => void) | null = null;

function route(): void {
  teardown?.();
  teardown = null;
  const m = /^#\/lesson\/([\w-]+)(?:\/(\w+))?(?:\/(\d+))?/.exec(location.hash);
  const lesson = m ? findLesson(m[1] as string) : undefined;
  if (lesson) {
    const section = SECTIONS.includes(m?.[2] as SectionId) ? (m?.[2] as SectionId) : undefined;
    mountLesson(lesson, section, m?.[3] ? Number(m[3]) : undefined);
  } else {
    document.title = 'Motion Maths';
    teardown = mountHome(app, progress, route);
    focusHeading();
  }
}

function mountLesson(lesson: LessonDef, section?: SectionId, step?: number): void {
  const index = LESSONS.indexOf(lesson);
  const view = buildLessonView(lesson, index);
  app.replaceChildren(view.root);
  document.title = `${lesson.meta.title} · Motion Maths`;
  try {
    sm ??= new SceneManager();
  } catch {
    view.host.innerHTML =
      '<p class="webgl-error">Sorry — this lesson needs WebGL, which your browser has turned off or does not support.</p>';
    teardown = () => view.root.remove();
    return;
  }
  const scene = sm;
  scene.attach(view.host);
  const runner = new LessonRunner(lesson, scene, view, progress, {
    navigate: (r) => {
      location.hash = r;
    },
    next: LESSONS[index + 1],
    onSectionChange: (s, i) => history.replaceState(null, '', `#/lesson/${lesson.meta.id}/${s}/${i}`),
  });
  const last = progress.get(lesson.meta.id).last;
  const startSection = section ?? last?.section ?? 'hook';
  const startStep = step ?? (section ? 0 : (last?.step ?? 0));
  runner.goto(startSection, startStep);
  focusHeading();
  teardown = () => {
    runner.dispose();
    scene.detach();
    view.root.remove();
  };
}

/** Move focus to the page heading after navigation so screen readers announce the new page. */
function focusHeading(): void {
  const h = app.querySelector('h1');
  if (!h) return;
  h.setAttribute('tabindex', '-1');
  h.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

if (import.meta.env.DEV) {
  // Handy in the console: __tutor.memory() shows live GPU geometries/textures.
  (window as unknown as Record<string, unknown>).__tutor = {
    memory: () => {
      sm?.renderOnce();
      return sm?.memory;
    },
    tweens: () => gsap.globalTimeline.getChildren(true, true, true).length,
    tweenTargets: () =>
      gsap.globalTimeline.getChildren(true, true, false).map((t) => {
        const x = (t as gsap.core.Tween).targets()[0] as { className?: string; constructor?: { name: string } } | undefined;
        return `${x?.className || x?.constructor?.name} ${t.progress().toFixed(2)}`;
      }),
    /** Jump the current animation to a position (0..1000). */
    scrub: (v: number) => {
      const s = document.querySelector<HTMLInputElement>('.scrub');
      if (!s) return;
      s.value = String(v);
      s.dispatchEvent(new Event('input'));
    },
    sceneObjects: () => {
      let n = 0;
      sm?.scene.traverse(() => n++);
      return n;
    },
  };
}
