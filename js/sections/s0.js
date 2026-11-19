// Intro: "From chip to band diagram" (Animation 1). Presentation: a slide before Section 1.
// Detailed: the block "Why this matters for every transistor" at the top of the page.
import { stateFor } from '../state.js';
import { metalById, CHIP } from '../../data/materials.js';
import { TRANSISTOR_RON } from '../../data/course-data.js';
import { createChipAnim, chipStart } from '../chip-anim.js';

const opening = () =>
  `Every transistor has to pass current through a metal–semiconductor contact. When a transistor’s on-resistance falls toward ${TRANSISTOR_RON.value} ${TRANSISTOR_RON.unit}, the contacts dominate. Why can’t engineers just pick a better metal?`;

export default {
  id: 's0',
  num: 0,
  intro: true,
  title: 'From chip to band diagram',
  short: 'From chip to band diagram',
  detailedTitle: 'Why this matters for every transistor',
  start: () => ({ ...stateFor('si', 'Si', { phiM: metalById(CHIP.metal).phiM }), chip: chipStart(1) }),
  content: () => ({
    takeaway: opening(),
    idle: 'Press Play (A) for the whole story, or pick a stage.',
    simTitle: 'From chip to band diagram',
    simNote: 'simplified, not to scale · electron flow is illustrative (log scale)',
    tryThis: [
      'Stage 4: switch Ideal → Real Si → Real GaAs with the same metal and compare the current ratio.',
      'Stage 4: try every metal on Real Si. None gets below the floor set by pinning.',
      'Stage 5: switch the two fixes on one at a time and watch ρ<sub>c</sub> and the electron flow.',
    ],
  }),
  sim: (root, ctx) => createChipAnim(root, ctx, { variant: 'full' }),
  hooks: [],
};
