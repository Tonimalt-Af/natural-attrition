# Playtest log

Two instruments: (a) the headless TypeScript bot (`tools/bot.ts`, modes greedy / lazy / idle) for pacing; (b) Playwright with system Chrome at 1280×800 and 390×844 (`e2e/run.mjs` screenshots of every act, twist and ending; `e2e/play.mjs` real click-through flows; `e2e/a11y.mjs` axe-core + keyboard + reduced motion). Screenshots were opened and looked at every cycle.

Spec pacing targets (min): Act I 30–42, II 33–47, III 28–42, IV 8–12, total 95–125, lazy ≤ 180.

## Cycle 0 – calibration (bot only)
Findings → changes
- Act II uneven/slow → base price P0 175, stock-funded price factor.
- Act III either 14 min or never finished (cliff): bot wasted cash on integration tiers with nothing to integrate, ATM runaway, racks eating all cash → racks/initiatives priced in minutes of *peak* profit (`piBase`), ATM 1.5e-7, debt-first funding flag, required-first ordering.
- Act IV only 6.5 min → ANALYSIS 90 s / SUNSET 120 s (≈ 8 min).
- Determinism bug (`Math.random` in a removed helper) and a Jaws-chart `phiF` blow-up in Act IV fixed; unit test added.

## Cycle 1 – first screenshots (desktop + mobile)
Findings → changes
- Mobile: vitals card overlapped the stage (stale `grid-area`) → reset to `auto`, 2-column vitals grid.
- Jaws chart clipped on the right, and read "Closed Loop" during Act II (act index off by one) → measure inner div, fix `actT`.
- Market Field looked like a random checkerboard → cached smooth-noise rank blobs.
- SaaS skin leaked into the Act IV document → disabled in Act IV.
- Nothing told a new player what to do → first-run hint + one-click "Transition 3 from the Innovation Lab".
- e2e: redesign modal blocks clicks → tests wait out its 3 s lock.

## Cycle 2 – click-through + second screenshots
Findings → changes
- `play.mjs`: new game, cut, directory cut, wave, person card, reload/Continue, Act I→II, bid, Act IV both endings: all pass after the modal-dismiss helper.
- **Death spiral in Act I (minutes 3.5–6.5):** the first incident (a keeper leaving) took 35 % of *revenue* while profit margin is ~1.5 % → profit −370/s, cash 0, Market Cap read $0 for ~3 minutes and the Alligator chart collapsed. Pure dead time. → incidents/hallucinations now eat a share of *profit* (60 % / 45 %) plus a 0.4 % revenue sliver, 90 s; displayed Market Cap floored so it never reads $0. Early profit now stays ≥ 0 for the greedy bot; incidents still bite.
- Re-tuned pacing after the change (table below).

## Cycle 3 – accessibility / Stable UI
`e2e/a11y.mjs` found, on the first run:
- badge text contrast 2.76–3.4 (white on light red) → darker badge;
- Act IV grey text #777 (4.47) → #606060; Act IV progress bar had no accessible name → `aria-label`;
- Stable-UI "Next goal" card muted text contrast 3.9 → fixed;
- tab strip clipped "Settings" at wider text → tabs wrap.
After fixes: 0 serious/critical axe violations on Acts I–IV (default and Stable), Tab reaches 25 distinct controls with a visible focus ring, `prefers-reduced-motion` auto-enables Stable UI, no console errors on either viewport.

## Final pacing (minutes, headless bot, seeds 1–3)
| mode | seed | Act I | Act II | Act III | Act IV | total |
|---|---|---|---|---|---|---|
| greedy | 1 | 36.2 | 39.4 | 32.6 | 8.0 | 116.2 |
| greedy | 2 | 36.0 | 39.2 | 31.6 | 8.0 | 114.8 |
| greedy | 3 | 37.7 | 42.5 | 30.8 | 8.0 | 119.0 |
| lazy | 1 | 35.3 | 75.8 | 29.3 | 9.7 | 150.0 |
| lazy | 2 | 33.8 | 76.5 | 30.8 | 9.7 | 150.8 |
| lazy | 3 | 33.8 | 77.3 | 30.7 | 9.7 | 151.5 |

Idle (never touches anything): the company keeps attriting and earning, no crash/NaN, never walled.

## Known issues / not done
- The last ~9 min of Act I is mostly saving for the Synergy Memo (cuts and quarters keep you busy, but it is the flattest stretch).
- Act III UI is less polished than I–II; Act IV is deliberately bare.
- No sound, no French, no Case Files screen, no Konami easter egg (see README deviations).
- Real-human pacing is unknown; only the bot and screenshot checks were available.
