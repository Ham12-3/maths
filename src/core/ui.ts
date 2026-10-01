/** Small accessible panel widgets used by lessons (sliders, readouts, buttons). */
import { renderTex, setRich } from './tex';

let uid = 0;
const nextId = (p: string) => `${p}-${++uid}`;

export interface SliderOpts {
  /** Label: plain text with optional $maths$. */
  label: string;
  /** Short name for screen readers, e.g. "slope m". */
  name: string;
  min: number;
  max: number;
  step: number;
  value: number;
  color?: string;
  format?: (v: number) => string;
  onInput: (v: number) => void;
}

export interface SliderRef {
  el: HTMLElement;
  input: HTMLInputElement;
  get(): number;
  /** Set the value (and the readout) without firing onInput. */
  set(v: number): void;
  setDisabled(v: boolean): void;
}

export class PanelUI {
  constructor(readonly root: HTMLElement) {}

  slider(o: SliderOpts): SliderRef {
    const wrap = document.createElement('div');
    wrap.className = 'slider';
    if (o.color) wrap.style.setProperty('--accent', o.color);
    const id = nextId('slider');
    const head = document.createElement('div');
    head.className = 'slider-head';
    const label = document.createElement('label');
    label.htmlFor = id;
    setRich(label, o.label);
    const out = document.createElement('output');
    out.htmlFor = id;
    out.className = 'slider-value';
    head.append(label, out);
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = String(o.min);
    input.max = String(o.max);
    input.step = String(o.step);
    input.value = String(o.value);
    input.setAttribute('aria-label', o.name);
    const fmt = o.format ?? ((v: number) => String(v));
    const show = (v: number) => {
      const t = fmt(v);
      out.textContent = t;
      input.setAttribute('aria-valuetext', `${o.name} ${t}`);
      const pct = ((v - o.min) / (o.max - o.min)) * 100;
      input.style.setProperty('--fill', `${pct}%`);
    };
    show(o.value);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      show(v);
      o.onInput(v);
    });
    wrap.append(head, input);
    this.root.appendChild(wrap);
    return {
      el: wrap,
      input,
      get: () => Number(input.value),
      set: (v: number) => {
        input.value = String(v);
        show(Number(input.value));
      },
      setDisabled: (v: boolean) => {
        input.disabled = v;
      },
    };
  }

  /** A live-updating line of text/maths, announced politely to screen readers. */
  readout(className = 'readout', live = true): { el: HTMLElement; set(text: string): void; tex(tex: string): void } {
    const el = document.createElement('div');
    el.className = className;
    if (live) el.setAttribute('aria-live', 'polite');
    this.root.appendChild(el);
    return {
      el,
      set: (text: string) => setRich(el, text),
      tex: (tex: string) => renderTex(el, tex, true),
    };
  }

  button(text: string, onClick: () => void, variant: 'primary' | 'ghost' = 'ghost'): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn btn-${variant}`;
    setRich(b, text);
    b.addEventListener('click', onClick);
    this.root.appendChild(b);
    return b;
  }

  row(): PanelUI {
    const el = document.createElement('div');
    el.className = 'ui-row';
    this.root.appendChild(el);
    return new PanelUI(el);
  }

  note(text: string): HTMLElement {
    const p = document.createElement('p');
    p.className = 'note';
    setRich(p, text);
    this.root.appendChild(p);
    return p;
  }

  clear(): void {
    this.root.replaceChildren();
  }
}
