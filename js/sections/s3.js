// Section 3. Pinning strength S and the experimental evidence.
import { h } from '../ui/dom.js';
import * as E from '../engine.js';
import { stateFor, metalAt } from '../state.js';
import { METALS, metalById, SLIDER_RANGES, SEMI_ORDER, SEMICONDUCTORS, PRESETS, PRESET_FOR_SEMI, ASTAR_P } from '../../data/materials.js';
import { MOTT_SCHOTTKY, DIGITIZED_LABEL } from '../../data/course-data.js';
import { simFrame, panel, badgeRow } from '../ui/sim-frame.js';
import { readout, boundControls, metalControl, checkbox, segmented, globalControls, presetNotes } from '../ui/controls.js';
import { createLiveBand } from '../ui/live-band.js';
import { createPhiBPhiMPlot } from '../plots/phib-phim.js';
import { createJVPlot } from '../plots/jv.js';
import { createHeatmapPlot } from '../plots/heatmap.js';
import { createCVPlot } from '../plots/cv.js';
import { num, sci, eV, times, pow10, sciTex, pct } from '../ui/format.js';
import { createMission } from '../hooks/mission.js';
import { mythById } from '../hooks/myth-fact.js';

const AL = metalById('Al').phiM;
const AU = metalById('Au').phiM;

const KEY_EQ = String.raw`\begin{aligned}\phi_{Bn} &= \gamma(\phi_m - \chi)\\ &\quad + (1-\gamma)(E_g/e - \phi_0)\\ S = \gamma &= \frac{\varepsilon_i}{\varepsilon_i + e^2\delta D_{it}}\end{aligned}`;

// Kurtin, McGill and Mead (1969); numbers from course-data.js (KURTIN_1969)
const ionicity = (F) =>
  `Kurtin, McGill and Mead (1969) found that $S$ rises from about ${F.kurtin.S_covalent} for covalent semiconductors such as Si, Ge and GaAs toward about ${F.kurtin.S_ionic} for strongly ionic ones such as ZnS and oxides, with a fairly sharp transition as the electronegativity difference grows. GaN, more ionic than GaAs, generally pins less strongly. Ionicity isn’t the whole story: GaAs is more ionic than Si yet pins harder in the course figure, because defects and interface chemistry add states too.`;
// Ge preset (Dimoulas et al. 2006); the barrier range is the engine's range over the Table 9.1 metals
const geNote = (F) =>
  `In Ge the neutral level is only about ${num(F.gePhi0, 2)} eV above $E_v$ and $S \\approx ${F.geS}$, so n-type contacts have barriers of about ${num(F.geMin, 2)}–${num(F.geMax, 1)} eV with almost any metal, while p-type contacts are ${F.gePOhmic ? 'nearly ohmic' : 'low-barrier'}. This is why n-type contacts to Ge are hard to make.`;

