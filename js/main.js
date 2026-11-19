// Entry point: picks the mode, mounts the layout, routes global keys.
import { TITLE } from './config.js';
import { initialMode, rememberMode, isPhone } from './modes.js';
import { facts } from './facts.js';
import { buildPresentation } from './layout-present.js';
import { buildDetailed } from './layout-detailed.js';
import { showQR } from './qr.js';
import { showKeymap } from './presenter.js';
import { showSymbols } from './symbols.js';
import { closeOverlay, overlayOpen } from './overlay.js';
import { typingTarget } from './layout-common.js';
import s1 from './sections/s1.js';
import s2 from './sections/s2.js';
import s3 from './sections/s3.js';
import s4 from './sections/s4.js';
import s0 from './sections/s0.js';
import mos from './sections/mos.js';

const SECTIONS = [s1, s2, s3, s4];
const root = document.getElementById('app');
document.title = TITLE;

let mode = initialMode();
let app = null;

function mount(m) {
  if (app) app.destroy();
  closeOverlay();
  mode = m;
  document.documentElement.dataset.mode = m;
  document.body.className = `mode-${m}`;
  root.innerHTML = '';
  const F = facts();
  app =
    m === 'present'
      ? buildPresentation(root, { sections: [s0, ...SECTIONS], facts: F, onMode: switchMode })
      : buildDetailed(root, { sections: SECTIONS, intro: s0, further: [mos], facts: F, onMode: switchMode });
}

function switchMode(m) {
  if (m === 'present' && isPhone()) return; // phones stay in Detailed mode
  rememberMode(m);
  const keepHash = m === 'detailed' ? location.hash : '';
  mount(m);
  if (m === 'detailed') window.scrollTo(0, 0);
  if (keepHash && m === 'detailed') {
    const t = document.getElementById(keepHash.slice(1));
    if (t) t.scrollIntoView();
  }
}

document.addEventListener('keydown', (e) => {
  if (app && app.handleKey(e)) {
    e.preventDefault();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e)) return;
  if (overlayOpen() && e.key !== 'Escape') return;
  if (e.key === 'q' || e.key === 'Q') {
    showQR();
    e.preventDefault();
  } else if (e.key === 's' || e.key === 'S') {
    showSymbols(mode);
    e.preventDefault();
  } else if (e.key === '?') {
    showKeymap(mode);
    e.preventDefault();
  } else if ((e.key === 'm' || e.key === 'M') && !isPhone()) {
    switchMode(mode === 'present' ? 'detailed' : 'present');
    e.preventDefault();
  }
});

mount(mode);
