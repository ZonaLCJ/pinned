// Pure physics engine. No DOM. The single source of truth for every number shown.
// SI units internally; energies are returned in eV and potentials in V
// (numerically identical for one electron charge).
//
// Parameter object `p` (display units):
//   phiM [eV], chi [eV], Eg [eV], phi0 [eV above E_v], Dit [cm^-2 eV^-1],
//   delta [nm], epsRi [-], epsRs [-], Nd [cm^-3], T [K], Nc300 [cm^-3],
//   Astar [A cm^-2 K^-2], mTunnel [m0]
// No function mutates its inputs.

import { SEMICONDUCTORS, PRESETS, DEFAULTS, PRESET_FOR_SEMI, ASTAR_P } from '../data/materials.js';

// ---------------------------------------------------------------- constants
export const Q = 1.602176634e-19;      // C
export const KB = 8.617333262e-5;      // eV/K
export const EPS0 = 8.8541878128e-12;  // F/m
export const HBAR = 1.054571817e-34;   // J s
export const M0 = 9.1093837015e-31;    // kg

// unit conversions
export const perCm3ToPerM3 = (n) => n * 1e6;
export const perCm2eVToPerM2eV = (d) => d * 1e4;
export const nmToM = (x) => x * 1e-9;
/** Charge density C/m^2 -> elementary charges per cm^2 */
export const cPerM2ToEPerCm2 = (qd) => qd / Q * 1e-4;

export const thermalVoltage = (T) => KB * T; // V (= kT/q)

// ------------------------------------------------------------ presets/params
/** D_it [cm^-2 eV^-1] that gives pinning factor S for a layer delta [nm], epsRi. */
export function ditFromS(S, delta = DEFAULTS.delta, epsRi = DEFAULTS.epsRi) {
  if (S >= 1) return 0;
  const epsI = epsRi * EPS0;
  const d = nmToM(delta);
  return (epsI * (1 / S - 1)) / (Q * d) / 1e4; // m^-2 -> cm^-2
}

/**
 * Interface parameters for a preset.
 * Ideal: D_it = 0, delta = 0 (Schottky–Mott). phi0 keeps the semiconductor's
 * preset value so E0 can still be drawn if the user switches to Custom.
 */
export function presetInterface(presetId, semiId) {
  const pr = PRESETS[presetId];
  if (!pr) throw new Error(`unknown preset ${presetId}`);
  if (presetId === 'custom') return null;
  const semi = pr.semi || semiId || 'Si';
  const own = PRESETS[PRESET_FOR_SEMI[semi]];
  if (pr.ideal) {
    return { preset: 'ideal', semi, Dit: 0, delta: 0, epsRi: DEFAULTS.epsRi, phi0: own.phi0 };
  }
  return {
    preset: presetId,
    semi,
    // GaN has no agreed measured S: its preset fixes D_it directly (illustrative).
    Dit: pr.Dit != null ? pr.Dit : ditFromS(pr.S, DEFAULTS.delta, DEFAULTS.epsRi),
    delta: DEFAULTS.delta,
    epsRi: DEFAULTS.epsRi,
    phi0: pr.phi0,
  };
}

/** Build a full parameter object from a (partial) simulation state. */
export function makeParams(state) {
  const semi = SEMICONDUCTORS[state.semi || 'Si'];
  if (!semi) throw new Error(`unknown semiconductor ${state.semi}`);
  const doping = state.doping === 'p' ? 'p' : 'n';
  return {
    semi: semi.id,
    doping,
    phiM: state.phiM,
    chi: semi.chi,
    Eg: semi.Eg,
    phi0: state.phi0 ?? PRESETS[PRESET_FOR_SEMI[semi.id]].phi0,
    Dit: state.Dit ?? 0,
    delta: state.delta ?? DEFAULTS.delta,
    epsRi: state.epsRi ?? DEFAULTS.epsRi,
    epsRs: semi.epsRs,
    Nd: state.Nd ?? DEFAULTS.Nd,
    T: state.T ?? DEFAULTS.T,
    Nc300: semi.Nc300,
    Nv300: semi.Nv300,
    // A*: material value for electrons; 120 A cm^-2 K^-2 for holes (approx., free-electron value)
    Astar: doping === 'p' ? ASTAR_P.value : semi.Astar,
    mTunnel: semi.mTunnel,
  };
}

