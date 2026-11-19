// "Going further" (detailed mode only): the gate that can't switch.
// Same physics as Schottky pinning: interface states buffer the charge the gate supplies.
import { h } from '../ui/dom.js';
import * as E from '../engine.js';
import { MOS, MOS_PRESETS, SEMICONDUCTORS } from '../../data/materials.js';
import { simFrame, panel } from '../ui/sim-frame.js';
import { readout, slider, segmented } from '../ui/controls.js';
import { createMosBandPlot, createPsiVGPlot, PSI_STYLES } from '../plots/mos.js';
import { num, sci, sciTex, pow10 } from '../ui/format.js';

const Eg = SEMICONDUCTORS.Si.Eg;
const model = (Dit) => ({ ...MOS, Dit });
const presetById = (id) => MOS_PRESETS.find((p) => p.id === id) || MOS_PRESETS[0];

/** Numbers quoted in the text, all from the engine. */
function mosFacts() {
  const m0 = model(0);
  const VBD = MOS.breakdownMVcm * 1e8 * MOS.tox * 1e-9; // MV/cm × nm -> V
  const VT = Object.fromEntries(MOS_PRESETS.map((p) => [p.id, E.mosThreshold(model(p.Dit))]));
  const worst = MOS_PRESETS[MOS_PRESETS.length - 1];
  const slopeWorst = E.mosPsi(model(worst.Dit), 2) - E.mosPsi(model(worst.Dit), 1);
  return { Cox: E.mosCox(m0), phiF: E.mosPhiF(m0), VBD, VT, worst, slopeWorst, ratio: VT[worst.id] / VBD };
}

const twiceOr = (r) => (Math.round(r) === 2 ? 'about twice' : `about ${num(r, 1)} times`);

function breakdownSentence(F) {
  return `Reaching inversion would need about ${num(F.VT[F.worst.id], 0)} V on ${MOS.tox} nm of SiO₂, ${twiceOr(F.ratio)} its breakdown voltage (about ${num(F.VBD, 0)} V at roughly ${MOS.breakdownMVcm} MV/cm).`;
}

const KEY_EQ = String.raw`\begin{aligned}\text{Schottky contact (Section 3):}\quad S = \gamma &= \frac{\varepsilon_i}{\varepsilon_i + e^2\delta D_{it}} = \frac{C_i}{C_i + e^2 D_{it}},\quad C_i = \varepsilon_i/\delta\\[4pt] \text{MOS gate:}\quad \frac{d\psi_s}{dV_G} &\approx \frac{C_{ox}}{C_{ox} + C_s + e^2 D_{it}}\end{aligned}`;

