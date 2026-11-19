// Form controls bound to a store. Each control exposes sync(state) so the sim can
// push state changes (demos, presets) back into the widgets.
import { h } from './dom.js';
import { METALS, SLIDER_RANGES, SEMICONDUCTORS, SEMI_ORDER, PRESETS } from '../../data/materials.js';
import { paramPatch, presetPatch, semiPatch, metalAt, isMaterialPreset } from '../state.js';
import { num, sci } from './format.js';

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

/**
 * Range slider. Log sliders map 0..1000 onto log10(min..max).
 * opts: { label (html), min, max, step, log, format(v), onInput(v), aria }
 */
export function slider(opts) {
  const id = nextId('sl');
  const { min, max, log } = opts;
  const N = 1000;
  const toPos = (v) => (log ? ((Math.log10(v) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * N : v);
  const fromPos = (p) => (log ? 10 ** (Math.log10(min) + (p / N) * (Math.log10(max) - Math.log10(min))) : p);
  const input = h('input', {
    type: 'range',
    id,
    min: log ? 0 : min,
    max: log ? N : max,
    step: log ? 1 : opts.step ?? 0.01,
    'aria-label': opts.aria || null,
  });
  const out = h('output', { for: id });
  const el = h('div', { class: `slider ${opts.cls || ''}` }, h('label', { for: id, html: opts.label }), input, out);
  let current = null;
  const paint = (v) => {
    const frac = (toPos(v) - Number(input.min)) / (Number(input.max) - Number(input.min));
    input.style.setProperty('--fill', `${Math.max(0, Math.min(1, frac)) * 100}%`);
    out.textContent = opts.format ? opts.format(v) : String(v);
    input.setAttribute('aria-valuetext', out.textContent);
  };
  input.addEventListener('input', () => {
    const v = fromPos(Number(input.value));
    current = v;
    paint(v);
    opts.onInput?.(v);
  });
  return {
    el,
    input,
    set(v, display) {
      if (v === current && display === undefined) return;
      current = v;
      const clamped = Math.min(Math.max(v, min), max);
      // log sliders cannot show 0 (the Ideal preset's D_it); linear sliders can
      input.value = String(toPos(log && !(clamped > 0) ? min : clamped));
      paint(v);
      if (display !== undefined) out.textContent = display;
    },
    setDisabled(b) {
      input.disabled = !!b;
      el.classList.toggle('disabled', !!b);
    },
  };
}

/** Segmented buttons. options: [{ value, label, title }] */
export function segmented({ options, onChange, aria, cls = '' }) {
  const btns = options.map((o) =>
    h('button', {
      type: 'button',
      class: 'btn',
      'aria-pressed': 'false',
      title: o.title || null,
      html: `<span>${o.label}</span>`,
      onclick: () => onChange(o.value),
      dataset: { value: String(o.value) },
    }),
  );
  const el = h('div', { class: `seg ${cls}`, role: 'group', 'aria-label': aria || null }, btns);
  return {
    el,
    buttons: btns,
    set(v) {
      for (const b of btns) b.setAttribute('aria-pressed', String(b.dataset.value === String(v)));
    },
  };
}

/** Table 9.1 snap buttons. */
export function metalButtons({ onPick, showWF = false, metals = METALS, aria = 'Snap φ_m to a Table 9.1 metal' }) {
  const btns = metals.map((m) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn',
        'aria-pressed': 'false',
        'aria-label': `${m.id}, φ_m = ${m.phiM.toFixed(2)} eV`,
        onclick: () => onPick(m),
        dataset: { metal: m.id },
      },
      m.id,
      showWF ? h('span', { class: 'wf' }, m.phiM.toFixed(2)) : null,
    ),
  );
  const el = h('div', { class: 'metals', role: 'group', 'aria-label': aria }, btns);
  return {
    el,
    buttons: btns,
    set(phiM) {
      const m = metalAt(phiM);
      for (const b of btns) b.setAttribute('aria-pressed', String(!!m && b.dataset.metal === m.id));
    },
  };
}

export function checkbox({ label, checked = false, onChange }) {
  const input = h('input', { type: 'checkbox' });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const el = h('label', { class: 'check' }, input, h('span', { html: label }));
  return { el, input, set: (v) => (input.checked = !!v) };
}

/** Read-only value chip. */
export function readout(label, { key = false, title } = {}) {
  const v = h('span', { class: 'ro-value' }, '—');
  const el = h('div', { class: `readout${key ? ' key' : ''}`, title: title || null }, h('span', { class: 'ro-label', html: label }), v);
  const labEl = el.querySelector('.ro-label');
  return {
    el,
    setLabel(html) {
      if (labEl.innerHTML !== html) labEl.innerHTML = html;
    },
    set(text, sign) {
      v.textContent = text;
      el.classList.toggle('pos', sign === 'pos');
      el.classList.toggle('neg', sign === 'neg');
    },
  };
}

