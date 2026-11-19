// "Symbols" overlay (S key / header button, both modes): every symbol and plot marking on the
// site with its meaning, unit and where it appears. Meanings follow engine.js; the few numbers
// (kT at 300 K, V_FB, the MIGS decay length) are read from the engine and the data files.
// Plot-marking swatches reuse the exact colours and dash patterns of js/plots/*.js.
import { h } from './ui/dom.js';
import { tex, mathify } from './ui/math.js';
import { openOverlay } from './overlay.js';
import { thermalVoltage } from './engine.js';
import { DEFAULTS, MOS } from '../data/materials.js';
import { TUNNEL_DECAY_NM, DIGITIZED_LABEL } from '../data/course-data.js';
import { BRAND_RAMP } from './plots/svg.js';
import { num, sciTex } from './ui/format.js';
import { presetNotes } from './ui/controls.js';
import { TARGET as RHO_TARGET } from './hooks/build-contact.js';

// ---------------------------------------------------------------- swatches (inline SVG)
const W = 56;
const H = 22;
const M = H / 2;
const svg = (inner) => `<svg class="sym-swatch" viewBox="0 0 ${W} ${H}" aria-hidden="true">${inner}</svg>`;
const ln = (stroke, { width = 3, dash = null, cap = 'butt', y = M } = {}) =>
  `<line x1="3" y1="${y}" x2="${W - 3}" y2="${y}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="${cap}"/>`;
