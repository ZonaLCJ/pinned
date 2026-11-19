// Captions that describe the current band diagram in words, generated from the engine state.
import { saturationRatioVs300 } from './engine.js';
import { num, times } from './ui/format.js';

/**
 * Sentences for a solved contact (p = params, res = solveBarrier(p)).
 * Returns { charge, pinning, sm, regime, temp, S } (null where a sentence does not apply).
 */
export function captionSentences(p, res) {
  const pType = res.doping === 'p';
  const S = res.gamma;
  const hasStates = !res.ideal && p.Dit > 0;

  // 1. interface charge
  let charge;
  if (!hasStates) charge = 'The ideal contact has no interface states.';
  else if (Math.abs(res.EFmE0) < 0.02) charge = 'E<sub>F</sub> sits at the neutral level, so the interface states are neutral.';
  else {
    const above = res.EFmE0 > 0;
    charge = `E<sub>F</sub> at the interface lies ${num(Math.abs(res.EFmE0), 2)} eV ${above ? 'above' : 'below'} the neutral level, so the interface states hold net ${above ? 'negative' : 'positive'} charge.`;
  }

  // 2. pinning strength
  const pinnedName = pType ? 'φ<sub>0</sub>' : 'E<sub>g</sub> − φ<sub>0</sub>';
  let pinning;
  if (S >= 0.7) pinning = 'Weak pinning: the barrier follows the metal closely.';
  else if (S >= 0.3) pinning = "Partial pinning: the barrier moves by about S times any change in the metal's work function.";
  else pinning = `Strong pinning: the barrier stays near ${pinnedName} = ${num(res.pinned, 2)} eV whatever the metal.`;
  pinning = `S = ${num(S, 2)}. ${pinning}`;

  // 3. comparison with Schottky–Mott
  const Y = res.phiB - res.sm;
  const sm =
    Math.abs(Y) < 0.005
      ? 'The barrier equals the Schottky–Mott value.'
      : `The barrier is ${num(Math.abs(Y), 2)} eV ${Y > 0 ? 'higher' : 'lower'} than the Schottky–Mott value.`;

  // 4. regime flags
  const regime = res.flags.ohmic ? 'Ohmic: no barrier for majority carriers.' : res.flags.inversion ? 'Inversion.' : null;

  // 5. temperature
  let temp = null;
  if (Math.round(p.T) !== 300) {
    const r = saturationRatioVs300(p);
    temp = `At ${Math.round(p.T)} K the barrier is almost unchanged, but the saturation current is ${times(r.ratio, 2)} its 300 K value.`;
  }
  return { charge, pinning, sm, regime, temp, S };
}

/** Full caption (detailed mode and the More drawer). */
export const fullCaption = (c) => [c.charge, c.pinning, c.sm, c.regime, c.temp].filter(Boolean).join(' ');
