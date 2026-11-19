// Section 1 hook "Sign it!": snapshots generated from the engine.
// Type 1: net interface charge +, − or 0 (0 when |E_F − E0| < 0.02 eV).
// Type 2: is the real barrier lower or higher than the ideal φ_m − χ?
import { h } from '../ui/dom.js';
import { solveBarrier, makeParams, pivotWorkFunction } from '../engine.js';
import { stateFor } from '../state.js';
import { METALS, metalById, SEMICONDUCTORS } from '../../data/materials.js';
import { num, signed, perCm2, sci } from '../ui/format.js';
import { createBandPlot } from '../plots/band.js';
import { createPhiBPhiMPlot } from '../plots/phib-phim.js';
import { hookFrame, countdown, setOptions, markOptions, getBest, saveBest, shuffle, givenBox } from './hook-ui.js';
import { signItGiven } from './given.js';

export const ZERO = 0.02;
const PRESET_SEMI = { si: 'Si', gaas: 'GaAs' };

function snapshot(preset, phiM, metalId) {
  const semi = PRESET_SEMI[preset];
  const st = stateFor(preset, semi, { phiM });
  const p = makeParams(st);
  const res = solveBarrier(p);
  return { preset, semi, phiM, metal: metalId, p, res, ideal: phiM - p.chi };
}

const signOf = (res) => (res.EFmE0 > ZERO ? 'neg' : res.EFmE0 < -ZERO ? 'pos' : 'zero');

function describe(sn) {
  const who = sn.metal ? `${sn.metal} (φ<sub>m</sub> = ${num(sn.phiM, 2)} eV)` : `a metal at the pivot, φ<sub>m</sub> = ${num(sn.phiM, 2)} eV`;
  return `${who} on n-${sn.semi}, ${sn.semi} preset`;
}

/** All rounds the engine can generate. */
export function buildPool() {
  const pool = [];
  for (const preset of ['si', 'gaas']) {
    for (const m of METALS) {
      const sn = snapshot(preset, m.phiM, m.id);
      // Charge-sign questions only where the sign is clear-cut (spec: 0 when |E_F − E0| < 0.02 eV).
      if (preset === 'si' || Math.abs(sn.res.EFmE0) >= ZERO) pool.push({ kind: 'sign', ...sn, answer: signOf(sn.res) });
      if (Math.abs(sn.res.phiBn - sn.ideal) >= ZERO) pool.push({ kind: 'compare', ...sn, answer: sn.res.phiBn < sn.ideal ? 'lower' : 'higher' });
    }
    const pv = pivotWorkFunction(makeParams(stateFor(preset, PRESET_SEMI[preset], { phiM: 5 })));
    const sn = snapshot(preset, pv, null);
    pool.push({ kind: 'sign', ...sn, answer: signOf(sn.res) });
  }
  return pool;
}

/** The three presentation rounds: Al sign (−), Au vs ideal (lower), pivot sign (0). */
export function presentationRounds() {
  const pool = buildPool();
  const find = (kind, preset, metal) => pool.find((r) => r.kind === kind && r.preset === preset && r.metal === metal);
  return [find('sign', 'si', 'Al'), find('compare', 'si', 'Au'), find('sign', 'si', null)];
}

function explain(r) {
  const res = r.res;
  if (r.kind === 'sign') {
    if (r.answer === 'neg')
      return `E<sub>F</sub> is ${num(res.EFmE0, 2)} eV above E<sub>0</sub>: acceptor-like states between E<sub>0</sub> and E<sub>F</sub> are filled, so Q<sub>ss</sub> = ${sci(res.QssCm, 2)} e/cm² (negative).`;
    if (r.answer === 'pos')
      return `E<sub>F</sub> is ${num(-res.EFmE0, 2)} eV below E<sub>0</sub>: donor-like states between E<sub>F</sub> and E<sub>0</sub> are empty, so Q<sub>ss</sub> = +${sci(res.QssCm, 2)} e/cm² (positive).`;
    return `At the pivot φ<sub>m</sub>* = ${num(r.phiM, 2)} eV, E<sub>F</sub> sits on E<sub>0</sub> (E<sub>F</sub> − E<sub>0</sub> = ${signed(res.EFmE0, 3)} eV): almost no charge has to go into the states.`;
  }
  const want = r.ideal;
  return `The metal alone would give ${num(want, 2)} eV; the interface pulls toward E<sub>g</sub> − φ<sub>0</sub> = ${num(res.pinned, 2)} eV. Real barrier: ${num(res.phiBn, 2)} eV, ${r.answer}.`;
}

