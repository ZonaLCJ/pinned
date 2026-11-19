// Section 4. Breaking the pin (or tunnelling through it).
import { h } from '../ui/dom.js';
import * as E from '../engine.js';
import { stateFor, metalAt } from '../state.js';
import { metalById, SLIDER_RANGES, DEFAULTS } from '../../data/materials.js';
import { MOS2_LINES, DIGITIZED_LABEL, SHEN_2021 } from '../../data/course-data.js';
import { simFrame, panel, badgeRow } from '../ui/sim-frame.js';
import { readout, boundControls, semiControl, metalControl, checkbox, segmented } from '../ui/controls.js';
import { createLiveBand } from '../ui/live-band.js';
import { createRhoCPlot } from '../plots/rhoc.js';
import { createIVPlot, IV_JMAX } from '../plots/iv.js';
import { createHeatmapPlot } from '../plots/heatmap.js';
import { createPhiBPhiMPlot } from '../plots/phib-phim.js';
import { num, sci, eV, rhoStr, sciTex, times } from '../ui/format.js';
import { createBuildContact, TARGET } from '../hooks/build-contact.js';
import { createMythFact, mythById } from '../hooks/myth-fact.js';
import { createChipAnim, chipStart } from '../chip-anim.js';

const AL = metalById('Al').phiM;

const KEY_EQ = String.raw`\begin{gathered}\gamma = \frac{\varepsilon_i}{\varepsilon_i + e^2\delta\,D_{it,\mathrm{eff}}}\\[2pt] D_{it,\mathrm{eff}} = D_{it}\,e^{-t/\lambda}\end{gathered}`;