// ---------------------------------------------------------------- bound controls
/** Standard slider set bound to a store. Returns { el(key), sync(state) }. */
export function boundControls(store, keys, { present = false } = {}) {
  const made = {};
  const set = (patch) => store.set(patch, { source: 'user' });
  const fmtE = (v) => `${num(v, 2)} eV`;
  const defs = {
    phiM: () =>
      slider({
        label: 'φ<sub>m</sub>',
        aria: 'Metal work function φ_m',
        ...SLIDER_RANGES.phiM,
        format: fmtE,
        onInput: (v) => set({ phiM: Math.round(v * 100) / 100 }),
      }),
    Dit: () =>
      slider({
        label: 'D<sub>it</sub>',
        aria: 'Interface-state density D_it',
        ...SLIDER_RANGES.Dit,
        format: (v) => `${sci(v, 2)} cm⁻²eV⁻¹`,
        onInput: (v) => set(paramPatch(store.get(), 'Dit', v)),
      }),
    delta: () =>
      slider({
        label: 'δ',
        aria: 'Interfacial layer thickness δ',
        ...SLIDER_RANGES.delta,
        format: (v) => `${num(v, 2)} nm`,
        onInput: (v) => set(paramPatch(store.get(), 'delta', Math.round(v * 100) / 100)),
      }),
    phi0: () =>
      slider({
        label: 'φ<sub>0</sub>',
        aria: 'Neutral level φ_0 above E_v',
        min: 0,
        max: 1.42,
        step: 0.01,
        format: fmtE,
        onInput: (v) => set(paramPatch(store.get(), 'phi0', Math.min(Math.round(v * 100) / 100, egOf(store.get())))),
      }),
    Nd: () =>
      slider({
        label: 'N<sub>d</sub>',
        aria: 'Doping concentration (N_d for n-type, N_A for p-type)',
        ...SLIDER_RANGES.Nd,
        format: (v) => `${sci(v, 2)} cm⁻³`,
        onInput: (v) => set({ Nd: v }),
      }),
    T: () =>
      slider({
        label: 'T',
        aria: 'Temperature T',
        min: 200,
        max: 450,
        step: 10,
        format: (v) => `${Math.round(v)} K`,
        onInput: (v) => set({ T: Math.round(v / 10) * 10 }),
      }),
    t: () =>
      slider({
        label: 't',
        aria: 'Interlayer thickness t',
        ...SLIDER_RANGES.t,
        format: (v) => `${num(v, 2)} nm`,
        onInput: (v) => set({ t: Math.round(v * 100) / 100 }),
      }),
    lambda: () =>
      slider({
        label: 'λ',
        aria: 'MIGS blocking length λ (advanced)',
        ...SLIDER_RANGES.lambda,
        format: (v) => `${num(v, 2)} nm`,
        onInput: (v) => set({ lambda: Math.round(v * 100) / 100 }),
      }),
    kappa: () =>
      slider({
        label: 'κ',
        aria: 'Interlayer tunnelling constant κ (advanced)',
        ...SLIDER_RANGES.kappa,
        format: (v) => `${num(v, 2)} nm⁻¹`,
        onInput: (v) => set({ kappa: Math.round(v * 100) / 100 }),
      }),
  };
  for (const k of keys) made[k] = defs[k]();
  return {
    get: (k) => made[k],
    els: keys.map((k) => made[k].el),
    sync(state) {
      for (const [k, c] of Object.entries(made)) {
        if (k === 'Dit') {
          if (state.preset === 'ideal' || !(state.delta > 0)) {
            c.set(SLIDER_RANGES.Dit.min, '0 (ideal)');
          } else c.set(state.Dit);
        } else if (k === 'delta') {
          if (!(state.delta > 0)) c.set(SLIDER_RANGES.delta.min, '0 (ideal)');
          else c.set(state.delta);
        } else if (k === 'phi0') {
          c.input.max = String(egOf(state));
          c.set(state.phi0);
        } else if (k === 'Nd') {
          // the doping slider is N_d for n-type and N_A for p-type
          const lab = c.el.querySelector('label');
          const want = state.doping === 'p' ? 'N<sub>A</sub>' : 'N<sub>d</sub>';
          if (lab.innerHTML !== want) lab.innerHTML = want;
          c.set(state.Nd);
        } else c.set(state[k]);
      }
    },
  };
}

const egOf = (s) => SEMICONDUCTORS[s.semi].Eg;

/** Interface selector: Ideal | Preset (the material's preset) | Custom. */
export function presetControl(store, { presets = ['ideal', 'preset', 'custom'] } = {}) {
  const labels = { ideal: 'Ideal', preset: 'Preset', custom: 'Custom' };
  const seg = segmented({
    aria: 'Interface: ideal, the material preset, or custom',
    options: presets.map((p) => ({ value: p, label: labels[p], title: p === 'preset' ? 'Measured pinning of the selected semiconductor' : null })),
    onChange: (v) => store.set(presetPatch(store.get(), v), { source: 'user' }),
  });
  return { el: seg.el, sync: (s) => seg.set(isMaterialPreset(s.preset) ? 'preset' : s.preset) };
}

