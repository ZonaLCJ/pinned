// Quiz "Given & formulas" boxes: every question can be worked out from the box alone, and the
// values shown match the engine and the data files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { METALS, PRESETS, DEFAULTS, metalById } from '../data/materials.js';
import { MOTT_SCHOTTKY, TUNNEL_DECAY_NM } from '../data/course-data.js';
import { facts } from '../js/facts.js';
import { num, sciTex } from '../js/ui/format.js';
import * as G from '../js/hooks/given.js';
import { buildPool, presentationRounds, ZERO } from '../js/hooks/sign-it.js';
import { OPTIONS, predictRounds, predictParams, predictAnswer } from '../js/hooks/predict.js';
import { ROUNDS, TARGET, missionParams, missionWorks } from '../js/hooks/mission.js';
import { contactGiven, contactParams, TARGET as RHO_TARGET } from '../js/hooks/build-contact.js';
import { MYTHS } from '../js/hooks/myth-fact.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
// quantities a box must never list as "given" (they are what the questions ask for)
const ASKED = ['phiBn', 'phiB', 'EFmE0', 'Qss', 'dPhiBn'];

// ------------------------------------------------------------------ answers from the box alone
test('Q1. Sign it!: every question in the pool, worked out from the box, matches the quiz', () => {
  const pool = buildPool();
  assert.ok(pool.length > 0);
  const bad = pool
    .filter((r) => G.signItByHand(r, ZERO) !== r.answer)
    .map((r) => `${r.kind} ${r.preset} ${r.metal || 'pivot'} φm=${r.phiM.toFixed(2)}: quiz ${r.answer}, box ${G.signItByHand(r, ZERO)}`);
  assert.deepEqual(bad, [], `answers that differ:\n${bad.join('\n')}`);
  // the three Outline-mode rounds are part of the pool
  for (const r of presentationRounds()) assert.equal(G.signItByHand(r, ZERO), r.answer);
});

test('Q2. Predict and lock: every round (both modes), worked out from the box, matches the quiz', () => {
  const F = facts();
  for (const present of [true, false]) {
    for (const Dit of predictRounds(present, F)) {
      const quiz = predictAnswer(Dit, F.hookPhi1);
      const box = G.predictByHand(predictParams(Dit, F.hookPhi1), Dit, F.hookPhi1, OPTIONS);
      assert.equal(box, quiz, `D_it = ${Dit}: quiz ${quiz}, box ${box}`);
    }
  }
});

test('Q3. Mission: the metals that hit the target, worked out from the box, match the quiz', () => {
  for (const rd of ROUNDS) {
    assert.deepEqual(G.missionByHand(rd, missionParams(rd, 5), TARGET, METALS), missionWorks(rd), `${rd.preset} round`);
  }
  // and they are the sets the Outline summary quotes
  const F = facts();
  assert.deepEqual(missionWorks(ROUNDS[0]), F.missionIdeal);
  assert.deepEqual(missionWorks(ROUNDS[1]), F.missionSi);
  assert.deepEqual(missionWorks(ROUNDS[2]), F.missionGaAs);
});

// ------------------------------------------------------------------ values shown in the boxes
test('Q4. Sign it! box: values come from the engine; the asked quantity is never given', () => {
  for (const r of buildPool()) {
    const g = G.signItGiven(r, ZERO);
    const p = r.p;
    close(g.shown.chi, p.chi, 0.005, 'chi');
    close(g.shown.Eg, p.Eg, 0.005, 'Eg');
    close(g.shown.phi0, p.phi0, 0.005, 'phi0');
    close(g.shown.EgPhi0, E.pinnedBarrier(p), 0.005, 'Eg - phi0');
    close(g.shown.S, E.gamma(p), 0.005, 'S');
    close(g.shown.S, PRESETS[r.preset].S, 0.005, 'S = preset S');
    close(g.shown.phiM, r.phiM, 0.005, 'phiM');
    close(g.pivot, E.pivotWorkFunction(p), 1e-12, 'pivot');
    const html = g.given.map((x) => x.html).join(' ');
    for (const v of [num(p.chi, 2), num(p.Eg, 2), num(p.phi0, 2), num(E.gamma(p), 2), num(r.phiM, 2)]) assert.ok(html.includes(v), `box shows ${v}`);
    for (const x of g.given) assert.ok(!ASKED.includes(x.sym), `asked quantity ${x.sym} listed as given`);
    assert.ok(g.notes.join(' ').includes(String(ZERO)) === (r.kind === 'sign'), 'zero rule only on charge-sign questions');
  }
});

