// Interface-state ladder drawn at x = 0 between E_v(0) and E_c(0).
// Filled acceptor-like states between E0 and E_F are negative (teal);
// empty donor-like states between E_F and E0 are positive (red).
import { line, rect, text } from './svg.js';

/**
 * drawLadder({ x, w, y, st }, lad, { neutral, label })
 * lad = engine.ladderStates(p, res)
 */
export function drawLadder({ x, w, y, st }, lad, { neutral = false, e0Label = true, labelX = x - 12, lineFrom = x - 8 } = {}) {
  if (!lad || !lad.rungs.length) return '';
  let s = '';
  const E0 = lad.E0;
  // shade the charged window between E0 and E_F
  if (!neutral && Math.abs(E0) > 0.005) {
    const fill = E0 < 0 ? 'var(--c-neg)' : 'var(--c-pos)';
    s += rect(x, y(Math.max(E0, 0)), w, y(Math.min(E0, 0)) - y(Math.max(E0, 0)), { fill, opacity: 0.18 });
  }
  const sw = Math.max(2, st.line - 0.5);
  for (const r of lad.rungs) {
    let stroke;
    if (!neutral && r.charge === -1) stroke = 'var(--c-neg)';
    else if (!neutral && r.charge === 1) stroke = 'var(--c-pos)';
    else stroke = r.filled ? '#5a5f7a' : '#c3c7de';
    s += line(x + 2, y(r.E), x + w - 2, y(r.E), { stroke, 'stroke-width': sw, 'stroke-linecap': 'round' });
  }
  // neutral level E0 (amber, dash-dot)
  s += line(lineFrom, y(E0), x + w + 8, y(E0), {
    stroke: 'var(--c-e0)',
    'stroke-width': st.line,
    'stroke-dasharray': `${st.line * 4} ${st.line * 1.6} ${st.line * 0.8} ${st.line * 1.6}`,
  });
  if (e0Label) s += text(labelX, y(E0), 'E_{0}', { anchor: 'end', cls: 'e0-ink strong halo' });
  return s;
}