/**
 * Semiconductor selector. materials: which to offer (default Si, GaAs, Ge, GaN).
 * nLabels: show "n-Si" style labels (Section 4, which is fixed to n-type).
 */
export function semiControl(store, { materials = SEMI_ORDER, nLabels = false } = {}) {
  const seg = segmented({
    aria: 'Semiconductor',
    options: materials.map((m) => ({ value: m, label: nLabels ? `n-${m}` : m })),
    onChange: (v) => store.set(semiPatch(store.get(), v), { source: 'user' }),
  });
  return { el: seg.el, sync: (s) => seg.set(s.semi) };
}

/** Doping type: n-type (electron barrier) | p-type (hole barrier). */
export function dopingControl(store) {
  const seg = segmented({
    aria: 'Doping type',
    options: [
      { value: 'n', label: 'n-type', title: 'electron barrier' },
      { value: 'p', label: 'p-type', title: 'hole barrier' },
    ],
    onChange: (v) => store.set({ doping: v }, { source: 'user' }),
  });
  return { el: seg.el, sync: (s) => seg.set(s.doping || 'n') };
}

/**
 * "Settings" row with doping type and temperature. In Outline (presentation) mode it is
 * collapsed behind a "Settings" button; in Detailed mode it is always shown.
 */
export function settingsRow(store, { present = false } = {}) {
  const dc = dopingControl(store);
  const tc = boundControls(store, ['T']);
  const note = h('span', { class: 'ctl-note' }, 'E', h('sub', {}, 'g'), ', χ, φ', h('sub', {}, '0'), ' and D', h('sub', {}, 'it'), ' stay at their 300 K values; full ionization (no freeze-out).');
  const row = h(
    'div',
    { class: 'ctl-row settings-row', hidden: present },
    h('span', { class: 'ctl-label' }, 'Doping:'),
    dc.el,
    h('div', { class: 'sliders one settings-t' }, tc.els),
    note,
  );
  // Outline mode: the row opens as a popover above the controls, so the slide layout never
  // changes; the button carries a short summary when the settings differ from n-type, 300 K
  const summary = h('span', { class: 'settings-summary' });
  let button = null;
  if (present) {
    row.classList.add('settings-pop');
    button = h(
      'button',
      { type: 'button', class: 'btn settings-btn', 'aria-expanded': 'false', onclick: () => setOpen(row.hidden) },
      'Settings',
      summary,
      h('span', { 'aria-hidden': 'true' }, ' ▾'),
    );
    document.addEventListener('pointerdown', (e) => {
      if (!row.hidden && !row.contains(e.target) && !button.contains(e.target)) setOpen(false);
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        button.focus();
      }
    });
  }
  function setOpen(open) {
    row.hidden = !open;
    button?.setAttribute('aria-expanded', String(open));
  }
  return {
    row,
    button,
    summary,
    sync(s) {
      dc.sync(s);
      tc.sync(s);
      const dflt = s.doping !== 'p' && Math.round(s.T) === 300;
      summary.textContent = dflt ? '' : `(${s.doping === 'p' ? 'p' : 'n'}, ${Math.round(s.T)} K)`;
    },
  };
}

/**
 * The global controls of the S1–S3 simulations: Interface (Ideal | Preset | Custom),
 * Semiconductor (Si | GaAs | Ge | GaN) and the Settings row (doping type, T).
 */
export function globalControls(store, { present = false } = {}) {
  const pc = presetControl(store);
  const sc = semiControl(store);
  const st = settingsRow(store, { present });
  const row1 = h('div', { class: 'ctl-row' }, pc.el, sc.el, present ? st.button : null);
  return {
    rows: [row1, st.row],
    sync(s) {
      pc.sync(s);
      sc.sync(s);
      st.sync(s);
    },
  };
}

/** Badges describing the source of the selected preset (Ge measured, GaN illustrative). */
export function presetNotes(s) {
  const pr = PRESETS[s.preset];
  if (!pr || !isMaterialPreset(s.preset)) return [];
  if (pr.illustrative) return [['warn', `${pr.label} preset: illustrative D<sub>it</sub>`]];
  if (pr.source === 'dimoulas') return [['info', `${pr.label}: S = ${pr.S} (Dimoulas et al. 2006)`]];
  return [];
}

/** Metal snap buttons bound to a store. */
export function metalControl(store, opts = {}) {
  const m = metalButtons({ ...opts, onPick: (mt) => store.set({ phiM: mt.phiM }, { source: 'user' }) });
  return { el: m.el, sync: (s) => m.set(s.phiM) };
}