test('Q5. Predict box: D* from the engine constants (≈ 1.1e13), S formula reproduces the engine γ', () => {
  const F = facts();
  const Ds = G.dStar();
  close(Ds, (DEFAULTS.epsRi * E.EPS0) / (E.Q * E.nmToM(DEFAULTS.delta)) / 1e4, 1, 'D* from constants');
  close(Ds, E.ditFromS(0.5), 1, 'S = 1/2 at D_it = D*');
  assert.equal(sciTex(Ds, 2), '1.1\\times10^{13}');
  for (const Dit of predictRounds(false, F)) {
    const p = predictParams(Dit, F.hookPhi1);
    close(1 / (1 + Dit / Ds), E.gamma(p), 1e-12, `S at D_it = ${Dit}`);
    const g = G.predictGiven(p, Dit, F.hookPhi1);
    close(g.shown.chi, 4.01, 0.005, 'chi');
    close(g.shown.Eg, 1.12, 0.005, 'Eg');
    close(g.shown.phi0, 0.45, 0.005, 'phi0');
    close(g.shown.EgPhi0, 0.67, 0.005, 'Eg - phi0');
    assert.equal(g.shown.phi1, 4.6);
    for (const x of g.given) assert.ok(!ASKED.includes(x.sym) && x.sym !== 'S', `${x.sym} must not be given`);
    assert.ok(g.given.some((x) => x.html.includes('4.60 → 5.60')));
  }
});

test('Q6. Mission box: χ, E_g, φ0, S and the target per round', () => {
  for (const rd of ROUNDS) {
    const p = missionParams(rd, 5);
    const g = G.missionGiven(rd, p, TARGET);
    close(g.shown.chi, p.chi, 0.005, 'chi');
    close(g.shown.Eg, p.Eg, 0.005, 'Eg');
    if (rd.preset === 'ideal') assert.equal(g.shown.S, 1);
    else close(g.shown.S, E.gamma(p), 0.005, 'S');
    assert.ok(g.given.some((x) => x.sym === 'target' && x.value === TARGET));
    for (const x of g.given) assert.ok(!ASKED.includes(x.sym));
  }
});

test('Q7. Build a contact box: constants, prefactor and E0′ table from the engine; the solver example', () => {
  const g = contactGiven();
  for (const r of g.rows) {
    const q = contactParams(r.id);
    assert.equal(r.chi, q.chi);
    assert.equal(r.Eg, q.Eg);
    assert.equal(r.phi0, q.phi0);
    close(r.Dit, E.ditFromS(PRESETS[r.id === 'Si' ? 'si' : 'gaas'].S), 1, 'D_it from the preset S');
    close(r.S, PRESETS[r.id === 'Si' ? 'si' : 'gaas'].S, 1e-9, 'S');
    assert.equal(r.Astar, q.Astar);
    close(r.prefactor, E.KB / (q.Astar * DEFAULTS.T), 1e-20, 'k_B/(A*T)');
    close(r.prefactor, E.contactResistivity(q).prefactor, 1e-20, 'prefactor = engine');
    assert.equal(r.mTunnel, q.mTunnel);
    assert.equal(r.epsRs, q.epsRs);
    G.BC_ND.forEach((Nd, k) => close(r.e0p[k], E.E0prime({ ...q, Nd }), 1e-12, `E0′ ${r.id} ${Nd}`));
  }
  const html = g.given.map((x) => x.html).join(' ');
  for (const v of [`\\lambda = ${DEFAULTS.lambda}`, `\\kappa = ${DEFAULTS.kappa}`, `T = ${DEFAULTS.T}`, sciTex(RHO_TARGET, 1)]) assert.ok(html.includes(v), v);
  // the note's example: Al/Si at 1e19, full solver vs formula (0.40 vs 0.57 eV)
  const pAl = contactParams('Si', { phiM: metalById('Al').phiM, Nd: 1e19 });
  const note = g.notes.join(' ');
  assert.equal(num(E.contactResistivity(pAl, { t: 0 }).phiBn, 2), '0.40');
  assert.equal(num(E.analyticBarrier(pAl), 2), '0.57');
  assert.ok(note.includes('0.40 vs 0.57'), note);
});

test('Q8. Myth or fact: one useful relation per card, from the data files, never the verdict', () => {
  for (const m of MYTHS) {
    const rel = G.MYTH_RELATIONS[m.id];
    assert.ok(rel, `card ${m.id} has a relation`);
    assert.ok(!/\b(myth|fact|true|false)\b/i.test(rel), `card ${m.id} relation states no verdict`);
  }
  assert.ok(G.MYTH_RELATIONS[2].includes(`${TUNNEL_DECAY_NM}`));
  assert.ok(G.MYTH_RELATIONS[3].includes(`${MOTT_SCHOTTKY.Si.slope}`) && G.MYTH_RELATIONS[3].includes(`${MOTT_SCHOTTKY.GaAs.slope}`));
  assert.ok(G.MYTH_RELATIONS[5].includes(`\\lambda = ${DEFAULTS.lambda}`));
});
