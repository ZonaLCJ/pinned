// Detailed-mode extras: intro, misconceptions box, model limits, references.
import { esc } from './ui/dom.js';
import { MYTHS } from './hooks/myth-fact.js';
import { DIGITIZED_LABEL, MOTT_SCHOTTKY, SHEN_2021, REFS_EXTRA } from '../data/course-data.js';
import { ASTAR_P, SEMICONDUCTORS, PRESETS } from '../data/materials.js';
import { num } from './ui/format.js';

// 'A. Author et al., Journal 89, 252110 (2006)' -> journal name in italics
const refHtml = (r) => esc(r).replace(/, ([A-Z][A-Za-z. ]+?) (\d+, \d+ \(\d{4}\))$/, ', <em>$1</em> $2');

// <li>Course material: <em>Introduction to Semiconductor</em>, PDF pp. 268–282 (metal–semiconductor junction, Mott–Schottky rule, interface charges, depletion capacitance, Schottky diode, 2D contacts) and p. 287 (tunnelling decay length).</li>
export function EXTRAS() {
  return {
    lede: `<p>Interface states can pin the Fermi level and weaken the dependence of Schottky barrier height on the chosen metal. This site shows <strong>how metal work function and pinning strength affect the resulting barrier</strong> with 4 sections, each with a live simulation, try to answer these 4 questions: what interface states are, where the work-function difference goes, how strongly the barrier is pinned (and what experiments show), and how contacts get around the pin.</p>`,
    misconceptions: `<ul class="myth-list">${MYTHS.map(
      (m) => `<li><span class="verdict ${m.answer}">${m.answer === 'myth' ? 'Myth' : 'Fact'}:</span> “${m.text}” ${m.why}</li>`,
    ).join('')}</ul>`,
    limits: `<ul>
<li>1D model.</li>
<li>Uniform $D_{it}$ with a single neutral level $E_0=E_v+e\\phi_0$.</li>
<li>Interfacial layer treated as a uniform dielectric ($\\delta$, $\\varepsilon_i$).</li>
<li>Boltzmann statistics (degenerate doping is flagged as approximate).</li>
<li>Temperature changes only $N_c$, $N_v$ ($\\propto T^{3/2}$) and $kT$: $E_g$, $\\chi$, $\\phi_0$ and $D_{it}$ stay at their 300 K values, and the dopants are fully ionized (no freeze-out).</li>
<li>Hole currents use $A^* = ${ASTAR_P.value}$ A cm⁻² K⁻² for every semiconductor, ${ASTAR_P.label}.</li>
<li>The carriers moving in the band diagrams have exaggerated energies so that crossings are visible; the real relative crossing rate is shown next to them.</li>
<li>The J–V plot ignores series resistance and image-force lowering.</li>
<li>No image-force lowering (also in the C–V lab).</li>
<li>No barrier inhomogeneity.</li>
<li>The contact-resistance model of Section 4 is a qualitative toy.</li>
<li>Course data overlays are ${DIGITIZED_LABEL.replace('≈ ', 'approximately ')}. ${MOTT_SCHOTTKY.footnote}</li>
</ul>`,
    refs: `<ol class="ref-list">
<li>Course material of "Introduction to Semiconductor" by prof. Mario Hofmann of NTU.</li>
<li>D. A. Neamen. (2012), <em>Semiconductor Physics and Devices</em>, 4rd ed., ch. 9, pp.333 (Tables 9.1 and 9.2, interface-state model).</li>
<li>J. Bardeen. (1947). Surface States and Rectification at a Metal Semi-Conductor Contact. <em>Phys. Rev.</em>, 71, 717-727. <a href="https://doi.org/10.1103/PhysRev.71.717" target="_blank" rel="noopener noreferrer">https://doi.org/10.1103/PhysRev.71.717</a></li>
<li>V. Heine. (1965). Theory of Surface States. <em>Phys. Rev.</em>, 138, A1689-A1696. <a href="https://doi.org/10.1103/PhysRev.138.A1689" target="_blank" rel="noopener noreferrer">https://doi.org/10.1103/PhysRev.138.A1689</a></li>
<li>A. M. Cowley & S. M. Sze. (1965). Surface States and Barrier Height of Metal‐Semiconductor Systems. <em>J. Appl. Phys.</em> 36, 3212. <a href="https://doi.org/10.1063/1.1702952" target="_blank" rel="noopener noreferrer">https://doi.org/10.1063/1.1702952</a></li>
<li>J. Tersoff. (1984). Schottky Barrier Heights and the Continuum of Gap States. <em>Phys. Rev. Lett.</em> 52, 465-468. <a href="https://doi.org/10.1103/PhysRevLett.52.465" target="_blank" rel="noopener noreferrer">https://doi.org/10.1103/PhysRevLett.52.46</a></li>
<li>S. M. Sze & K. K. Ng. (2006). <em>Physics of Semiconductor Devices</em>, 3rd ed., ch. 3.</li>
<li>P.-C. Shen et al., <em>Nature</em> 593, 211 (2021). <a href="${SHEN_2021.url}" target="_blank" rel="noopener noreferrer">${SHEN_2021.url}</a></li>
<li>S. Kurtin, T. C. McGill & C. A. Mead (1969). FUNDAMENTAL TRANSITION IN THE ELECTRONIC NATURE OF SOLIDS. <em>Phys. Rev. Lett.</em> 22, 1433-1436. <a href="https://doi.org/10.1103/PhysRevLett.22.1433" target="_blank" rel="noopener noreferrer">https://doi.org/10.1103/PhysRevLett.22.1433</a> (ionicity trend of S). </li>
<li>A. Dimoulas et al. (2006). Fermi-level pinning and charge neutrality level in germanium. <em>Appl. Phys. Lett.</em> 89, 252110. <a href="https://doi.org/10.1063/1.2410241" target="_blank" rel="noopener noreferrer">https://doi.org/10.1063/1.2410241</a> (Ge preset: neutral level and S).</li>
<li>A. Y. Polyakov et al. (2006). Fermi level pinning in heavily neutron-irradiated GaN. <em>J. Appl. Phys.</em> 100, 093715. <a href="https://doi.org/10.1063/1.2361157" target="_blank" rel="noopener noreferrer">https://doi.org/10.1063/1.2361157</a> (GaN preset: E<sub>F</sub> pinned about ${num(SEMICONDUCTORS.GaN.Eg - PRESETS.gan.phi0, 1)} eV below E<sub>c</sub>; illustrative D<sub>it</sub>).</li>
</ol>`,
    // footerNote: `Every number on this site is computed live by the engine (<code>js/engine.js</code>) or read from the course data file (<code>data/course-data.js</code>).`,
    footerNote: `Every number on this site is computed live or found from the course material and References.`,
  };
}