export function createSignIt(root, ctx) {
  const present = ctx.mode === 'present';
  const N = present ? 3 : 6;
  const SECONDS = present ? 15 : 10;
  const F = hookFrame(root, { title: 'Sign it!', mode: ctx.mode });
  const G = givenBox(F, { mode: ctx.mode });
  const bandHost = h('div', { class: 'si-band' });
  const pbHost = h('div', { class: 'si-pb' });
  F.visual.append(bandHost, pbHost);
  const band = createBandPlot(bandHost, 'Snapshot band diagram');
  const pb = createPhiBPhiMPlot(pbHost, 'Snapshot: ideal line and pinned level');
  bandHost.style.flex = pbHost.style.flex = '1 1 auto';
  bandHost.style.minHeight = pbHost.style.minHeight = '0';
  bandHost.style.display = pbHost.style.display = 'flex';

  let rounds = [];
  let i = 0;
  let score = 0;
  let revealed = false;
  let chosen = null;
  let timer = null;
  let buttons = [];

  function draw(r, show) {
    const isSign = r.kind === 'sign';
    bandHost.hidden = !isSign;
    pbHost.hidden = isSign;
    if (isSign) {
      band.update({ p: r.p, res: r.res, opts: { vac: false, ladderNeutral: !show, W: false, arrows: false } });
    } else {
      pb.update({
        p: r.p,
        curve: show,
        pivot: false,
        xMarker: r.phiM,
        dots: [
          { phiM: r.phiM, phiB: Math.min(r.ideal, 1.4), color: 'var(--text-muted)', label: `ideal ${num(r.ideal, 2)}`, left: true },
          ...(show ? [{ phiM: r.phiM, phiB: r.res.phiBn, label: `real ${num(r.res.phiBn, 2)}` }] : []),
        ],
      });
    }
  }

  function show() {
    revealed = false;
    chosen = null;
    const r = rounds[i];
    F.meta.innerHTML = `Round ${i + 1}/${N}${present ? '' : ` · <span class="score">score ${score}</span>`}`;
    if (r.kind === 'sign') {
      F.q.innerHTML = 'Net interface charge: +, − or 0?';
      buttons = setOptions(
        F.options,
        [
          { value: 'pos', label: '+ positive' },
          { value: 'neg', label: '− negative' },
          { value: 'zero', label: '0 neutral' },
        ],
        pick,
      );
    } else {
      F.q.innerHTML = 'Is the real barrier lower or higher than the ideal φ<sub>m</sub> − χ?';
      buttons = setOptions(
        F.options,
        [
          { value: 'lower', label: 'Lower' },
          { value: 'higher', label: 'Higher' },
        ],
        pick,
      );
    }
    F.sub.innerHTML = describe(r) + (r.kind === 'compare' ? ` · pinned level E<sub>g</sub> − φ<sub>0</sub> = ${num(r.res.pinned, 2)} eV` : '');
    G.show(true);
    G.set(signItGiven(r, ZERO));
    F.feedback.hidden = true;
    F.footer.replaceChildren(nextButton(), ...(present ? [h('span', { class: 'hook-sub' }, 'Pick an answer, or wait for the reveal')] : []));
    draw(r, false);
    timer?.stop();
    // at 0 without a pick the correct answer is revealed automatically (both modes)
    timer = countdown(F.cd, SECONDS, { onEnd: () => reveal() });
  }

  // "Next" is always available: before the reveal it skips to the next question
  const nextButton = () => h('button', { type: 'button', class: 'btn primary hook-next', onclick: next }, i === N - 1 ? 'Finish' : 'Next');

  function pick(v) {
    if (revealed) return;
    chosen = v;
    reveal(); // picking reveals the answer and its explanation at once (both modes)
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    timer?.stop();
    const r = rounds[i];
    const ok = chosen === r.answer;
    if (ok) score++;
    markOptions(buttons, { correct: r.answer, chosen });
    F.feedback.hidden = false;
    F.feedback.className = `hook-feedback ${present ? '' : ok ? 'good' : 'bad'}`;
    const lead = present ? '' : ok ? '<strong>Correct.</strong> ' : chosen == null ? '<strong>Time is up.</strong> ' : '<strong>Not quite.</strong> ';
    F.feedback.innerHTML = lead + explain(r);
    F.meta.innerHTML = `Round ${i + 1}/${N}${present ? '' : ` · <span class="score">score ${score}</span>`}`;
    draw(r, true);
    F.footer.replaceChildren(nextButton());
  }

  function next() {
    if (i < N - 1) {
      i++;
      show();
      return;
    }
    timer?.stop();
    F.cd.hidden = true;
    F.options.replaceChildren();
    F.sub.textContent = '';
    G.show(false);
    if (present) {
      F.q.innerHTML =
        'Sign rule: E<sub>F</sub> above E<sub>0</sub> → negative interface charge, barrier pushed up. E<sub>F</sub> below E<sub>0</sub> → positive, barrier pushed down.';
    } else {
      const best = saveBest('signit', score) ? score : getBest('signit');
      F.q.innerHTML = `Score ${score}/${N} <span class="hook-sub">· best ${best}/${N}</span>`;
    }
    F.feedback.hidden = true;
    F.footer.replaceChildren(h('button', { type: 'button', class: 'btn primary', onclick: start }, 'Play again'));
  }

  function start() {
    rounds = present ? presentationRounds() : shuffle(buildPool()).slice(0, N);
    i = 0;
    score = 0;
    show();
  }

  return {
    start,
    stop: () => timer?.stop(),
    toggleGiven: () => G.toggle(),
    closeGiven: () => G.close(),
    onKey(k) {
      if (k === 'Enter') {
        if (!rounds.length) return false;
        if (!revealed && rounds[i] && F.options.children.length) reveal();
        else if (revealed) next();
        else start();
        return true;
      }
      const n = Number(k);
      if (n >= 1 && n <= buttons.length && !revealed) {
        buttons[n - 1].click();
        return true;
      }
      return false;
    },
  };
}
