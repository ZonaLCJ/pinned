# Pinned! How interface states tame the Schottky barrier

Static teaching site for the graduate course *Introduction to Semiconductor*: how interface
states pin the Fermi level and weaken the dependence of the Schottky barrier height on the
chosen metal. An intro animation ("From chip to band diagram"), four sections, each with a
live simulation, two scripted demos and a quiz, and a detailed-mode "Going further" block on
pinning at a MOS gate.

Simulation controls (Sections 1–3): interface (Ideal | Preset | Custom), semiconductor
(Si | GaAs | Ge | GaN), doping type (n-type electron barrier | p-type hole barrier) and
temperature (200–450 K) under "Settings". Every band diagram in Sections 1–4 shows moving
carriers (with a "Pause carrier motion" button; paused under prefers-reduced-motion) and a
caption written live from the engine state. Section 3 adds the Bardeen limit (S = 0), a
log-scale J–V plot and a four-semiconductor comparison. Quizzes, demos, the Section 4 contact
model and both animations stay at n-type, 300 K, Si/GaAs.

Plain HTML, CSS and vanilla ES modules. No framework, no build step, no dependencies.
External resources (pinned, with SRI): KaTeX 0.16.11, qrcode-generator 1.4.4 (both from
jsDelivr) and Google Fonts (IBM Plex Sans / Mono).

## Run locally

```bash
python3 -m http.server
```

Then open <http://localhost:8000/>. ES modules need a server; opening `index.html` from disk
will not work.

## Test the physics engine

```bash
node --test
```

`tests/engine.test.mjs` checks every value listed in spec §5.7 (ideal preset, Si/GaAs preset
barriers, slopes, γ, limits, pivot invariance, charges, mission sets, toy contact model), a few
extra invariants (monotonic charge residual, no input mutation, C–V intercept), the numbers
quoted by the intro animation (stage 4 and 5) and the MOS gate model (thresholds, dψs/dVG).

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (the site lives at the repository root).
2. Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/ (root)`.
3. Set `SITE_URL` in `js/config.js` to the Pages URL, e.g.
   `https://<user>.github.io/<repo>/`, so the QR code points to the public detailed-mode page.

All URLs are relative, so the site works under a sub-path.

## Configure

`js/config.js` holds everything you are expected to edit:

| Constant | Meaning |
|---|---|
| `TITLE` | Site title (used in the header, `<title>` and the hero) |
| `SITE_URL` | Public URL; the QR encodes `SITE_URL + '?mode=detailed'` (falls back to the current address) |
| `AUTHORS` | Footer author line (shown as TODO until set) |

## Modes

* `?mode=present`: Outline mode, the slides for the live talk (intro slide + one section per
  screen, no scrolling, fits 1280×720 to 1920×1080). The URL keeps the value `present`.
* The "Going further" MOS block exists only in detailed mode.
* `?mode=detailed`: detailed mode for phones and laptops (one scrolling article).
* Without the parameter the last choice (localStorage) is used; first visit = Detailed.
* Phones (screen's shorter side < 600 px and a coarse pointer, see `isPhone()` in `js/modes.js`)
  always get Detailed mode: `?mode=present`, a saved choice, the toggle and `M` are ignored there,
  and the saved choice is left untouched for other devices.
* The header toggle (or key `M`) switches modes.
* The Σ header button (or key `S`) opens the Symbols page in both modes: every symbol and plot
  marking with its meaning, unit and section, with a filter box.
* Every quiz question has a "Given & formulas" box with the values and formulas needed to work
  the answer out by hand (expanded in Detailed mode; behind a button and `G` in Outline mode).

### Outline-mode keys

| Key | Action |
|---|---|
| ← / → | previous / next section |
| A / B | Demo A / Demo B (A plays the intro animation) |
| C | contact animation (Section 1), back to the chip (Section 4) |
| H | open the quiz |
| G | quiz: Given & formulas (open / close) |
| Space / R | pause-resume / replay the demo |
| Enter, 1–4 | quiz: reveal or next round, pick an option |
| D | More drawer (concept, derivation, assumptions); Esc closes |
| F | fullscreen |
| Q | QR code to the detailed site |
| S | symbols and what they mean (both modes) |
| ? | key map |

## Layout

```
index.html
css/tokens.css  base.css  present.css  detailed.css
js/config.js          site constants
js/engine.js          pure physics, no DOM: the single source of truth for every number
js/facts.js           numbers quoted in the prose, computed with the engine
js/state.js           shared simulation state, presets, subscribe()
js/demo-player.js     scripted demos + caption bar
js/modes.js  qr.js  overlay.js  presenter.js (key map)  symbols.js (Symbols page)
js/layout-present.js  layout-detailed.js  layout-common.js  content-extras.js  main.js
js/plots/*.js         band diagram + ladder, charge comparison, MIGS, charge bars, budget,
                      φB–φm, heatmap (+contours), C–V, J–V, ρc–t, I–V, MOS band + ψs–VG (hand-written SVG)
js/ui/live-band.js    band diagram with moving carriers, real crossing rate and live caption
js/captions.js        the live caption sentences (from the engine state)
js/sections/s0.js     intro: "From chip to band diagram" (Animation 1)
js/sections/s1–s4.js  content, simulation, demos and quizzes of each section
js/sections/mos.js    "Going further": the gate that can't switch (Animation 2, detailed only)
js/chip-anim.js       Animation 1 component (intro and Section 4 "Back to the chip")
js/hooks/*.js         quizzes (Sign it!, Predict and lock, Mission, Build a contact, Myth or fact);
                      given.js: the "Given & formulas" content of every question
js/ui/*.js            DOM helpers, controls, formatting, KaTeX helper, storage
data/materials.js     Si, GaAs, Ge, GaN, Table 9.1 metals, presets, slider ranges, MOS and intro settings
data/course-data.js   values digitized from / quoted on the course slides
tests/*.test.mjs      node --test (engine, and quiz answers from the Given & formulas boxes)
```

## Model limits

1D; uniform D_it with a single neutral level; interfacial layer as a uniform dielectric;
Boltzmann statistics (degenerate doping is flagged); no image-force lowering; no barrier
inhomogeneity; the Section 4 contact-resistance model is a qualitative toy. Temperature changes
only N_c, N_v (∝ T^1.5) and kT: E_g, χ, φ0 and D_it keep their 300 K values, with full
ionization. Hole currents use A* = 120 A cm⁻² K⁻² (approx., free-electron value). The carrier
animation exaggerates energies (kT_display = 0.12 eV × T/300 K); the real crossing rate is shown.
The J–V plot ignores series resistance and image-force lowering.