function content(F) {
  const why = `$J \\propto \\exp(-e\\phi_B/kT)$. On ideal GaAs, Al → Au would change $\\phi_B$ by ${num(F.idealSpread, 2)} eV, i.e. about $${sciTex(F.idealRatio, 1)}\\times$ in current. The course data show only about ${num(F.dataSpread, 2)} eV, i.e. about ${Math.round(F.dataRatio)}×.`;
  const little = `With $\\delta \\approx ${num(F.delta, 1)}$ nm and $\\varepsilon_i \\approx \\varepsilon_0$, $D_{it} \\approx 10^{13}$ cm⁻²eV⁻¹ already gives $S \\approx ${num(F.gamma13, 2)}$. That is only about ${num(F.surfFrac * 100, 1)}% of the Si surface atoms ($${sciTex(F.surfaceAtoms, 2)}$ cm⁻²) per eV.`;
  const derivation = `
<h4>Derivation: the weighted average</h4>
<p>Drop the depletion term from the course equation (Section 2):</p>
$$e^2 D_{it}\\,\\delta\\,(E_g/e - \\phi_0 - \\phi_{Bn}) = \\varepsilon_i\\,(\\phi_{Bn} - \\phi_m + \\chi)$$
$$\\Rightarrow\\quad \\phi_{Bn} = \\gamma(\\phi_m - \\chi) + (1-\\gamma)(E_g/e - \\phi_0)$$
$$\\gamma = \\frac{\\varepsilon_i}{\\varepsilon_i + e^2\\delta D_{it}}$$
<p>So $S = d\\phi_{Bn}/d\\phi_m = \\gamma$. At $\\phi_m = \\phi_m^* = \\chi + E_g/e - \\phi_0$ both terms ask for the same barrier, and $\\phi_{Bn} = E_g/e - \\phi_0$ for every $D_{it}$.</p>`;
  return {
    takeaway: `A modest $D_{it} \\approx 10^{13}$ cm⁻²eV⁻¹ already halves the metal’s influence. Measured $S$ is about ${F.dataSlopeSi} for Si and ${F.dataSlopeGaAs} for GaAs.`,
    keyEq: KEY_EQ,
    idle: 'Demo A: rotate the curve about the pivot. Demo B: the φ<sub>B</sub> map over φ<sub>m</sub> and D<sub>it</sub>.',
    more: `
<h4>A weighted average</h4>
<p>The barrier is a weighted average of what the metal wants ($\\phi_m - \\chi$) and what the interface wants ($E_g/e - \\phi_0$), with $S = \\gamma$ as the weight.</p>
<h4>The pivot</h4>
<p>At $\\phi_m^* = \\chi + E_g/e - \\phi_0$ (${num(F.siPivot, 2)} eV for the Si preset) $D_{it}$ does not matter, because no charge has to go into the states.</p>
<h4>How little it takes</h4><p>${little}</p>
<h4>Why it matters</h4><p>${why}</p>
<h4>How φ<sub>B</sub> is measured</h4><p>From the intercept of $1/C^2$ vs $V$ (course depletion-capacitance slide) or from the I–V saturation current. Try the C–V Lab tab.</p>
<h4>Ionicity trend</h4><p>${ionicity(F)}</p>
<h4>Real semiconductors</h4><p>${geNote(F)}</p>
${derivation}`,
    simTitle: 'Barrier vs work function, and a virtual C–V lab',
    simNote: `Course points: ${DIGITIZED_LABEL}`,
    concept: `
<h4>A weighted average</h4>
<p>The barrier is a weighted average of what the metal wants, $\\phi_m - \\chi$, and what the interface wants, $E_g/e - \\phi_0$. The weight is the pinning factor $S = \\gamma$: $S = 1$ is Schottky–Mott, $S = 0$ is fully pinned (Bardeen).</p>
<h4>The pivot</h4>
<p>At $\\phi_m^* = \\chi + E_g/e - \\phi_0$ both ask for the same barrier, so no charge has to go into the interface states and $D_{it}$ does not matter. Every curve passes through this point: ${num(F.siPivot, 2)} eV for the Si preset and ${num(F.gaPivot, 2)} eV for GaAs.</p>
<h4>How little it takes</h4>
<p>${little}</p>
<h4>Why it matters</h4>
<p>${why}</p>
<h4>How $\\phi_B$ is measured</h4>
<p>From the intercept of $1/C^2$ vs $V$ (course depletion-capacitance slide), $1/C'^2 = 2(V_{bi} + V_R)/(e\\varepsilon_s N_d)$, so the voltage-axis intercept is $-V_{bi}$ and $\\phi_{Bn} = V_{bi} + \\phi_n$. Or from the saturation current of the I–V curve. The <em>C–V lab</em> tab lets you take the measurement yourself, metal by metal, and rebuild the Mott–Schottky figure.</p>
<h4>What the barrier does to the current</h4>
<p>The J–V panel draws $J = A^*T^2\\exp(-e\\phi_B/kT)\\,[\\exp(eV/kT) - 1]$ for three barriers: $S = 1$ (dashed), the Bardeen limit $S = 0$ (dotted) and the present $D_{it}$ (solid). On a log axis a barrier change is a vertical shift, one decade for every $kT\\ln 10$ of barrier. The four-semiconductor panel gives Si, GaAs, Ge and GaN the same $D_{it}$, so they share one $S$; the curves differ only through $\\chi$, $E_g$ and $\\phi_0$.</p>
<h4>Ionicity trend</h4>
<p>${ionicity(F)}</p>
<div class="callout real-semi"><h4>Real semiconductors</h4><p>${geNote(F)}</p></div>`,
    derivation,
    deepDive: `
<h4>Deep dive: the pivot in the numeric solver</h4>
<p>In the analytic form the pivot is exact. The plotted curves use the numeric solver, which keeps the depletion charge $Q_{sc}$: the states must also supply that charge, so even at $\\phi_m^*$ the barrier moves a little with $D_{it}$. Across $D_{it} = 10^{11}$–$10^{15}$ cm⁻²eV⁻¹ the spread is ${num(F.pivotSpreadSi, 3)} eV for Si and ${num(F.pivotSpreadGaAs, 3)} eV for GaAs.</p>
<p class="small">${MOTT_SCHOTTKY.footnote}</p>`,
    assumptions: ['$\\varepsilon_i$ and $\\delta$ fixed ($\\varepsilon_{r,i} = 1$, $\\delta = ' + num(F.delta, 1) + '$ nm unless changed).', 'No image-force lowering (C–V lab too).', 'Uniform $D_{it}$, single neutral level.'],
    tryThis: [
      'Si preset: tap Ag, then Pt. The barrier changes by about $S\\,\\Delta\\phi_m$, and the current ratio to Al collapses compared with the ideal line.',
      'Tick <em>course data</em>: the Si curve runs through the measured points. Switch to the GaAs preset.',
      'Put $\\phi_m$ at the pivot and drag $D_{it}$: the dot stays put while the curve rotates about it.',
      '<em>C–V lab</em>: measure every Table 9.1 metal (Fit, then Plot it). Your points rebuild the Mott–Schottky figure.',
      '<em>Heatmap</em>: find the column whose colour never changes.',
      '<em>J–V</em>: drag $D_{it}$ and watch the solid curve move from the dashed ($S = 1$) curve to the dotted ($S = 0$) one.',
      'Switch the semiconductor to Ge, then to p-type: almost every metal gives the same barrier, and the p-type contacts turn ohmic.',
    ],
    misconceptions: [mythById(3)].map((m) => `<strong>${m.answer === 'myth' ? 'Myth' : 'Fact'}:</strong> “${m.text}” ${m.why}`),
  };
}

