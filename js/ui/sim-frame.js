// Common skeleton for every simulation: readouts, view tabs, plots, caption slot, controls.
import { h } from './dom.js';
import { segmented } from './controls.js';

export function simFrame(root, ctx, { plotsClass = '' } = {}) {
  const top = h('div', { class: 'sim-top' });
  const tabs = h('div', { class: 'sim-tabs', hidden: true });
  const plots = h('div', { class: `sim-plots ${plotsClass}` });
  const capSlot = h('div', { class: 'sim-caption' });
  const controls = h('div', { class: 'sim-controls' });
  root.append(top, tabs, plots, capSlot, controls);
  if (ctx.mode === 'present') capSlot.append(ctx.caption.el);
  return { top, tabs, plots, capSlot, controls };
}

/** Bordered panel with a title row and a body that holds a plot. */
export function panel(title, { sub = '', cls = '' } = {}) {
  const titleEl = h('div', { class: 'panel-title' }, h('span', { class: 'pt-main', html: title }), sub ? h('span', { class: 'sub', html: sub }) : null);
  const body = h('div', { class: 'panel-body' });
  const el = h('div', { class: `panel ${cls}` }, titleEl, body);
  return {
    el,
    body,
    setTitle: (t) => (titleEl.querySelector('.pt-main').innerHTML = t),
    setSub(t) {
      let s = titleEl.querySelector('.sub');
      if (!s) titleEl.append((s = h('span', { class: 'sub' })));
      s.innerHTML = t;
    },
  };
}

/** View tabs: options [{ value, label }]. */
export function viewTabs(host, options, onChange, aria = 'Simulation view') {
  host.hidden = false;
  const seg = segmented({ options, onChange, aria, cls: 'tabs' });
  host.append(seg.el);
  return seg;
}

/** Regime / validity badges for a solver result. */
export function badgeRow(host) {
  const el = h('span', { class: 'badges' });
  host.append(el);
  return {
    el,
    set(res, extra = []) {
      const out = [];
      if (res?.flags?.degenerateBadge) out.push(['warn', 'degenerate doping — approximate']);
      if (res?.flags?.inversion) out.push(['warn', 'inversion — beyond this model']);
      if (res?.flags?.ohmic) out.push(['warn', 'ohmic / accumulation']);
      for (const x of extra) out.push(x);
      // badge text may carry <sub> markup (e.g. D<sub>it</sub>); it is never user input
      el.replaceChildren(...out.map(([k, t]) => h('span', { class: `badge ${k === 'warn' ? '' : k}`, html: t })));
    },
  };
}