function content() {
  const F = mosFacts();
  const [a, b, c] = MOS_PRESETS;
  return {
    takeaway:
      'Pinning at a MOS gate is the same physics as pinning at a Schottky contact: interface states act as a charge buffer. With enough of them the gate cannot move $E_F$ at the surface, and the channel never turns on.',
    keyEq: KEY_EQ,
    concept: `
<p>To turn a transistor on, the gate has to bend the bands at the silicon surface by $\\psi_s = 2\\phi_F$ (inversion). The gate supplies charge through $C_{ox}$; that charge can end up in the semiconductor ($C_s$) or in the interface states ($e^2 D_{it}$). Both formulas above are the same weighted average: the more capacitance the interface states offer, the less the "push" reaches the band bending.</p>
<p>After a hydrogen anneal, Si/SiO₂ reaches $D_{it} \\approx ${sciTex(a.Dit, 1)}$ cm⁻²eV⁻¹ and the gate reaches inversion at about ${num(F.VT[a.id], 2)} V. With $D_{it} = ${sciTex(b.Dit, 1)}$ it takes ${num(F.VT[b.id], 2)} V. With $D_{it} = ${sciTex(c.Dit, 1)}$, a 1 V gate step moves the surface only about ${num(F.slopeWorst * 1000, 0)} mV, and ${breakdownSentence(F).replace('Reaching inversion would need', 'inversion would need')} A low-$D_{it}$ oxide interface is part of why silicon dominates the industry.</p>`,
    derivation: `
<h4>Model</h4>
$$Q_s = -\\operatorname{sign}(\\psi_s)\\,\\frac{\\sqrt2\\,\\varepsilon_s\\,(kT/q)}{L_D}\\,F,\\qquad L_D = \\sqrt{\\frac{\\varepsilon_s kT}{q^2 p_{p0}}}$$
$$F = \\sqrt{\\left(e^{-\\beta\\psi_s} + \\beta\\psi_s - 1\\right) + \\frac{n_{p0}}{p_{p0}}\\left(e^{\\beta\\psi_s} - \\beta\\psi_s - 1\\right)},\\qquad \\beta = q/kT$$
$$Q_{it} = -q\\,D_{it}\\,(\\psi_s - \\phi_F),\\qquad \\phi_F = \\frac{kT}{q}\\ln\\frac{N_A}{n_i}$$
$$V_G = V_{FB} + \\psi_s - \\frac{Q_s + Q_{it}}{C_{ox}}$$
<p>$V_G$ increases with $\\psi_s$, so the simulator inverts it by bisection over $\\psi_s$ from ${num(MOS.psiRange[0], 1)} to ${num(MOS.psiRange[1], 1)} V.</p>`,
    assumptions: [
      `p-type Si substrate: $N_A = ${sciTex(MOS.NA, 1)}$ cm⁻³, $n_i = ${sciTex(MOS.ni, 2)}$ cm⁻³, $\\varepsilon_{r,s} = ${MOS.epsRs}$, $T = ${MOS.T}$ K, so $p_{p0} = N_A$, $n_{p0} = n_i^2/N_A$ and $\\phi_F = ${num(F.phiF, 3)}$ V.`,
      `SiO₂ gate oxide: $\\varepsilon_r = ${MOS.epsRox}$, $t_{ox} = ${MOS.tox}$ nm, so $C_{ox} = ${sciTex(F.Cox, 3)}$ F/m².`,
      `$V_{FB} = ${MOS.VFB}$: the work-function difference and fixed oxide charge are ignored.`,
      'Exact 1D Poisson charge $Q_s$ (accumulation, depletion and inversion), Boltzmann statistics.',
      'Uniform $D_{it}$ with its neutral level at midgap; $E_i$ is drawn at midgap.',
      'Band shapes in the diagram use the depletion approximation (illustrative); $\\psi_s$ itself comes from the exact model.',
      `“${c.label}” is illustrative: Si parameters with a GaAs-like $D_{it}$.`,
      `SiO₂ breakdown taken as roughly ${MOS.breakdownMVcm} MV/cm.`,
    ],
    simTitle: 'The gate that can’t switch',
    simNote: 'p-Si, 10 nm SiO₂, V<sub>FB</sub> = 0',
    tryThis: [
      `Drag $V_G$ to the threshold of each preset: ${MOS_PRESETS.map((p) => `${num(F.VT[p.id], 2)} V`).join(', ')}.`,
      'With the GaAs-like preset, sweep $V_G$ over the whole range: $\\psi_s$ hardly leaves midgap.',
      'Compare $d\\psi_s/dV_G$ with $S$ in Section 3: same weighted average, different capacitors.',
    ],
  };
}

