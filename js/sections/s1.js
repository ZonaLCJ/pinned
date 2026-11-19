// Section 1. Interface states: a charge reservoir with a neutral level.
import { h } from '../ui/dom.js';
import * as E from '../engine.js';
import { stateFor, presetPatch, metalAt } from '../state.js';
import { metalById } from '../../data/materials.js';
import { TUNNEL_DECAY_NM } from '../../data/course-data.js';
import { simFrame, panel, viewTabs, badgeRow } from '../ui/sim-frame.js';
import { readout, boundControls, metalControl, globalControls, presetNotes } from '../ui/controls.js';
import { createLiveBand } from '../ui/live-band.js';
import { createBandPlot } from '../plots/band.js';
import { createChargeComparePlot } from '../plots/charge-compare.js';
import { createMigsPlot } from '../plots/migs.js';
import { num, signed, sci, eV, perCm2, pow10, sciTex } from '../ui/format.js';
import { createSignIt } from '../hooks/sign-it.js';
import { mythById } from '../hooks/myth-fact.js';

const AU = metalById('Au').phiM;

function content(F) {
  const more = `
<h4>Recap: the ideal Schottky–Mott contact</h4>
<p>In contact, electrons flow until the Fermi levels align. In the ideal Schottky–Mott picture the barrier is $\\phi_{B0} = \\phi_m - \\chi$: for Au on n-Si, ${num(F.idealAuSi.phiBn, 2)} eV.</p>
<h4>A charge reservoir in the gap</h4>
<ul>
<li>A density $D_{it}$ (cm⁻²eV⁻¹) of states sits in the gap at the interface, with a neutral level $E_0 = E_v + e\\phi_0$.</li>
<li>States above $E_0$ are acceptor-like: neutral when empty, negative when filled.</li>
<li>States below $E_0$ are donor-like: neutral when filled, positive when empty.</li>
<li>Net result: $Q_{ss} = -eD_{it}(E_F - E_0)$.</li>
</ul>
<h4>Where they come from</h4>
<ul>
<li>Dangling bonds and defects (Bardeen, 1947).</li>
<li>Metal-induced gap states, MIGS (Heine, 1965; Tersoff, 1984).</li>
<li>MIGS link to the tunnelling lecture: metal wavefunctions at gap energies decay evanescently into the semiconductor, $\\psi \\propto e^{-x/${TUNNEL_DECAY_NM}\\,\\mathrm{nm}}$, as on the course tunnelling slide. So even a perfect, defect-free interface has gap states.</li>
</ul>
<h4>Sign rule</h4>
<p>Negative interface charge raises the barrier; positive charge lowers it. Either way the barrier is pulled toward the pinned value $E_g - e\\phi_0$.</p>
<h4>Why the interface wins</h4>
<p>At $D_{it} = 10^{13}$ cm⁻²eV⁻¹ the interface supplies about $${sciTex(F.dit13, 1)}$ e/cm² per eV of $E_F - E_0$. The whole depletion region of n-Si at $N_d = ${sciTex(F.Nd, 1)}$ cm⁻³ holds only about $${sciTex(F.pinnedQscCm, 2)}$ e/cm².</p>
<h4>Derivation</h4>
$$Q_{ss} = -e\\int_{E_0}^{E_F} D_{it}\\,dE = -e\\,D_{it}\\,(E_F - E_0)$$
$$E_F - E_0 = E_g - e\\phi_0 - e\\phi_{Bn}\\quad\\text{(at the interface)}$$
<h4>Assumptions</h4>
<ul><li>Uniform $D_{it}$ with a single neutral level.</li><li>States below $E_F$ filled, above empty.</li><li>The states share the metal's $E_F$.</li></ul>`;

  return {
    takeaway: 'Interface states are a far cheaper charge source than the depletion region; that is why they can take over.',
    keyEq: 'Q_{ss} = -e\\,D_{it}\\,(E_F - E_0)',
    idle: 'Contact: ideal barrier. Demo A: flip the sign of Q<sub>ss</sub>. Demo B: raise D<sub>it</sub>.',
    more,
    simTitle: 'Interface states and charge',
    concept: `
<h4>Recap: the ideal Schottky–Mott contact</h4>
<p>Bring a metal into contact with n-type semiconductor and electrons flow from the semiconductor into the metal until the Fermi levels align. The bands bend and a barrier appears. In the ideal Schottky–Mott picture its height is $\\phi_{B0} = \\phi_m - \\chi$; for Au on n-Si that is ${num(F.idealAuSi.phiBn, 2)} eV. Press <em>Contact</em> in the simulation to replay this, then switch on interface states.</p>
<h4>A charge reservoir with a neutral level</h4>
<p>A real interface carries a density $D_{it}$ (states per cm² per eV) of electronic states inside the gap. They are described by a neutral level $E_0 = E_v + e\\phi_0$:</p>
<ul>
<li>States above $E_0$ are <strong>acceptor-like</strong>: neutral when empty, negative when filled.</li>
<li>States below $E_0$ are <strong>donor-like</strong>: neutral when filled, positive when empty.</li>
</ul>
<p>So only the states between $E_0$ and $E_F$ carry net charge, and $Q_{ss} = -eD_{it}(E_F - E_0)$. In the diagram, filled acceptor-like states are teal (negative) and empty donor-like states are red (positive).</p>
<h4>Where the states come from</h4>
<ul>
<li><strong>Dangling bonds and defects</strong> at the surface (Bardeen, 1947).</li>
<li><strong>Metal-induced gap states (MIGS)</strong> (Heine, 1965; Tersoff, 1984). Metal wavefunctions at energies inside the semiconductor gap cannot propagate there, so they decay evanescently, $\\psi \\propto e^{-x/${TUNNEL_DECAY_NM}\\,\\mathrm{nm}}$, exactly the decay on the course tunnelling slide. Their tails are gap states at the interface. So even a perfect, defect-free interface has gap states.</li>
</ul>
<h4>Sign rule</h4>
<p>Negative interface charge raises the barrier and positive charge lowers it. Either way, the barrier is pulled toward the pinned value $E_g - e\\phi_0$.</p>
<h4>Why interface states can take over</h4>
<p>At $D_{it} = 10^{13}$ cm⁻²eV⁻¹ the interface supplies about $${sciTex(F.dit13, 1)}$ e/cm² for every eV that $E_F$ moves away from $E_0$. The <em>whole</em> depletion region of n-Si at $N_d = ${sciTex(F.Nd, 1)}$ cm⁻³ holds only about $${sciTex(F.pinnedQscCm, 2)}$ e/cm². Shifting $E_F - E_0$ by a few tens of meV is a far cheaper way to supply charge than bending the bands further. The log-scale charge plot shows this directly.</p>`,
    derivation: `
<h4>Derivation: net interface charge</h4>
<p>With a uniform $D_{it}$ and the states below $E_F$ filled, only the states between $E_0$ and $E_F$ differ from the neutral situation $E_F = E_0$:</p>
$$Q_{ss} = -e\\int_{E_0}^{E_F} D_{it}\\,dE = -e\\,D_{it}\\,(E_F - E_0)$$
<p>At the interface $E_c - E_F = e\\phi_{Bn}$ and $E_0 = E_v + e\\phi_0$, so</p>
$$E_F - E_0 = E_g - e\\phi_0 - e\\phi_{Bn}.$$`,
    assumptions: ['Uniform $D_{it}$ with a single neutral level $E_0$.', 'States below $E_F$ are filled and states above it are empty.', 'The interface states share the Fermi level of the metal.'],
    tryThis: [
      'Press <em>Contact</em> (Ideal preset): watch the Fermi levels align and the ideal barrier $\\phi_m - \\chi$ appear.',
      'Si preset: tap Al, then Au. For Al, $E_F$ sits above $E_0$ (teal, negative states); for Au, below it (red, positive).',
      `Drag $\\phi_m$ to the pivot, ${num(F.siPivot, 2)} eV: $E_F$ lands on $E_0$ and the interface is neutral.`,
      'Watch the charge plot while you drag $D_{it}$ from $10^{12}$ to $10^{14}$: the thick curve climbs far above the depletion charge.',
      `Open the MIGS view: |ψ|² falls to 1% within ${num((TUNNEL_DECAY_NM / 2) * Math.log(100), 1)} nm of the interface.`,
    ],
    misconceptions: [mythById(2)].map((m) => `<strong>${m.answer === 'myth' ? 'Myth' : 'Fact'}:</strong> “${m.text}” ${m.why}`),
  };
}

