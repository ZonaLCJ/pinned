// Data read off the course slides. Shown in the UI with DIGITIZED_LABEL.
// All points are (phi_m, phi_Bn) in eV.

export const DIGITIZED_LABEL = '≈ digitized from course slide (±0.02 eV)';

// Course PDF p. 271, Mott–Schottky figure. phi_m is where each metal sits *in that
// figure*, which differs from Table 9.1 (e.g. Al ≈ 4.1 in the figure vs 4.28 in Table 9.1).
export const MOTT_SCHOTTKY = Object.freeze({
  source: 'Course PDF p. 271',
  footnote:
    'φ_m positions are where each metal sits in the course figure; they differ from Table 9.1 (e.g. Al ≈ 4.1 eV in the figure vs 4.28 eV in the table).',
  GaAs: Object.freeze({
    slope: 0.04,
    points: Object.freeze([
      { metal: 'Al', phiM: 4.11, phiB: 0.77 },
      { metal: 'Ag', phiM: 4.42, phiB: 0.83 },
      { metal: 'W', phiM: 4.59, phiB: 0.78 },
      { metal: 'Au/Pd', phiM: 5.12, phiB: 0.87 },
      { metal: 'Pt', phiM: 5.71, phiB: 0.85 },
    ]),
  }),
  Si: Object.freeze({
    slope: 0.26,
    points: Object.freeze([
      { metal: 'Mg', phiM: 3.73, phiB: 0.38 },
      { metal: 'Al', phiM: 4.11, phiB: 0.58 },
      { metal: 'Ag', phiM: 4.43, phiB: 0.67 },
      { metal: 'W', phiM: 4.60, phiB: 0.62 },
      { metal: 'Au/Pd', phiM: 5.10, phiB: 0.80 },
      { metal: 'Au/Pd', phiM: 5.15, phiB: 0.75 },
      { metal: 'Pt', phiM: 5.71, phiB: 0.88 },
    ]),
  }),
});

// Course slide p. 272: 2D contacts on n-MoS2 (approximate lines read off the slide).
export const MOS2_LINES = Object.freeze([
  Object.freeze({
    id: 'evaporated',
    label: 'Evaporated metals',
    S: 0.1,
    note: 'pinned, S ≈ 0.1',
    phiB: (phiM) => 0.10 * phiM - 0.36,
  }),
  Object.freeze({
    id: 'vdw',
    label: 'van der Waals-transferred metals',
    S: 0.99,
    note: 'S ≈ 1',
    phiB: (phiM) => 0.99 * (phiM - 4.25) + 0.05,
  }),
  Object.freeze({
    id: 'bi',
    label: 'Bi semimetal contact',
    S: null,
    note: 'φ_B ≈ 0 (Shen et al. 2021)',
    phiB: () => 0,
  }),
]);

export const SHEN_2021 = Object.freeze({
  cite: 'P.-C. Shen et al., Nature 593, 211 (2021)',
  url: 'https://www.nature.com/articles/s41586-021-03472-9',
  contactResistance_ohm_um: 123,
  barrier_eV: 0,
});

// Course tunnelling slide (PDF p. 287): psi ∝ exp(-x / 0.5 nm).
export const TUNNEL_DECAY_NM = 0.5;

// Course slide p. 280: contacts dominate once a transistor's on-resistance falls toward this value.
export const TRANSISTOR_RON = Object.freeze({ value: 500, unit: 'Ω·µm', source: 'course slide p. 280' });

// Literature used by the semiconductor additions (Ge, GaN, ionicity trend).
export const REFS_EXTRA = Object.freeze({
  dimoulas: 'A. Dimoulas et al., Appl. Phys. Lett. 89, 252110 (2006)',
  polyakov: 'A. Y. Polyakov et al., J. Appl. Phys. 100, 093715 (2006)',
  kurtin: 'S. Kurtin, T. C. McGill and C. A. Mead, Phys. Rev. Lett. 22, 1433 (1969)',
});

// Kurtin, McGill and Mead (1969): S rises from about 0.1 (covalent) toward about 1 (strongly ionic).
export const KURTIN_1969 = Object.freeze({ S_covalent: 0.1, S_ionic: 1 });
