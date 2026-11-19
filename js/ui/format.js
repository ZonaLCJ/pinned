// Number formatting for display. Uses the true minus sign (U+2212).

const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
export const MINUS = '−';
export const supStr = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');
const fixMinus = (s) => s.replace(/-/g, MINUS);

/** Fixed decimals with a proper minus sign. */
export function num(x, d = 2) {
  if (!Number.isFinite(x)) return '—';
  const s = x.toFixed(d);
  return fixMinus(/^-0\.?0*$/.test(s) ? s.slice(1) : s);
}
/** Explicit sign: +0.11 / −0.10 */
export function signed(x, d = 2) {
  const s = num(x, d);
  return x > 0 && s !== num(0, d) ? `+${s}` : s;
}
export const eV = (x, d = 2) => `${num(x, d)} eV`;
export const volt = (x, d = 2) => `${num(x, d)} V`;
export const signedEV = (x, d = 2) => `${signed(x, d)} eV`;

/** Mantissa/exponent split (rounded to `sig` significant figures). */
export function splitSci(x, sig = 2) {
  if (x === 0) return { m: 0, e: 0 };
  let e = Math.floor(Math.log10(Math.abs(x)));
  let m = x / 10 ** e;
  const r = Number(m.toFixed(sig - 1));
  if (Math.abs(r) >= 10) {
    e += 1;
    m = x / 10 ** e;
  }
  return { m: Number(m.toFixed(sig - 1)), e };
}

/** 3.2 × 10¹² (unicode). `sig` significant figures; mantissa 1 is dropped. */
export function sci(x, sig = 2, { dropOne = true, compact = false } = {}) {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const { m, e } = splitSci(x, sig);
  if (e === 0) return fixMinus(m.toFixed(sig - 1));
  const ms = fixMinus(m.toFixed(sig - 1));
  if (dropOne && Math.abs(m) === 1 && sig <= 2) return `${m < 0 ? MINUS : ''}10${supStr(e)}`;
  return compact ? `${ms}×10${supStr(e)}` : `${ms} × 10${supStr(e)}`;
}
/** TeX version: 3.2\times10^{12} */
export function sciTex(x, sig = 2) {
  if (x === 0) return '0';
  const { m, e } = splitSci(x, sig);
  if (e === 0) return m.toFixed(sig - 1);
  if (Math.abs(m) === 1 && sig <= 2) return `${m < 0 ? '-' : ''}10^{${e}}`;
  return `${m.toFixed(sig - 1)}\\times10^{${e}}`;
}
/** Power of ten only: 10¹³ */
export const pow10 = (x) => `10${supStr(Math.round(Math.log10(x)))}`;

export const perCm2 = (x, sig = 2) => `${sci(x, sig, { compact: true })} e/cm²`;
export const ditStr = (x, sig = 2) => (x === 0 ? '0' : `${sci(x, sig)} cm⁻²eV⁻¹`);
export const ndStr = (x, sig = 2) => `${sci(x, sig)} cm⁻³`;
export const rhoStr = (x, sig = 2) => `${sci(x, sig, { dropOne: false })} Ω·cm²`;

/** Current ratio: 48× or 6.0 × 10¹³× */
export function times(x, sig = 2) {
  if (!Number.isFinite(x)) return '—';
  if (x < 0.1) return `${sci(x, sig, { dropOne: false })}×`;
  if (x < 1000) return `${x < 10 ? x.toFixed(x < 1 ? 2 : 1) : Math.round(x)}×`;
  return `${sci(x, sig, { dropOne: false })}×`;
}

/** Length in m -> "0.27 µm" or "28 nm". */
export function length(m) {
  if (!(m > 0)) return '0';
  if (m >= 1e-6) return `${Number((m * 1e6).toPrecision(2))} µm`;
  if (m >= 1e-8) return `${Math.round(m * 1e9)} nm`;
  return `${Number((m * 1e9).toPrecision(2))} nm`;
}

export const pct = (x) => `${Math.round(x * 100)}%`;
export const secs = (s) => {
  const neg = s < 0;
  s = Math.abs(Math.round(s));
  return `${neg ? MINUS : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
