// Section 2 hook: predict-and-lock. "φ_m goes up by 1 eV with D_it = 1e14. How much does
// the barrier move?" The correct option is the one closest to the engine's Δφ_Bn.
import { h, prefersReducedMotion } from '../ui/dom.js';
import { makeParams, solveBarrier } from '../engine.js';
import { stateFor } from '../state.js';
import { num, pow10 } from '../ui/format.js';
import { createBandPlot } from '../plots/band.js';
import { createBudgetPlot } from '../plots/budget-bar.js';
import { hookFrame, countdown, setOptions, markOptions, getBest, saveBest, givenBox } from './hook-ui.js';
import { predictGiven } from './given.js';

export const OPTIONS = [1.0, 0.5, 0.1, 0];
/** The rounds (D_it values) each mode plays. */
export const predictRounds = (present, facts) => (present ? [facts.hookDit] : [1e14, 1e13, 1e15, 1e12]);
/** n-Si (Si preset values) with a custom D_it, as the quiz uses it. */
export const predictParams = (Dit, phiM) => makeParams(stateFor('si', 'Si', { phiM, Dit, preset: 'custom' }));
/** The option the quiz marks correct: the one closest to the engine's Δφ_Bn for φ_m → φ_m + 1 eV. */
export function predictAnswer(Dit, phi1) {
  const dB = solveBarrier(predictParams(Dit, phi1 + 1)).phiBn - solveBarrier(predictParams(Dit, phi1)).phiBn;
  return OPTIONS.reduce((a, b) => (Math.abs(b - dB) < Math.abs(a - dB) ? b : a));
}

export function createPredict(root, ctx) {
  const present = ctx.mode === 'present';
  const F = hookFrame(root, { title: 'Predict and lock', mode: ctx.mode });
  const G = givenBox(F, { mode: ctx.mode });
  const PHI1 = ctx.facts.hookPhi1;
  const rounds = predictRounds(present, ctx.facts);
  const bandHost = h('div', { style: { flex: '3 1 0', minHeight: '0', display: 'flex' } });
  const budHost = h('div', { style: { flex: '1.3 1 0', minHeight: '0', display: 'flex' } });
  F.visual.append(bandHost, budHost);
  const band = createBandPlot(bandHost, 'Band diagram during the work-function step');
  const bud = createBudgetPlot(budHost);
  if (!present) {
    bandHost.querySelector('.plot').style.height = '230px';
    budHost.querySelector('.plot').style.height = '110px';
  }

  let i = 0;
  let score = 0;
  let locked = false;
  let chosen = null;
  let timer = null;
  let raf = 0;
  let buttons = [];

  const params = predictParams;
  function draw(Dit, phiM) {
    const p = params(Dit, phiM);
    const res = solveBarrier(p);
    band.update({ p, res, opts: { vac: true, dVox: true, arrows: false, W: false } });
    bud.update({ p, res });
    return res;
  }

  function show() {
    locked = false;
    chosen = null;
    const Dit = rounds[i];
    F.meta.innerHTML = present ? '' : `Round ${i + 1}/${rounds.length} · <span class="score">score ${score}</span>`;
    F.q.innerHTML = `φ<sub>m</sub> goes up by 1 eV with D<sub>it</sub> = ${pow10(Dit)} cm⁻²eV⁻¹. How much does the barrier move?`;
    F.sub.innerHTML = `n-Si, δ = ${num(ctx.facts.delta, 1)} nm, φ<sub>m</sub>: ${num(PHI1, 2)} → ${num(PHI1 + 1, 2)} eV. ${present ? 'Vote, then lock.' : 'Pick one to lock it in.'}`;
    buttons = setOptions(
      F.options,
      OPTIONS.map((v) => ({ value: v, label: `${num(v, 1)} eV` })),
      lock,
    );
    G.show(true);
    G.set(predictGiven(params(Dit, PHI1), Dit, PHI1));
    F.feedback.hidden = true;
    // "Next" skips to the next round (only when there is one)
    const skip = i < rounds.length - 1 ? [h('button', { type: 'button', class: 'btn primary hook-next', onclick: next }, 'Next')] : [];
    F.footer.replaceChildren(...skip, ...(present ? [h('span', { class: 'hook-sub' }, 'Click the class answer, or Enter to reveal')] : []));
    draw(Dit, PHI1);
    timer?.stop();
    timer = countdown(F.cd, 15);
  }

  function lock(v) {
    if (locked) return;
    locked = true;
    chosen = v;
    timer?.stop();
    markOptions(buttons, { correct: null, chosen: v });
    const Dit = rounds[i];
    const r0 = draw(Dit, PHI1);
    const end = () => {
      const r1 = draw(Dit, PHI1 + 1);
      const dB = r1.phiBn - r0.phiBn;
      const correct = predictAnswer(Dit, PHI1);
      const ok = chosen === correct;
      if (ok) score++;
      markOptions(buttons, { correct, chosen });
      F.feedback.hidden = false;
      F.feedback.className = `hook-feedback ${present ? '' : ok ? 'good' : 'bad'}`;
      const S = r1.gamma;
      F.feedback.innerHTML = `${present ? '' : ok ? '<strong>Correct.</strong> ' : '<strong>Not quite.</strong> '}Δφ<sub>Bn</sub> = ${num(dB, 2)} eV (S ≈ ${num(S, 2)}). The other ${num(1 - dB, 2)} eV went into the interface dipole ΔV<sub>ox</sub>.`;
      F.meta.innerHTML = present ? '' : `Round ${i + 1}/${rounds.length} · <span class="score">score ${score}</span>`;
      const last = i === rounds.length - 1;
      F.footer.replaceChildren(h('button', { type: 'button', class: 'btn primary hook-next', onclick: next }, last ? (present ? 'Again' : 'Finish') : 'Next'));
    };
    if (prefersReducedMotion()) return end();
    const t0 = performance.now();
    const D = 2200;
    const step = (now) => {
      const u = Math.min(1, (now - t0) / D);
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      draw(Dit, PHI1 + e);
      if (u < 1) raf = requestAnimationFrame(step);
      else end();
    };
    raf = requestAnimationFrame(step);
  }

  function next() {
    cancelAnimationFrame(raf);
    if (i < rounds.length - 1) {
      i++;
      show();
      return;
    }
    if (present) return start();
    F.options.replaceChildren();
    F.cd.hidden = true;
    G.show(false);
    const best = saveBest('predict', score) ? score : getBest('predict');
    F.q.innerHTML = `Score ${score}/${rounds.length} <span class="hook-sub">· best ${best}/${rounds.length}</span>`;
    F.sub.innerHTML = 'The barrier moves by S × Δφ<sub>m</sub>; the rest is taken by the dipole.';
    F.feedback.hidden = true;
    F.footer.replaceChildren(h('button', { type: 'button', class: 'btn primary', onclick: start }, 'Play again'));
  }

  function start() {
    cancelAnimationFrame(raf);
    i = 0;
    score = 0;
    show();
  }

  return {
    start,
    stop() {
      timer?.stop();
      cancelAnimationFrame(raf);
    },
    toggleGiven: () => G.toggle(),
    closeGiven: () => G.close(),
    onKey(k) {
      if (k === 'Enter') {
        if (!locked) lock(null);
        else if (!F.feedback.hidden) next();
        return true;
      }
      const n = Number(k);
      if (n >= 1 && n <= OPTIONS.length && !locked) {
        lock(OPTIONS[n - 1]);
        return true;
      }
      return false;
    },
  };
}