function content(F) {
  const shen = `${SHEN_2021.cite}`;
  const toy = `
<h4>Toy model (qualitative)</h4>
<p>An interlayer of thickness $t$ blocks the MIGS tails: $D_{it,\\mathrm{eff}} = D_{it}\\,e^{-t/\\lambda}$ with $\\lambda = ${DEFAULTS.lambda}$ nm, while $\\delta$ and $\\varepsilon_i$ stay unchanged. Thermionic-field emission through the (thinner, heavily doped) barrier:</p>
$$E_{00} = \\frac{\\hbar}{2}\\sqrt{\\frac{N_d}{m^*_{t}\\,\\varepsilon_s}},\\qquad E_0' = E_{00}\\coth\\frac{E_{00}}{kT}$$
<p>($E_{00}$ comes out directly in eV with SI inputs, because $e$ cancels.)</p>
$$\\rho_c = \\frac{k_B}{A^* T}\\,\\exp\\!\\left(\\frac{\\phi_{Bn}}{E_0'}\\right)\\,e^{2\\kappa t},\\qquad \\kappa = ${DEFAULTS.kappa}\\ \\mathrm{nm^{-1}}$$
<p>The TFE form follows Sze &amp; Ng, ch. 3; $e^{2\\kappa t}$ is the tunnelling penalty of the interlayer. For Si/Al at $N_d = 10^{18}$ cm⁻³ the optimum is $t \\approx ${num(F.opt18.t, 2)}$ nm; at $10^{19}$ cm⁻³ it is $t \\approx ${num(F.opt19.t, 2)}$ nm with $\\rho_c \\approx ${sciTex(F.opt19.rhoC, 2)}$ Ω·cm², against $${sciTex(F.al19t0.rhoC, 2)}$ Ω·cm² without the interlayer.</p>`;
  const model = `In this model $Q_{sc}$ exceeds $Q_{ss}$ from $N_d \\approx 10^{18}$ cm⁻³ (Au/n-Si at $10^{18}$: $Q_{sc} = ${sciTex(F.si18.QscCm, 2)}$ vs $|Q_{ss}| = ${sciTex(Math.abs(F.si18.QssCm), 2)}$ e/cm²), so the textbook "neglect the depletion term" approximation fails there.`;
  return {
    takeaway: 'Every fix maps onto $\\gamma$: lower $D_{it}$, block MIGS, or go around the barrier.',
    keyEq: KEY_EQ,
    idle: 'Demo A: Si/Al, sweep the interlayer t. Demo B: map of log ρ<sub>c</sub> over t × N<sub>d</sub>.',
    more: `
<h4>Four ways out</h4>
<ul>
<li><strong>Lower $D_{it}$:</strong> passivate, or van der Waals-transferred metals (no bonds, no defects; $S \\approx 1$ on MoS₂).</li>
<li><strong>Block MIGS</strong> with a ~1 nm insulator (MIS contact): $S$ rises, but tunnelling adds resistance, so there is an optimum $t$.</li>
<li><strong>Semimetal contact</strong>, Bi on monolayer MoS₂: zero barrier, ${SHEN_2021.contactResistance_ohm_um} Ω·µm (${shen}).</li>
<li><strong>Heavy doping</strong> (tunnelling contacts): thin enough to tunnel; the height stays pinned.</li>
</ul>
<h4>Model note</h4><p>${model}</p>${toy}`,
    simTitle: 'Contact engineering (toy model, qualitative)',
    simNote: `MoS₂ lines: ${DIGITIZED_LABEL}`,
    concept: `
<h4>Lower $D_{it}$</h4>
<p>Passivate the surface, or use van der Waals-transferred metals that form no chemical bonds and no defects. On MoS₂ these give $S \\approx 1$ (course slide; see the 2D tab).</p>
<h4>Block MIGS with a ~1 nm insulator (MIS contact)</h4>
<p>A thin insulator between metal and semiconductor keeps the metal wavefunctions from reaching the semiconductor, which raises $S$. But electrons now have to tunnel through it, so there is an optimum thickness.</p>
<h4>Semimetal contact</h4>
<p>Bi on monolayer MoS₂ suppresses MIGS and gives a zero Schottky barrier with ${SHEN_2021.contactResistance_ohm_um} Ω·µm: ${shen}, by MIT, National Taiwan University (Prof. Chih-I Wu's lab), TSMC and others.</p>
<h4>Heavy doping: tunnelling contacts</h4>
<p>The barrier gets thin enough to tunnel through, but its height stays pinned.</p>
<h4>Model note</h4>
<p>${model}</p>`,
    derivation: toy,
    assumptions: ['Toy model, qualitative: one tunnelling constant $\\kappa$ and one blocking length $\\lambda$.', '$\\delta$ and $\\varepsilon_i$ are unchanged by the interlayer.', 'I–V thumbnail: thermionic emission only, fixed scale ±' + IV_JMAX + ' A/cm².'],
    tryThis: [
      'Si preset, Al, $N_d = 10^{18}$: drag $t$ from 0 to 3 nm. $\\phi_{Bn}$ falls, then the tunnelling penalty wins.',
      'Raise $N_d$ to $10^{19}$: the barrier matters less ($E_0\'$ grows) and the optimum $t$ moves.',
      `GaAs preset: the best Al contact at $10^{19}$ reaches only $${sciTex(F.gaBest19.rhoC, 2)}$ Ω·cm².`,
      '2D tab: compare the evaporated ($S \\approx 0.1$) and vdW-transferred ($S \\approx 1$) lines.',
      'Advanced: change $\\lambda$ or $\\kappa$ and watch the optimum move.',
    ],
    misconceptions: [mythById(1), mythById(5)].map((m) => `<strong>${m.answer === 'myth' ? 'Myth' : 'Fact'}:</strong> “${m.text}” ${m.why}`),
  };
}

