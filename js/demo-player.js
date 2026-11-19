// Scripted demos that move the sliders themselves.
//
// script = {
//   label: 'Demo A',
//   setup?: (state) => patch,          // applied once at the start
//   steps: [{
//     dur: ms,
//     caption: string | (state) => string,
//     live?: (state) => string,        // live readout shown in the caption bar
//     tracks?: { key: [from|null, to, 'lin'|'log'] },  // null = value at step start
//     update?: (u, state, base) => patch,               // custom interpolation, u in [0,1]
//     ease?: 'inout' | 'linear',
//   }],
//   done?: (state) => patch,
//   doneCaption?: string | (state) => string,
// }
//
// Space pauses/resumes, R replays (wired in app.js through activePlayer()).
// A user-initiated change to the store (meta.source === 'user') stops the demo and
// leaves the sliders where they are.
import { prefersReducedMotion } from './ui/dom.js';

let active = null;
export const activePlayer = () => active;

const ease = {
  linear: (u) => u,
  inout: (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2),
};

function interp(a, b, u, scale) {
  if (scale === 'log') return 10 ** (Math.log10(a) + (Math.log10(b) - Math.log10(a)) * u);
  return a + (b - a) * u;
}

export function createDemoPlayer({ store, caption, onChange }) {
  let script = null;
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let playing = false;
  let paused = false;
  let stepIdx = -1;
  let base = null;
  const reduced = prefersReducedMotion();

  store.subscribe((_s, meta) => {
    if (meta.source !== 'user') return;
    if (playing) stop(true);
    else if (script) caption?.idle();
  });

  const total = () => script.steps.reduce((a, s) => a + s.dur, 0);
  const capText = (c, st) => (typeof c === 'function' ? c(st) : c || '');

  function applyStep(i, u) {
    const step = script.steps[i];
    const e = (ease[step.ease || 'inout'] || ease.inout)(u);
    const uu = reduced ? (u >= 1 ? 1 : Math.floor(e * 4) / 4) : e;
    const patch = {};
    if (step.tracks) {
      for (const [k, [from, to, scale]] of Object.entries(step.tracks)) {
        const a = from == null ? base[k] : from;
        patch[k] = interp(a, to, uu, scale);
      }
    }
    if (step.update) Object.assign(patch, step.update(uu, store.get(), base));
    if (Object.keys(patch).length) store.set(patch, { source: 'demo' });
  }

  function frame(now) {
    raf = 0;
    if (!playing || paused) return;
    elapsed += Math.min(100, now - last);
    last = now;
    let acc = 0;
    let i = 0;
    for (; i < script.steps.length; i++) {
      if (elapsed < acc + script.steps[i].dur) break;
      acc += script.steps[i].dur;
    }
    if (i >= script.steps.length) {
      // finish the last step exactly
      if (stepIdx >= 0 && stepIdx < script.steps.length) applyStep(script.steps.length - 1, 1);
      finish();
      return;
    }
    if (i !== stepIdx) {
      if (stepIdx >= 0 && stepIdx < i) applyStep(stepIdx, 1);
      stepIdx = i;
      base = { ...store.get() };
    }
    const step = script.steps[i];
    applyStep(i, Math.min(1, (elapsed - acc) / step.dur));
    const st = store.get();
    caption?.show({
      main: capText(step.caption, st),
      live: step.live ? step.live(st) : '',
      progress: elapsed / total(),
      state: 'playing',
      label: script.label,
    });
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    playing = false;
    paused = false;
    if (script.done) store.set(script.done(store.get()), { source: 'demo' });
    const st = store.get();
    const lastStep = script.steps[script.steps.length - 1];
    caption?.show({
      main: capText(script.doneCaption ?? lastStep.caption, st),
      live: script.doneLive != null ? capText(script.doneLive, st) : lastStep.live ? lastStep.live(st) : '',
      progress: 1,
      state: 'done',
      label: script.label,
    });
    onChange?.();
  }

  function play(s) {
    stop(false);
    script = s;
    active = api;
    if (s.setup) store.set(s.setup(store.get()), { source: 'demo' });
    elapsed = 0;
    stepIdx = -1;
    playing = true;
    paused = false;
    last = performance.now();
    raf = requestAnimationFrame(frame);
    onChange?.();
  }

  function stop(interrupted) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    const was = playing;
    playing = false;
    paused = false;
    if (was && interrupted) caption?.show({ main: 'Demo stopped. The sliders are yours.', live: '', progress: 0, state: 'stopped' });
    if (was) onChange?.();
  }

  function toggle() {
    if (!script) return;
    if (!playing) {
      play(script);
      return;
    }
    paused = !paused;
    if (!paused) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else {
      const step = script.steps[Math.max(0, stepIdx)];
      caption?.show({ main: capText(step.caption, store.get()), live: 'paused', progress: elapsed / total(), state: 'paused', label: script.label });
    }
    onChange?.();
  }

  const api = {
    play,
    stop: () => stop(false),
    toggle,
    replay: () => script && play(script),
    get playing() {
      return playing;
    },
    get paused() {
      return paused;
    },
    get script() {
      return script;
    },
  };
  return api;
}

/** Caption bar element. `idleText` is shown when no demo has run. */
export function createCaptionBar(el, idleText = '') {
  el.classList.add('caption-bar');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<span class="cap-state"></span><span class="cap-text"><span class="cap-main"></span><span class="cap-live"></span></span><span class="cap-progress"></span>';
  const stateEl = el.querySelector('.cap-state');
  const mainEl = el.querySelector('.cap-main');
  const liveEl = el.querySelector('.cap-live');
  const progEl = el.querySelector('.cap-progress');
  let liveIdle = ''; // live text from the simulation (e.g. the pinning-strength sentence)
  const idle = () => {
    el.classList.add('idle');
    stateEl.textContent = '';
    mainEl.innerHTML = liveIdle || idleText;
    liveEl.textContent = '';
    progEl.style.width = '0';
    el.hidden = !idleText && el.dataset.collapse === '1';
  };
  idle();
  return {
    el,
    /** Text shown while no demo runs (replaces the static hint). */
    setLiveIdle(text) {
      liveIdle = text || '';
      if (el.classList.contains('idle')) idle();
    },
    show({ main, live, progress, state, label }) {
      el.hidden = false;
      el.classList.remove('idle');
      // plain words, no symbols that some platforms render as emoji
      const tag = { playing: '', paused: '· paused', done: '· done', stopped: '' }[state] || '';
      stateEl.textContent = `${label || ''} ${tag}`.trim();
      // captions are authored in the section files (trusted HTML, for subscripts)
      mainEl.innerHTML = main;
      liveEl.innerHTML = live || '';
      progEl.style.width = `${Math.round((progress || 0) * 100)}%`;
    },
    idle,
  };
}
