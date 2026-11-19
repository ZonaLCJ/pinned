// Every number quoted in the prose is computed here from engine.js / course-data.js.
// (Spec: no hard-coded results in the UI.)
import * as E from './engine.js';
import { stateFor } from './state.js';
import { METALS, SEMICONDUCTORS, DEFAULTS, PRESETS, metalById } from '../data/materials.js';
import { MOTT_SCHOTTKY, SHEN_2021, TUNNEL_DECAY_NM, KURTIN_1969 } from '../data/course-data.js';

const params = (preset, semi, phiM, extra = {}) => E.makeParams(stateFor(preset, semi, { phiM, ...extra }));
const phiOf = (id) => metalById(id).phiM;

let cached = null;

export function facts() {
  if (cached) return cached;
  const T = DEFAULTS.T;
  const kT = E.thermalVoltage(T);
  const si = params('si', 'Si', phiOf('Au'));
  const ga = params('gaas', 'GaAs', phiOf('Au'));

  const solve = (pr, semi, id, extra) => E.solveBarrier(params(pr, semi, phiOf(id), extra));

  // S1
  const idealAuSi = solve('ideal', 'Si', 'Au');
  const idealAlSi = solve('ideal', 'Si', 'Al');
  const siAu = solve('si', 'Si', 'Au');
  const siAl = solve('si', 'Si', 'Al');
  const pinnedQsc = E.depletionCharge(si, E.pinnedBarrier(si)); // whole depletion region at E_F = E0
  const dit13 = 1e13;

  // S2
  const auSiLayerNoStates = E.solveBarrier(params('ideal', 'Si', phiOf('Au'), { delta: DEFAULTS.delta, Dit: 0 }));
  const hookDit = 1e14;
  const hookPhi1 = 4.6;
  const hp = params('si', 'Si', hookPhi1, { Dit: hookDit });
  const hookDelta = E.barrier({ ...hp, phiM: hookPhi1 + 1 }) - E.barrier(hp);

  // S3
  const gamma13 = E.gamma({ Dit: dit13, delta: DEFAULTS.delta, epsRi: DEFAULTS.epsRi });
  const surfFrac = dit13 / SEMICONDUCTORS.Si.surfaceAtoms;
  const idealGaAsAl = solve('ideal', 'GaAs', 'Al');
  const idealGaAsAu = solve('ideal', 'GaAs', 'Au');
  const idealSpread = idealGaAsAu.phiBn - idealGaAsAl.phiBn;
  const idealRatio = E.currentRatio(idealGaAsAl.phiBn, idealGaAsAu.phiBn, T);
  const gaData = MOTT_SCHOTTKY.GaAs.points;
  const dataAl = gaData.find((d) => d.metal === 'Al');
  const dataAu = gaData.find((d) => d.metal === 'Au/Pd');
  const dataSpread = dataAu.phiB - dataAl.phiB;
  const dataRatio = E.currentRatio(dataAl.phiB, dataAu.phiB, T);

  const pivotSpread = (pr, semi) => {
    const p0 = params(pr, semi, 4.5);
    const pv = E.pivotWorkFunction(p0);
    const v = E.logRange(1e11, 1e15, 41).map((Dit) => E.barrier({ ...p0, phiM: pv, Dit }));
    return Math.max(...v) - Math.min(...v);
  };

  // S3: Ge note (Ge preset: Dimoulas et al. 2006) — barrier range over the Table 9.1 metals
  const geN = METALS.map((m) => solve('ge', 'Ge', m.id).phiB);
  const geP = METALS.map((m) => solve('ge', 'Ge', m.id, { doping: 'p' }));

  // S4
  const si18 = solve('si', 'Si', 'Au', { Nd: 1e18 });
  const pAl18 = params('si', 'Si', phiOf('Al'), { Nd: 1e18 });
  const pAl19 = params('si', 'Si', phiOf('Al'), { Nd: 1e19 });
  const opt18 = E.optimumThickness(pAl18);
  const opt19 = E.optimumThickness(pAl19);
  const al18t0 = E.contactResistivity(pAl18, { t: 0 });
  const al18t1 = E.contactResistivity(pAl18, { t: 1.0 });
  const al18t3 = E.contactResistivity(pAl18, { t: 3 });
  const al19t0 = E.contactResistivity(pAl19, { t: 0 });
  const gaBest19 = E.optimumThickness(params('gaas', 'GaAs', phiOf('Al'), { Nd: 1e19 }));

  // mission sets
  const mission = (pr, semi) => METALS.filter((m) => solve(pr, semi, m.id).phiBn <= 0.6).map((m) => m.id);

  cached = {
    T,
    kT,
    si,
    ga,
    siPivot: E.pivotWorkFunction(si),
    gaPivot: E.pivotWorkFunction(ga),
    siPinned: E.pinnedBarrier(si),
    gaPinned: E.pinnedBarrier(ga),
    siS: E.gamma(si),
    gaS: E.gamma(ga),
    siDit: si.Dit,
    gaDit: ga.Dit,
    idealAuSi,
    idealAlSi,
    siAu,
    siAl,
    pinnedQscCm: E.cPerM2ToEPerCm2(pinnedQsc),
    dit13,
    hookDit,
    auSiLayerNoStates,
    hookPhi1,
    hookDelta,
    gamma13,
    surfFrac,
    surfaceAtoms: SEMICONDUCTORS.Si.surfaceAtoms,
    idealSpread,
    idealRatio,
    dataSpread,
    dataRatio,
    dataSlopeSi: MOTT_SCHOTTKY.Si.slope,
    dataSlopeGaAs: MOTT_SCHOTTKY.GaAs.slope,
    pivotSpreadSi: pivotSpread('si', 'Si'),
    pivotSpreadGaAs: pivotSpread('gaas', 'GaAs'),
    si18,
    opt18,
    opt19,
    al18t0,
    al18t1,
    al18t3,
    al19t0,
    gaBest19,
    missionIdeal: mission('ideal', 'GaAs'),
    missionSi: mission('si', 'Si'),
    missionGaAs: mission('gaas', 'GaAs'),
    geMin: Math.min(...geN),
    geMax: Math.max(...geN),
    gePOhmic: geP.every((r) => r.flags.ohmic),
    gePhi0: PRESETS.ge.phi0,
    geS: PRESETS.ge.S,
    kurtin: KURTIN_1969,
    shen: SHEN_2021,
    decayNm: TUNNEL_DECAY_NM,
    delta: DEFAULTS.delta,
    epsRi: DEFAULTS.epsRi,
    Nd: DEFAULTS.Nd,
  };
  return cached;
}
