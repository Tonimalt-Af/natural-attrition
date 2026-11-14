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

## Cycle 4 – fresh-eyes first-time-player run
Method: played the live build in Playwright as a first-time player (no debug, 1280×800 and 390×844, ~10 real minutes, screenshot every ~90 s, `e2e/live10.mjs`), then debug-accelerated through the rest and re-read every act/twist/ending screenshot. (Tooling note: the sandbox pauses background processes between tool calls, so long timed runs must stay in one foreground call.)
Findings → changes
- **The jokes were invisible.** All the log writing lived in a hidden "Log" tab; a first-time player never saw a single cut line. → added a permanent **Ticker** under the header showing the newest log line (tone-coloured, fades in), plus a Day-1 opening line.
- **Mobile Directory was unreadable** (name column clipped off-screen, horizontal scroll after tapping). → mobile layout drops Dept/Net columns, fixed column widths, full-width Transition buttons; no horizontal overflow at 390 px.
- First minute: "Next goal" and the list both said *Nothing pending. We've checked.* back to back. → the goal card now tells you ideas arrive as Slides accumulate.
- Dead time: the last ~9 min of Act I was just saving cash for the Synergy Memo. → memo cash 360k → 270k (Act I now 33–36 min).
- Writing: eight Hollis "Observation" mails shared one subject and a repeated tic → distinct subjects, sharper bodies (demand, cash, exposure).
- Verified unchanged/healthy: no console errors on either viewport over 10 min; Act II treemap + Alligator chart, redesign modal, Reality Lens, Market Field, Act IV document and both endings re-read; 0 axe violations; all UI flows pass.

## Final pacing (minutes, headless bot, seeds 1–3, after Cycle 4)
| mode | seed | Act I | Act II | Act III | Act IV | total |
|---|---|---|---|---|---|---|
| greedy | 1 | 33.8 | 36.9 | 31.4 | 8.0 | 110.2 |
| greedy | 2 | 33.6 | 37.3 | 31.3 | 8.0 | 110.3 |
| greedy | 3 | 35.8 | 41.3 | 32.5 | 8.0 | 117.6 |
| lazy | 1 | 32.3 | 79.5 | 27.0 | 9.7 | 148.5 |
| lazy | 2 | 31.5 | 77.3 | 30.0 | 9.7 | 148.5 |
| lazy | 3 | 33.0 | 88.5 | 27.0 | 9.7 | 158.3 |

Idle (never touches anything): the company keeps attriting and earning, no crash/NaN, never walled.

## Known issues / not done
- Act I's last stretch (saving for the Synergy Memo) is still the flattest part; the bot's early purchases lag a human's, so real Act I may run a little shorter than the bot's 34–36 min.
- Act III UI is less polished than I–II; Act IV is deliberately bare.
- No sound, no French, no Case Files screen, no Konami easter egg (see README deviations).
- Real-human pacing is unknown; only the bot and screenshot checks were available.
