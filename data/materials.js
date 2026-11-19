// Material parameters, metals and presets.
// Values are taken verbatim from the build spec (course notes / Neamen Table 9.1).
// Nothing in here is computed; derived values (e.g. preset D_it) come from js/engine.js.

export const SEMICONDUCTORS = Object.freeze({
  Si: Object.freeze({
    id: 'Si',
    name: 'Si',
    Eg: 1.12,          // eV
    chi: 4.01,         // eV, electron affinity
    epsRs: 11.7,       // relative permittivity
    Nc300: 2.8e19,     // cm^-3 at 300 K
    Nv300: 1.04e19,    // cm^-3 at 300 K
    Astar: 110,        // A cm^-2 K^-2 (Richardson constant, n-type)
    mTunnel: 0.26,     // m*_tunnel / m0 (approx.)
    surfaceAtoms: 6.8e14, // cm^-2, Si surface atom density (used in S3 text)
  }),
  GaAs: Object.freeze({
    id: 'GaAs',
    name: 'GaAs',
    Eg: 1.42,
    chi: 4.07,
    epsRs: 13.1,
    Nc300: 4.7e17,
    Nv300: 7.0e18,
    Astar: 8.16,
    mTunnel: 0.067,
  }),
  Ge: Object.freeze({
    id: 'Ge',
    name: 'Ge',
    Eg: 0.66,
    chi: 4.13,         // course Table 9.2
    epsRs: 16.0,
    Nc300: 1.04e19,
    Nv300: 6.0e18,
    Astar: 143,        // approx.
    AstarApprox: true,
  }),
  GaN: Object.freeze({
    id: 'GaN',
    name: 'GaN',
    Eg: 3.4,
    chi: 4.1,
    epsRs: 8.9,
    Nc300: 2.24e18,
    Nv300: 4.6e19,
    Astar: 26.4,       // approx.
    AstarApprox: true,
  }),
});

/** Order of the semiconductor selector. */
export const SEMI_ORDER = Object.freeze(['Si', 'GaAs', 'Ge', 'GaN']);

/** p-type currents: A* = 120 A cm^-2 K^-2 for every material (approx., free-electron value). */
export const ASTAR_P = Object.freeze({ value: 120, label: 'approx. (free-electron value)' });

// Course Table 9.1, work functions in eV (alphabetical order).
export const METALS = Object.freeze([
  { id: 'Ag', phiM: 4.26 },
  { id: 'Al', phiM: 4.28 },
  { id: 'Au', phiM: 5.10 },
  { id: 'Cr', phiM: 4.50 },
  { id: 'Mo', phiM: 4.60 },
  { id: 'Ni', phiM: 5.15 },
  { id: 'Pd', phiM: 5.12 },
  { id: 'Pt', phiM: 5.65 },
  { id: 'Ti', phiM: 4.33 },
  { id: 'W',  phiM: 4.55 },
].map(Object.freeze));

export function metalById(id) {
  return METALS.find((m) => m.id === id) || null;
}

// Defaults shared by every preset (spec §5.5).
export const DEFAULTS = Object.freeze({
  delta: 0.5,   // nm, interfacial layer thickness
  epsRi: 1,     // relative permittivity of the interfacial layer
  Nd: 1e16,     // cm^-3
  T: 300,       // K
  t: 0,         // nm, deliberate interlayer (Section 4 only)
  lambda: 0.3,  // nm, MIGS blocking length (toy model)
  kappa: 1.5,   // nm^-1, interlayer tunnelling decay constant (toy model)
});

