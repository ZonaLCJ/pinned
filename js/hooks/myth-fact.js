// Backup hook "Myth or fact" (Section 4). Swipe or tap.
import { h } from '../ui/dom.js';
import { mathify } from '../ui/math.js';
import { MOTT_SCHOTTKY } from '../../data/course-data.js';
import { hookFrame, countdown, setOptions, markOptions, getBest, saveBest, givenBox } from './hook-ui.js';
import { mythGiven } from './given.js';

export const MYTHS = [
  { id: 1, text: 'Heavy doping removes Fermi-level pinning.', answer: 'myth', why: 'It thins the barrier so electrons can tunnel; the height stays pinned.' },
  { id: 2, text: 'Even a perfect, defect-free interface can pin $E_F$.', answer: 'fact', why: 'Metal-induced gap states (MIGS) exist without any defects.' },
  {
    id: 3,
    text: 'Pinned means the barrier is completely independent of the metal.',
    answer: 'myth',
    why: `$S \\approx ${MOTT_SCHOTTKY.Si.slope}$ for Si: the barrier still follows the metal, only weakly.`,
  },
  { id: 4, text: '$E_F$ is pinned throughout the semiconductor.', answer: 'myth', why: 'Only at the interface; the bulk $E_F$ is set by the doping.' },
  { id: 5, text: 'A ~1 nm insulator can raise $S$.', answer: 'fact', why: 'It blocks the MIGS tails, at the cost of tunnelling resistance.' },
].map((m) => ({ ...m, text: mathify(m.text), why: mathify(m.why) }));

export function mythById(id) {
  return MYTHS.find((m) => m.id === id);
}

export function createMythFact(root, ctx) {
  const present = ctx.mode === 'present';
  const F = hookFrame(root, { title: 'Myth or fact', mode: ctx.mode, single: true });
  F.visual.hidden = true;
  const card = h('div', { class: 'mf-card' });
  F.q.replaceWith(card);
  F.q = card;
  const G = givenBox(F, { mode: ctx.mode, inline: true });
  F.sub.textContent = present ? 'Audience: shout it out. Enter reveals.' : 'Tap Myth or Fact, or swipe the card left (myth) or right (fact).';
  let i = 0;
  let score = 0;
  let revealed = false;
  let chosen = null;
  let timer = null;
  let buttons = [];

  function show() {
    revealed = false;
    chosen = null;
    const m = MYTHS[i];
    card.className = 'mf-card';
    card.style.transform = '';
    card.innerHTML = `“${m.text}”`;
    G.show(true);
    G.set(mythGiven(m.id));
    F.meta.textContent = `Card ${i + 1}/${MYTHS.length}${present ? '' : ` · score ${score}`}`;
    F.feedback.hidden = true;
    buttons = setOptions(
      F.options,
      [
        { value: 'myth', label: 'Myth' },
        { value: 'fact', label: 'Fact' },
      ],
      pick,
    );
    F.footer.replaceChildren();
    timer?.stop();
    timer = present ? countdown(F.cd, 5) : null;
    if (!present) F.cd.hidden = true;
  }
  function pick(v) {
    if (revealed) return;
    chosen = v;
    if (present) {
      markOptions(buttons, { correct: null, chosen: v });
      return;
    }
    reveal();
  }
  function reveal() {
    if (revealed) return;
    revealed = true;
    timer?.stop();
    const m = MYTHS[i];
    const ok = chosen === m.answer;
    if (!present && ok) score++;
    markOptions(buttons, { correct: m.answer, chosen });
    card.classList.add(m.answer);
    F.feedback.hidden = false;
    F.feedback.className = `hook-feedback ${present ? '' : ok ? 'good' : 'bad'}`;
    F.feedback.innerHTML = `<span class="verdict ${m.answer}">${m.answer === 'myth' ? 'Myth' : 'Fact'}.</span> ${m.why}`;
    F.meta.textContent = `Card ${i + 1}/${MYTHS.length}${present ? '' : ` · score ${score}`}`;
    const last = i === MYTHS.length - 1;
    F.footer.replaceChildren(
      h('button', { type: 'button', class: 'btn primary', onclick: next }, last ? (present ? 'Done' : 'See score') : 'Next card'),
    );
  }
  function next() {
    if (i < MYTHS.length - 1) {
      i++;
      show();
      return;
    }
    // end
    timer?.stop();
    F.options.replaceChildren();
    G.show(false);
    card.className = 'mf-card';
    if (present) {
      card.textContent = 'That was all five.';
    } else {
      const best = saveBest('mythfact', score) ? score : getBest('mythfact');
      card.textContent = `Score ${score}/${MYTHS.length} · best ${best}/${MYTHS.length}`;
    }
    F.feedback.hidden = true;
    F.footer.replaceChildren(h('button', { type: 'button', class: 'btn primary', onclick: restart }, 'Play again'));
  }
  function restart() {
    i = 0;
    score = 0;
    show();
  }

  // swipe
  let x0 = null;
  card.addEventListener('pointerdown', (e) => {
    if (revealed) return;
    x0 = e.clientX;
    card.setPointerCapture?.(e.pointerId);
  });
  card.addEventListener('pointermove', (e) => {
    if (x0 == null) return;
    card.style.transform = `translateX(${(e.clientX - x0) * 0.6}px) rotate(${(e.clientX - x0) * 0.03}deg)`;
  });
  const end = (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0;
    x0 = null;
    card.style.transform = '';
    if (Math.abs(dx) > 70) pick(dx < 0 ? 'myth' : 'fact');
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', () => {
    x0 = null;
    card.style.transform = '';
  });

  return {
    start: restart,
    stop: () => timer?.stop(),
    toggleGiven: () => G.toggle(),
    closeGiven: () => G.close(),
    onKey(k) {
      if (k === 'Enter') {
        if (!revealed) reveal();
        else next();
        return true;
      }
      if (k === '1') return pick('myth'), true;
      if (k === '2') return pick('fact'), true;
      if (k === 'ArrowLeft' && !revealed) return pick('myth'), true;
      if (k === 'ArrowRight' && !revealed) return pick('fact'), true;
      return false;
    },
  };
}