// --------------------------------------------------------------------- heatmap grid
const hmCache = new Map();
function barrierGrid(s) {
  const key = [s.semi, s.doping, s.phi0, s.delta, s.epsRi, s.Nd, s.T].join('|');
  if (hmCache.has(key)) return hmCache.get(key);
  const base = E.makeParams({ ...s, Dit: 1e13, delta: s.delta > 0 ? s.delta : 0.5 });
  const xs = E.rangeArray(3.5, 6, 76);
  const ys = E.logRange(SLIDER_RANGES.Dit.min, SLIDER_RANGES.Dit.max, 49);
  const g = E.grid(xs, ys, (phiM, Dit) => E.barrier({ ...base, phiM, Dit }));
  if (hmCache.size > 8) hmCache.clear();
  hmCache.set(key, g);
  return g;
}

// four-semiconductor plot: each material with its own chi, E_g and phi0 (material preset),
// all sharing the current D_it, delta, eps_i, doping, N and T
const FOUR_STYLE = {
  Si: { color: 'var(--brand-ink)', dash: null, cls: 'ink strong' },
  GaAs: { color: 'var(--c-pos)', dash: '11 5', cls: 'pos-ink strong' },
  Ge: { color: 'var(--c-neg)', dash: '2 6', cls: 'neg-ink strong' },
  GaN: { color: 'var(--c-e0)', dash: '12 4 3 4', cls: 'e0-ink strong' },
};
const fourParams = (s) => SEMI_ORDER.map((id) => E.makeParams({ ...s, semi: id, phi0: PRESETS[PRESET_FOR_SEMI[id]].phi0 }));
// A* note for the J–V panel
function astarNote(p) {
  if (p.doping === 'p') return `A* = ${ASTAR_P.value} A cm⁻² K⁻², ${ASTAR_P.label}`;
  return `A* = ${p.Astar} A cm⁻² K⁻²${SEMICONDUCTORS[p.semi].AstarApprox ? ' (approx.)' : ''}`;
}

