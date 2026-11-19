// Hand-written SVG plotting helpers. Plots are drawn in CSS pixels (viewBox = box size)
// so font sizes and line widths are exactly what the CSS variables say.
import { esc } from '../ui/dom.js';

const NS = 'http://www.w3.org/2000/svg';
let plotCounter = 0;

/** Read the plot sizing variables of the current mode. */
export function plotStyle(el) {
  const cs = getComputedStyle(el);
  const px = (name, fb) => parseFloat(cs.getPropertyValue(name)) || fb;
  return {
    tick: px('--plot-tick', 13),
    label: px('--plot-label', 15),
    line: px('--plot-line', 2.5),
  };
}

/**
 * createPlot(host, draw, opts) -> { el, svg, update(data), render(), destroy() }
 * draw({ w, h, st }, data) returns the SVG inner markup.
 */
export function createPlot(host, draw, { className = '', label = '', onEvents } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `plot ${className}`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('role', 'img');
  if (label) svg.setAttribute('aria-label', label);
  wrap.append(svg);
  host.append(wrap);
  let data = null;
  let w = 0;
  let hh = 0;
  let raf = 0;
  const ctx = { w: 0, h: 0, st: null, scales: {}, uid: `pl${++plotCounter}` };

  function render() {
    raf = 0;
    if (data == null) return;
    const r = wrap.getBoundingClientRect();
    w = r.width;
    hh = r.height;
    if (w < 20 || hh < 20) return;
    ctx.w = w;
    ctx.h = hh;
    ctx.st = plotStyle(wrap);
    svg.setAttribute('viewBox', `0 0 ${w.toFixed(1)} ${hh.toFixed(1)}`);
    svg.setAttribute('width', w.toFixed(1));
    svg.setAttribute('height', hh.toFixed(1));
    svg.innerHTML = draw(ctx, data);
  }
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(render);
  };
  const ro = new ResizeObserver(() => {
    const r = wrap.getBoundingClientRect();
    if (Math.abs(r.width - w) > 0.5 || Math.abs(r.height - hh) > 0.5) schedule();
  });
  ro.observe(wrap);
  if (onEvents) onEvents(svg, ctx);
  return {
    el: wrap,
    svg,
    ctx,
    update(d) {
      data = d;
      schedule();
    },
    render,
    destroy: () => ro.disconnect(),
  };
}

// ------------------------------------------------------------------ scales
export function lin(d0, d1, r0, r1) {
  const k = (r1 - r0) / (d1 - d0);
  const f = (v) => r0 + (v - d0) * k;
  f.inv = (p) => d0 + (p - r0) / k;
  f.domain = [d0, d1];
  f.range = [r0, r1];
  return f;
}
export function logScale(d0, d1, r0, r1) {
  const l0 = Math.log10(d0);
  const l1 = Math.log10(d1);
  const k = (r1 - r0) / (l1 - l0);
  const f = (v) => r0 + (Math.log10(Math.max(v, 1e-300)) - l0) * k;
  f.inv = (p) => 10 ** (l0 + (p - r0) / k);
  f.domain = [d0, d1];
  f.range = [r0, r1];
  f.log = true;
  return f;
}

export function niceStep(span, n) {
  const raw = span / Math.max(1, n);
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}
export function ticks(d0, d1, n = 5) {
  const lo = Math.min(d0, d1);
  const hi = Math.max(d0, d1);
  const step = niceStep(hi - lo, n);
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}
export const decimalsFor = (step) => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));

// --------------------------------------------------------------- markup
const f1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);