// ---------------------------------------------------------------- bulk
export function ncAtT(Nc300, T) {
  return Nc300 * Math.pow(T / 300, 1.5);
}

/**
 * n-type: phi_n = (kT/q) ln(Nc(T)/Nd); p-type: phi_p = (kT/q) ln(Nv(T)/NA).
 * Clamped at 0 (flag `degenerate`). N_c, N_v ∝ T^1.5; full ionization assumed.
 * The doping density is p.Nd for both types (N_d or N_A).
 */
export function bulkFermi(p) {
  if (p.doping === 'p') {
    const Nv = ncAtT(p.Nv300, p.T);
    let phiP = thermalVoltage(p.T) * Math.log(Nv / p.Nd);
    const degenerate = phiP < 0;
    if (degenerate) phiP = 0;
    return { phiP, phiBulk: phiP, Nv, degenerate, degenerateBadge: p.Nd > 0.3 * Nv };
  }
  const Nc = ncAtT(p.Nc300, p.T);
  let phiN = thermalVoltage(p.T) * Math.log(Nc / p.Nd);
  const degenerate = phiN < 0;
  if (degenerate) phiN = 0;
  return { phiN, phiBulk: phiN, Nc, degenerate, degenerateBadge: p.Nd > 0.3 * Nc };
}

// ------------------------------------------------------------- analytic form
/** gamma = eps_i / (eps_i + q delta D_it), D_it in m^-2 eV^-1. Equals S. */
export function gamma(p) {
  const epsI = p.epsRi * EPS0;
  return epsI / (epsI + Q * nmToM(p.delta) * perCm2eVToPerM2eV(p.Dit));
}

const isP = (p) => p.doping === 'p';

/** Pinned (Bardeen-limit, S = 0) barrier: E_g - phi0 (n-type) or phi0 (p-type), eV. */
export const pinnedBarrier = (p) => (isP(p) ? p.phi0 : p.Eg - p.phi0);

/** Schottky–Mott (S = 1) barrier: phi_m - chi (n-type) or E_g + chi - phi_m (p-type). */
export const schottkyMott = (p) => (isP(p) ? p.Eg + p.chi - p.phiM : p.phiM - p.chi);

/** Pivot work function phi_m* = chi + E_g - phi0 (where the S = 1 and S = 0 lines cross; both types). */
export const pivotWorkFunction = (p) => p.chi + p.Eg - p.phi0;

/** Analytic barrier (neglects Q_sc): gamma·(S = 1 value) + (1 - gamma)·(S = 0 value). */
export function analyticBarrier(p) {
  const g = gamma(p);
  return g * schottkyMott(p) + (1 - g) * pinnedBarrier(p);
}

/** E_F - E0 at the interface for a barrier phiB: n: E_g - phi0 - phiBn; p: phiBp - phi0. */
export const interfaceOffset = (p, phiB) => (isP(p) ? phiB - p.phi0 : p.Eg - p.phi0 - phiB);

/** Barrier for a given E_F - E0 at the interface (inverse of interfaceOffset). */
export const barrierForOffset = (p, x) => (isP(p) ? p.phi0 + x : p.Eg - p.phi0 - x);

// -------------------------------------------------------- charge balance
/**
 * Magnitude of the depletion charge [C/m^2] for barrier phiB and bulk phi (0 if phiB <= phi).
 * Q_sc is +this for n-type (ionized donors) and -this for p-type (ionized acceptors).
 */
export function depletionCharge(p, phiBn, phiN = bulkFermi(p).phiBulk) {
  const v = phiBn - phiN;
  if (!(v > 0)) return 0;
  return Math.sqrt(2 * Q * p.epsRs * EPS0 * perCm3ToPerM3(p.Nd) * v);
}

/** Interface-state charge Q_ss [C/m^2] = -q D_it (E_F - E0). */
export function interfaceCharge(p, phiB) {
  return -Q * perCm2eVToPerM2eV(p.Dit) * interfaceOffset(p, phiB);
}

