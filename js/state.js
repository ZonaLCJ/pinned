// Shared simulation state + subscribe(). One schema for every section:
// { semi, preset, phiM, Dit, delta, phi0, epsRi, Nd, T, t, lambda, kappa, anim }
// Presentation mode: one shared store; each section loads its start state on entry.
// Detailed mode: each section owns a local store, so scrolling never resets another sim.
import { presetInterface } from './engine.js';
import { DEFAULTS, SEMICONDUCTORS, METALS, SLIDER_RANGES, PRESETS, PRESET_FOR_SEMI } from '../data/materials.js';

export function createStore(initial) {
  let state = { ...initial };
  const subs = new Set();
  return {
    get: () => state,
    /** meta.source: 'user' | 'demo' | 'hook' | 'init' */
    set(patch, meta = {}) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      for (const fn of subs) fn(state, meta);
    },
    replace(next, meta = {}) {
      state = { ...next };
      for (const fn of subs) fn(state, meta);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

/** Full state for a preset (+ overrides). */
export function stateFor(presetId, semi = 'Si', extra = {}) {
  const base = {
    semi,
    preset: presetId,
    doping: 'n', // quizzes, demos and animations rely on these defaults (n-type, 300 K)
    phiM: 5.1,
    Dit: 0,
    delta: DEFAULTS.delta,
    phi0: PRESETS[PRESET_FOR_SEMI[semi]].phi0,
    epsRi: DEFAULTS.epsRi,
    Nd: DEFAULTS.Nd,
    T: DEFAULTS.T,
    t: DEFAULTS.t,
    lambda: DEFAULTS.lambda,
    kappa: DEFAULTS.kappa,
    anim: null,
  };
  const iface = presetInterface(presetId === 'custom' ? PRESET_FOR_SEMI[semi] : presetId, semi);
  return { ...base, ...iface, preset: presetId, ...extra };
}

/** Material presets (one per semiconductor). */
export const isMaterialPreset = (id) => Object.values(PRESET_FOR_SEMI).includes(id);

/** Patch for choosing a preset from the current state. 'preset' = the material preset of state.semi. */
export function presetPatch(state, presetId) {
  if (presetId === 'preset') presetId = PRESET_FOR_SEMI[state.semi];
  if (presetId === 'custom') {
    const p = { preset: 'custom' };
    if (!(state.delta > 0)) p.delta = DEFAULTS.delta; // leaving Ideal: give the layer a thickness
    if (!(state.Dit > 0)) p.Dit = SLIDER_RANGES.Dit.min;
    return p;
  }
  const iface = presetInterface(presetId, state.semi);
  return { ...iface, preset: presetId };
}

/** Patch for switching semiconductor. Material presets follow the semiconductor. */
export function semiPatch(state, semi) {
  if (isMaterialPreset(state.preset)) {
    return { ...presetInterface(PRESET_FOR_SEMI[semi]), semi };
  }
  const Eg = SEMICONDUCTORS[semi].Eg;
  return { semi, phi0: Math.min(state.phi0, Eg) };
}

/** Patch for a physics slider (D_it, delta, phi0, epsRi): switches to Custom. */
export function paramPatch(state, key, value) {
  const p = { [key]: value };
  if (['Dit', 'delta', 'phi0', 'epsRi'].includes(key) && state.preset !== 'custom') {
    p.preset = 'custom';
    if (key !== 'delta' && !(state.delta > 0)) p.delta = DEFAULTS.delta;
    if (key !== 'Dit' && !(state.Dit > 0)) p.Dit = SLIDER_RANGES.Dit.min;
  }
  return p;
}

/** Table 9.1 metal matching phi_m (within 5 meV), or null. */
export function metalAt(phiM) {
  return METALS.find((m) => Math.abs(m.phiM - phiM) < 0.005) || null;
}
