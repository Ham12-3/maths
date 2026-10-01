/**
 * Draggable handles: raycast picking, pointer (mouse/touch/pen) dragging, snapping via a
 * per-handle `constrain` function, hover/focus glow, and an invisible-but-focusable button
 * per handle so everything also works with the keyboard (arrow keys).
 */
import gsap from 'gsap';
import {
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Plane,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type ColorRepresentation,
} from 'three';
import { C } from './colors';
import { Dot, Ring, Z, basicMaterial } from './draw';
import { d } from './motion';
import type { SceneManager } from './scene-manager';
import type { V2 } from '../math/vec';

export interface HandleOpts {
  /** Spoken name, e.g. "Corner B". */
  name: string;
  at: V2 | Vector3;
  color: ColorRepresentation;
  /** Dot radius in world units. */
  radius: number;
  /** Apply limits and snapping to a proposed position; return the position to use. */
  constrain?: (p: Vector3) => Vector3;
  onMove: (p: Vector3) => void;
  onStart?: () => void;
  onEnd?: () => void;
  /** World units moved per arrow-key press (default 0.5). */
  keyStep?: number;
  /** Text read out to screen readers, e.g. "a = 3". */
  describe?: () => string;
  /** '3d' handles drag on a plane facing the camera and use Shift+↑/↓ for depth. */
  space?: '2d' | '3d';
}

export class Handle {
  readonly group = new Group();
  readonly hit: Mesh;
  readonly button: HTMLButtonElement;
  readonly pos = new Vector3();
  private halo: Mesh<BufferGeometry, MeshBasicMaterial>;
  private hovered = false;
  private focused = false;
  dragging = false;
  enabled = true;

  constructor(readonly opts: HandleOpts) {
    const r = opts.radius;
    if (opts.space === '3d') {
      const core = new Mesh(new SphereGeometry(r, 24, 16), new MeshBasicMaterial({ color: opts.color }));
      const shell = new Mesh(
        new SphereGeometry(r * 1.35, 24, 16),
        new MeshBasicMaterial({ color: C.ink, transparent: true, opacity: 0.25, depthWrite: false }),
      );
      this.halo = new Mesh(
        new SphereGeometry(r * 2.4, 24, 16),
        new MeshBasicMaterial({ color: opts.color, transparent: true, opacity: 0, depthWrite: false }),
      );
      this.group.add(core, shell, this.halo);
    } else {
      const core = new Dot(opts.color, r, 0);
      const ring = new Ring(C.ink, r * 1.45, r * 0.32, 0.01);
      this.halo = new Mesh(new CircleGeometry(r * 2.6, 40), basicMaterial(opts.color, 0));
      this.halo.position.z = -0.01;
      this.group.add(this.halo, ring, core);
      this.group.position.z = Z.handle;
    }
    this.hit = this.halo;
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'handle-key';
    this.button.setAttribute('aria-roledescription', 'draggable point');
    this.set(new Vector3(opts.at.x, opts.at.y, 'z' in opts.at ? opts.at.z : 0), false);
  }

  /** Move to p (after constraints). notify=false moves the visuals only. */
  set(p: Vector3, notify = true): void {
    const q = this.opts.constrain ? this.opts.constrain(p.clone()) : p.clone();
    if (this.opts.space !== '3d') q.z = 0;
    this.pos.copy(q);
    this.group.position.x = q.x;
    this.group.position.y = q.y;
    if (this.opts.space === '3d') this.group.position.z = q.z;
    if (notify) this.opts.onMove(q.clone());
    this.updateAria();
  }

  /** Move the visuals only (no constraints, no callbacks) — for lesson-driven animation. */
  place(p: V2 | Vector3): void {
    this.pos.set(p.x, p.y, 'z' in p ? p.z : 0);
    this.group.position.x = p.x;
    this.group.position.y = p.y;
    if (this.opts.space === '3d') this.group.position.z = this.pos.z;
    this.updateAria();
  }

