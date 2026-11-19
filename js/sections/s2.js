// Section 2. Charge balance: where the work-function difference goes.
import { h } from '../ui/dom.js';
import * as E from '../engine.js';
import { stateFor } from '../state.js';
import { metalById } from '../../data/materials.js';
import { simFrame, panel, badgeRow } from '../ui/sim-frame.js';
import { readout, boundControls, metalControl, globalControls, presetNotes } from '../ui/controls.js';
import { createLiveBand } from '../ui/live-band.js';
import { createBandPlot } from '../plots/band.js';
import { createChargeBarsPlot } from '../plots/charge-bars.js';
import { createBudgetPlot } from '../plots/budget-bar.js';
import { num, signed, sci, eV } from '../ui/format.js';
import { createPredict } from '../hooks/predict.js';
import { mythById } from '../hooks/myth-fact.js';

const AU = metalById('Au').phiM;

const DERIVATION_TEX = String.raw`\begin{aligned}
&\text{1. Vacuum level across }\delta: && \phi_m - \chi = \phi_{Bn} + \Delta V_{ox}\\
&\text{2. Gauss's law across }\delta: && Q_m = -\varepsilon_i\,\Delta V_{ox}/\delta\\
&\text{3. Interface charge:} && Q_{ss} = -eD_{it}\,(E_g - e\phi_0 - e\phi_{Bn})\\
&\text{4. Depletion charge:} && Q_{sc} = \sqrt{2e\varepsilon_s N_d(\phi_{Bn} - \phi_n)}\\
&\text{5. Neutrality:} && Q_m + Q_{ss} + Q_{sc} = 0
\end{aligned}`;

const COURSE_EQ = String.raw`\begin{aligned}(E_g - e\phi_0 - e\phi_{Bn}) &= \frac{1}{eD_{it}}\sqrt{2e\varepsilon_s N_d(\phi_{Bn} - \phi_n)}\\ &\quad - \frac{\varepsilon_i}{eD_{it}\,\delta}\left[\phi_m - (\chi + \phi_{Bn})\right]\end{aligned}`;

