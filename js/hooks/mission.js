// Section 3 hook "Mission: hit the barrier": reach φ_Bn ≤ 0.60 eV with a Table 9.1 metal.
// Round 1: ideal with GaAs's χ and E_g; round 2: Si preset; round 3: GaAs preset (impossible).
import { h } from '../ui/dom.js';
import { makeParams, solveBarrier, pinnedBarrier } from '../engine.js';
import { stateFor } from '../state.js';
import { METALS } from '../../data/materials.js';
import { num } from '../ui/format.js';
import { createPhiBPhiMPlot } from '../plots/phib-phim.js';
import { hookFrame, countdown, getBest, saveBest, givenBox } from './hook-ui.js';
import { missionGiven } from './given.js';

export const TARGET = 0.6;
export const ROUNDS = [
  { preset: 'ideal', semi: 'GaAs', label: 'Ideal contact with GaAs’s χ and E<sub>g</sub>' },
  { preset: 'si', semi: 'Si', label: 'Si preset' },
  { preset: 'gaas', semi: 'GaAs', label: 'GaAs preset' },
];

export const missionParams = (rd, phiM) => makeParams(stateFor(rd.preset, rd.semi, { phiM }));
/** The Table 9.1 metals that reach the target in a round (numeric solver): the quiz's answer. */
export const missionWorks = (rd) => METALS.filter((m) => solveBarrier(missionParams(rd, m.phiM)).phiBn <= TARGET).map((m) => m.id);

