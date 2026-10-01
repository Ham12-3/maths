import { Vector3 } from 'three';
import type { SceneManager } from './scene-manager';
import { renderTex, setRich } from './tex';
import type { V2 } from '../math/vec';

export type LabelAnchor = 'center' | 'above' | 'below' | 'left' | 'right';

export interface LabelOpts {
  /** Plain text with optional $maths$. */
  text?: string;
  /** Pure TeX (rendered with KaTeX). */
  tex?: string;
  color?: string;
  anchor?: LabelAnchor;
  /** Extra pixel offset. */
  offset?: [number, number];
  className?: string;
  /** Hidden from screen readers (decorative, e.g. tick numbers). */
  decorative?: boolean;
}

const ANCHOR: Record<LabelAnchor, string> = {
  center: 'translate(-50%, -50%)',
  above: 'translate(-50%, calc(-100% - 10px))',
  below: 'translate(-50%, 10px)',
  left: 'translate(calc(-100% - 10px), -50%)',
  right: 'translate(10px, -50%)',
};

/**
 * A crisp HTML label pinned to a world position. Animate `inner` (opacity/scale) with GSAP;
 * the outer element is positioned every frame.
 */
export class Label {
  readonly el: HTMLDivElement;
  readonly inner: HTMLSpanElement;
  readonly pos = new Vector3();
  follow: (() => V2 | Vector3) | null = null;
  private lastX = NaN;
  private lastY = NaN;
  private anchorCss: string;
  private offset: [number, number];

  constructor(opts: LabelOpts) {
    this.el = document.createElement('div');
    this.el.className = `label ${opts.className ?? ''}`;
    if (opts.decorative) this.el.setAttribute('aria-hidden', 'true');
    this.inner = document.createElement('span');
    this.inner.className = 'label-inner';
    if (opts.color) this.inner.style.color = opts.color;
    this.el.appendChild(this.inner);
    this.anchorCss = ANCHOR[opts.anchor ?? 'center'];
    this.offset = opts.offset ?? [0, 0];
    if (opts.tex !== undefined) this.setTex(opts.tex);
    else if (opts.text !== undefined) this.setText(opts.text);
  }

  setText(s: string): this {
    setRich(this.inner, s);
    return this;
  }

  setTex(tex: string): this {
    renderTex(this.inner, tex);
    return this;
  }

  at(p: V2 | Vector3): this {
    this.pos.set(p.x, p.y, 'z' in p ? p.z : 0);
    return this;
  }

  /** Change which side of its point the label sits on. */
  setAnchor(anchor: LabelAnchor): this {
    const css = ANCHOR[anchor];
    if (css !== this.anchorCss) {
      this.anchorCss = css;
      this.lastX = NaN; // force a re-place next frame
    }
    return this;
  }

  setColor(c: string): this {
    this.inner.style.color = c;
    return this;
  }

  /** Called every frame by the layer. */
  place(sm: SceneManager, tmp: Vector3): void {
    if (this.follow) {
      const p = this.follow();
      this.pos.set(p.x, p.y, 'z' in p ? p.z : 0);
    }
    const s = sm.toScreen(this.pos, tmp);
    const x = Math.round(s.x * 2) / 2;
    const y = Math.round(s.y * 2) / 2;
    if (x === this.lastX && y === this.lastY) return;
    this.lastX = x;
    this.lastY = y;
    this.el.style.transform = `translate(${x + this.offset[0]}px, ${y + this.offset[1]}px) ${this.anchorCss}`;
    this.el.style.visibility = s.behind ? 'hidden' : '';
  }
}

export class LabelLayer {
  private labels = new Set<Label>();
  private tmp = new Vector3();
  private stopFrame: () => void;

  constructor(
    private sm: SceneManager,
    private container: HTMLElement,
  ) {
    this.stopFrame = sm.onFrame(() => this.update());
  }

  add(opts: LabelOpts & { at?: V2 | Vector3 }): Label {
    const l = new Label(opts);
    if (opts.at) l.at(opts.at);
    this.labels.add(l);
    this.container.appendChild(l.el);
    l.place(this.sm, this.tmp);
    return l;
  }

  remove(l: Label): void {
    l.el.remove();
    this.labels.delete(l);
  }

  update(): void {
    for (const l of this.labels) l.place(this.sm, this.tmp);
  }

  clear(): void {
    for (const l of this.labels) l.el.remove();
    this.labels.clear();
  }

  dispose(): void {
    this.clear();
    this.stopFrame();
  }
}