/** Potential drop across delta: n: phi_m - chi - phiBn; p: phi_m - chi - (E_g - phiBp). */
export const oxideDrop = (p, phiB) => (isP(p) ? p.phiM - p.chi - (p.Eg - phiB) : p.phiM - p.chi - phiB);

/** Metal charge Q_m [C/m^2] = -eps_i dV_ox / delta (Gauss's law across delta). */
export function metalCharge(p, phiB) {
  return (-p.epsRi * EPS0 * oxideDrop(p, phiB)) / nmToM(p.delta);
}

/**
 * F(phiB) = Q_m + Q_ss + Q_sc. Strictly increasing in phiBn (n-type),
 * strictly decreasing in phiBp (p-type, Q_sc = -sqrt(2 q eps_s N_A (phiBp - phi_p))).
 */
export function chargeResidual(p, phiB, phiBulk = bulkFermi(p).phiBulk) {
  const qsc = depletionCharge(p, phiB, phiBulk);
  return metalCharge(p, phiB) + interfaceCharge(p, phiB) + (isP(p) ? -qsc : qsc);
}

// -------------------------------------------------------------- solver
/**
 * Barrier height from charge balance. Returns every derived quantity.
 * regime: 'depletion' | 'ohmic' | 'inversion'
 */
export function solveBarrier(p) {
  const bulk = bulkFermi(p);
  const phiBulk = bulk.phiBulk;
  const pType = isP(p);
  // Spec: delta = 0 and D_it = 0 -> Schottky–Mott. delta = 0 with D_it > 0 is the
  // same limit (D_it * delta -> 0), so any delta <= 0 takes this branch.
  const ideal = !(p.delta > 0);
  let phiB;
  let regime = 'depletion';
  let iterations = 0;

  if (ideal) {
    // Schottky–Mott: never divide by delta. n: phi_m - chi; p: E_g + chi - phi_m.
    phiB = schottkyMott(p);
    if (phiB > p.Eg) regime = 'inversion';
    else if (phiB < phiBulk) regime = 'ohmic';
  } else {
    const F = (x) => chargeResidual(p, x, phiBulk);
    let lo = phiBulk;
    let hi = p.Eg;
    // n-type: F increases; p-type: F decreases. "up" = F has the sign of the high end.
    const up = pType ? -1 : 1;
    if (pType ? F(lo) <= 0 : F(lo) > 0) {
      regime = 'ohmic';
      phiB = phiBulk;
    } else if (pType ? F(hi) > 0 : F(hi) < 0) {
      regime = 'inversion';
      phiB = p.Eg;
    } else {
      // 60 iterations (spec §5.3). Stopping early at a 1e-6 V interval would leave a
      // relative charge residual of ~5e-6, above the 1e-6 neutrality target.
      for (iterations = 0; iterations < 60 && hi - lo > 0; iterations++) {
        const mid = 0.5 * (lo + hi);
        if (up * F(mid) > 0) hi = mid;
        else lo = mid;
      }
      phiB = 0.5 * (lo + hi);
    }
  }

  const dVox = oxideDrop(p, phiB);
  const Vbi = phiB - phiBulk;
  const epsS = p.epsRs * EPS0;
  const N = perCm3ToPerM3(p.Nd);
  const W = Vbi > 0 ? Math.sqrt((2 * epsS * Vbi) / (Q * N)) : 0; // m
  const Emax = (Q * N * W) / epsS; // V/m

  const qscMag = depletionCharge(p, phiB, phiBulk);
  const Qsc = pType ? -qscMag : qscMag;
  let Qss;
  let Qm;
  if (ideal) {
    Qss = 0;
    Qm = -Qsc;
  } else {
    Qss = interfaceCharge(p, phiB);
    Qm = metalCharge(p, phiB);
  }
  const EFmE0 = interfaceOffset(p, phiB);

  return {
    doping: pType ? 'p' : 'n',
    phiB, // majority-carrier barrier (phi_Bn or phi_Bp)
    ...(pType ? { phiBp: phiB, phiP: phiBulk } : { phiBn: phiB, phiN: phiBulk }),
    phiBulk,
    Ec0: pType ? p.Eg - phiB : phiB, // E_c at the interface, relative to E_F
    sm: schottkyMott(p),
    dVox,
    Vbi,
    W,
    Emax,
    Qm,
    Qss,
    Qsc,
    QmCm: cPerM2ToEPerCm2(Qm),
    QssCm: cPerM2ToEPerCm2(Qss),
    QscCm: cPerM2ToEPerCm2(Qsc),
    EFmE0,
    regime,
    ideal,
    iterations,
    gamma: ideal ? 1 : gamma(p),
    pivot: pivotWorkFunction(p),
    pinned: pinnedBarrier(p),
    flags: {
      ideal,
      ohmic: regime === 'ohmic',
      inversion: regime === 'inversion',
      degenerate: bulk.degenerate,
      degenerateBadge: bulk.degenerateBadge,
    },
  };
}