function sim(root, ctx) {
  const { store, mode } = ctx;
  const present = mode === 'present';
  const fr = simFrame(root, ctx, { plotsClass: 'cols-2' });

  const roB = readout('φ<sub>Bn</sub>', { key: true });
  const roS = readout('S');
  const roP = readout('pivot φ<sub>m</sub>*');
  if (present) roP.el.classList.add('only-detailed');
  const roJ = readout('J / J<sub>Al</sub>');
  const roSpread = readout('J spread (metals)');
  fr.top.append(roB.el, roS.el, roP.el, roJ.el, roSpread.el);

  // view tabs. Outline mode: the J–V and four-semiconductor plots are tabs too, so nothing scrolls.
  let view = 'curve';
  const tabOptions = present
    ? [
        { value: 'curve', label: 'φ<sub>B</sub>–φ<sub>m</sub>' },
        { value: 'jv', label: 'J–V' },
        { value: 'four', label: '4 semiconductors' },
        { value: 'map', label: 'Heatmap' },
        { value: 'lab', label: 'Lab' },
      ]
    : [
        { value: 'curve', label: 'φ<sub>B</sub> vs φ<sub>m</sub>' },
        { value: 'map', label: 'Heatmap' },
        { value: 'lab', label: 'C–V lab' },
      ];
  const tabs = segmented({ aria: 'View', options: tabOptions, onChange: (v) => setView(v), cls: 'tabs' });
  fr.tabs.hidden = false;
  fr.tabs.append(tabs.el);

  // panels
  const pCurve = panel('Barrier vs metal work function');
  const curve = createPhiBPhiMPlot(pCurve.body);
  const pBand = panel('Band diagram (linked)');
  const band = createLiveBand(pBand.body, ctx);
  const badges = badgeRow(pBand.el.querySelector('.panel-title'));
  const pMap = panel('φ<sub>B</sub> over φ<sub>m</sub> × D<sub>it</sub>', { sub: 'numeric solver, contours every 0.1 eV' });
  const map = createHeatmapPlot(pMap.body, 'Heatmap of barrier height over work function and interface-state density');
  const pCV = panel('Virtual C–V lab', { sub: 'simulated' });
  const cv = createCVPlot(pCV.body);
  // J–V: three barriers on a log axis, with the two current ratios
  const pJV = panel(present ? 'J–V for three barriers' : 'Current: S = 1, S = 0 and the present D<sub>it</sub>', { sub: 'log scale' });
  const roJ1 = readout('J<sub>s</sub>(current) / J<sub>s</sub>(S = 1)');
  const roJ0 = readout('J<sub>s</sub>(S = 0) / J<sub>s</sub>(S = 1)');
  // Outline mode: the two ratios replace the metal readouts in the top row while the J–V tab is open
  if (present) fr.top.append(roJ1.el, roJ0.el);
  else pJV.body.append(h('div', { class: 'panel-readouts' }, roJ1.el, roJ0.el));
  const jv = createJVPlot(pJV.body);
  const jvNote = h('p', { class: 'panel-note' });
  pJV.body.append(jvNote);
  // four semiconductors sharing D_it
  const pFour = panel('Four semiconductors, one D<sub>it</sub>');
  const four = createPhiBPhiMPlot(pFour.body, 'Barrier versus metal work function for Si, GaAs, Ge and GaN at the same interface-state density');
  const fourNote = h('p', { class: 'panel-note' });
  pFour.body.append(fourNote);
  const all = [pCurve, pBand, pMap, pCV, pJV, pFour];
  for (const pn of all) Object.assign(pn.body.style, { flex: '1 1 auto', minHeight: '0', display: 'flex', flexDirection: 'column' });
  const mainPanels = present ? all : [pCurve, pBand, pMap, pCV];
  fr.plots.append(...mainPanels.map((pn) => pn.el));
  // Detailed mode: J–V and the four-semiconductor plot sit in their own row under the tabbed plots
  if (!present) {
    jv.el.style.height = '330px';
    four.el.style.height = '330px';
    fr.plots.after(h('div', { class: 'sim-plots cols-2 s3-extra' }, pJV.el, pFour.el));
  }

  // course-data toggle (Si or GaAs, n-type only) + lab controls
  let showData = !present;
  const dataToggle = checkbox({ label: 'course data', checked: showData, onChange: (v) => ((showData = v), update(store.get())) });
  const labStatus = h('span', { class: 'lab-status', 'aria-live': 'polite' });
  const btnMeasure = h('button', { type: 'button', class: 'btn', onclick: () => measure(true) }, 'Re-measure');
  const btnFit = h('button', { type: 'button', class: 'btn primary', onclick: () => fit() }, 'Fit');
  const btnPlot = h('button', { type: 'button', class: 'btn primary', onclick: () => plotIt() }, 'Plot it');
  const btnClear = h('button', { type: 'button', class: 'btn ghost', onclick: () => clearLab() }, 'Clear');
  const labRow = h('div', { class: 'ctl-row lab-row', hidden: true }, btnMeasure, btnFit, btnPlot, btnClear, labStatus);

  const gc = globalControls(store, { present });
  const mc = metalControl(store);
  const metalRow = h('div', { class: 'ctl-row' }, mc.el);
  // Outline mode: the toggle shares the metal row (saves a row on the slide)
  (present ? metalRow : gc.rows[0]).append(dataToggle.el);
  const bc = boundControls(store, present ? ['Dit'] : ['phiM', 'Dit', 'delta', 'phi0', 'Nd']);
  fr.controls.append(...gc.rows, metalRow, labRow, h('div', { class: `sliders${present ? ' one' : ''}` }, bc.els));

  // ---- C–V lab state
  const lab = { key: '', meas: null, line: null, seed: 1, results: {} };
  const labKey = (s) => `${s.preset}|${s.semi}|${s.doping}|${s.T}|${s.Dit.toPrecision(4)}|${s.phi0}|${s.delta}|${s.Nd}`;
  function measure(again) {
    const s = store.get();
    if (again) lab.seed++;
    const p = E.makeParams(s);
    const m = metalAt(s.phiM);
    const seed = lab.seed * 7919 + Math.round(s.phiM * 1000);
    lab.meas = E.simulateCV(p, { seed, noise: 0.01 });
    lab.metal = m ? m.id : null;
    // starting line: deliberately off, so the user has to fit or drag
    const ys = lab.meas.points.map((q) => q.y);
    const slope0 = (ys[ys.length - 1] - ys[0]) / 4;
    lab.line = { slope: slope0 * 0.75, intercept: ys[0] * 1.5 };
    lab.fitted = false;
    updateLab();
  }
  function fit() {
    if (!lab.meas) measure(false);
    lab.line = E.fitLine(
      lab.meas.points.map((q) => q.VR),
      lab.meas.points.map((q) => q.y),
    );
    lab.fitted = true;
    updateLab();
  }
  function current() {
    if (!lab.meas || !lab.line) return null;
    return E.barrierFromCVLine(lab.line, lab.meas.truth.phiBulk);
  }
  function plotIt() {
    const out = current();
    if (!out) return;
    const s = store.get();
    const key = labKey(s);
    lab.results[key] = lab.results[key] || {};
    lab.results[key][s.phiM.toFixed(2)] = { phiM: s.phiM, phiB: out.phiB, metal: lab.metal };
    updateLab();
    update(store.get());
  }
  function clearLab() {
    lab.results[labKey(store.get())] = {};
    updateLab();
    update(store.get());
  }
  function labPoints(s) {
    return Object.values(lab.results[labKey(s)] || {});
  }
  function updateLab() {
    if (!lab.meas) return;
    const ys = lab.meas.points.map((q) => q.y);
    const ymax = Math.max(...ys) * 1.15;
    const pw = Math.floor(Math.log10(ymax));
    const scale = 10 ** pw;
    cv.update({
      points: lab.meas.points,
      line: lab.line,
      yMax: ymax,
      scale,
      unitLabel: `10^{${pw}} cm⁴/F²`,
      onDrag: (l) => {
        lab.line = l;
        lab.fitted = false;
        updateLab();
      },
    });
    const out = current();
    const pts = labPoints(store.get());
    const pType = lab.meas.truth.doping === 'p';
    const nm = pType ? ['φ<sub>Bp</sub>', 'φ<sub>p</sub>'] : ['φ<sub>Bn</sub>', 'φ<sub>n</sub>'];
    let msg = out ? `V<sub>bi</sub> = ${num(out.Vbi, 2)} V → ${nm[0]} = V<sub>bi</sub> + ${nm[1]} = ${num(out.phiB, 2)} eV` : '';
    if (!lab.metal) msg += ' · pick a Table 9.1 metal to plot it';
    if (pts.length >= 2) {
      const f = E.fitLine(
        pts.map((q) => q.phiM),
        pts.map((q) => q.phiB),
      );
      msg += ` · ${pts.length} metals, slope ${num(f.slope, 2)}${pts.length >= METALS.length ? ' (Mott–Schottky figure rebuilt)' : ''}`;
    }
    labStatus.innerHTML = msg;
    btnPlot.disabled = !lab.metal;
  }

  // which panels each view shows, in order
  const LAYOUT = {
    curve: [pCurve, pBand],
    // Outline mode: J–V and the four-semiconductor plot get the full width
    jv: [pJV],
    four: [pFour],
    map: [pMap, pBand],
    lab: [pCV, pCurve],
  };
  function setView(v) {
    view = v;
    tabs.set(v);
    const shown = LAYOUT[v];
    for (const pn of mainPanels) pn.el.hidden = !shown.includes(pn);
    for (const pn of shown) fr.plots.append(pn.el);
    labRow.hidden = v !== 'lab';
    if (present) {
      roJ1.el.hidden = roJ0.el.hidden = v !== 'jv';
      roS.el.hidden = roJ.el.hidden = roSpread.el.hidden = v === 'jv';
    }
    fr.plots.className = `sim-plots ${v === 'lab' ? 'cols-2e' : shown.length > 1 ? 'cols-2' : ''}`;
    if (v === 'lab') measure(false);
    update(store.get());
  }

  let lastLabKey = '';
  function update(s) {
    const p = E.makeParams(s);
    const res = E.solveBarrier(p);
    const pType = res.doping === 'p';
    const bAl = E.barrier({ ...p, phiM: AL });
    const bs = METALS.map((m) => E.barrier({ ...p, phiM: m.phiM }));
    roB.setLabel(pType ? 'φ<sub>Bp</sub>' : 'φ<sub>Bn</sub>');
    roB.set(eV(res.phiB, 2));
    roS.set(num(res.gamma, 2));
    roP.el.hidden = res.ideal || !(p.Dit > 0);
    roP.set(eV(res.pivot, 2));
    roJ.set(times(E.currentRatio(res.phiB, bAl, p.T), 2));
    roSpread.set(times(E.currentRatio(Math.min(...bs), Math.max(...bs), p.T), 2));
    badges.set(res, presetNotes(s));
    gc.sync(s);
    mc.sync(s);
    bc.sync(s);
    // the course data (Mott–Schottky figure) exist only for n-type Si and GaAs
    const dataOK = !pType && Boolean(MOTT_SCHOTTKY[p.semi]);
    dataToggle.el.hidden = !dataOK;
    const m = metalAt(s.phiM);
    const overlay = showData && dataOK ? MOTT_SCHOTTKY[p.semi].points.map((q, k) => ({ phiM: q.phiM, phiB: q.phiB, label: q.metal, below: k % 2 === 1 })) : [];
    const labDots = view === 'lab' ? labPoints(s).map((q) => ({ phiM: q.phiM, phiB: q.phiB, color: 'var(--brand)', ring: 'var(--brand-ink)', r: 7 })) : [];
    curve.update({
      p,
      overlay,
      dots: [...labDots, { phiM: s.phiM, phiB: res.phiB, label: m ? m.id : null, left: pType ? s.phiM > 4.6 : s.phiM > 5.3 }],
      ideal: true,
      pinned: true,
      pivot: true,
    });
    if (view !== 'lab') band.update({ p, res, opts: { vac: false, W: false, arrows: false } });

    // J–V: S = 1 (Schottky–Mott, clipped to 0…E_g), S = 0 (Bardeen limit) and the solver's barrier
    if (!present || view === 'jv') {
      const b1 = Math.min(p.Eg, Math.max(0, E.schottkyMott(p)));
      const b0 = E.pinnedBarrier(p);
      roJ1.set(sci(E.currentRatio(res.phiB, b1, p.T), 2, { dropOne: false }));
      roJ0.set(sci(E.currentRatio(b0, b1, p.T), 2, { dropOne: false }));
      jv.update({
        T: p.T,
        Astar: p.Astar,
        curves: [
          { key: 's1', phiB: b1, label: `S = 1: ${num(b1, 2)} eV` },
          { key: 'cur', phiB: res.phiB, label: `present D_{it}: ${num(res.phiB, 2)} eV` },
          { key: 's0', phiB: b0, label: `S = 0: ${num(b0, 2)} eV` },
        ],
      });
      jvNote.innerHTML = `${pType ? 'Hole' : 'Electron'} current; the legend gives each barrier ${pType ? 'φ<sub>Bp</sub>' : 'φ<sub>Bn</sub>'}. T = ${Math.round(p.T)} K, ${astarNote(p)}. Series resistance and image-force lowering are ignored.`;
    }
    // four semiconductors at the same D_it (hence the same S)
    if (!present || view === 'four') {
      const ps = fourParams(s);
      // barrier rises with phi_m (n-type) or falls (p-type): the largest value is at one end
      const top = Math.max(...ps.map((q) => E.barrier({ ...q, phiM: pType ? 3.5 : 6 })));
      four.update({
        p: null,
        curves: ps.map((q) => ({ p: q, label: q.semi, color: FOUR_STYLE[q.semi].color, dash: FOUR_STYLE[q.semi].dash, cls: FOUR_STYLE[q.semi].cls, width: 3.5 })),
        xMarker: s.phiM,
        yRange: [0, Math.max(1.4, Math.ceil((top + 0.1) * 2) / 2)],
        yTitle: pType ? 'barrier φ_{Bp} (eV)' : 'barrier φ_{Bn} (eV)',
      });
      const sh = res.ideal ? 'Ideal interface: S = 1 for all four' : `D<sub>it</sub> = ${sci(p.Dit, 2)} cm⁻²eV⁻¹, so S = ${num(res.gamma, 2)} for all four`;
      fourNote.innerHTML = `${sh}; each uses its own χ, E<sub>g</sub> and φ<sub>0</sub>. ${pType ? 'p' : 'n'}-type, T = ${Math.round(p.T)} K.`;
    }
    if (view === 'map') {
      const g = barrierGrid(s);
      const pv = E.pivotWorkFunction(p);
      // colour scale 0–1.4 eV, widened for wide-gap semiconductors (GaN)
      const vmax = Math.max(1.4, Math.ceil(g.max * 2) / 2);
      const step = vmax > 2 ? 0.25 : 0.1;
      pMap.setSub(`numeric solver, contours every ${step} eV`);
      map.update({
        grid: g,
        yLog: true,
        vmin: 0,
        vmax,
        levels: E.rangeArray(step, vmax - step, Math.round(vmax / step) - 1),
        labelLevels: vmax > 2 ? [1, 1.5, 2, 2.5] : [0.5, 0.7, 0.9],
        labelRow: 0.55,
        fmtLevel: (v) => (step < 0.2 ? v.toFixed(1) : String(v)),
        vlines: p.Dit > 0 || s.preset !== 'ideal' ? [{ x: pv, label: `pivot ${num(pv, 2)} eV` }] : [],
        markers: [{ x: s.phiM, y: Math.max(s.Dit || SLIDER_RANGES.Dit.min, SLIDER_RANGES.Dit.min), label: null }],
        xTicks: [3.5, 4, 4.5, 5, 5.5, 6],
        xTitle: 'φ_{m} (eV)',
        yTitle: 'D_{it} (cm⁻²eV⁻¹)',
        legendTicks: [0, vmax / 2, vmax],
        legendFmt: (v) => (Number.isInteger(v * 10) ? v.toFixed(1) : v.toFixed(2)),
      });
    }
    if (view === 'lab') {
      const k = labKey(s) + s.phiM;
      if (k !== lastLabKey) {
        lastLabKey = k;
        measure(false);
      }
    }
  }

  const demoA = {
    label: 'Demo A',
    setup: () => {
      setView('curve');
      return { ...stateFor('si', 'Si', { phiM: AU }), preset: 'custom', Dit: 1e11 };
    },
    steps: [
      {
        dur: 4500,
        caption: 'Si, raising D<sub>it</sub>: the curve rotates about the pivot',
        live: (s) => {
          const p = E.makeParams(s);
          return `D<sub>it</sub> = ${sci(s.Dit, 2)} · S = ${num(E.gamma(p), 2)}`;
        },
        tracks: { Dit: [1e11, 1e13, 'log'] },
      },
      {
        dur: 4500,
        caption: '…and the current spread between the metals collapses',
        live: (s) => {
          const p = E.makeParams(s);
          const bs = METALS.map((m) => E.barrier({ ...p, phiM: m.phiM }));
          return `D<sub>it</sub> = ${sci(s.Dit, 2)} · S = ${num(E.gamma(p), 2)} · J spread ${times(E.currentRatio(Math.min(...bs), Math.max(...bs), p.T), 2)}`;
        },
        tracks: { Dit: [1e13, 1e15, 'log'] },
      },
    ],
  };
  const demoB = {
    label: 'Demo B',
    setup: () => {
      setView('map');
      return { ...stateFor('si', 'Si', { phiM: 3.6 }), preset: 'custom', Dit: 1e11 };
    },
    steps: [
      {
        dur: 4500,
        caption: 'Contours fan out from the pivot column (constant colour)',
        live: (s) => `φ<sub>m</sub> = ${num(s.phiM, 2)} eV`,
        tracks: { phiM: [3.6, 5.9, 'lin'] },
      },
      {
        dur: 4500,
        caption: '…and the map turns uniform at high D<sub>it</sub>: the metal stops mattering',
        live: (s) => `D<sub>it</sub> = ${sci(s.Dit, 2)} · φ<sub>Bn</sub> = ${num(E.barrier(E.makeParams(s)), 2)} eV`,
        tracks: { Dit: [1e11, 1e15, 'log'], phiM: [5.9, 4.4, 'lin'] },
      },
    ],
  };

  setView('curve');
  return {
    update,
    moreEl: band.moreEl,
    demos: [
      { id: 'A', label: 'Demo A', key: 'A', title: 'Si: sweep D<sub>it</sub> 10¹¹ → 10¹⁵', script: demoA },
      { id: 'B', label: 'Demo B', key: 'B', title: 'heatmap of φ<sub>B</sub> over φ<sub>m</sub> × D<sub>it</sub>', script: demoB },
    ],
  };
}

export default {
  id: 's3',
  num: 3,
  title: 'Pinning strength S and the experimental evidence',
  short: 'Pinning strength S',
  start: () => stateFor('si', 'Si', { phiM: AU }),
  content,
  sim,
  hooks: [{ id: 'mission', label: 'Mission', create: createMission }],
};