export function createMission(root, ctx) {
  const present = ctx.mode === 'present';
  const F = hookFrame(root, { title: 'Mission: hit the barrier', mode: ctx.mode });
  const G = givenBox(F, { mode: ctx.mode });
  const pbHost = h('div', { style: { flex: '1 1 auto', minHeight: '0', display: 'flex' } });
  F.visual.append(pbHost);
  const plot = createPhiBPhiMPlot(pbHost, 'Mission plot: picks so far');
  const metalRow = h('div', { class: 'metals mission-metals' });
  F.options.replaceWith(metalRow);
  F.options = metalRow;

  let r = 0;
  let picks = [];
  let attempts = 0;
  let done = false;
  let roundOver = false;
  let timer = null;

  const params = missionParams;

  function draw(reveal) {
    const rd = ROUNDS[r];
    const p = params(rd, 5);
    plot.update({
      p,
      target: TARGET,
      curve: reveal,
      ideal: reveal,
      pinned: reveal,
      pivot: false,
      dots: picks.map((k) => ({ phiM: k.phiM, phiB: k.phiB, label: k.id, color: k.phiB <= TARGET ? 'var(--brand-ink)' : '#a7abc6', left: k.phiM > 5.2 })),
    });
  }

  function showRound() {
    const rd = ROUNDS[r];
    picks = [];
    roundOver = false;
    F.meta.innerHTML = `Round ${r + 1}/3 · ${rd.label}${present ? '' : ` · attempts ${attempts}`}`;
    F.q.innerHTML = `Reach φ<sub>Bn</sub> ≤ ${num(TARGET, 2)} eV: pick a metal`;
    F.sub.innerHTML = present ? 'Call out a metal. Each pick reveals its barrier.' : 'Each pick reveals its barrier. Fewest attempts wins.';
    metalRow.replaceChildren(
      ...METALS.map((m) =>
        h(
          'button',
          { type: 'button', class: 'btn', dataset: { metal: m.id }, onclick: () => pick(m), 'aria-label': `${m.id}, φ_m = ${m.phiM.toFixed(2)} eV` },
          m.id,
          h('span', { class: 'wf' }, m.phiM.toFixed(2)),
        ),
      ),
    );
    F.feedback.hidden = true;
    F.footer.replaceChildren();
    G.show(true);
    G.set(missionGiven(rd, params(rd, 5), TARGET));
    draw(false);
  }

  function pick(m) {
    if (roundOver || done) return;
    if (picks.some((k) => k.id === m.id)) return;
    const rd = ROUNDS[r];
    const res = solveBarrier(params(rd, m.phiM));
    attempts++;
    picks.push({ id: m.id, phiM: m.phiM, phiB: res.phiBn });
    const btn = metalRow.querySelector(`[data-metal="${m.id}"]`);
    const hit = res.phiBn <= TARGET;
    btn.classList.add(hit ? 'correct' : 'wrong');
    btn.disabled = true;
    F.meta.innerHTML = `Round ${r + 1}/3 · ${rd.label}${present ? '' : ` · attempts ${attempts}`}`;
    F.feedback.hidden = false;
    F.feedback.className = `hook-feedback ${hit ? 'good' : 'bad'}`;
    F.feedback.innerHTML = `${m.id}: φ<sub>Bn</sub> = ${num(res.phiBn, 2)} eV, ${hit ? 'hit' : 'miss'}.`;
    draw(false);
    const misses = picks.filter((k) => k.phiB > TARGET).length;
    if (hit) endRound(true);
    else if (r === 2 && misses >= 2) endRound(false);
  }

  function solutionText(rd) {
    const ok = missionWorks(rd);
    return ok.length ? `Metals that work here: ${ok.join(', ')}.` : '';
  }

  function endRound(hit) {
    roundOver = true;
    const rd = ROUNDS[r];
    draw(true);
    if (r === 2 && !hit) {
      const pb = pinnedBarrier(params(rd, 5));
      F.feedback.hidden = false;
      F.feedback.className = 'hook-feedback bad';
      F.feedback.innerHTML = `<strong>Pinned at ≈ ${num(pb, 1)} eV. No metal can do it.</strong>`;
    } else {
      F.feedback.innerHTML += ` ${solutionText(rd)}`;
    }
    for (const b of metalRow.children) b.disabled = true;
    const last = r === ROUNDS.length - 1;
    F.footer.replaceChildren(h('button', { type: 'button', class: 'btn primary', onclick: next }, last ? 'Finish' : 'Next round'));
  }

  function next() {
    if (r < ROUNDS.length - 1) {
      r++;
      showRound();
      return;
    }
    done = true;
    timer?.stop();
    F.cd.hidden = true;
    metalRow.replaceChildren();
    F.feedback.hidden = true;
    G.show(false);
    if (present) {
      const n = (k) => (k ? String(k) : 'none');
      F.q.innerHTML = `Ideal: ${n(ctx.facts.missionIdeal.length)} metals work. Si: ${n(ctx.facts.missionSi.length)}. GaAs: ${n(ctx.facts.missionGaAs.length)}.`;
      F.sub.textContent = 'The stronger the pinning, the less the metal matters.';
    } else {
      const best = saveBest('mission', attempts, (a, b) => a < b) ? attempts : getBest('mission');
      F.q.innerHTML = `${attempts} attempts <span class="hook-sub">· best ${best}</span>`;
      F.sub.textContent = 'The stronger the pinning, the less the metal matters.';
    }
    F.footer.replaceChildren(h('button', { type: 'button', class: 'btn primary', onclick: start }, 'Play again'));
  }

  function timeUp() {
    if (done) return;
    if (!roundOver) {
      if (r === 2) endRound(false);
      else {
        roundOver = true;
        draw(true);
        F.feedback.hidden = false;
        F.feedback.className = 'hook-feedback';
        F.feedback.innerHTML = `Time. ${solutionText(ROUNDS[r])}`;
        for (const b of metalRow.children) b.disabled = true;
        F.footer.replaceChildren(h('button', { type: 'button', class: 'btn primary', onclick: next }, 'Next round'));
      }
    }
  }

  function start() {
    r = 0;
    attempts = 0;
    done = false;
    timer?.stop();
    showRound();
    if (present) timer = countdown(F.cd, 30, { onEnd: timeUp });
    else F.cd.hidden = true;
  }

  return {
    start,
    stop: () => timer?.stop(),
    toggleGiven: () => G.toggle(),
    closeGiven: () => G.close(),
    onKey(k) {
      if (k === 'Enter') {
        const b = F.footer.querySelector('button');
        if (b) b.click();
        else if (present && !roundOver) timeUp();
        return true;
      }
      return false;
    },
  };
}