/** Majority-carrier barrier only (convenience): phi_Bn or phi_Bp. */
export const barrier = (p) => solveBarrier(p).phiB;

/** Barrier for each phi_m in xs (numeric solver). */
export function sweepPhiM(p, xs) {
  return xs.map((phiM) => solveBarrier({ ...p, phiM }).phiB);
}

/** Numeric slope d(phiBn)/d(phiM) between two work functions. */
export function numericSlope(p, a, b) {
  return (barrier({ ...p, phiM: b }) - barrier({ ...p, phiM: a })) / (b - a);
}

/** Work function that puts E_F - E0 at `target` (eV) at the interface (bisection). */
export function phiMForOffset(p, target, lo = 2, hi = 8) {
  const g = (phiM) => solveBarrier({ ...p, phiM }).EFmE0 - target; // decreasing in phiM
  let a = lo;
  let b = hi;
  for (let i = 0; i < 80; i++) {
    const m = 0.5 * (a + b);
    if (g(m) > 0) a = m;
    else b = m;
  }
  return 0.5 * (a + b);
}

// --------------------------------------------------------- band profile
/**
 * Semiconductor band profile, energies relative to E_F = 0.
 * n-type: E_c(x) = phi_n + V_bi (1 - x/W)^2 (bands bend up toward the interface).
 * p-type: E_v(x) = -[phi_p + V_bi (1 - x/W)^2], E_c = E_v + E_g (bands bend down).
 * xMax = 1.4 W (or 100 nm if there is no depletion region), unless xMaxFixed [m] is given.
 */
export function bandProfile(p, res, n = 120, xMaxFixed) {
  const W = res.W;
  const xMax = xMaxFixed > 0 ? xMaxFixed : W > 0 ? 1.4 * W : 100e-9;
  const Vbi = Math.max(res.Vbi, 0);
  const pType = res.doping === 'p';
  const bulk = res.phiBulk ?? res.phiN;
  const EcBulk = pType ? p.Eg - bulk : bulk;
  const sgn = pType ? -1 : 1;
  // ideal contacts can sit outside [phi_bulk, E_g]; draw the surface value as given then
  const surfEc = res.ideal && Vbi > 0 ? res.Ec0 ?? res.phiBn : EcBulk + sgn * Vbi;
  const xs = [];
  const Ec = [];
  for (let i = 0; i <= n; i++) {
    const x = (xMax * i) / n;
    xs.push(x);
    let e;
    if (W > 0 && x <= W) e = EcBulk + sgn * Vbi * (1 - x / W) ** 2;
    else e = EcBulk;
    if (i === 0) e = surfEc;
    Ec.push(e);
  }
  const Ev = Ec.map((e) => e - p.Eg);
  const Evac = Ec.map((e) => e + p.chi);
  return { xs, Ec, Ev, Evac, xMax, W, EcBulk, EvBulk: EcBulk - p.Eg };
}

/**
 * Interface-state ladder at x = 0 between E_v(0) and E_c(0).
 * Number of rungs grows with log10(D_it) (visual density ∝ log10(D_it / 1e10)).
 * Each rung: { E, filled, charge: -1 (filled acceptor), +1 (empty donor), 0 (neutral) }
 */
