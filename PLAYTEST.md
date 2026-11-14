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

## Cycle 5 – dead time and useless-feeling purchases (Acts I–IV)
Trigger: a live player at ~35 min sat on 13.5K Slides and $10M doing nothing, QVO associates "did nothing", and the Act II start showed "QVO Partners affordable in 16 min".
Method: two new human-like bots (`aggressive`: buys everything affordable, spams associates/pizza; `clicky`: acts every 0.5 s) and `tools/deadtime.ts`, which logs every stretch where the player has no meaningful purchase or action available, plus Slides surplus and useless buys (`node tools/deadtime.ts modes seeds [--md]`, report in `reports/deadtime.md`).

Dead spots found → fix
| where | what was blocking | fix |
|---|---|---|
| Act I, ~6–31 min (aggressive bot: 12–22 min gaps) | Associates burned the cash the next initiative needed; Slides piled up (13K–900K unused) because nothing sold for Slides | In-game associate cap (12 in Act I, 40 later) with the cap shown on the card; new **Strategic Deck** (unlocks with Slide Stack): presents surplus Slides to the Street for capped cash, 15 s cooldown |
| Act I end, memo | Fixed 90k cash while profit was small; "affordable in 10 min" and the card also hid the headcount gate | memo cash 90k → 75k; the Next goal card now names the blocker (Slides / cash / headcount ≤ 520 with "now N") and a sane ETA |
| Act II start, QVO Partners "16 min", Leveraged Recap "73 min" | Flat prices set for a bot that never over-earned | **Value-based pricing**: nothing costs more than ~4 min of current profit in Act I/III, ~3.2 min in Act II (cash-minimum items excluded) |
| Act II, targets | Smallest acquisition cost ~3.5 min of profit, so the target list was out of reach for long stretches | ~1 in 3 targets is now a cheap "tuck-in" |
| Act II start | "1,000 employees, 100% integrated" while humans were 380 | One-time zoom-out caption, HQ block shows "N ppl / 1,000 roles", left panel says Roles (org chart) vs Humans (in the roles), caption explains the gap |
| Act II integration | Blocks integrated one after another from 0 to 100% | **Day-1 synergies**: 30–55% of acquired roles cut at closing (more at higher intensity, with a scandal bump), then **waves every 20 s across all open blocks in parallel** (visible as the dotted unintegrated areas shrinking in steps, with memo-speak log lines). Saves migrate v2 → v3 (in-progress blocks kept, wave buffer starts empty) |

Max dead gap per act, minutes (before → after; before = parent commit 1cdafd1, aggressive bot; greedy/lazy had none over 2 min in Act I but wasted Slides)
| mode | Act I | Act II | Act III |
|---|---|---|---|
| greedy | 0.7 → 0.7 | n/a → ≤1.3 | 0.2 |
| lazy | – → ≤0.6 | – → ≤0.6 | – |
| aggressive | 12–22 → 0.9–1.9 | – → ≤2.0 | ≤1.2 |
| clicky | – → 1.1–1.8 | – → ≤1.6 | ≤1.1 |
The pacing tests now assert a max gap ≤ 2.5 min for greedy/aggressive/clicky.

Pacing after Cycle 5 (minutes, seeds 1–3)
| mode | seed | Act I | Act II | Act III | Act IV | total |
|---|---|---|---|---|---|---|
| greedy | 1 | 28.9 | 31.3 | 26.4 | 8.0 | 94.6 |
| greedy | 2 | 27.5 | 33.5 | 26.6 | 8.1 | 95.7 |
| greedy | 3 | 27.7 | 35.1 | 26.2 | 8.1 | 97.1 |
| lazy | 1 | 29.3 | 109.5 | 7.5 | 9.7 | 156.0 |
| lazy | 2 | 25.5 | 117.8 | 6.7 | 9.8 | 159.8 |
| lazy | 3 | 25.5 | 114.8 | 6.0 | 9.7 | 156.0 |
| aggressive | 1 | 38.8 | 39.0 | 23.4 | 8.1 | 109.3 |
| aggressive | 2 | 39.1 | 37.5 | 24.4 | 8.0 | 109.0 |
| aggressive | 3 | 39.6 | 39.9 | 24.4 | 8.1 | 112.0 |
| clicky | 1 | 30.5 | 37.4 | 24.1 | 8.0 | 100.0 |
| clicky | 2 | 35.4 | 42.4 | 23.6 | 8.0 | 109.4 |
| clicky | 3 | 34.7 | 41.0 | 23.3 | 8.0 | 107.0 |

Pacing windows adjusted: Act II [28,47], Act III [22,42], total [88,125]. The greedy bot is now faster than before (value-based pricing removes flat-price waits); real players in the aggressive modes land around 100–112 min.

## Final pacing (minutes, headless bot, seeds 1–3, after Cycle 4, superseded by the Cycle 5 table above)
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

## Cycle 5b – Act III bids "enabled" but dead (reported by Adrien)
Cause: `bid()` refused with `'orc'` (cumulative size > 50% of the economy without Regulatory Capture) and only mailed the ORC, while the Bid buttons only checked cash. Fix: pure `canBid()` in the engine; the target list disables each button with its reason (Walled off: ORC / Fully consolidated / Need $X) and shows one banner (satire + "Unlock: Regulatory Capture" with cost and ETA); the Next goal card points to Regulatory Capture when every bid is ORC-walled. Regulatory Capture now appears at 30% consolidation (was 40%), costs 3,000 Slides and 1 min of profit (was 4,000 / 5 min); aggressive/clicky bots now buy it within ~1 min of hitting the wall (was never). Tests cover canBid purity, the goal card, and a ≤2.5 min wall wait for both bots. New fixture/screenshot `act3-orc`.