// Presets fitted to the lines of the course Mott–Schottky figure (spec §5.5).
// D_it is NOT stored: it is derived from S with engine.ditFromS() so the
// preset can never drift from its slope. Table values for reference:
//   Si   S = 0.26, Eg - phi0 = 0.67 eV, phi0 = 0.45 eV, D_it = 3.15e13, pivot 4.68 eV
//   GaAs S = 0.04, Eg - phi0 = 0.82 eV, phi0 = 0.60 eV, D_it = 2.65e14, pivot 4.89 eV
export const PRESETS = Object.freeze({
  ideal:  Object.freeze({ id: 'ideal',  label: 'Ideal',  semi: null,   S: 1,    phi0: null, ideal: true }),
  si:     Object.freeze({ id: 'si',     label: 'Si',     semi: 'Si',   S: 0.26, phi0: 0.45 }),
  gaas:   Object.freeze({ id: 'gaas',   label: 'GaAs',   semi: 'GaAs', S: 0.04, phi0: 0.60 }),
  // Ge: phi0 = charge-neutrality level 0.09 eV above E_v and S = 0.05 (Dimoulas et al. 2006).
  ge:     Object.freeze({ id: 'ge',     label: 'Ge',     semi: 'Ge',   S: 0.05, phi0: 0.09, source: 'dimoulas' }),
  // GaN: E_F pinned ≈ 0.9 eV below E_c (phi0 = 2.5 eV; Polyakov et al. 2006). No agreed measured S:
  // D_it = 1e13 cm^-2 eV^-1 is illustrative (S ≈ 0.52 at delta = 0.5 nm).
  gan:    Object.freeze({ id: 'gan',    label: 'GaN',    semi: 'GaN',  S: null, Dit: 1e13, phi0: 2.5, illustrative: true, source: 'polyakov' }),
  custom: Object.freeze({ id: 'custom', label: 'Custom', semi: null,   S: null, phi0: null }),
});

// Table values quoted in the spec, used only by tests to check the derivation.
export const PRESET_TABLE = Object.freeze({
  si:   Object.freeze({ Dit: 3.15e13, pinned: 0.67, pivot: 4.68 }),
  gaas: Object.freeze({ Dit: 2.65e14, pinned: 0.82, pivot: 4.89 }),
});

export const SLIDER_RANGES = Object.freeze({
  phiM:  Object.freeze({ min: 3.5, max: 6.0, step: 0.01, unit: 'eV' }),
  Dit:   Object.freeze({ min: 1e11, max: 1e15, log: true, unit: 'cm⁻²eV⁻¹' }),
  delta: Object.freeze({ min: 0.2, max: 2, step: 0.01, unit: 'nm' }),
  phi0:  Object.freeze({ min: 0, max: null /* = Eg */, step: 0.01, unit: 'eV' }),
  Nd:    Object.freeze({ min: 1e15, max: 1e19, log: true, unit: 'cm⁻³' }),
  t:     Object.freeze({ min: 0, max: 3, step: 0.01, unit: 'nm' }),
  lambda: Object.freeze({ min: 0.1, max: 1.0, step: 0.01, unit: 'nm' }), // advanced, detailed mode
  kappa:  Object.freeze({ min: 0.5, max: 3.0, step: 0.05, unit: 'nm⁻¹' }), // advanced, detailed mode
});

// ---------------------------------------------------------------------------
// "Going further" MOS gate model (detailed mode only). Values from the build spec.
export const MOS = Object.freeze({
  NA: 1e17,         // cm^-3, p-type Si substrate
  ni: 1.5e10,       // cm^-3, intrinsic carrier density of Si at 300 K
  epsRs: 11.7,      // Si
  T: 300,           // K
  epsRox: 3.9,      // SiO2
  tox: 10,          // nm
  VFB: 0,           // V: work-function difference and fixed oxide charge ignored
  breakdownMVcm: 10, // MV/cm, rough SiO2 breakdown field
  psiRange: Object.freeze([-0.5, 1.2]), // V, bisection bracket for psi_s
  VGRange: Object.freeze([-2, 3]),      // V, slider and plot range
});

export const MOS_PRESETS = Object.freeze([
  Object.freeze({ id: 'annealed', label: 'Si/SiO₂ after H₂ anneal', Dit: 1e10 }),
  Object.freeze({ id: 'poor', label: 'Poor interface', Dit: 1e12 }),
  Object.freeze({ id: 'gaaslike', label: 'GaAs-like native oxide', Dit: 1e14, note: 'illustrative: Si parameters with a GaAs-like D_it' }),
]);

// Animation 1 ("From chip to band diagram") settings.
export const CHIP = Object.freeze({
  metal: 'Al',
  NdStart: 1e16,    // cm^-3 (stages 1–4)
  NdHeavy: 1e19,    // cm^-3 ("Heavy doping" fix)
  tInterlayer: 0.75, // nm ("+ 0.75 nm interlayer" fix)
});

/** Material preset id for a semiconductor. */
export const PRESET_FOR_SEMI = Object.freeze({ Si: 'si', GaAs: 'gaas', Ge: 'ge', GaN: 'gan' });