export function ladderStates(p, res) {
  if (!(p.Dit > 0) || res.ideal) return { rungs: [], E0: null };
  const n = Math.max(2, Math.min(28, Math.round(5 * (Math.log10(p.Dit) - 10))));
  const Ec0 = res.Ec0 ?? res.phiBn;
  const Ev0 = Ec0 - p.Eg;
  const E0 = Ev0 + p.phi0;
  const rungs = [];
  for (let i = 0; i < n; i++) {
    const E = Ev0 + ((i + 0.5) / n) * p.Eg;
    const filled = E < 0; // below E_F
    let charge = 0;
    if (E > E0 && E < 0) charge = -1; // filled acceptor-like
    else if (E < E0 && E > 0) charge = +1; // empty donor-like
    rungs.push({ E, filled, charge });
  }
  return { rungs, E0, Ev0, Ec0 };
}

// ---------------------------------------------------------------- current
/** Saturation current density J_s = A* T^2 exp(-phiBn / kT) [A/cm^2]. */
export function saturationCurrent(phiBn, T, Astar) {
  return Astar * T * T * Math.exp(-phiBn / thermalVoltage(T));
}

/**
 * Saturation current at p.T relative to 300 K: J_s(T)/J_s(300 K), each with the barrier
 * solved at its own temperature (A* cancels). E_g, chi, phi0 and D_it stay at 300 K values.
 */
export function saturationRatioVs300(p) {
  const bT = barrier(p);
  const b300 = barrier({ ...p, T: 300 });
  return { ratio: saturationCurrent(bT, p.T, 1) / saturationCurrent(b300, 300, 1), phiB: bT, phiB300: b300 };
}

/** Real relative crossing rate over the barrier at equilibrium: exp(-V_bi / kT). */
export function crossingRate(res, T) {
  return Math.exp(-Math.max(res.Vbi, 0) / thermalVoltage(T));
}

/** J1/J2 = exp((phiB2 - phiB1)/kT). Independent of A*. */
export function currentRatio(phiB1, phiB2, T) {
  return Math.exp((phiB2 - phiB1) / thermalVoltage(T));
}

/** J(V) = J_s (exp(V/kT) - 1) [A/cm^2]. */
export function diodeCurrent(phiBn, T, Astar, V) {
  return saturationCurrent(phiBn, T, Astar) * Math.expm1(V / thermalVoltage(T));
}

// ------------------------------------------------------------------- C–V
/** 1/C'^2 = 2 (V_bi + V_R) / (q eps_s N_d), returned in cm^4/F^2. */
export function invCapSquared(p, Vbi, VR) {
  const si = (2 * (Vbi + VR)) / (Q * p.epsRs * EPS0 * perCm3ToPerM3(p.Nd)); // m^4/F^2
  return si * 1e8; // (F/m^2 -> F/cm^2 is x1e-4, squared inverse is x1e8)
}

/** Deterministic PRNG (mulberry32) so a "measurement" can be repeated. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simulated C–V measurement: 1/C^2 at each V_R with ±noise (uniform, relative). */
export function simulateCV(p, { VR = rangeArray(0, 4, 17), noise = 0.01, seed = 1 } = {}) {
  const res = solveBarrier(p);
  const rnd = mulberry32(seed);
  const pts = VR.map((v) => {
    const ideal = invCapSquared(p, res.Vbi, v);
    return { VR: v, y: ideal * (1 + noise * (2 * rnd() - 1)), yTrue: ideal };
  });
  return { points: pts, truth: res };
}