  updateAria(): void {
    const desc = this.opts.describe?.();
    const keys =
      this.opts.space === '3d'
        ? 'Arrow keys move it left, right, up and down; Shift with up or down moves it nearer or further.'
        : 'Use the arrow keys to move it.';
    const label = `${this.opts.name}${desc ? `, ${desc}` : ''}. ${keys}`;
    if (this.button.getAttribute('aria-label') !== label) this.button.setAttribute('aria-label', label);
  }

  setHover(v: boolean): void {
    if (this.hovered === v) return;
    this.hovered = v;
    this.glow();
  }
  setFocus(v: boolean): void {
    this.focused = v;
    this.glow();
  }
  setDragging(v: boolean): void {
    this.dragging = v;
    this.glow();
  }

  private glow(): void {
    const on = this.enabled && (this.hovered || this.focused || this.dragging);
    gsap.to(this.halo.material, { opacity: on ? (this.dragging ? 0.45 : 0.32) : 0, duration: d(0.18), overwrite: 'auto' });
    const s = on ? 1.15 : 1;
    gsap.to(this.group.scale, { x: s, y: s, z: s, duration: d(0.2), ease: 'power2.out', overwrite: 'auto' });
  }

  /** A short "look at me" pulse used when a draggable first appears. */
  attention(): gsap.core.Timeline {
    const tl = gsap.timeline();
    tl.fromTo(this.halo.material, { opacity: 0 }, { opacity: 0.4, duration: 0.35, yoyo: true, repeat: 3, ease: 'sine.inOut' });
    tl.fromTo(this.halo.scale, { x: 0.6, y: 0.6, z: 0.6 }, { x: 1.25, y: 1.25, z: 1.25, duration: 0.7, repeat: 1, ease: 'sine.out' }, 0);
    tl.set(this.halo.scale, { x: 1, y: 1, z: 1 });
    return tl;
  }

  /** Disabled handles stay visible but can't be grabbed or focused. */
  setEnabled(v: boolean): void {
    this.enabled = v;
    this.button.disabled = !v;
    this.button.hidden = !v;
    if (!v) {
      this.hovered = this.focused = this.dragging = false;
      this.glow();
    }
  }
}

export class DragController {
  private handles: Handle[] = [];
  private active: { h: Handle; id: number; plane: Plane; offset: Vector3 } | null = null;
  private stopFrame: () => void;
  private tmp = new Vector3();

  constructor(
    private sm: SceneManager,
    private host: HTMLElement,
    private keyLayer: HTMLElement,
    private addToScene: (g: Group) => void,
  ) {
    host.addEventListener('pointerdown', this.onDown, { capture: true });
    host.addEventListener('pointermove', this.onMove);
    host.addEventListener('pointerup', this.onUp);
    host.addEventListener('pointercancel', this.onUp);
    host.addEventListener('pointerleave', this.onLeave);
    this.stopFrame = sm.onFrame(() => this.placeButtons());
  }

  add(opts: HandleOpts): Handle {
    const h = new Handle(opts);
    this.addToScene(h.group);
    this.keyLayer.appendChild(h.button);
    h.button.addEventListener('keydown', (e) => this.onKey(e, h));
    h.button.addEventListener('focus', () => h.setFocus(true));
    h.button.addEventListener('blur', () => h.setFocus(false));
    this.handles.push(h);
    return h;
  }

  get count(): number {
    return this.handles.length;
  }

  get list(): readonly Handle[] {
    return this.handles;
  }

  /** Remove all handles (their meshes are disposed with the stage root). */
  clear(): void {
    if (this.active) this.release();
    for (const h of this.handles) {
      gsap.killTweensOf([h.group.scale, h.hit.material, h.hit.scale]);
      h.button.remove();
    }
    this.handles = [];
    this.host.style.cursor = '';
  }

