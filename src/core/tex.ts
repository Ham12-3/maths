import katex from 'katex';
import 'katex/dist/katex.min.css';

const OPTS = { throwOnError: false, strict: 'ignore' as const, output: 'htmlAndMathml' as const };

/** Render TeX into an element (skips work if the same TeX is already there). */
export function renderTex(el: HTMLElement, tex: string, display = false): void {
  const key = `${display ? 'D' : 'I'}:${tex}`;
  if (el.dataset.tex === key) return;
  el.dataset.tex = key;
  katex.render(tex, el, { ...OPTS, displayMode: display });
}

export const texToHtml = (tex: string, display = false): string =>
  katex.renderToString(tex, { ...OPTS, displayMode: display });

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Plain text with inline maths between $…$ and **bold**. Text is escaped, so captions
 * can never inject markup.
 */
export function richHtml(s: string): string {
  return s
    .split(/(\$[^$]+\$)/g)
    .map((part) => {
      if (part.startsWith('$') && part.endsWith('$') && part.length > 1) return texToHtml(part.slice(1, -1));
      return escapeHtml(part).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    })
    .join('');
}

export function setRich(el: HTMLElement, s: string): void {
  if (el.dataset.rich === s) return;
  el.dataset.rich = s;
  el.innerHTML = richHtml(s);
}