/** Least-squares line y = slope x + intercept. */
export function fitLine(xs, ys) {
  const n = xs.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
    sxx += xs[i] * xs[i];
    sxy += xs[i] * ys[i];
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

/** From a 1/C^2 vs V_R line: the voltage-axis intercept is -V_bi; phi_B = V_bi + phi_n (or phi_p). */
export function barrierFromCVLine(line, phiBulk) {
  const Vbi = line.intercept / line.slope;
  return { Vbi, phiBn: Vbi + phiBulk, phiB: Vbi + phiBulk, vIntercept: -Vbi };
}

// --------------------------------------------- contact-resistance toy model
/** E00 = (hbar/2) sqrt(N_d / (m* eps_s)) — comes out in eV with SI inputs. */
export function E00(p) {
  return (HBAR / 2) * Math.sqrt(perCm3ToPerM3(p.Nd) / (p.mTunnel * M0 * p.epsRs * EPS0));
}

/** E0' = E00 coth(E00 / kT). */
export function E0prime(p) {
  const e = E00(p);
  const x = e / thermalVoltage(p.T);
  return e / Math.tanh(x);
}

/**
 * Toy contact model (qualitative). Interlayer thickness t [nm]:
 *   D_it,eff = D_it exp(-t/lambda); delta and eps_i unchanged.
 *   rho_c = (k_B/(A* T)) exp(phiBn/E0') exp(2 kappa t)  [Ohm cm^2]
 */
export function contactResistivity(p, { t = 0, lambda = DEFAULTS.lambda, kappa = DEFAULTS.kappa } = {}) {
  const DitEff = p.Dit * Math.exp(-t / lambda);
  const pe = { ...p, Dit: DitEff };
  const res = solveBarrier(pe);
  const e0p = E0prime(p);
  // (toy model, n-type only)
  const prefactor = KB / (p.Astar * p.T);
  const barrierFactor = Math.exp(res.phiBn / e0p);
  const tunnelFactor = Math.exp(2 * kappa * t);
  return {
    rhoC: prefactor * barrierFactor * tunnelFactor,
    phiBn: res.phiBn,
    res,
    DitEff,
    gammaEff: res.ideal ? 1 : gamma(pe),
    E00: E00(p),
    E0p: e0p,
    prefactor,
    barrierFactor,
    tunnelFactor,
  };
}

/** Interlayer thickness that minimises rho_c on [tMin, tMax] (grid + golden-section). */
export function optimumThickness(p, { tMin = 0, tMax = 3, lambda = DEFAULTS.lambda, kappa = DEFAULTS.kappa } = {}) {
  const f = (t) => Math.log(contactResistivity(p, { t, lambda, kappa }).rhoC);
  const N = 120;
  let best = tMin;
  let bestV = Infinity;
  for (let i = 0; i <= N; i++) {
    const t = tMin + ((tMax - tMin) * i) / N;
    const v = f(t);
    if (v < bestV) {
      bestV = v;
      best = t;
    }
  }
  const h = (tMax - tMin) / N;
  let a = Math.max(tMin, best - h);
  let b = Math.min(tMax, best + h);
  const gr = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 60; i++) {
    const c = b - gr * (b - a);
    const d = a + gr * (b - a);
    if (f(c) < f(d)) b = d;
    else a = c;
  }
  const t = 0.5 * (a + b);
  return { t, ...contactResistivity(p, { t, lambda, kappa }) };
}

// ---------------------------------------------------------------- helpers
export function rangeArray(a, b, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(a + ((b - a) * i) / (n - 1));
  return out;
}

export function logRange(a, b, n) {
  const la = Math.log10(a);
  const lb = Math.log10(b);
  return rangeArray(la, lb, n).map((x) => 10 ** x);
}