function content(F) {
  const limits = `<ul>
<li>$D_{it}\\,\\delta \\to 0$: $\\phi_{Bn} = \\phi_m - \\chi$ (Schottky–Mott).</li>
<li>$D_{it} \\to \\infty$: $\\phi_{Bn} = (E_g - e\\phi_0)/e$ (Bardeen limit, fully pinned).</li>
</ul>`;
  const derivation = `
<h4>Derivation</h4>
$$${DERIVATION_TEX}$$
<p>Combining these gives the course equation:</p>
$$${COURSE_EQ}$$
<p>Its limits:</p>${limits}`;
  return {
    takeaway: 'The metal’s push $\\phi_m - \\chi$ is split between band bending (the barrier) and an interface dipole $\\Delta V_{ox}$. With large $D_{it}$, the dipole takes almost all of it.',
    keyEq: '\\phi_m - \\chi = \\phi_{Bn} + \\Delta V_{ox}',
    idle: 'Demo A: GaAs, sweep φ<sub>m</sub>. Demo B: Au on n-Si, sweep D<sub>it</sub>.',
    more: `
<h4>Where the difference goes</h4>
<ul>
<li>The vacuum level is continuous, so $\\phi_m - \\chi$ must appear somewhere.</li>
<li>Part bends the bands: that part is the barrier $\\phi_{Bn}$.</li>
<li>The rest drops across the interfacial layer $\\delta$: $\\Delta V_{ox}$, an interface dipole.</li>
<li>The dipole is $Q_m$ on one side and $Q_{ss} + Q_{sc}$ on the other.</li>
</ul>${derivation}`,
    simTitle: 'Charge balance across the interfacial layer',
    concept: `
<p>Follow the vacuum level from the metal into the semiconductor. It is continuous, so the work-function difference $\\phi_m - \\chi$ has to show up somewhere. Part of it bends the semiconductor bands; that part is the barrier $\\phi_{Bn}$. The rest drops across the thin interfacial layer $\\delta$ as $\\Delta V_{ox}$.</p>
<p>That drop is an interface dipole. The metal charge $Q_m$ sits on one side of $\\delta$; the interface charge $Q_{ss}$ and the depletion charge $Q_{sc}$ sit on the other, and together they are neutral. When $D_{it}$ is large, a tiny shift of $E_F - E_0$ supplies a lot of $Q_{ss}$. The dipole then absorbs almost any change in $\\phi_m$, and the barrier hardly moves.</p>
<p>$\\Delta V_{ox}$ can be negative. For a low-work-function metal on a pinned surface the dipole points the other way and pushes the barrier <em>above</em> $\\phi_m - \\chi$ (try Al on the Si preset).</p>`,
    derivation,
    deepDive: `
<h4>Deep dive: how the simulator solves it</h4>
<p>$F(\\phi_{Bn}) = Q_m + Q_{ss} + Q_{sc}$ increases strictly with $\\phi_{Bn}$, so bisection on $[\\phi_n, E_g]$ always finds a unique root. If $F(\\phi_n) > 0$ the contact is flagged ohmic/accumulation; if $F(E_g) < 0$, inversion. The numeric solver keeps $Q_{sc}$, so it reproduces the course equation exactly rather than the textbook approximation.</p>
<p>The Ideal preset uses $\\delta = 0$ and returns $\\phi_m - \\chi$ exactly. With $\\delta = ${num(F.delta, 1)}$ nm and $D_{it} = 0$, the depletion charge alone still drops ${num(F.idealAuSi.phiBn - F.auSiLayerNoStates.phiBn, 2)} V across $\\delta$, so Au/n-Si gives ${num(F.auSiLayerNoStates.phiBn, 2)} instead of ${num(F.idealAuSi.phiBn, 2)} eV. That is physical, but it is not the textbook ideal.</p>`,
    assumptions: ['The interfacial layer is a uniform dielectric of thickness $\\delta$ and permittivity $\\varepsilon_i$.', 'Interface states sit at the semiconductor side of $\\delta$ and share the metal’s $E_F$.', 'Depletion approximation for $Q_{sc}$; Boltzmann statistics for $\\phi_n$.'],
    tryThis: [
      'GaAs preset: tap the metals from Ag to Pt. The vacuum step $\\Delta V_{ox}$ changes by almost as much as $\\phi_m$; $\\phi_{Bn}$ hardly moves.',
      'Au on the Si preset: drag $D_{it}$ from $10^{11}$ to $10^{15}$ and watch the charge move from $Q_{sc}$ into $Q_{ss}$.',
      'Al on the Si preset: $\\Delta V_{ox}$ is negative and the barrier sits above $\\phi_m - \\chi$.',
      'Make $\\delta$ thicker at fixed $D_{it}$: the same states pin more strongly.',
    ],
    misconceptions: [mythById(4)].map((m) => `<strong>${m.answer === 'myth' ? 'Myth' : 'Fact'}:</strong> “${m.text}” ${m.why}`),
  };
}

