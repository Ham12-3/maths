/** Tiny GSAP helpers so every lesson moves with the same rhythm. */
import type { Object3D } from 'three';
import { DUR, EASE } from './motion';
import type { Label } from './labels';

type Pos = gsap.Position | undefined;
interface HasOpacity {
  opacity: number;
}
interface Drawable {
  draw: number;
}
interface Growable {
  grow: number;
}

/** Scale an object up from nothing with a little overshoot. */
export function pop(tl: gsap.core.Timeline, obj: Object3D | Object3D[], at?: Pos, dur: number = DUR.base): gsap.core.Timeline {
  const targets = (Array.isArray(obj) ? obj : [obj]).map((o) => o.scale);
  return tl.fromTo(targets, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1, duration: dur, ease: EASE.appear, stagger: 0.08 }, at);
}

export function fadeIn(tl: gsap.core.Timeline, t: HasOpacity | HasOpacity[], at?: Pos, to = 1, dur: number = DUR.base) {
  return tl.fromTo(t, { opacity: 0 }, { opacity: to, duration: dur, ease: EASE.fade, stagger: 0.08 }, at);
}

export function fadeOut(tl: gsap.core.Timeline, t: HasOpacity | HasOpacity[], at?: Pos, dur: number = DUR.quick) {
  return tl.to(t, { opacity: 0, duration: dur, ease: EASE.fade }, at);
}

/** Make a Stroke draw itself along its length. */
export function drawOn(tl: gsap.core.Timeline, s: Drawable | Drawable[], at?: Pos, dur: number = DUR.draw) {
  return tl.fromTo(s, { draw: 0 }, { draw: 1, duration: dur, ease: EASE.draw, stagger: 0.12 }, at);
}

/** Grow an arrow out of its tail. */
export function grow(tl: gsap.core.Timeline, a: Growable | Growable[], at?: Pos, dur: number = DUR.base) {
  return tl.fromTo(a, { grow: 0 }, { grow: 1, duration: dur, ease: EASE.move, stagger: 0.12 }, at);
}

/** Pop a label (or several, staggered) into view. */
export function popLabel(tl: gsap.core.Timeline, l: Label | Label[], at?: Pos, dur: number = DUR.quick + 0.1) {
  const inners = (Array.isArray(l) ? l : [l]).map((x) => x.inner);
  return tl.fromTo(inners, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: dur, ease: EASE.appear, stagger: 0.1 }, at);
}

export function hideLabel(tl: gsap.core.Timeline, l: Label | Label[], at?: Pos) {
  const inners = (Array.isArray(l) ? l : [l]).map((x) => x.inner);
  return tl.to(inners, { opacity: 0, scale: 0.8, duration: DUR.quick, ease: EASE.leave }, at);
}

/** A quick "look here" pulse (scale up and back). Only for things centred on their own origin. */
export function pulse(tl: gsap.core.Timeline, obj: Object3D | HTMLElement, at?: Pos, amount = 1.25) {
  if (obj instanceof HTMLElement) return tl.to(obj, { scale: amount, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 1 }, at);
  return tl.to(obj.scale, { x: amount, y: amount, z: amount, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 1 }, at);
}

/** Start state helpers (call in setup so things begin hidden). */
export function hidden<T extends HasOpacity>(...items: T[]): void {
  for (const i of items) i.opacity = 0;
}
export function shrunk(...objs: Object3D[]): void {
  for (const o of objs) o.scale.setScalar(0);
}
export function hiddenLabel(...ls: Label[]): void {
  for (const l of ls) l.inner.style.opacity = '0';
}

/** Briefly thicken a stroke to draw the eye to it. */
export function thicken(tl: gsap.core.Timeline, s: { width: number }, at?: Pos, factor = 1.9) {
  const w = s.width;
  return tl.fromTo(s, { width: w }, { width: w * factor, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 }, at);
}

/** Blink something's opacity a few times (keeps its final opacity). */
export function flash(tl: gsap.core.Timeline, t: HasOpacity | HasOpacity[], at?: Pos, low = 0.15, times = 2) {
  const list = Array.isArray(t) ? t : [t];
  const start = list[0]?.opacity ?? 1;
  return tl.fromTo(list, { opacity: start }, { opacity: low, duration: 0.22, yoyo: true, repeat: times * 2 - 1, ease: 'sine.inOut' }, at);
}

/**
 * A scrub-safe switch: calls `on()` when the playhead passes `at` going forwards and
 * `off()` when it passes back again (a plain tl.call() would only ever fire `on`).
 */
export function switchAt(tl: gsap.core.Timeline, at: Pos, on: () => void, off: () => void) {
  const flag = { v: 0 };
  let state = false;
  return tl.fromTo(
    flag,
    { v: 0 },
    {
      v: 1,
      duration: 0.01,
      immediateRender: false,
      onUpdate: () => {
        const now = flag.v > 0.5;
        if (now === state) return;
        state = now;
        if (now) on();
        else off();
      },
    },
    at,
  );
}
