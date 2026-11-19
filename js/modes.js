// Mode selection: ?mode= URL parameter, then the last saved choice, then Detailed.
// Phones only ever get Detailed mode (the saved choice is left alone for other devices).
import { load, save } from './ui/storage.js';

export const MODES = ['present', 'detailed'];
const KEY = 'mode';

/**
 * A phone: the screen's shorter side is under 600 px and the main pointer is coarse.
 * True in portrait and landscape (also with "request desktop site"); false for tablets and
 * for a narrow laptop window.
 */
export function isPhone() {
  try {
    const { screen, matchMedia } = globalThis;
    return Math.min(screen.width, screen.height) < 600 && matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function initialMode() {
  if (isPhone()) return 'detailed'; // ignores ?mode=present and a saved 'present'; saves nothing
  let q = null;
  try {
    q = new URLSearchParams(window.location.search).get('mode');
  } catch {
    q = null;
  }
  if (MODES.includes(q)) return q;
  const saved = load(KEY);
  if (MODES.includes(saved)) return saved;
  return 'detailed';
}

/** Persist the choice and keep the URL in sync, so a reload stays in this mode. */
export function rememberMode(mode) {
  save(KEY, mode);
  try {
    const u = new URL(window.location.href);
    if (u.searchParams.has('mode')) {
      u.searchParams.set('mode', mode);
      window.history.replaceState(null, '', u);
    }
  } catch {
    /* ignore */
  }
}

/** URL for the detailed-mode QR code. */
export function detailedUrl(siteUrl) {
  const base = siteUrl || window.location.origin + window.location.pathname;
  return `${base}${base.includes('?') ? '&' : '?'}mode=detailed`;
}