  dispose(): void {
    this.clear();
    this.stopFrame();
    this.host.removeEventListener('pointerdown', this.onDown, { capture: true });
    this.host.removeEventListener('pointermove', this.onMove);
    this.host.removeEventListener('pointerup', this.onUp);
    this.host.removeEventListener('pointercancel', this.onUp);
    this.host.removeEventListener('pointerleave', this.onLeave);
  }

  private pickHandle(e: PointerEvent): Handle | null {
    const live = this.handles.filter((h) => h.enabled && h.group.visible && h.group.parent?.visible !== false);
    if (!live.length) return null;
    const hits = this.sm.pick(
      e.clientX,
      e.clientY,
      live.map((h) => h.hit),
    );
    const first = hits[0];
    return first ? (live.find((h) => h.hit === first.object) ?? null) : null;
  }

  private planeFor(h: Handle): Plane {
    if (h.opts.space !== '3d') return new Plane(new Vector3(0, 0, 1), 0);
    const n = new Vector3();
    this.sm.camera.getWorldDirection(n);
    return new Plane().setFromNormalAndCoplanarPoint(n.negate(), h.pos);
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const h = this.pickHandle(e);
    if (!h) return;
    e.stopPropagation();
    e.preventDefault();
    const plane = this.planeFor(h);
    const p = this.sm.pointerOnPlane(e.clientX, e.clientY, plane, new Vector3());
    if (!p) return;
    this.active = { h, id: e.pointerId, plane, offset: h.pos.clone().sub(p) };
    try {
      this.host.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events cannot be captured */
    }
    h.setDragging(true);
    h.opts.onStart?.();
    this.host.style.cursor = 'grabbing';
  };

  private onMove = (e: PointerEvent): void => {
    if (this.active) {
      if (e.pointerId !== this.active.id) return;
      const p = this.sm.pointerOnPlane(e.clientX, e.clientY, this.active.plane, this.tmp);
      if (p) this.active.h.set(p.add(this.active.offset));
      return;
    }
    if (e.pointerType === 'touch') return;
    const h = this.pickHandle(e);
    for (const x of this.handles) if (x !== h) x.setHover(false);
    if (h) h.setHover(true);
    this.host.style.cursor = h ? 'grab' : '';
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.active || e.pointerId !== this.active.id) return;
    this.release();
  };

  private onLeave = (): void => {
    if (this.active) return;
    for (const h of this.handles) h.setHover(false);
    this.host.style.cursor = '';
  };

  private release(): void {
    if (!this.active) return;
    const { h, id } = this.active;
    try {
      if (this.host.hasPointerCapture(id)) this.host.releasePointerCapture(id);
    } catch {
      /* ignore */
    }
    this.active = null;
    h.setDragging(false);
    h.opts.onEnd?.();
    this.host.style.cursor = '';
  }

  private onKey(e: KeyboardEvent, h: Handle): void {
    const step = h.opts.keyStep ?? 0.5;
    const p = h.pos.clone();
    const is3d = h.opts.space === '3d';
    switch (e.key) {
      case 'ArrowLeft':
        p.x -= step;
        break;
      case 'ArrowRight':
        p.x += step;
        break;
      case 'ArrowUp':
        if (is3d && e.shiftKey) p.z -= step;
        else p.y += step;
        break;
      case 'ArrowDown':
        if (is3d && e.shiftKey) p.z += step;
        else p.y -= step;
        break;
      case 'PageUp':
        if (!is3d) return;
        p.z -= step;
        break;
      case 'PageDown':
        if (!is3d) return;
        p.z += step;
        break;
      default:
        return;
    }
    e.preventDefault();
    h.opts.onStart?.();
    h.set(p);
    h.opts.onEnd?.();
  }

  private placeButtons(): void {
    for (const h of this.handles) {
      if (!h.enabled) continue;
      const s = this.sm.toScreen(h.pos, this.tmp);
      h.button.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
    }
  }
}