function sim(root, ctx) {
  const { store } = ctx;
  const fr = simFrame(root, ctx, { plotsClass: 'cols-2e' });
  const roPsi = readout('ψ<sub>s</sub>', { key: true });
  const roSlope = readout('dψ<sub>s</sub>/dV<sub>G</sub>');
  const roVT = readout('threshold V<sub>T</sub>');
  const roCh = readout('channel');
  const note = h('span', { class: 'badge info', hidden: true });
  fr.top.append(roPsi.el, roSlope.el, roVT.el, roCh.el, note);

  const pBand = panel('MOS band diagram', { sub: 'oxide not to scale · dashed line in the gate: E<sub>F,gate</sub> = E<sub>F</sub> − qV<sub>G</sub>' });
  const band = createMosBandPlot(pBand.body);
  const legend = MOS_PRESETS.map(
    (p, i) => `<span><span class="sw" style="color:${PSI_STYLES[i].color};${PSI_STYLES[i].dash ? `border-top-style:${PSI_STYLES[i].dash.startsWith('2 ') ? 'dotted' : 'dashed'}` : ''}"></span>${pow10(p.Dit)}</span>`,
  ).join('');
  const pPsi = panel('ψ<sub>s</sub> vs V<sub>G</sub>', { sub: `<span class="legend">${legend}<span>cm⁻²eV⁻¹</span></span>` });
  const psiPlot = createPsiVGPlot(pPsi.body);
  for (const pn of [pBand, pPsi]) Object.assign(pn.body.style, { flex: '1 1 auto', minHeight: '0', display: 'flex', flexDirection: 'column' });
  fr.plots.append(pBand.el, pPsi.el);

  const seg = segmented({
    aria: 'Interface preset',
    options: MOS_PRESETS.map((p) => ({ value: p.id, label: `${p.label} (${pow10(p.Dit)})` })),
    onChange: (v) => store.set({ mosPreset: v }, { source: 'user' }),
  });
  const vg = slider({
    label: 'V<sub>G</sub>',
    aria: 'Gate voltage V_G',
    min: MOS.VGRange[0],
    max: MOS.VGRange[1],
    step: 0.01,
    format: (v) => `${num(v, 2)} V`,
    onInput: (v) => store.set({ VG: Math.round(v * 100) / 100 }, { source: 'user' }),
  });
  fr.controls.append(h('div', { class: 'ctl-row' }, seg.el), h('div', { class: 'sliders' }, vg.el));

  const models = MOS_PRESETS.map((p) => ({ m: model(p.Dit), label: p.label }));
  function update(s) {
    const pr = presetById(s.mosPreset);
    const m = model(pr.Dit);
    const r = E.mosSolve(m, s.VG);
    roPsi.set(`${num(r.psi, 3)} V`);
    roSlope.set(num(r.slope, 3));
    roVT.set(`${num(r.VT, 2)} V`);
    roCh.set(r.inversion ? 'on (inversion)' : 'off');
    roCh.el.classList.toggle('key', r.inversion);
    note.hidden = !pr.note;
    note.innerHTML = `<span>${(pr.note || '').replace('D_it', 'D<sub>it</sub>')}</span>`;
    seg.set(pr.id);
    vg.set(s.VG);
    band.update({ m, psi: r.psi, VG: s.VG, Eg });
    psiPlot.update({ models, sel: MOS_PRESETS.indexOf(pr), VG: s.VG, psi: r.psi });
  }

  const F = mosFacts();
  const step = (p, last) => ({
    dur: 3800,
    ease: 'linear',
    caption: `${p.label} (D<sub>it</sub> = ${pow10(p.Dit)} cm⁻²eV⁻¹): sweep V<sub>G</sub> from −1 to +3 V`,
    live: (s) => {
      const m = model(p.Dit);
      const moved = E.mosPsi(m, s.VG) - E.mosPsi(m, -1);
      return `V<sub>G</sub> = ${num(s.VG, 2)} V · E<sub>F</sub> at the surface moved ${num(moved, 2)} eV (ψ<sub>s</sub> = ${num(E.mosPsi(m, s.VG), 2)} V)`;
    },
    update: (u) => ({ mosPreset: p.id, VG: -1 + 4 * u }),
  });
  const demo = {
    label: 'Demo',
    setup: () => ({ mosPreset: MOS_PRESETS[0].id, VG: -1 }),
    steps: MOS_PRESETS.map((p, i) => step(p, i === MOS_PRESETS.length - 1)),
    doneCaption: breakdownSentence(F),
    doneLive: (s) => {
      const m = model(F.worst.Dit);
      return `E<sub>F</sub> at the surface moved only ${num(E.mosPsi(m, 3) - E.mosPsi(m, -1), 3)} eV for a 4 V sweep`;
    },
  };
  return {
    update,
    demos: [{ id: 'A', label: 'Demo', key: 'A', title: 'sweep V<sub>G</sub> from −1 to +3 V for each preset', script: demo }],
  };
}

export default {
  id: 'mos',
  further: true,
  title: 'The gate that can’t switch',
  short: 'The gate that can’t switch',
  start: () => ({ mosPreset: MOS_PRESETS[0].id, VG: 0 }),
  content,
  sim,
  hooks: [],
};