/** Generic grid evaluation for heatmaps: rows over ys, columns over xs. */
export function grid(xs, ys, fn) {
  const values = new Float64Array(xs.length * ys.length);
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < ys.length; j++) {
    for (let i = 0; i < xs.length; i++) {
      const v = fn(xs[i], ys[j]);
      values[j * xs.length + i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return { xs, ys, values, min, max, nx: xs.length, ny: ys.length };
}

// ======================================================================
// MOS gate with interface states ("Going further", detailed mode only).
// m = { NA [cm^-3], ni [cm^-3], epsRs, T, epsRox, tox [nm], VFB [V], Dit [cm^-2 eV^-1] }
// psi = surface potential psi_s [V], positive = bands bend down (toward inversion of p-Si).

/** Oxide capacitance per area C_ox = eps_ox / t_ox [F/m^2]. */
export const mosCox = (m) => (m.epsRox * EPS0) / nmToM(m.tox);

/** phi_F = (kT/q) ln(N_A / n_i) [V]. */
export const mosPhiF = (m) => thermalVoltage(m.T) * Math.log(m.NA / m.ni);

/** Extrinsic Debye length L_D = sqrt(eps_s kT / (q^2 p_p0)) [m]. */
export const mosDebye = (m) => Math.sqrt((m.epsRs * EPS0 * thermalVoltage(m.T)) / (Q * perCm3ToPerM3(m.NA)));

/**
 * Semiconductor charge per area [C/m^2] from the exact 1D Poisson result
 * (accumulation, depletion and inversion):
 *   Q_s = −sign(psi) sqrt(2) eps_s (kT/q) / L_D · F,
 *   F = sqrt[(e^(−b psi) + b psi − 1) + (n_p0/p_p0)(e^(b psi) − b psi − 1)], b = q/kT.
 */
export function mosQs(m, psi) {
  if (psi === 0) return 0;
  const vt = thermalVoltage(m.T);
  const b = 1 / vt;
  const ratio = (m.ni / m.NA) ** 2; // n_p0 / p_p0
  const F = Math.sqrt(Math.exp(-b * psi) + b * psi - 1 + ratio * (Math.exp(b * psi) - b * psi - 1));
  return (-Math.sign(psi) * Math.SQRT2 * m.epsRs * EPS0 * vt * F) / mosDebye(m);
}

/** Interface-state charge, neutral level at midgap: Q_it = −q D_it (psi_s − phi_F) [C/m^2]. */
export const mosQit = (m, psi) => -Q * perCm2eVToPerM2eV(m.Dit) * (psi - mosPhiF(m));

/** V_G = V_FB + psi_s − (Q_s + Q_it)/C_ox. Increases monotonically with psi_s. */
export const mosVG = (m, psi) => m.VFB + psi - (mosQs(m, psi) + mosQit(m, psi)) / mosCox(m);

/** Surface potential for a gate voltage: bisection over psi_s in m.psiRange (default −0.5…1.2 V). */
export function mosPsi(m, VG) {
  let [lo, hi] = m.psiRange || [-0.5, 1.2];
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (mosVG(m, mid) > VG) hi = mid;
    else lo = mid;
  }
  return 0.5 * (lo + hi);
}

/** Threshold: the V_G at which psi_s = 2 phi_F. */
export const mosThreshold = (m) => mosVG(m, 2 * mosPhiF(m));

/** Semiconductor capacitance C_s = −dQ_s/dpsi_s [F/m^2] (central difference). */
export function mosCs(m, psi, h = 1e-4) {
  return -(mosQs(m, psi + h) - mosQs(m, psi - h)) / (2 * h);
}

/** Full state at a gate voltage, incl. dpsi/dV_G (numeric) and the small-signal estimate. */
export function mosSolve(m, VG) {
  const psi = mosPsi(m, VG);
  const phiF = mosPhiF(m);
  const Cox = mosCox(m);
  const Cs = mosCs(m, psi);
  const Cit = Q * perCm2eVToPerM2eV(m.Dit);
  const dV = 0.01;
  const slope = (mosPsi(m, VG + dV) - mosPsi(m, VG - dV)) / (2 * dV);
  return {
    VG,
    psi,
    phiF,
    Cox,
    Cs,
    Cit,
    Qs: mosQs(m, psi),
    Qit: mosQit(m, psi),
    slope,
    slopeEstimate: Cox / (Cox + Cs + Cit),
    VT: mosThreshold(m),
    inversion: psi >= 2 * phiF,
  };
}

/** Band-bending profile psi(x) for drawing (depletion approximation / Debye tail; illustrative). */
export function mosProfile(m, psi, xMax, n = 80) {
  const phiF = mosPhiF(m);
  const N = perCm3ToPerM3(m.NA);
  const xs = [];
  const ps = [];
  if (psi >= 0) {
    const W = Math.sqrt((2 * m.epsRs * EPS0 * Math.min(psi, 2 * phiF)) / (Q * N));
    for (let i = 0; i <= n; i++) {
      const x = (xMax * i) / n;
      xs.push(x);
      ps.push(x < W ? psi * (1 - x / W) ** 2 : 0);
    }
    return { xs, ps, W };
  }
  const LD = mosDebye(m);
  for (let i = 0; i <= n; i++) {
    const x = (xMax * i) / n;
    xs.push(x);
    ps.push(psi * Math.exp(-x / LD));
  }
  return { xs, ps, W: 0 };
}

/** Interface-state ladder at the oxide–Si interface (neutral level at midgap), reusing ladderStates(). */
export function mosLadder(m, psi, Eg) {
  const Ec0 = mosPhiF(m) - psi + Eg / 2; // E_c(0) relative to E_F
  return ladderStates({ Dit: m.Dit, Eg, phi0: Eg / 2 }, { phiBn: Ec0, ideal: false });
}
