// KaTeX helpers. KaTeX is loaded as a classic deferred script before the modules.
// If it failed to load, TeX is shown as plain monospace text.
import { esc } from './dom.js';

const cache = new Map();

export function tex(src, display = false) {
  const key = (display ? 'D|' : 'I|') + src;
  if (cache.has(key)) return cache.get(key);
  let out;
  const k = typeof window !== 'undefined' ? window.katex : undefined;
  if (k && typeof k.renderToString === 'function') {
    try {
      out = k.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore', trust: false });
    } catch {
      out = `<code class="tex-fallback">${esc(src)}</code>`;
    }
  } else {
    out = `<code class="tex-fallback">${esc(src)}</code>`;
  }
  cache.set(key, out);
  return out;
}

/** Replace $$…$$ (display) and $…$ (inline) in an HTML string with rendered math. */
export function mathify(html) {
  return String(html)
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => `<div class="eq-block">${tex(t.trim(), true)}</div>`)
    .replace(/\$([^$]+?)\$/g, (_, t) => tex(t.trim(), false));
}