export function pathD(pts) {
  let d = '';
  let pen = false;
  for (const p of pts) {
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${f1(p[0])},${f1(p[1])}`;
    pen = true;
  }
  return d;
}

export function attrs(o) {
  return Object.entries(o)
    .filter(([, v]) => v != null && v !== false)
    .map(([k, v]) => `${k}="${typeof v === 'number' ? f1(v) : esc(v)}"`)
    .join(' ');
}

export const line = (x1, y1, x2, y2, a = {}) => `<line ${attrs({ x1, y1, x2, y2, ...a })}/>`;
export const rect = (x, y, w, h, a = {}) =>
  `<rect ${attrs({ x: Math.min(x, x + w), y: Math.min(y, y + h), width: Math.abs(w), height: Math.abs(h), ...a })}/>`;
export const circle = (cx, cy, r, a = {}) => `<circle ${attrs({ cx, cy, r, ...a })}/>`;
export const path = (pts, a = {}) => `<path ${attrs({ d: pathD(pts), fill: 'none', ...a })}/>`;
export const g = (inner, a = {}) => `<g ${attrs(a)}>${inner}</g>`;

/**
 * Rich text: "φ_{Bn}" -> φ with subscript Bn, "10^{13}" -> superscript.
 * Single-character forms "E_c", "x^2" are supported too.
 */
export function rich(s) {
  const src = String(s);
  let out = '';
  let shift = 0; // current baseline shift in em
  const re = /([_^])(\{([^}]*)\}|(.))/g;
  let last = 0;
  let m;
  const plain = (t) => {
    if (!t) return;
    if (shift !== 0) {
      out += `<tspan dy="${(-shift).toFixed(2)}em">${esc(t)}</tspan>`;
      shift = 0;
    } else out += esc(t);
  };
  while ((m = re.exec(src))) {
    plain(src.slice(last, m.index));
    const body = m[3] ?? m[4];
    const target = m[1] === '_' ? 0.3 : -0.45;
    out += `<tspan dy="${(target - shift).toFixed(2)}em" class="ss">${esc(body)}</tspan>`;
    shift = target;
    last = re.lastIndex;
  }
  plain(src.slice(last));
  if (shift !== 0) out += `<tspan dy="${(-shift).toFixed(2)}em"></tspan>`;
  return out;
}

/** text(x, y, s, { anchor, cls, size, weight, fill, baseline, rotate }) */
export function text(x, y, s, o = {}) {
  const a = {
    x,
    y,
    'text-anchor': o.anchor || 'start',
    'dominant-baseline': o.baseline || 'middle',
    class: o.cls,
    'font-size': o.size,
    'font-weight': o.weight,
    fill: o.fill,
    transform: o.rotate ? `rotate(${o.rotate} ${f1(x)} ${f1(y)})` : null,
  };
  return `<text ${attrs(a)}>${rich(s)}</text>`;
}

/** Approximate rendered width of a label (for layout only). */
export function textWidth(s, size) {
  const plain = String(s).replace(/[_^]\{([^}]*)\}/g, '$1').replace(/[_^](.)/g, '$1');
  return plain.length * size * 0.56;
}

/** Vertical double arrow with optional label. */
export function vArrow(x, y1, y2, a = {}) {
  const head = a.head ?? 7;
  const dir = y2 > y1 ? 1 : -1;
  const len = Math.abs(y2 - y1);
  if (len < 2) return '';
  const hs = Math.min(head, len / 2.5);
  const stroke = a.stroke || 'var(--text)';
  const sw = a.sw || 2;
  let s = line(x, y1 + dir * hs * 0.6, x, y2 - dir * hs * 0.6, { stroke, 'stroke-width': sw });
  s += `<path d="M${f1(x - hs * 0.7)},${f1(y1 + dir * hs)}L${f1(x)},${f1(y1)}L${f1(x + hs * 0.7)},${f1(y1 + dir * hs)}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  s += `<path d="M${f1(x - hs * 0.7)},${f1(y2 - dir * hs)}L${f1(x)},${f1(y2)}L${f1(x + hs * 0.7)},${f1(y2 - dir * hs)}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  return s;
}

/** Axis break marker (two short slanted strokes) at (x, y). */
export function breakMark(x, y, size = 7, color = 'var(--text-muted)') {
  return (
    `<path d="M${f1(x - size)},${f1(y + 2)}L${f1(x + size)},${f1(y - 4)}M${f1(x - size)},${f1(y + 7)}L${f1(x + size)},${f1(y + 1)}" stroke="${color}" stroke-width="2"/>` +
    rect(x - size - 1, y - 1.5, 2 * size + 2, 4.5, { fill: 'var(--surface)' }).replace('/>', ' opacity="0.9"/>')
  );
}

// ------------------------------------------------------------------- axes
/**
 * Draws axes + ticks. Returns markup.
 * o = { x: scale, y: scale, xTicks, yTicks, xFmt, yFmt, xTitle, yTitle, st, grid, box: {l,r,t,b} }
 */
export function axes(o) {
  const { x, y, st, box } = o;
  let s = '';
  const xt = o.xTicks || (x.log ? logTicks(x.domain) : ticks(...x.domain, o.xN || 5));
  const yt = o.yTicks || (y.log ? logTicks(y.domain) : ticks(...y.domain, o.yN || 5));
  const xf = o.xFmt || ((v) => fmtTick(v, xt));
  const yf = o.yFmt || ((v) => fmtTick(v, yt));
  if (o.grid !== false) {
    for (const v of yt) s += line(box.l, y(v), box.r, y(v), { class: 'gridline' });
  }
  s += line(box.l, box.b, box.r, box.b, { class: 'axis' });
  s += line(box.l, box.t, box.l, box.b, { class: 'axis' });
  if (o.xTicksShow !== false)
    for (const v of xt) {
      const px = x(v);
      if (px < box.l - 1 || px > box.r + 1) continue;
      s += line(px, box.b, px, box.b + 5, { class: 'axis' });
      s += text(px, box.b + 8 + st.tick * 0.55, xf(v), { anchor: 'middle', cls: 'tick' });
    }
  for (const v of yt) {
    const py = y(v);
    if (py < box.t - 1 || py > box.b + 1) continue;
    s += line(box.l - 5, py, box.l, py, { class: 'axis' });
    s += text(box.l - 8, py, yf(v), { anchor: 'end', cls: 'tick' });
  }
  if (o.xTitle) s += text((box.l + box.r) / 2, box.b + 12 + st.tick * 1.1 + st.label * 0.55, o.xTitle, { anchor: 'middle', cls: 'axis-title' });
  if (o.yTitle) {
    // centre of the rotated title: clear of the tick labels by ~half its own line height
    const yx = box.l - (o.yTitleOffset ?? o.yTickW + 12 + st.label * 0.6);
    s += text(yx, (box.t + box.b) / 2, o.yTitle, { anchor: 'middle', cls: 'axis-title', rotate: -90 });
  }
  return s;
}

export function logTicks([a, b]) {
  const out = [];
  for (let e = Math.ceil(Math.log10(Math.min(a, b)) - 1e-9); e <= Math.floor(Math.log10(Math.max(a, b)) + 1e-9); e++) out.push(10 ** e);
  return out;
}

export function fmtTick(v, all) {
  if (all && all.length > 1 && all.every((t) => t > 0) && all[all.length - 1] / all[0] >= 100) {
    return `10^{${Math.round(Math.log10(v))}}`;
  }
  const step = all && all.length > 1 ? Math.abs(all[1] - all[0]) : 1;
  const d = decimalsFor(step);
  const s = v.toFixed(d);
  return (/^-0\.?0*$/.test(s) ? s.slice(1) : s).replace('-', '−');
}

/** Width needed for y tick labels. */
export function tickWidth(labels, st) {
  return Math.max(...labels.map((l) => textWidth(l, st.tick)), st.tick) + 2;
}

/** Linear colour ramp through hex stops. */
export function ramp(stops) {
  const rgb = stops.map((hx) => [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16)));
  return (u) => {
    const t = Math.min(1, Math.max(0, u)) * (rgb.length - 1);
    const i = Math.min(rgb.length - 2, Math.floor(t));
    const f = t - i;
    return rgb[i].map((c, k) => Math.round(c + (rgb[i + 1][k] - c) * f));
  };
}
export const BRAND_RAMP = ramp(['#f6f7ff', '#cdd2ff', '#919cff', '#5a64d6', '#2a2f78']);