function sim(root, ctx) {
  const { store, mode } = ctx;
  const present = mode === 'present';
  const fr = simFrame(root, ctx, { plotsClass: 'rows-r' });
  const roT = readout('φ<sub>m</sub> − χ');
  const roB = readout('φ<sub>Bn</sub>', { key: true });
  const roD = readout('ΔV<sub>ox</sub>');
  const roS = readout('S = γ');
  fr.top.append(roT.el, roB.el, roD.el, roS.el);

  const pBand = panel('Band diagram and vacuum level');
  const badges = badgeRow(pBand.el.querySelector('.panel-title'));
  const band = createLiveBand(pBand.body, ctx);
  const pBars = panel('Charges (e/cm²)');
  const bars = createChargeBarsPlot(pBars.body);
  const pBud = panel('Potential budget (eV)');
  const bud = createBudgetPlot(pBud.body);
  for (const pn of [pBand, pBars, pBud]) Object.assign(pn.body.style, { flex: '1 1 auto', minHeight: '0', display: 'flex', flexDirection: 'column' });
  if (!present) {
    bars.el.classList.add('short');
    bud.el.classList.add('short');
    bars.el.style.height = '170px';
    bud.el.style.height = '130px';
  }
  fr.plots.append(pBand.el, pBars.el, pBud.el);

  const gc = globalControls(store, { present });
  const mc = metalControl(store);
  const bc = boundControls(store, present ? ['phiM', 'Dit'] : ['phiM', 'Dit', 'delta', 'phi0', 'Nd']);
  fr.controls.append(...gc.rows, h('div', { class: 'ctl-row' }, mc.el), h('div', { class: 'sliders' }, bc.els));

  function update(s) {
    const p = E.makeParams(s);
    const res = E.solveBarrier(p);
    roT.set(eV(p.phiM - p.chi, 2));
    roB.setLabel(res.doping === 'p' ? 'φ<sub>Bp</sub>' : 'φ<sub>Bn</sub>');
    roB.set(eV(res.phiB, 2));
    roD.set(`${signed(res.dVox, 2)} V`);
    roS.set(num(res.gamma, 2));
    badges.set(res, presetNotes(s));
    gc.sync(s);
    mc.sync(s);
    bc.sync(s);
    band.update({ p, res, opts: { vac: true, dVox: true } });
    bars.update({ res });
    bud.update({ p, res });
  }

  const live = (s) => {
    const r = E.solveBarrier(E.makeParams(s));
    return `φ<sub>Bn</sub> = ${num(r.phiBn, 2)} eV · ΔV<sub>ox</sub> = ${signed(r.dVox, 2)} V`;
  };
  const demoA = {
    label: 'Demo A',
    setup: () => stateFor('gaas', 'GaAs', { phiM: 4.2 }),
    steps: [
      {
        dur: 8500,
        ease: 'linear',
        caption: 'GaAs, φ<sub>m</sub> 4.2 → 5.6 eV: the dipole takes it, the barrier barely moves',
        live: (s) => `φ<sub>m</sub> = ${num(s.phiM, 2)} · ${live(s)}`,
        tracks: { phiM: [4.2, 5.6, 'lin'] },
      },
    ],
  };
  const demoB = {
    label: 'Demo B',
    setup: () => ({ ...stateFor('si', 'Si', { phiM: AU }), preset: 'custom', Dit: 1e11 }),
    steps: [
      {
        dur: 4500,
        caption: 'Au/n-Si, raising D<sub>it</sub>: φ<sub>Bn</sub> slides from φ<sub>m</sub> − χ toward E<sub>g</sub> − φ<sub>0</sub>',
        live: (s) => `D<sub>it</sub> = ${sci(s.Dit, 2)} · ${live(s)}`,
        tracks: { Dit: [1e11, 1e13, 'log'] },
      },
      {
        dur: 4500,
        caption: '…and the charge moves from Q<sub>sc</sub> into Q<sub>ss</sub>',
        live: (s) => {
          const r = E.solveBarrier(E.makeParams(s));
          return `D<sub>it</sub> = ${sci(s.Dit, 2)} · Q<sub>ss</sub> = ${sci(r.QssCm, 2)} · Q<sub>sc</sub> = ${sci(r.QscCm, 2)}`;
        },
        tracks: { Dit: [1e13, 1e15, 'log'] },
      },
    ],
  };
  return {
    update,
    moreEl: band.moreEl,
    demos: [
      { id: 'A', label: 'Demo A', key: 'A', title: 'GaAs: sweep φ<sub>m</sub> 4.2 → 5.6 eV', script: demoA },
      { id: 'B', label: 'Demo B', key: 'B', title: 'Au on Si: sweep D<sub>it</sub> 10¹¹ → 10¹⁵', script: demoB },
    ],
  };
}

export default {
  id: 's2',
  num: 2,
  title: 'Charge balance: where the work-function difference goes',
  short: 'Charge balance',
  start: () => stateFor('si', 'Si', { phiM: AU }),
  content,
  sim,
  hooks: [{ id: 'predict', label: 'Predict and lock', create: createPredict }],
};
