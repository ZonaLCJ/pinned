// QR overlay. Uses the qrcode-generator global (loaded from jsDelivr, pinned 1.4.4).
// The QR encodes SITE_URL + '?mode=detailed' (falls back to the current location).
import { SITE_URL } from './config.js';
import { detailedUrl } from './modes.js';
import { h, icon } from './ui/dom.js';
import { openOverlay } from './overlay.js';

export function qrSvg(text) {
  const lib = window.qrcode;
  if (typeof lib !== 'function') return null;
  const qr = lib(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const m = 4; // quiet zone
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`;
  return `<svg class="qr-svg" viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${text}"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#1d2040"/></svg>`;
}

export function showQR() {
  const url = detailedUrl(SITE_URL);
  const svg = qrSvg(url);
  const card = h(
    'div',
    { class: 'qr-card' },
    h('h2', { class: 'qr-title' }, 'Scan to read and play on your phone'),
    svg ? h('div', { html: svg }) : h('p', { class: 'badge' }, 'QR library did not load; use the address below.'),
    h('p', { class: 'qr-url' }, url),
    !SITE_URL ? h('p', { class: 'qr-note' }, 'SITE_URL is not set in js/config.js, so this is the current address.') : null,
  );
  return openOverlay(card, { label: 'QR code', cls: 'qr-overlay' });
}