const box = (fill, { stroke = 'none', sw = 0, opacity = 1, x = 6, w = W - 12, y = 3, hh = H - 6, rx = 3 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
const dot = (fill, { stroke = 'var(--surface)', sw = 2, r = 6, cx = W / 2 } = {}) => `<circle cx="${cx}" cy="${M}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const SW = {
  line: (stroke, o) => svg(ln(stroke, o)),
  fill: (fill, o) => svg(box(fill, o)),
  dot: (fill, o) => svg(dot(fill, o)),
  hollow: (stroke) => svg(dot('var(--surface)', { stroke, sw: 3 })),
  ring: (stroke, fill = 'var(--surface)') => svg(dot(fill, { stroke, sw: 3, r: 7 })),
  cross: () => svg(`<path d="M${W / 2 - 6},${M - 6}L${W / 2 + 6},${M + 6}M${W / 2 - 6},${M + 6}L${W / 2 + 6},${M - 6}" stroke="var(--text)" stroke-width="3"/>`),
  arrowUp: (stroke, dash) => svg(`${ln(stroke, { dash, width: 3, y: M + 4 })}<path d="M${W - 12},${M - 2}L${W - 4},${M + 4}L${W - 12},${M + 10}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>`),
  arrowDown: (stroke) => svg(`<path d="M${W / 2},3V${H - 3}M${W / 2 - 6},${H - 9}L${W / 2},${H - 3}L${W / 2 + 6},${H - 9}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`),
  vArrow: (stroke) => svg(`<path d="M${W / 2},3V${H - 3}M${W / 2 - 5},8L${W / 2},3L${W / 2 + 5},8M${W / 2 - 5},${H - 8}L${W / 2},${H - 3}L${W / 2 + 5},${H - 8}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>`),
  ramp: () => {
    const stops = [0, 0.25, 0.5, 0.75, 1].map((u) => `<stop offset="${u}" stop-color="rgb(${BRAND_RAMP(u).join(',')})"/>`).join('');
    return svg(`<defs><linearGradient id="sym-ramp">${stops}</linearGradient></defs>${box('url(#sym-ramp)', { stroke: 'var(--border)', sw: 1 })}`);
  },
  hatch: () =>
    svg(
      `<defs><pattern id="sym-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--surface)"/><line x1="0" y1="0" x2="0" y2="8" stroke="var(--brand-ink)" stroke-width="3"/></pattern></defs>${box('url(#sym-hatch)', { stroke: 'var(--brand-ink)', sw: 2 })}`,
    ),
  bracket: () => svg(`<line x1="4" y1="${M}" x2="${W - 6}" y2="${M}" stroke="var(--brand-ink)" stroke-width="1.5"/><line x1="${W - 6}" y1="${M - 5}" x2="${W - 6}" y2="${M + 6}" stroke="var(--brand-ink)" stroke-width="1.5"/>`),
  badge: (cls, text) => `<span class="badge ${cls}">${text}</span>`,
};

// ---------------------------------------------------------------- rows
// [symbol (TeX), meaning (HTML, $…$ allowed), unit, where it appears, extra search words]
const T300 = DEFAULTS.T;
const kT300 = num(thermalVoltage(T300), 4);

function groups() {
  return [
    {
      title: 'Energy levels',
      rows: [
        ['E_c', 'conduction-band edge', 'eV', 'Intro, 1–4, MOS'],
        ['E_v', 'valence-band edge', 'eV', 'Intro, 1–4, MOS'],
        ['E_g', 'band gap, $E_c - E_v$', 'eV', '1–4'],
        ['E_F', 'Fermi level, one flat line in equilibrium', 'eV', 'Intro, 1–4, MOS'],
        ['E_{F,\\mathrm{gate}}', 'Fermi level of the gate, $E_F - qV_G$ (dashed line in the gate)', 'eV', 'MOS'],
        ['E_0', 'interface neutral level (charge-neutrality level, CNL), $E_v + e\\phi_0$', 'eV', '1–3', 'cnl'],
        ['E_{\\mathrm{vac}}', 'vacuum level', 'eV', '1, 2'],
        ['E_i', 'intrinsic level at midgap', 'eV', 'MOS'],
        ['kT', `thermal energy, ${kT300} eV at ${T300} K`, 'eV', '1–4, MOS'],
      ],
    },
    {
      title: 'Work functions, barriers and potentials',
      rows: [
        ['\\phi_m', 'metal work function, $E_{\\mathrm{vac}} - E_F$ in the metal', 'eV', 'Intro, 1–4'],
        ['\\chi', 'electron affinity, $E_{\\mathrm{vac}} - E_c$', 'eV', 'Intro, 1–4'],
        ['\\phi_{B0}', 'ideal Schottky–Mott barrier, $\\phi_m - \\chi$', 'eV', 'Intro, 1'],
        ['\\phi_B', 'barrier height in general ($\\phi_{Bn}$ or $\\phi_{Bp}$, whichever applies)', 'eV', '3, 4'],
        ['\\phi_{Bn}', 'barrier for electrons, $E_c - E_F$ at the interface', 'eV', '1–4'],
        ['\\phi_{Bp}', 'barrier for holes, $E_F - E_v$ at the interface', 'eV', '1–3'],
        ['\\phi_0', 'neutral level measured from $E_v$', 'eV', '1–3'],
        ['E_g - \\phi_0', 'pinned (Bardeen-limit) barrier', 'eV', '1–3', 'bardeen'],
        ['\\phi_m^*', 'pivot work function, $\\chi + E_g - \\phi_0$', 'eV', '3', 'pivot'],
        ['\\phi_n', '$E_c - E_F$ in the n-type bulk, $(kT/q)\\ln(N_c/N_d)$', 'eV', '1–4'],
        ['\\phi_p', '$E_F - E_v$ in the p-type bulk, $(kT/q)\\ln(N_v/N_A)$', 'eV', '1–3'],
        ['V_{bi}', 'built-in voltage, the total band bending', 'V', '1–4'],
        ['\\Delta V_{ox}', 'potential drop across the interfacial layer, i.e. the interface dipole', 'V', '2'],
        ['V,\\ V_R', 'applied forward / reverse bias', 'V', '3, 4'],
      ],
    },
    {
      title: 'Interface and material parameters',
      rows: [
        ['D_{it}', 'density of interface states', 'cm⁻² eV⁻¹', '1–4, MOS'],
        ['D_{it,\\mathrm{eff}}', 'D<sub>it</sub> reduced by an interlayer, $D_{it}\\,e^{-t/\\lambda}$', 'cm⁻² eV⁻¹', '4'],
        ['S\\ (=\\gamma)', 'pinning factor, $d\\phi_B/d\\phi_m = \\varepsilon_i/(\\varepsilon_i + e^2\\delta D_{it})$', '—', '1–4', 'gamma pinning factor'],
        ['S_{\\mathrm{eff}}', 'pinning factor computed with $D_{it,\\mathrm{eff}}$', '—', '4'],
        ['\\delta', 'interfacial layer thickness', 'nm', '1–3'],
        ['C_i', 'capacitance of the interfacial layer per area, $\\varepsilon_i/\\delta$', 'F/m²', 'MOS'],
        ['\\varepsilon_i,\\ \\varepsilon_{r,i}', 'permittivity / relative permittivity of the interfacial layer', 'F/m / —', '1–3'],
        ['\\varepsilon_s,\\ \\varepsilon_{r,s}', 'permittivity / relative permittivity of the semiconductor', 'F/m / —', '1–4, MOS'],
        ['\\varepsilon_0', 'vacuum permittivity', 'F/m', '2, 3'],
        ['N_d,\\ N_A', 'donor / acceptor density', 'cm⁻³', '1–4, MOS'],
        ['N_c,\\ N_v', 'effective density of states in the conduction / valence band', 'cm⁻³', '1–4'],
        ['n_i', 'intrinsic carrier density', 'cm⁻³', 'MOS'],
        ['p_{p0},\\ n_{p0}', 'equilibrium hole / electron density in the p-type bulk ($N_A$ and $n_i^2/N_A$)', 'cm⁻³', 'MOS'],
        ['T', 'temperature', 'K', '1–4'],
        ['W', 'depletion width', 'nm', '1–4'],
        ['x', 'depth into the semiconductor (band-diagram axis)', 'nm', 'Intro, 1–4, MOS'],
        ['e\\ (q)', 'elementary charge', 'C', 'all'],
        ['\\hbar,\\ k_B,\\ m_0', 'reduced Planck constant, Boltzmann constant, free-electron mass', 'J s, J/K, kg', '4'],
      ],
    },
    {
      title: 'Charges',
      rows: [
        ['Q_m', 'charge on the metal', 'e/cm²', '2'],
        ['Q_{ss}', 'interface-state charge, $-eD_{it}(E_F - E_0)$', 'e/cm²', '1, 2'],
        ['Q_{sc}', 'depletion (space) charge', 'e/cm²', '1, 2'],
        ['Q_s,\\ Q_{it}', 'semiconductor and interface charge in the MOS section', 'C/m²', 'MOS'],
      ],
    },
    {
      title: 'Current and contacts',
      rows: [
        ['J', 'current density', 'A/cm²', '3, 4'],
        ['J_s', 'saturation current density, $A^*T^2\\exp(-e\\phi_B/kT)$', 'A/cm²', '3'],
        ['J/J_{\\mathrm{Al}}', 'current relative to an Al contact on the same semiconductor (readout)', '—', '3'],
        ['A^*', 'Richardson constant', 'A cm⁻² K⁻²', '3, 4', 'richardson'],
        ["C,\\ 1/C^2", 'depletion capacitance in the C–V lab', 'F/cm², cm⁴/F²', '3'],
        ['\\rho_c', 'specific contact resistivity', 'Ω·cm²', '4', 'rho'],
        ['t', 'deliberate interlayer thickness', 'nm', '4'],
        ['\\lambda', 'MIGS blocking length', 'nm', '4'],
        ['\\kappa', 'tunnelling decay constant of the interlayer', 'nm⁻¹', '4'],
        ['e^{2\\kappa t}', 'tunnelling penalty of the interlayer', '—', '4'],
        ['E_{00}', 'characteristic tunnelling energy', 'meV', '4'],
        ["E_0'", 'effective energy that replaces kT, $E_{00}\\coth(E_{00}/kT)$', 'meV', '4'],
        ['m^*_t', 'tunnelling effective mass', 'm₀', '4'],
        ['\\psi', `electron wavefunction in the MIGS panel, $\\psi \\propto e^{-x/${TUNNEL_DECAY_NM}\\,\\mathrm{nm}}$`, '—', '1'],
      ],
    },
    {
      title: 'MOS (“Going further”)',
      rows: [
        ['V_G', 'gate voltage', 'V', 'MOS'],
        ['V_{FB}', `flat-band voltage, ${MOS.VFB} here`, 'V', 'MOS'],
        ['V_T', 'threshold voltage, where $\\psi_s = 2\\phi_F$', 'V', 'MOS'],
        ['\\psi_s', 'surface potential, the band bending at the oxide interface', 'V', 'MOS'],
        ['\\phi_F', 'Fermi potential, $(kT/q)\\ln(N_A/n_i)$', 'V', 'MOS'],
        ['C_{ox}', 'oxide capacitance per area, $\\varepsilon_{ox}/t_{ox}$', 'F/m²', 'MOS'],
        ['\\varepsilon_{ox}', 'permittivity of the gate oxide', 'F/m', 'MOS'],
        ['C_s', 'semiconductor capacitance', 'F/m²', 'MOS'],
        ['t_{ox}', 'oxide thickness', 'nm', 'MOS'],
        ['L_D', 'Debye length', 'nm', 'MOS'],
        ['F', 'dimensionless field function in the exact $Q_s$ formula', '—', 'MOS'],
      ],
    },
    {
      title: 'Abbreviations',
      text: true,
      rows: [
        ['MIGS', 'metal-induced gap states', '', '1, 4'],
        ['CNL', 'charge-neutrality level (= $E_0$)', '', '1–3'],
        ['MIS', 'metal–insulator–semiconductor contact', '', '4'],
        ['TFE', 'thermionic-field emission', '', '4'],
      ],
    },
    // ------------------------------------------------------------ plot markings
    {
      title: 'Plot markings: band diagrams',
      swatch: true,
      rows: [
        [SW.line('var(--c-band)'), '$E_c$ and $E_v$ (solid)', '', 'Intro, 1–4, MOS', 'band edge'],
        [SW.line('var(--c-ef)', { dash: '9 6' }), '$E_F$ (dashed)', '', 'Intro, 1–4, MOS', 'fermi'],
        [SW.line('var(--c-e0)', { dash: '12 4.8 2.4 4.8' }), '$E_0$, the neutral level (dash-dot)', '', '1–3', 'neutral cnl'],
        [SW.line('var(--c-vac)', { dash: '1 6', cap: 'round' }), '$E_{\\mathrm{vac}}$, the vacuum level (dotted, on a broken axis)', '', '1, 2', 'vacuum'],
        [SW.line('var(--text-muted)', { width: 2, dash: '2 5' }), '$E_i$ at midgap (dotted grey)', '', 'MOS'],
        [SW.fill('var(--c-metal)'), 'metal block (labelled with the metal); gate and contacts in the chip drawings', '', 'Intro, 1–4, MOS'],
        [SW.fill('#f4f5fb', { stroke: 'var(--border)', sw: 1.5, x: 22, w: 12 }), '“δ (enlarged)” strip: the interfacial layer, drawn wider than scale', '', '1–4', 'delta'],
        [SW.fill('#fbf6e9', { stroke: 'var(--text-muted)', sw: 1.5, x: 20, w: 16 }), 'gate oxide (SiO₂, not to scale)', '', 'Intro, MOS'],
        [SW.fill('var(--brand-tint)'), 'depletion region (shaded, width $W$)', '', '1–4, MOS'],
        [SW.fill('var(--c-valence-fill)', { stroke: 'var(--border)', sw: 1 }), 'filled valence band (below $E_v$)', '', '1–4'],
        [SW.bracket(), '$W$ bracket: depletion width', '', '1, 3, 4'],
        [SW.vArrow('var(--text)'), '$\\phi_{Bn}$ / $\\phi_{Bp}$, $\\phi_m$, $\\chi$ arrows; broken arrows span the axis break', '', 'Intro, 1–4'],
        [SW.vArrow('var(--brand-ink)'), '$\\Delta V_{ox}$ arrow across δ; $\\psi_s$ arrow in the MOS diagram', '', '2, MOS'],
      ],
    },
    {
      title: 'Plot markings: interface states and carriers',
      swatch: true,
      rows: [
        [SW.line('var(--c-neg)', { width: 3.5, cap: 'round' }), 'interface-state rung holding negative charge (filled acceptor-like state between $E_0$ and $E_F$)', '', '1–4', 'ladder negative'],
        [SW.line('var(--c-pos)', { width: 3.5, cap: 'round' }), 'interface-state rung holding positive charge (empty donor-like state between $E_F$ and $E_0$)', '', '1–4', 'ladder positive'],
        [SW.line('#5a5f7a', { width: 3.5, cap: 'round' }) + SW.line('#c3c7de', { width: 3.5, cap: 'round' }), 'neutral rungs: filled (dark) below $E_F$, empty (light) above', '', '1–4', 'ladder neutral'],
        [SW.fill('var(--c-neg)', { opacity: 0.18 }) + SW.fill('var(--c-pos)', { opacity: 0.18 }), 'shaded window between $E_0$ and $E_F$: net negative (teal) or positive (red) interface charge', '', '1–4'],
        [SW.dot('var(--c-neg)', { sw: 1.5 }), 'electron (filled dot), moving in the conduction band; also the electrons of the chip and contact animations', '', 'Intro, 1–4', 'carrier'],
        [SW.hollow('var(--c-pos)'), 'hole (hollow dot), moving in the valence band (p-type)', '', '1–3', 'carrier'],
      ],
    },
    {
      title: 'Plot markings: barrier vs work function (φB–φm)',
      swatch: true,
      rows: [
        [SW.line('var(--text-muted)', { width: 2, dash: '7 5' }), 'S = 1, Schottky–Mott (dashed, clipped to 0…$E_g$)', '', '1, 3', 'ideal'],
        [SW.line('var(--c-e0)', { width: 2.5, dash: '2 5', cap: 'round' }), 'S = 0, Bardeen limit $E_g - \\phi_0$ (dotted)', '', '3', 'bardeen pinned'],
        [SW.line('var(--brand-ink)', { width: 3.5 }), 'present curve from the numeric solver (solid)', '', '1, 3'],
        [SW.dot('var(--text-muted)', { r: 7, sw: 2.5 }), '“ideal” dot: $\\phi_m - \\chi$ (Sign it!)', '', '1 quiz'],
        [SW.dot('var(--brand-ink)', { r: 7, sw: 2.5 }), '“real” dot / the present metal', '', '1, 3'],
        [SW.cross(), 'course-data point (Mott–Schottky figure, digitized)', '', '3', 'data'],
        [SW.ring('var(--c-e0)'), 'pivot $\\phi_m^*$, where the S = 1 and S = 0 lines cross', '', '3', 'pivot'],
        [SW.fill('var(--brand-tint)') + SW.line('var(--brand-ink)', { width: 2, dash: '6 4' }), 'Mission target band: $\\phi_{Bn} \\le$ target', '', '3 quiz', 'mission'],
        [SW.dot('var(--brand-ink)', { r: 7, sw: 2.5 }) + SW.dot('#a7abc6', { r: 7, sw: 2.5 }), 'Mission picks: hit (dark) and miss (grey)', '', '3 quiz', 'mission'],
        [SW.dot('var(--brand)', { stroke: 'var(--brand-ink)', r: 7, sw: 2.5 }), 'your C–V lab measurements', '', '3', 'lab'],
        [SW.line('var(--brand-ink)', { width: 2, dash: '3 4' }), 'current $\\phi_m$ (vertical dashed marker)', '', '3, 4'],
        [SW.line('var(--text)', { width: 3 }), 'MoS₂ panel: evaporated contacts', '', '4'],
        [SW.line('var(--brand-ink)', { width: 3, dash: '10 6' }), 'MoS₂ panel: van der Waals-transferred contacts', '', '4'],
        [SW.line('var(--text-muted)', { width: 5, dash: '2 7' }), 'MoS₂ panel: Bi semimetal contacts', '', '4'],
      ],
    },
    {
      title: 'Plot markings: J–V and four semiconductors',
      swatch: true,
      rows: [
        [SW.line('var(--text)', { dash: '9 6', cap: 'round' }), 'J–V: S = 1 barrier (dashed)', '', '3'],
        [SW.line('var(--c-e0)', { dash: '1 6', cap: 'round' }), 'J–V: S = 0 barrier (dotted)', '', '3'],
        [SW.line('var(--brand-ink)', { width: 4 }), 'J–V: present $D_{it}$ (solid)', '', '3'],
        [SW.arrowUp('var(--brand-ink)'), 'arrow: the curve leaves the plotted range at the top', '', '3', 'off range'],
        [SW.arrowDown('var(--text)'), 'down arrow at the bottom: the whole curve lies below the range (“below scale”)', '', '3', 'off range'],
        [SW.line('var(--brand-ink)', { width: 3.5, cap: 'round' }), 'Si', '', '3', 'four semiconductors'],
        [SW.line('var(--c-pos)', { width: 3.5, dash: '11 5', cap: 'round' }), 'GaAs', '', '3', 'four semiconductors'],
        [SW.line('var(--c-neg)', { width: 3.5, dash: '2 6', cap: 'round' }), 'Ge', '', '3', 'four semiconductors'],
        [SW.line('var(--c-e0)', { width: 3.5, dash: '12 4 3 4', cap: 'round' }), 'GaN', '', '3', 'four semiconductors'],
        [SW.line('var(--brand-ink)', { width: 3.5 }), 'I–V curve of the contact', '', '4'],
      ],
    },
    {
      title: 'Plot markings: heatmaps and contact resistivity',
      swatch: true,
      rows: [
        [SW.ramp(), 'heatmap colour: low (light) to high (dark) value of $\\phi_B$ or $\\log_{10}\\rho_c$', '', '3, 4', 'heatmap'],
        [SW.line('rgba(29,32,64,0.55)', { width: 1.5 }) + SW.line('rgba(255,255,255,0.85)', { width: 1.5 }), 'contour lines (dark on light colours, white on dark colours), labelled with their value', '', '3, 4', 'heatmap contour'],
        [SW.line('var(--text)', { width: 3.5, dash: '8 4' }), `target contour $\\rho_c = ${sciTex(RHO_TARGET, 1)}$ Ω·cm² (thick dashed)`, '', '4', 'heatmap target'],
        [SW.line('var(--c-e0)', { width: 3, dash: '10 4 3 4' }), 'pivot line $\\phi_m^*$ on the $\\phi_B$ heatmap', '', '3', 'heatmap pivot'],
        [SW.ring('var(--text)', 'none'), 'sweet-spot ring: lowest $\\rho_c$ on the map', '', '4', 'heatmap sweet spot'],
        [SW.dot('var(--brand-ink)', { r: 7, sw: 2.5 }), 'current setting on a map or curve', '', '3, 4'],
        [SW.line('var(--brand-ink)', { width: 3.5 }), '$\\rho_c(t)$ with the tunnelling penalty (solid)', '', '4', 'rho'],
        [SW.line('#a7abc6', { width: 2.5, dash: '7 5' }), '$\\rho_c(t)$ from the barrier only, without the tunnelling penalty (grey dashed)', '', '4', 'rho'],
        [SW.line('var(--brand-ink)', { width: 2, dash: '6 4' }), 'target $\\rho_c$ (dashed); also the target in the Build-a-contact meter', '', '4', 'rho'],
        [SW.ring('var(--c-e0)'), 'optimum interlayer thickness $t$ (amber ring)', '', '4', 'rho optimum'],
      ],
    },
    {
      title: 'Plot markings: other plots',
      swatch: true,
      rows: [
        [SW.line('var(--c-pos)', { width: 4.5 }) + SW.line('var(--c-neg)', { width: 4.5 }), '$|Q_{ss}|$ for the present $D_{it}$: red where $Q_{ss} > 0$, teal where $Q_{ss} < 0$', '', '1', 'charge'],
        [SW.line('var(--text)', { dash: '12 4.5' }), '$Q_{sc}$, the whole depletion charge (dashed)', '', '1', 'charge'],
        [SW.line('#a7abc6', { width: 2 }), 'reference curves for fixed $D_{it}$ values (each labelled with its $D_{it}$)', '', '1', 'charge'],
        [SW.fill('var(--c-pos)') + SW.fill('var(--c-neg)'), 'charge bars: positive (red) and negative (teal)', '', '2', 'charge'],
        [SW.fill('var(--brand-tint)', { stroke: 'var(--brand-ink)', sw: 2 }), 'budget bar: $\\phi_m - \\chi$', '', '2', 'budget'],
        [SW.fill('var(--text)'), 'budget bar: $\\phi_{Bn}$ (or $E_g - \\phi_{Bp}$ for p-type)', '', '2', 'budget'],
        [SW.fill('var(--brand)', { stroke: 'var(--brand-ink)', sw: 2 }) + SW.hatch(), 'budget bar: $\\Delta V_{ox}$, solid when positive, hatched when negative', '', '2', 'budget'],
        [SW.line('var(--brand-ink)', { width: 3.5 }), 'MIGS panel: $|\\psi|^2$ decaying into the semiconductor', '', '1', 'migs'],
        [SW.line('var(--text-muted)', { width: 1.5, dash: '4 4' }), 'MIGS panel: $1/e^2$ marker at the decay length', '', '1', 'migs'],
        [SW.dot('var(--text)', { stroke: 'none', r: 5 }), 'C–V lab: measured $1/C^2$ points', '', '3', 'cv'],
        [SW.line('var(--brand-ink)', { width: 3.5 }), 'C–V lab: your fit line (drag the round handles)', '', '3', 'cv'],
        [SW.dot('var(--c-e0)', { r: 7 }), 'C–V lab: voltage-axis intercept $-V_{bi}$', '', '3', 'cv'],
        [SW.line('var(--brand-ink)', { width: 3 }) + SW.line('var(--text)', { width: 3, dash: '9 6' }) + SW.line('var(--text-muted)', { width: 3, dash: '2 6' }), '$\\psi_s$–$V_G$ curves for the three MOS presets (solid, dashed, dotted)', '', 'MOS'],
        [SW.line('var(--text)', { width: 1.5, dash: '6 4' }), 'inversion line $\\psi_s = 2\\phi_F$', '', 'MOS'],
      ],
    },
    {
      title: 'Badges and labels',
      swatch: true,
      rows: [
        [SW.badge('info', 'ideal: no interface states'), 'Ideal preset: $\\delta = 0$, $D_{it} = 0$, so $\\phi_{Bn} = \\phi_m - \\chi$', '', '1', 'badge'],
        [SW.badge('', 'ohmic / accumulation'), 'no barrier for majority carriers: the solver’s ohmic flag', '', '1–4', 'badge'],
        [SW.badge('', 'inversion — beyond this model'), 'the barrier reached $E_g$: the surface inverts, outside this model', '', '1–4', 'badge'],
        [SW.badge('', 'degenerate doping — approximate'), '$E_F$ inside the band in the bulk: Boltzmann statistics are only approximate', '', '1–4', 'badge'],
        [SW.badge('info', 'toy model, qualitative'), 'Section 4 contact-resistance model: trends only', '', '4', 'badge'],
        // the two preset badges come from the same helper the simulations use
        ...[['gan', 'no agreed measured S for GaN; the preset $D_{it}$ is an illustration'], ['ge', 'the Ge preset uses the measured S of that reference']].map(([id, m]) => {
          const [[k, txt]] = presetNotes({ preset: id });
          return [SW.badge(k === 'warn' ? '' : k, txt), m, '', '1–3', 'badge'];
        }),
        [`<span class="sym-label">${DIGITIZED_LABEL}</span>`, 'course-data points digitized from the course slide', '', '3, 4', 'badge digitized'],
      ],
    },
  ];
}

// ---------------------------------------------------------------- search
const GREEK = { phi: 'φ', chi: 'χ', psi: 'ψ', delta: 'δ', Delta: 'Δ', varepsilon: 'ε', epsilon: 'ε', gamma: 'γ', lambda: 'λ', kappa: 'κ', rho: 'ρ', hbar: 'ħ' };
const plainTex = (s) =>
  s
    .replace(/\\(varepsilon|epsilon|Delta|delta|phi|chi|psi|gamma|lambda|kappa|rho|hbar)/g, (m, g) => `${GREEK[g]} ${g}`)
    .replace(/\\mathrm|\\operatorname|\\[a-zA-Z]+|[{}\\^]/g, ' ');
const compact = (s) => s.toLowerCase().replace(/[\s_{}\\^,()'′*=−\-–]/g, '');
const stripHtml = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\$([^$]*)\$/g, (_, t) => plainTex(t));

export function showSymbols(mode) {
  const G = groups();
  const filter = h('input', { type: 'search', class: 'sym-filter', placeholder: 'Filter: symbol or meaning (e.g. φ_Bn, phi, depletion)', 'aria-label': 'Filter symbols' });
  const none = h('p', { class: 'sym-none', hidden: true }, 'No symbol matches.');
  const sections = G.map((g) => {
    const rows = g.rows.map(([sym, meaning, unit, where, extra = '']) => {
      const symHtml = g.swatch ? sym : g.text ? `<strong>${sym}</strong>` : tex(sym);
      const hay = `${g.swatch || g.text ? '' : plainTex(sym)} ${g.text ? sym : ''} ${stripHtml(meaning)} ${extra} ${g.title}`;
      const tr = h(
        'tr',
        {},
        h('td', { class: 'sym-sym', html: symHtml }),
        h('td', { class: 'sym-mean', html: mathify(meaning) }),
        h('td', { class: 'sym-unit' }, unit || '—'),
        h('td', { class: 'sym-where' }, where),
      );
      tr._hay = hay.toLowerCase();
      tr._hayC = compact(hay);
      return tr;
    });
    const table = h(
      'table',
      { class: 'sym-table' },
      h('thead', {}, h('tr', {}, h('th', {}, g.swatch ? 'Marking' : 'Symbol'), h('th', {}, 'Meaning'), h('th', {}, 'Unit'), h('th', {}, 'Where it appears (section)'))),
      h('tbody', {}, rows),
    );
    const sec = h('section', { class: 'sym-group' }, h('h3', {}, g.title), table);
    return { sec, rows };
  });
  function apply() {
    const q = filter.value.trim().toLowerCase();
    const qc = compact(q);
    let any = false;
    for (const { sec, rows } of sections) {
      let n = 0;
      for (const tr of rows) {
        const ok = !q || tr._hay.includes(q) || (qc && tr._hayC.includes(qc));
        tr.hidden = !ok;
        if (ok) n++;
      }
      sec.hidden = n === 0;
      any ||= n > 0;
    }
    none.hidden = any;
  }
  filter.addEventListener('input', apply);
  const content = h(
    'div',
    { class: 'sym-page' },
    h('div', { class: 'sym-head' }, h('h2', {}, 'Symbols and what they mean'), filter),
    none,
    sections.map((s) => s.sec),
    h('p', { class: 'sym-foot' }, 'Section numbers: Intro = “From chip to band diagram”, 1–4 = the four sections, MOS = “Going further” (Detailed mode). “quiz” = shown in that section’s quiz.'),
  );
  const el = openOverlay(content, { label: 'Symbols', cls: `sym-overlay sym-${mode}` });
  filter.focus();
  return el;
}