function sim(root, ctx) {
  const { store, mode } = ctx;
  const present = mode === 'present';
  const fr = simFrame(root, ctx, { plotsClass: 'cols-2' });

  // readouts
  const roB = readout('φ<sub>Bn</sub>', { key: true });
  const roIdeal = readout('φ<sub>m</sub> − χ');
  const roOff = readout('E<sub>F</sub> − E<sub>0</sub>');
  const roQss = readout('Q<sub>ss</sub>');
  const roQsc = readout('Q<sub>sc</sub>');
  fr.top.append(roB.el, roIdeal.el, roOff.el, roQss.el, roQsc.el);

  // plots
  const pBand = panel('Band diagram with interface states');
  const band = createLiveBand(pBand.body, ctx);
  const badges = badgeRow(pBand.el.querySelector('.panel-title'));
  const pRight = panel('');
  const rightBody = pRight.body;
  const ccHost = h('div', { class: 'view-cc' });
  const migsHost = h('div', { class: 'view-migs', hidden: true });
  rightBody.append(ccHost, migsHost);
  const cc = createChargeComparePlot(ccHost);
  const migs = createMigsPlot(migsHost);
  for (const el of [pBand.body, rightBody, ccHost, migsHost]) Object.assign(el.style, { flex: '1 1 auto', minHeight: '0', display: 'flex', flexDirection: 'column' });
  fr.plots.append(pBand.el, pRight.el);

  let view = 'cc';
  const tabSeg = h('div', { class: 'seg tabs', role: 'group', 'aria-label': 'Right panel view' });
  const tabBtn = (v, label) =>
    h('button', { type: 'button', class: 'btn', 'aria-pressed': String(v === view), onclick: () => setView(v), dataset: { value: v } }, label);
  tabSeg.append(tabBtn('cc', present ? 'Charge' : 'Interface vs depletion charge'), tabBtn('migs', present ? 'MIGS' : 'MIGS wavefunction'));
  pRight.el.querySelector('.panel-title').replaceChildren(tabSeg);
  function setView(v) {
    view = v;
    ccHost.hidden = v !== 'cc';
    migsHost.hidden = v !== 'migs';
    for (const b of tabSeg.children) b.setAttribute('aria-pressed', String(b.dataset.value === v));
    update(store.get());
  }

  // controls
  const gc = globalControls(store, { present });
  const mc = metalControl(store);
  const bc = boundControls(store, present ? ['phiM', 'Dit'] : ['phiM', 'Dit', 'delta', 'phi0']);
  fr.controls.append(
    ...gc.rows,
    h('div', { class: 'ctl-row' }, mc.el),
    h('div', { class: 'sliders' }, bc.els),
  );

  function update(s) {
    const p = E.makeParams(s);
    const res = E.solveBarrier(p);
    const hasStates = !res.ideal && p.Dit > 0;
    const pType = res.doping === 'p';
    roB.setLabel(pType ? 'φ<sub>Bp</sub>' : 'φ<sub>Bn</sub>');
    roB.set(eV(res.phiB, 2));
    roIdeal.setLabel(pType ? 'E<sub>g</sub> + χ − φ<sub>m</sub>' : 'φ<sub>m</sub> − χ');
    roIdeal.set(eV(res.sm, 2));
    roIdeal.el.hidden = present && hasStates;
    roOff.el.hidden = !hasStates;
    roQss.el.hidden = !hasStates;
    roOff.set(`${signed(res.EFmE0, 2)} eV`);
    roQss.set((res.QssCm > 0 ? '+' : '') + perCm2(res.QssCm), res.QssCm > 0 ? 'pos' : res.QssCm < 0 ? 'neg' : null);
    roQsc.set(perCm2(res.QscCm));
    badges.set(res, [...(res.ideal ? [['info', 'ideal: no interface states']] : []), ...presetNotes(s)]);
    gc.sync(s);
    mc.sync(s);
    bc.sync(s);
    band.update({ p, res, opts: { vac: false, anim: s.anim, arrows: false } });
    if (view === 'cc') cc.update({ p, res });
    else migs.update({ decayNm: TUNNEL_DECAY_NM });
  }

  // ---- demos
  const contact = {
    label: 'Contact',
    setup: () => ({ ...stateFor('ideal', 'Si', { phiM: AU }), anim: { sep: 1, bend: 0 } }),
    steps: [
      {
        dur: 2300,
        caption: (s) => {
          const p = E.makeParams(s);
          const r = E.solveBarrier(p);
          return `Apart: the n-Si Fermi level sits ${num(r.Vbi, 2)} eV above the metal's`;
        },
        update: (u) => ({ anim: { sep: 1 - u, bend: 0 } }),
      },
      { dur: 3600, caption: 'Contact: electrons flow to the metal, Fermi levels align, bands bend', update: (u) => ({ anim: { sep: 0, bend: u } }) },
      {
        dur: 1700,
        caption: (s) => `Ideal (Schottky–Mott) barrier: φ<sub>B0</sub> = φ<sub>m</sub> − χ = ${num(E.solveBarrier(E.makeParams(s)).phiBn, 2)} eV`,
        update: () => ({ anim: { sep: 0, bend: 1 } }),
      },
      {
        dur: 2800,
        caption: 'Now add interface states (Si preset)',
        live: (s) => `D<sub>it</sub> = ${sci(s.Dit, 2)} → φ<sub>Bn</sub> = ${num(E.barrier(E.makeParams(s)), 2)} eV`,
        update: (u) => {
          const target = E.presetInterface('si').Dit;
          return { anim: null, preset: 'custom', delta: 0.5, phi0: 0.45, Dit: 10 ** (11 + u * (Math.log10(target) - 11)) };
        },
      },
    ],
    done: (s) => ({ ...presetPatch(s, 'si'), anim: null }),
    doneCaption: (s) => {
      const p = E.makeParams(s);
      return `Si preset: φ<sub>Bn</sub> = ${num(E.barrier(p), 2)} eV instead of the ideal ${num(p.phiM - p.chi, 2)} eV`;
    },
  };
  const demoA = {
    label: 'Demo A',
    setup: (s) => {
      setView('cc');
      return { ...stateFor('si', 'Si', { phiM: s.phiM }), anim: null };
    },
    steps: [
      {
        dur: 8000,
        ease: 'linear',
        caption: 'E<sub>F</sub> − E<sub>0</sub> from −0.3 to +0.3 eV: Q<sub>ss</sub> passes through zero, flips sign',
        live: (s) => {
          const r = E.solveBarrier(E.makeParams(s));
          return `E<sub>F</sub> − E<sub>0</sub> = ${signed(r.EFmE0, 2)} eV · Q<sub>ss</sub> = ${sci(r.QssCm, 2)}`;
        },
        update: (u) => {
          const p = E.makeParams(stateFor('si', 'Si', { phiM: 5 }));
          return { phiM: Math.round(E.phiMForOffset(p, -0.3 + 0.6 * u) * 1000) / 1000 };
        },
      },
    ],
  };
  const demoB = {
    label: 'Demo B',
    setup: () => {
      setView('cc');
      return { ...stateFor('si', 'Si', { phiM: AU }), preset: 'custom', Dit: 1e12, anim: null };
    },
    steps: [
      {
        dur: 8000,
        caption: 'Raising D<sub>it</sub>… E<sub>F</sub> locks to E<sub>0</sub>; |Q<sub>ss</sub>| climbs far above Q<sub>sc</sub>',
        live: (s) => {
          const r = E.solveBarrier(E.makeParams(s));
          return `D<sub>it</sub> = ${sci(s.Dit, 2)} · |Q<sub>ss</sub>| = ${sci(Math.abs(r.QssCm), 2)} vs Q<sub>sc</sub> = ${sci(r.QscCm, 2)}`;
        },
        tracks: { Dit: [1e12, 1e14, 'log'] },
      },
    ],
  };

  return {
    update,
    moreEl: band.moreEl,
    demos: [
      { id: 'C', label: 'Contact', key: 'C', title: 'ideal contact forms, then add interface states', script: contact },
      { id: 'A', label: 'Demo A', key: 'A', title: 'sweep E<sub>F</sub> − E<sub>0</sub> through zero', script: demoA },
      { id: 'B', label: 'Demo B', key: 'B', title: 'raise D<sub>it</sub> from 10¹² to 10¹⁴', script: demoB },
    ],
  };
}

export default {
  id: 's1',
  num: 1,
  title: 'Interface states: a charge reservoir with a neutral level',
  short: 'Interface states',
  start: () => stateFor('ideal', 'Si', { phiM: AU }),
  content,
  sim,
  hooks: [{ id: 'signit', label: 'Sign it!', create: createSignIt }],
};