const rhoCache = new Map();
function rhoGrid(s) {
  const key = [s.semi, s.phiM, s.Dit, s.phi0, s.delta, s.T, s.lambda, s.kappa].join('|');
  if (rhoCache.has(key)) return rhoCache.get(key);
  const base = E.makeParams(s);
  const xs = E.rangeArray(0, 3, 61);
  const ys = E.logRange(SLIDER_RANGES.Nd.min, SLIDER_RANGES.Nd.max, 41);
  const g = E.grid(xs, ys, (t, Nd) => Math.log10(E.contactResistivity({ ...base, Nd }, { t, lambda: s.lambda, kappa: s.kappa }).rhoC));
  // sweet spot: grid minimum, refined in t
  let k = 0;
  for (let i = 1; i < g.values.length; i++) if (g.values[i] < g.values[k]) k = i;
  const Nd = ys[Math.floor(k / xs.length)];
  const opt = E.optimumThickness({ ...base, Nd }, { lambda: s.lambda, kappa: s.kappa });
  g.sweet = { t: opt.t, Nd, rhoC: opt.rhoC };
  if (rhoCache.size > 8) rhoCache.clear();
  rhoCache.set(key, g);
  return g;
}

function sim(root, ctx) {
  const { store, mode } = ctx;
  const present = mode === 'present';
  const fr = simFrame(root, ctx, { plotsClass: 'rows-r' });
  const roB = readout('φ<sub>Bn</sub>');
  const roS = readout('S<sub>eff</sub>');
  const roR = readout('ρ<sub>c</sub>', { key: true });
  const roT = readout('e<sup>2κt</sup>');
  fr.top.append(roB.el, roS.el, roR.el, roT.el);

  let view = 'contact';
  const tabs = segmented({
    aria: 'View',
    options: [
      { value: 'contact', label: 'Contact' },
      { value: 'map', label: 'Heatmap' },
      { value: 'mos2', label: '2D (MoS₂)' },
    ],
    onChange: (v) => setView(v),
    cls: 'tabs',
  });
  fr.tabs.hidden = false;
  fr.tabs.append(tabs.el);

  const pR = panel('ρ<sub>c</sub> vs interlayer t', {
    sub: `<span class="legend"><span><span class="sw" style="color:var(--brand-ink)"></span>ρ<sub>c</sub></span><span><span class="sw" style="color:#a7abc6;border-top-style:dashed"></span>no tunnelling penalty</span><span><span class="sw" style="color:var(--brand-ink);border-top-style:dashed;border-top-width:2px"></span>target ${sci(TARGET, 1)}</span></span>`,
  });
  const rho = createRhoCPlot(pR.body);
  const pIV = panel('I–V (thermionic)', { sub: `fixed scale ±${IV_JMAX} A/cm²` });
  const iv = createIVPlot(pIV.body);
  const pBand = panel('Band diagram');
  const badges = badgeRow(pBand.el.querySelector('.panel-title'));
  // live band (carriers + caption); the contact model stays n-type at 300 K
  const band = createLiveBand(pBand.body, ctx);
  const pMap = panel('log<sub>10</sub> ρ<sub>c</sub> over t × N<sub>d</sub>', { sub: 'toy model' });
  const map = createHeatmapPlot(pMap.body, 'Heatmap of contact resistivity over interlayer thickness and doping');
  const pM2 = panel('n-MoS₂: φ<sub>B</sub> vs φ<sub>m</sub>', { sub: DIGITIZED_LABEL });
  const m2 = createPhiBPhiMPlot(pM2.body, '2D contacts on MoS2');
  for (const pn of [pR, pIV, pBand, pMap, pM2]) Object.assign(pn.body.style, { flex: '1 1 auto', minHeight: '0', display: 'flex', flexDirection: 'column' });
  fr.plots.append(pR.el, pIV.el, pBand.el, pMap.el, pM2.el);
  if (!present) {
    iv.el.style.height = '180px';
    band.el.style.height = '200px';
  }

  // 2D toggles
  const on = { evaporated: true, vdw: true, bi: true };
  const m2Toggles = h(
    'div',
    { class: 'ctl-row m2-row', hidden: true },
    MOS2_LINES.map((ln) => checkbox({ label: ln.label, checked: true, onChange: (v) => ((on[ln.id] = v), update(store.get())) }).el),
  );

  const sc = semiControl(store, { materials: ['Si', 'GaAs'], nLabels: true });
  const mc = metalControl(store);
  const bc = boundControls(store, ['t', 'Nd']);
  const adv = present ? null : boundControls(store, ['lambda', 'kappa']);
  fr.controls.append(
    h('div', { class: 'ctl-row' }, sc.el, h('span', { class: 'badge info' }, 'toy model, qualitative')),
    h('div', { class: 'ctl-row' }, mc.el),
    m2Toggles,
    h('div', { class: 'sliders' }, bc.els),
    ...(adv ? [h('div', { class: 'advanced' }, h('span', { class: 'ctl-label' }, 'Advanced (toy-model constants)'), h('div', { class: 'sliders' }, adv.els))] : []),
  );

  function setView(v) {
    view = v;
    tabs.set(v);
    pR.el.hidden = v !== 'contact';
    pIV.el.hidden = v !== 'contact';
    pBand.el.hidden = v === 'mos2' || (present && v === 'contact');
    pMap.el.hidden = v !== 'map';
    pM2.el.hidden = v !== 'mos2';
    m2Toggles.hidden = v !== 'mos2';
    fr.plots.className = `sim-plots ${v === 'contact' ? (present ? 'cols-2' : 'rows-r') : v === 'map' ? 'cols-2' : ''}`;
    if (v === 'map') fr.plots.insertBefore(pMap.el, fr.plots.firstChild);
    else if (v === 'contact') fr.plots.insertBefore(pR.el, fr.plots.firstChild);
    update(store.get());
  }

  function update(s) {
    const p = E.makeParams(s);
    const c = E.contactResistivity(p, { t: s.t, lambda: s.lambda, kappa: s.kappa });
    roB.set(eV(c.phiBn, 2));
    roS.set(num(c.gammaEff, 2));
    roR.set(rhoStr(c.rhoC));
    roR.el.classList.toggle('pos', false);
    roT.set(times(c.tunnelFactor, 2));
    badges.set(c.res);
    sc.sync(s);
    mc.sync(s);
    bc.sync(s);
    adv?.sync(s);
    const pe = { ...p, Dit: c.DitEff };
    if (view !== 'mos2') band.update({ p: pe, res: c.res, opts: { vac: false, arrows: false, W: true } });
    if (view === 'contact') {
      rho.update({ p, t: s.t, lambda: s.lambda, kappa: s.kappa, target: TARGET });
      iv.update({ phiBn: c.phiBn, T: p.T, Astar: p.Astar });
    } else if (view === 'map') {
      const g = rhoGrid(s);
      const lo = Math.floor(g.min);
      const hi = Math.ceil(g.max);
      const levels = [];
      for (let v = lo; v <= hi; v++) levels.push(v);
      map.update({
        grid: g,
        yLog: true,
        vmin: lo,
        vmax: hi,
        levels,
        labelLevels: levels.filter((v) => v % 2 === 0 || v === -6),
        labelRow: 0.5,
        highlight: Math.log10(TARGET),
        fmtLevel: (v) => `10^{${v}}`,
        markers: [
          { x: g.sweet.t, y: g.sweet.Nd, kind: 'ring', label: `sweet spot: t ≈ ${num(g.sweet.t, 2)} nm`, dy: -30 },
          { x: s.t, y: s.Nd },
        ],
        xTicks: [0, 0.5, 1, 1.5, 2, 2.5, 3],
        xTitle: 't (nm)',
        yTitle: 'N_{d} (cm⁻³)',
        legendTicks: [lo, Math.round((lo + hi) / 2), hi],
        legendFmt: (v) => `${v}`,
      });
    } else {
      const lines = [];
      const styles = {
        evaporated: { color: 'var(--text)', cls: '' },
        vdw: { color: 'var(--brand-ink)', dash: '10 6', cls: 'ink' },
        bi: { color: 'var(--text-muted)', dash: '2 7', cls: 'muted', width: 5 },
      };
      for (const ln of MOS2_LINES) {
        if (!on[ln.id]) continue;
        lines.push({ fn: ln.phiB, ...styles[ln.id] });
      }
      const phiM = s.phiM;
      m2.update({
        p: null,
        lines,
        legend: MOS2_LINES.filter((ln) => on[ln.id]).map((ln) => ({ label: `${ln.id === 'vdw' ? 'vdW-transferred' : ln.id === 'bi' ? 'Bi semimetal' : 'evaporated'}: ${ln.note}`, ...styles[ln.id] })),
        dots: MOS2_LINES.filter((ln) => on[ln.id]).map((ln) => ({ phiM, phiB: Math.max(0, ln.phiB(phiM)), color: styles[ln.id].color })),
        xMarker: phiM,
        yTitle: 'barrier φ_{B} (eV)',
      });
    }
  }

  const liveA = (s) => {
    const c = E.contactResistivity(E.makeParams(s), { t: s.t, lambda: s.lambda, kappa: s.kappa });
    return `t = ${num(s.t, 2)} nm · φ<sub>Bn</sub> = ${num(c.phiBn, 2)} eV · ρ<sub>c</sub> = ${sci(c.rhoC, 1, { dropOne: false })} · e<sup>2κt</sup> = ${times(c.tunnelFactor, 2)}`;
  };
  const demoA = {
    label: 'Demo A',
    setup: () => {
      setView('contact');
      return { ...stateFor('si', 'Si', { phiM: AL, Nd: 1e18 }), t: 0 };
    },
    steps: [
      {
        dur: 4000,
        ease: 'linear',
        caption: 'Si/Al at 10¹⁸ cm⁻³: a thicker interlayer lowers φ<sub>Bn</sub>, ρ<sub>c</sub> drops',
        live: (s) => liveA(s),
        tracks: { t: [0, 1, 'lin'] },
      },
      {
        dur: 5000,
        ease: 'linear',
        caption: '…until the tunnelling factor e<sup>2κt</sup> wins: ρ<sub>c</sub> traces a U',
        live: (s) => liveA(s),
        tracks: { t: [1, 3, 'lin'] },
      },
    ],
  };
  const demoB = {
    label: 'Demo B',
    setup: () => {
      setView('map');
      return { ...stateFor('si', 'Si', { phiM: AL, Nd: 1e16 }), t: 0 };
    },
    steps: [
      {
        dur: 8000,
        caption: 'The sweet spot needs heavy doping and a thin interlayer together',
        live: (s) => {
          const c = E.contactResistivity(E.makeParams(s), { t: s.t, lambda: s.lambda, kappa: s.kappa });
          return `t = ${num(s.t, 2)} nm · N<sub>d</sub> = ${sci(s.Nd, 1)} · ρ<sub>c</sub> = ${sci(c.rhoC, 1, { dropOne: false })}`;
        },
        update: (u, s) => {
          const g = rhoGrid(s);
          return { t: u * g.sweet.t, Nd: 10 ** (16 + u * (Math.log10(g.sweet.Nd) - 16)) };
        },
      },
    ],
  };

  setView('contact');
  return {
    update,
    moreEl: band.moreEl,
    demos: [
      { id: 'A', label: 'Demo A', key: 'A', title: 'Si/Al at 10¹⁸: sweep t from 0 to 3 nm', script: demoA },
      { id: 'B', label: 'Demo B', key: 'B', title: 'map of log ρ<sub>c</sub>, find the sweet spot', script: demoB },
    ],
  };
}

export default {
  id: 's4',
  num: 4,
  title: 'Breaking the pin (or tunnelling through it)',
  short: 'Breaking the pin',
  start: () => ({ ...stateFor('si', 'Si', { phiM: AL, Nd: 1e18 }), t: 0 }),
  content,
  sim,
  extras: [
    {
      id: 'chip',
      label: 'Back to the chip',
      key: 'C',
      title: 'Back to the chip',
      idle: 'Press Play, or switch the fixes on and off.',
      start: () => ({ chip: { ...chipStart(5), u: 1 } }),
      create: (root, ctx) => createChipAnim(root, ctx, { variant: 'fixes' }),
    },
  ],
  hooks: [
    { id: 'build', label: 'Build a contact', create: createBuildContact },
    { id: 'mythfact', label: 'Myth or fact', create: createMythFact },
  ],
};
