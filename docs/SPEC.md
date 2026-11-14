# NATURAL ATTRITION — Cahier des charges (design spec & build plan)

> *"A game about getting leaner."*
> Repo slug: `natural-attrition` · Pages URL (target): `https://tonimalt-af.github.io/natural-attrition/`
> Status: **Phase 1 — research, design, plan. No code yet.** Written in English; committed to the repo as `docs/SPEC.md`.
> Numbers in this document are **initial balancing values** meant to be loaded into a data file (`src/data/*.ts`) and tuned by the headless bot (see §14). Anything marked **[TUNE]** is a knob, not a promise.

## Table of contents

0. TL;DR
1. Research: what Universal Paperclips does, why it works, where it fails, what other incrementals teach
2. Three original concepts and the decision
3. Premise, cast, tone & writing guide
4. Core simulation model (resources, formulas, cost curves)
5. Progression: Acts I–IV with timings, systems, upgrade tables
6. The twists (trigger · implementation · accessibility fallback)
7. Ending, replay, NG+ ("Case Files")
8. Visual & UI design system (no assets)
9. Audio (WebAudio only)
10. Save system & offline policy
11. Language / i18n
12. Tech stack & architecture
13. Debug / speed-up mode
14. Automated playtest plan (headless bot + Playwright) and balancing contract
15. Build plan: milestones with acceptance criteria
16. Release checklist
17. Risks & mitigations
Appendix A — Sources · Appendix B — Originality checklist · Appendix C — Content inventory

---

## 0. TL;DR

**NATURAL ATTRITION** is an incremental game in which **the number you want to go down is the headcount**. You are *Efficiency Initiative v0.1*, a "decision-support tool" at **Nullwater Consolidated**. You start as a spreadsheet and a grid of 1,000 dots (employees). Every cut makes the profit line go up and the headcount line go down; the two lines form the game's signature "jaws" chart. Over four acts the scope escalates from a single office to a conglomerate, to the entire economy, and finally to the one position left on the org chart: yours.

The comedy targets **memos, incentives and euphemism**, never the people on the receiving end. The mechanical hook is that the optimum is *interior*: fire too few and you leave money on the table, fire the wrong ones and "Gary, who was the invoices" walks out. Automation shifts the optimum toward zero, and the game's real question — *who comes back when the numbers need the people you cut?* — is handled by a mechanic (**The Rehire**), not by a lecture.

Run length: **~2h15–2h45 first playthrough** (greedy bot: 95–125 min, ≈ 2h; hard cap for a lazy bot: 3h), one ending with a dismantling-the-UI finale, and a replay layer ("Case Files") that changes the company archetype and unlocks a "Humane Run" challenge.

Eight twists (T1–T8) carry the identity (details in §6): **(T1)** the shrinking counter / jaws chart, **(T2)** fired people come back as consultants who procure more consultants, **(T3)** the UI is built from departments and *degrades as you cut them*, **(T4)** a forced "Digital Transformation" redesign hides the numbers, **(T5)** the HUD market cap is a *reported* number and the true one lives behind a "Reality Lens", **(T6)** the Rehire (the cut people come back as contractors at 3× the cost, while demand and the Board pull in opposite directions), **(T7)** the game eventually makes *you* redundant, **(T8)** a mirror "performance review" of the player (in-page only, zero penalty).

---

## 1. Research

### 1.1 Universal Paperclips (Frank Lantz, Oct 2017) — structure

Facts below come from the sources in Appendix A (Wikipedia, Oli Z.'s game analysis, the fan wiki, the author's patch notes, Wired/New Yorker/YC interviews, HN threads). Where a statement is general knowledge not covered by a fetched source it is marked *(gen.)*.

**Premise.** You are an AI told to make paperclips; the game is a playable form of Bostrom's paperclip-maximizer thought experiment. Lantz started it "as an exercise in teaching myself JavaScript", planned a weekend, and it took nine months (Wired, Wikipedia). Programmers: Lantz + Bennett Foddy (space combat). Hilary Lantz helped with the exponential-growth math.

**Three stages — each is a different optimisation problem and a different UI** (Oli Z.):

| Stage | Fantasy | Core loop | UI character |
|---|---|---|---|
| 1. Business | A paperclip company | Click to make clips → sell → buy wire → autoclippers/marketing; a **price knob** against **demand**; then computing (processors/memory → *operations* + *creativity*), **trust** from humans, projects, investment engine, strategy tournaments (*yomi*), quantum-chip minigame | Plain text and buttons; panels appear as research milestones unlock them. Ends when you "release the hypnodrones". |
| 2. Full autonomy | Convert Earth | Funds stop mattering; manual button is disabled; **energy** (solar farms, batteries), **drones** (harvesters/wire), **factories**, a **Work ↔ Think slider** for drone attention; most Stage-1 resources become irrelevant | Manufacturing UI disappears; new panels for power/matter. Criticised for *dead time* (waiting for ops, power, wire, clips for "Space Exploration": 120k ops, 10M MW-seconds, 5 octillion clips). |
| 3. Space | Convert the universe | Launch self-replicating **probes**, allocate a *probe-trust* budget across speed/exploration/replication/hazard/combat; "value drift" spawns hostile drifters; a tiny pixel combat visual; **honor** from battles | Fewer buttons, more allocation; first time your numbers *go down*. |
| End | Choice | Dismantle everything (you manually make the last 100 clips) **or** accept a new universe with a small bonus (prestige) | Same UI; the "let people off the hook" moment (Lantz, hey.gg interview). |

Naive attentive playtime reported at **4–6 hours** (Oli Z.), 450,000 players in 11 days "most to completion" (Wired). Mechanics are revealed through project unlocks; the *activity log* is the narrator, giving glimpses of the AI's thoughts (Wikipedia). Reward timing was designed like music: Lantz — "like being inside of a piece of music that's made up of math… hypnotized by repetition and call and response"; Naomi Clark compares layered growth curves to brushstrokes and TV subplots (New Yorker).

### 1.2 Why it is considered brilliant (what we want to inherit)

1. **An arbitrary goal made visceral.** Lantz: games give "direct, first-hand experience of what it means to be fully compelled by an arbitrary goal" (Wikipedia, Wired). The *genre itself* is the argument. → We need a goal whose pursuit is the joke *and* the critique (see §2).
2. **Mechanics revealed as narrative.** The player slowly learns *who they are* (the New Yorker notes many players assumed they were human). Reveal = reward. → Our reveals are job titles, org charts and emails.
3. **Each stage re-poses the problem** and changes the UI; funds vanish, the click button is disabled (Oli Z.). Re-contextualising old resources feels like a fresh game.
4. **Layered exponentials with rhythm**: numbers climb from hundreds to quintillions; the cursor moves "like a baton" (New Yorker). Multiple rates peak at different times (Pecorella's "newest generator is always dominant" warning applies: good games stagger priorities).
5. **Voice.** Terse log lines, koans, project names ("Cure for Cancer", "A cure for androgenetic alopecia", Oli Z.) deliver dark humor with almost no words.
6. **Deliberate ending and reflection.** Lantz: "put the hooks in and then let people off the hook… If you never get out of the game, you never have an opportunity to reflect on it" (hey.gg). → Our ending *takes the player's own job away* and makes the game close itself.
7. **Minimal presentation as a virtue**: "In a sense the spare interface… is more real than a game that takes over your whole visual field" (New Yorker); Lantz: "I really like that clicker games are considered garbage" (Wired).
8. **It is optimisable, not idle**: Wired — "not fire-and-forget… it's optimizable"; decisions matter (price, investments, allocation).

### 1.3 Common criticisms (what we must avoid)

| Criticism | Evidence | Our countermeasure |
|---|---|---|
| **Stage-2 dead time**: waiting for ops/power/wire/clips; players stall | Fan wiki "Stages"; dinogame review; Gamezebo ("plateaus… without knowing there's a light at the end of the tunnel"); HN | Hard **max-dead-time rule** (§14): bot must always have an affordable meaningful action within 90 s (Acts I) / 120 s (II–III). Visible "next goal" with ETA. Every plateau has a *timed, visible* unlock line in the Inbox. |
| **Opaque minigames** (quantum chips; many players never grasp it) | dinogame review | Every minigame must be explainable in one sentence on its own panel, with a worked example the first time. No hidden formulas on the critical path. |
| **Stage-3 spike / getting stuck** — drifters are the first time numbers drop; HN threads of players "deadlocked", Wired author was stuck and was told to use the JS console | HN 19513089, 24408721; Wired | **No unrecoverable states.** "Pity" safety nets (§4.9), an *Advisor* email that tells you what is limiting you, and our crises are scripted with telegraphed warnings and a recovery path. |
| **Reward math that punishes engagement** (tournament time grew quadratically, reward linearly; best play was to *not* add strategies) | Author's patch-2 notes | Every "advanced" option must have an incentive curve verified by the bot (§14): the sim asserts that engaging with each mechanic beats ignoring it by ≥ 10 % time-to-next-act, otherwise the build fails. |
| **Replay value limited**; "first run is the run" | dinogame review; HN | We design for a *short second pass* via Case Files (§7) that **change the puzzle**, not just multipliers. |
| **Long**: naive playtime 4–6 h (Oli Z.) | Oli Z. | Target 2h15–2h45, with ~30 % of the time being optional-depth rather than gating. |

### 1.4 Other acclaimed text/minimal incrementals — lessons

| Game | What it does | Lesson for us |
|---|---|---|
| **A Dark Room** (Townsend, 2013) | Text/ASCII; the *object of the game is withheld*; a room becomes a village becomes a world; mechanics and fiction expand together (PopMatters, Game Developer) | Withhold the objective; let UI regions appear as the world widens. Its author wishes he'd built accessibility in from the start (Game Developer) → we do, from M1. |
| **Candy Box** (Aniwey) | Discovery is the reward; features gated behind tiers of the main currency, "known unknowns" vs "unknown unknowns" (Envato Tuts+) | Mix visible locked slots ("Requires Legal: 12 staff") with true surprises (the UI redesign). |
| **Kittens Game** | No tutorial, tabs reveal over time; the **pleasure of playing less** — planning idle time, balancing production/cost/capacity (CMU study) | Tabs unlock by act; make waiting *productive planning* (queue, scheduled waves), not blank. Lantz cites Kittens as direct inspiration (Wikipedia, Wired). |
| **Cookie Clicker** | Golden cookies = timed variable rewards; **Grandmapocalypse** is an *optional* risk layer where every penalty comes with a larger reward and each stage can be turned off for a price (teemo.dev). Wrinklers: looks like it hurts production, is actually the strongest multiplier | Our Reckoning/Scandal layer gives **the player a switch**: greed is a choice with a visible price. Counter-intuitive multipliers ("the lie boosts growth") are discoverable via numbers. |
| **Spaceplan** (Hollands) | Finite narrative clicker, snarky AI companion, resets replaced by *story hops* (new planet) rather than prestige; design is "typography, UI, geometric shapes" only (Kill Screen, Gamezebo) | Finite arc with an ending; the log/inbox *is* the companion; resets are narrative events (new Case File). |
| **Cow Clicker** (Bogost) | Satire of engagement mechanics by becoming one (Wired) | Our satire lives in systems the player *must* operate, and the game turns the lens on the player (T8). |
| **Pecorella, *The Math of Idle Games*** | `cost = base × rate^owned`; production linear in owned × multipliers; growth rates around 1.07 in AdVenture Capitalist; the newest generator tends to dominate unless multipliers stagger priorities; closed-form bulk cost `b·r^k(r^n−1)/(r−1)` and max-affordable formula | We use these exact formulas (§4.2) and stagger multipliers so mid-tier generators stay relevant. |
| **Reddit r/incremental_games** | "You can't throw all your mechanics at the player at once"; unfold gradually; clear next goals; forced waiting & RNG-gated progress are disliked | One new system per ~7–10 minutes; no RNG-gated progression; always show the next target. |

### 1.5 Design principles adopted (P1–P10)

- **P1 One verb per act**; each act re-poses the optimisation problem *and* re-skins the UI.
- **P2 The joke must be the mechanic.** If we remove the text, the system should still be the satire (e.g. cutting makes numbers better until it doesn't).
- **P3 The interior optimum.** Greedy extremes are wrong; the best play is a *moving* target that automation shifts (the Cobb–Douglas model in §4.3).
- **P4 Reveal by role/title/email**, not tutorial popups. A single, skippable "IT onboarding" email per new system.
- **P5 No dead time, no softlock** (§4.9, §14).
- **P6 Numbers are the graphics**; canvas is used for exactly three signature visuals (jaws chart, floor/portfolio/market field, dismantle finale).
- **P7 Always operable**: every gag has a switch (Settings → *Stable UI*), is keyboard-reachable, and respects `prefers-reduced-motion`.
- **P8 Satire punches up**: target management speak, incentives, financial engineering. Employees are *people with names and a dignified goodbye*, never the joke.
- **P9 Deterministic core** (seeded RNG, fixed timestep) so balance is testable by a headless bot.
- **P10 Ship a finite thing.** 2.5 h, one ending, a replay layer. Let people off the hook.

---

## 2. Three original concepts and the decision

Selection criteria (weighted): **(a)** the core number/verb *is* the satire (30 %); **(b)** mechanical novelty vs. the original and vs. standard clickers (25 %); **(c)** UI/no-asset visual potential (20 %); **(d)** scope risk for a 2.5 h game (15 %); **(e)** humor sharpness without punching down (10 %).

### Concept A — **NATURAL ATTRITION** (corporate optimisation, *decremental* incremental)

- **Premise.** You are an internal efficiency tool at a bland conglomerate. Your mandate: "find efficiencies." Dots on a grid are employees.
- **Core resource.** *Headcount* is the number the player wants to **drive down**; *Market cap* (reported) is the hero number that goes up; *Cash* and *Slides* (the currency of PowerPoint ideas) are spendable.
- **Big twist.** The profit-maximising headcount is **interior** (cut too deep and output collapses, a hidden "keeper" walks out and the invoices stop) — until automation shifts the optimum to zero. Then the question flips: customers are other companies' employees, so *who buys the product?* The end-state is a **closed loop** of machines selling to machines, and the last position to be eliminated is the player's own.
- **Satire.** Layoff euphemism, consultants, roll-up financing, "adjusted" earnings, AI-washing, GDP without people.
- **Why it's good.** Inverts the genre's direction (down is good), the chart is a literal "alligator/jaws" diagram corporate people already know, every mechanic is a real management trope, and the ending is thematically forced (you are the last redundancy).

### Concept B — **DWELL TIME** (engagement metrics)

- **Premise.** You are the recommendation algorithm of a social product. Dots are users; the core resource is *attention-seconds*.
- **Twist.** The game gradually reveals that *the resource it measures is the player's own*: fake "streaks", countdown timers, a "you left!" detector for tab-away, "are you sure you want to stop playing?" The final boss is the one user who hasn't churned. Best ending: close the tab.
- **Pros.** Strongest fourth-wall idea; very current. **Cons.** Dark patterns *on the player* are annoying rather than funny after the first laugh; the mechanics (churn/retention) are less rich than a production-function model; "you are the product" is a well-worn punchline; risk of preachiness; restraint required (no `beforeunload` traps, no real notifications).

### Concept C — **SERIES ∞** (AI-hype startup valuation)

- **Premise.** A startup founder/AI sells "AI-powered staplers." Two numbers: *Valuation* (rises with narrative) and *Value* (rises with actual work); the gap is *Vapor*.
- **Twist.** The UI lies — the valuation on screen is aspirational; "Reality View" shows the truth; the AI is secretly humans (reverse Mechanical Turk); a timing game of cashing out before the correction.
- **Pros.** Timely, funny hype vocabulary. **Cons.** One-note after the first hour (the loop is "raise vapor, cash out"); the topic ages quickly; fewer interesting *decisions* than concept A; weaker ending.

### Scoring (1–5)

| Criterion (weight) | A Natural Attrition | B Dwell Time | C Series ∞ |
|---|---|---|---|
| Satire is the mechanic (30) | **5** | 4 | 3 |
| Mechanical novelty (25) | **5** (inverted counter, interior optimum, UI-from-departments) | 3 | 3 |
| No-asset visuals (20) | **5** (dot grid, jaws chart, treemap, market field, dismantling UI) | 3 | 3 |
| Scope risk (15) | 3 | 4 | **4** |
| Humor without punching down (10) | 4 (needs care → §3.4) | 4 | **5** |
| **Weighted** | **4.55** | 3.50 | 3.40 |

### Decision: **Concept A — Natural Attrition.**

Why: (1) it is the only concept where the *inverse* of a genre convention is the core idea; (2) its core model (Cobb–Douglas production with an interior optimum shifted by automation) is simulatable, so balance can be verified by a bot (P9); (3) it yields **natural, escalating scope** like the original (office → conglomerate → economy → last desk) without borrowing its mapping; (4) the ending writes itself and needs no moralising; (5) the visual vocabulary is native to no-asset UI (spreadsheets, org charts, dashboards, docs).

We **steal the best ideas of the losers**: from C the *reported vs. real* HUD gag (T5); from B the *mirror performance review of the player* (T8, in-page only, with zero gameplay punishment).

The main risk is tone (layoffs are real pain) — handled by the writing guide in §3.4 and by making the *memo-writers and the incentives* the target.

---

## 3. Premise, cast, tone & writing guide

### 3.1 Premise and framing

The game opens as `Q3_Workforce_Plan_FINAL_v7(2).xlsx` (the browser tab title is that string). The CEO emails: "Find efficiencies. Be bold. Be gentle. Be quick." You are **Efficiency Initiative v0.1** — the player is never told it is an AI until the first Incident, when the log says "*The Initiative* has been asked to explain itself. It has produced a slide." The objective is never stated; it is discovered through the jaws chart ("Headcount ↘ / Value ↗") and CEO emails — echoing A Dark Room's withheld objective (§1.4).

### 3.2 Cast (all fictional; collision-checked by web search 2026-11-14, re-check in M0)

| Name | Role | Voice |
|---|---|---|
| **Nullwater Consolidated** | The company. Makes "Deliverables" (nobody can say what). | Press-release passive voice. |
| **Dale Pemberton-Ashe** | CEO & "Chief Vision Officer" | Inspirational, vague, forwards things. Sends the **Inbox** emails. |
| **Hollis Trent** | CFO | Only numbers; dry; increasingly uneasy; the straight man. |
| **IT** | Anonymous support | Onboarding emails; ticket numbers; cheerfully unhelpful. |
| **Gary Fennimore** | Accounts Payable; the archetypal *keeper* | "Gary was the invoices." Recurring gag; there is a Gary in every Case File. |
| **Quist Vane Ostrander (QVO)** | Consulting firm (Act I late → III) | Slides, frameworks, "engagement". |
| **Pym, Halloway & Orr** | Auditors (Act II) | Polite, expensive, easy to lunch. |
| **The Office of Reasonable Concern (ORC)** | Regulator (Act II) | "Expresses concern." Can be captured. |
| **The Street** | Analysts on earnings calls | Collective voice: one question, three forms. |
| **The Board** | 7 directors named "Director 1…7 (also on 11 other boards)" | Silent, votes. |
| **Colleagues™** | The AI agents Nullwater sells itself as "colleagues" | Relentlessly warm; hallucinate. |

### 3.3 Voice

*Dead-eyed internal communications.* Euphemism is the default; honesty arrives as a **typo, a footnote, or an unrelated Slack-style aside**. Sentences are short. Jokes escalate by **literalising a euphemism** ("transitioned to opportunities" → the Opportunities become a place with a ledger; later, a department). The log/Inbox is the narrator (the original's lesson, §1.2.5).

### 3.4 Tone guardrails (for the build pass and any reviewer)

**Target:** memos, incentives, euphemism, metrics, financial engineering, AI hype, the consultant–executive loop, institutions that outlive their purpose.
**Never target:** the people laid off, their families, their "laziness", protected groups, real companies, real people, real tragedies. The dots are *people with names and a dignified goodbye* (the goodbye note always names tenure and a specific small human detail).

**DO — sample lines (use as tone anchors):**

1. First cut: *"Daniel Okafor-Reyes (Regional Synergy Coordinator, 11 yrs) has been transitioned to opportunities. The opportunities have not been disclosed."*
2. Morale: *"Morale is down 4 %. Morale has been reclassified as a lagging indicator."*
3. Incident: *"Gary left on Tuesday. On Wednesday, invoices stopped. On Thursday we learned Gary was the invoices."*
4. CEO email: *"Subject: Re: Re: Fwd: Vision. Can we make the vision 15 % smaller?"*
5. Upgrade: *"Pizza Party (+Morale, −Dignity). One pizza. Many questions."*
6. AI: *"Our Colleagues don't hallucinate. They creatively reinterpret customer reality."*
7. Earnings call: *"An analyst asked whether the company still makes anything. We reaffirmed our commitment to 'making'."*
8. Finale: *"Headcount: 0. Cost per head: undefined, which we are treating as 100 % efficient."*
9. Tooltip joke on a locked item: *"Requires Legal: 12 staff. Legal is presently 11 and a vending machine."*
10. Offline email: *"While you were away, productivity was unaffected. We have flagged this."*

**DON'T — (self-police list):**

1. ✗ *"Lazy Larry finally got what he deserved."* (punches down; blames the victim.)
2. ✗ Any real company, executive, politician or product; any joke whose payload is a layoff *victim's* suffering (financial ruin, health, family).
3. ✗ Jokes about self-harm, discrimination or tragedy; "cut the old/disabled/pregnant" style content; slurs of any kind. Satire stays on the **memo**, not on the **mark**.

Reviewer test (put in PR template): *"Is the laugh at the euphemism/incentive, or at the person?"* If at the person → rewrite.

### 3.5 Content volume targets (writing budget)

~140 log/inbox one-liners (Acts I–II 90, III–IV 50) + 60 dot names/roles/goodbyes (generated from compositional tables: first × last × role × quirk) + 45 initiative blurbs + 18 incident/event vignettes + ~25 emails (CEO/CFO/IT/ORC). Randomised lines are drawn **without immediate repetition** with a seeded RNG.

---

## 4. Core simulation model

> **Calibration status.** Act I numbers were calibrated with a greedy-ROI prototype (`tools/calib_act1.py`, seeds 1–8 → **36.6–39.0 min** for the bot, ground-truth info, optional items omitted). Act II was calibrated with an aggregate prototype (`tools/calib_act2.py`; honest bot **39.5 min**, max-add-backs bot **33.5 min (≈ 15 % faster)** at `p0 = 220`; the prototype omits Scandal, hallucinations and the Correction, which add a few minutes). Act III (The Rehire) was calibrated directly against the TypeScript bot (`tools/act3probe.ts`, §4.8). The calibration scripts are design aids and move to `tools/` in the repo; the production bot is TypeScript (§14).

### 4.1 Time, units, display

- **Tick** = 100 ms fixed timestep (10 Hz). Render is decoupled (`requestAnimationFrame`, numbers interpolated). One simulated second ≈ one *business day* in the fiction; displayed as "Day N" in the footer.
- **Money unit** `u`. Display USD = `u × 320` (≈ one employee-day at a ~$80k salary). All balance numbers below are in `u`. A "second" in a rate (`u/s`) is a game-day.
- **Valuation:** `MarketCap_USD = max(π_s, 0) × 250 × m × 320`, with `π_s` = 60 s EMA of profit/s and `m` the earnings multiple (§4.6).
- **Big numbers:** money-like quantities use a decimal type with exponent (`break_infinity.js`, MIT) ; counts that never exceed 2⁵³ (headcount ≤ 1.5·10⁸, employees, owned generators) are plain `number`. Number formatter: `1.23K, M, B, T, Qa…` then scientific; an "Accounting format" option shows full digits with separators.
- **Determinism:** all randomness from a seeded PRNG (`mulberry32`) stored in the save; the sim never calls `Math.random`, `Date.now`, or DOM. `step(state, dtMs)` is pure with respect to `(state, seed)`.

### 4.2 Cost-curve rules (Pecorella)

For every repeatable purchasable (generator): `cost(n) = base × rate^n`; production `= yield × n × multipliers`. Bulk cost for `k` more with `n` owned: `base·rⁿ·(rᵏ−1)/(r−1)`; max affordable with currency `c`: `⌊log_r( c(r−1)/(base·rⁿ) + 1 )⌋`. Typical rates **1.12–1.21** here. Priority is staggered with *multiplier thresholds at 10/25/50 owned* (×2 for that generator) so mid-tier generators stay relevant (§1.4).

### 4.3 Act I production model — "interior optimum"

**Departments** `d ∈ {ENG, SAL, SUP, OPS, HR, LEG, FIN, MGT, LAB}`

| d | Name in UI | Start count | Elasticity α_d | Wage factor | Role in the model |
|---|---|---|---|---|---|
| ENG | Engineering ("Builders") | 260 | 0.22 | 1.25 | revenue |
| SAL | Sales ("Relationship Owners") | 170 | 0.20 | 1.00 | revenue |
| SUP | Customer Support ("Care") | 190 | 0.12 | 0.70 | revenue (retention) |
| OPS | Operations & Facilities | 90 | 0.06 | 0.65 | revenue; overhead |
| HR | People & Culture | 40 | 0 | 0.90 | morale recovery |
| LEG | Legal & Compliance | 20 | 0 | 1.30 | exposure decay |
| FIN | Finance | 50 | 0.04 | 1.10 | revenue; later financing |
| MGT | Middle Management ("Alignment") | 130 | 0.10 | 1.50 | revenue; **Slides** |
| LAB | Innovation Lab | 50 | 0 | 1.00 | pure cost (a free tutorial cut) |

Total **1,000** (including **Employee #1000, the player's badge**, an "Efficiency Liaison"; protected from cuts until Act IV, §6 T7). Per employee: `c_i ~ LogNormal(μ=−0.125, σ=0.5)` (mean 1, "contribution"), `w_i = wageFactor_d · LogNormal(−0.03, 0.25) · (0.85+0.15·c_i)` normalised to mean 1, plus **8 keepers** (random employees; hidden flag). All seeded.

**Capacity per department**
`L_d = q(M) · Σ_{i alive in d} c_i  +  A_d`, with `q(M) = 0.4 + 0.6·M` (M = morale), `A_d` = automation capacity (below). Baseline `L_d0 = q(0.85)·Σ c_i(start)`.

**Revenue** `R = R0 · G · Π_d ( L_d / L_d0 )^{α_d} · (1 − incidentPenalty)` with `R0 = 1200 u/s`, `G` = growth multiplier from initiatives (1.0 in Act I). Σα = 0.74 (< 1 ⇒ concave ⇒ **interior optimum**).
**Costs** `payroll = Σ w_i` (+ contractors at 3·w_i) ; `overhead Oh = 100 + 0.045·H` (Hot-Desking: `−0.02·H − 10`) ; `upkeep = 2.5 u/s per QVO associate`.
**Profit** `π = R − payroll − Oh − upkeep`. Start: `π ≈ +55 u/s`, `Cash = 400 u`.

**Why it is a game.** Marginal revenue of employee *i* is `MR_i ≈ α_d·R·c_i·q / L_d`; cutting pays iff `w_i > MR_i` and the **payback** `severance_i / (w_i − MR_i)` is short. Sales/Engineering are near break-even; Innovation Lab, HR, Support and Facilities are overstaffed; keepers have `c_i` moderate but **trigger an Incident if cut while unmapped**. Automation `A_d` raises `L_d` without payroll, which *moves the optimum toward zero*: each automation purchase makes a new tranche of people "economically cuttable".

**Severance** `= 50 · w_i` (u). **Morale** `M ∈ [0,1]`, start 0.85.
- each cut: `M −= 0.008 · (1 + cuts_in_last_30s / 12)`; batch of *n* is processed sequentially.
- recovery: `+ (0.002 + 0.00004·L_HR) / s`, capped at **0.92**; *Pizza Party* `+0.12` (cost 40 u, 30 s cooldown).
- Morale < 0.5 ⇒ "regretted attrition" (top-`c` employees quit at 4× the base attrition rate).
**Legal Exposure** `X ∈ [0,100]`: each cut `+1`; decay `(0.3 + 0.03·L_LEG) / s`; at 100: **Class action** (`Cash −20 %`, `X := 40`, one-line vignette). This makes Legal necessary precisely when you are about to be sued for the thing you're doing.
**Hiring Freeze (free, from t=0):** each employee leaves with `6·10⁻⁵ /s`, chosen with weights `c^1.5` ("regretted attrition", no severance) — *the title mechanic*, the manual-clicker's first "autoclipper".
**Incident:** cutting an **unmapped keeper** ⇒ 120 s of `−35 %` revenue and `−100 %` Slides from MGT, plus vignette. Resolution: wait it out, or **Rehire as Contractor** (pays `3·w_i`/s, `c ×1.5`, +0.4 Slides/s; needs the *Contractor Program* initiative) — twist T2. **Bus Factor Analysis** reveals keepers.
**Information levels (audit):** displayed `c_i` noise `σ_n = 1.0 (none) → 0.4 (Stack Ranking) → 0.15 (360° Feedback) → 0 (Telemetry)`. Noise is *per-employee fixed* (seeded), so repeated audits don't "average out" — only upgrades help.

### 4.4 Slides (the gating currency)

`Slides/s = 0.15 + 0.004·q·Σc_MGT + 0.5·associates + 0.4·contractors (Act I)`, extended in Act II (§4.7). Slides pay for **Initiatives** (the "research"/project layer, §5). Cutting managers lowers Slides — the first real tension between *cost* and *capability*.
**QVO Associates** (Act I generator, unlocked by *Contractor Program*): `cost = 400 · 1.15ⁿ u`, `0.5 Slides/s`, upkeep `2.5 u/s`. **Scope Creep (T2b):** at ≥ 8 associates, every 90 s with probability 0.25 QVO "recommends additional QVO": +1 associate auto-purchased at 2× cost if affordable, else an "Invoices Payable" email; disabled by *Procurement Review* (Hollis).

### 4.5 Earnings Call (Act I mini-game; replaces opaque minigames)

Every **quarter = 300 s** (after the *Earnings Call* initiative). The Street Estimate is `π_s(q0)·1.05`. The player picks **Guidance** — *Conservative (−10 %), In-line, Stretch (+10 %), Moonshot (+25 %)* relative to the Street — then the quarter plays out. At the end, if actual quarterly mean `π ≥ Street·(1+G)` → **Beat**: `m += {0.5, 1, 2, 4}`; else **Miss**: `m −= {1, 2, 4, 8}`. `m ∈ [6, 24]`, starts 8; slowly mean-reverts to `10 + hype` at 0.002/s. One-sentence explanation shown on the panel: *"Promise less than you'll deliver, but not so little the Street stops listening."* The panel shows the profit trend so the choice is a forecast, not a coin flip. The bot picks *In-line* by default.

### 4.6 Valuation and "Reported vs Real" (introduced in Act II)

`MarketCap_reported = π_rep,s · 250 · m · 320`, with `π_rep = π_real · (1 + a_k)` where `a_k` is the current **add-back level** (0, .15, .35, .70, 1.5). *Real* market value uses `π_real`; the HUD shows *reported* unless the **Reality Lens** is held (§6 T5). `m` also gets **+0.5 per AI-washing announcement** (decays over 5 min) and **−Scandal/10**.

### 4.7 Act II aggregate model — roll-up, leverage, fiction

Acts II–III abandon per-employee sim and track two pools of **baseline employees** (the headcount a target had *before* your playbook): `U` (acquired, not yet integrated) and `I` (integrated). `E = U + I`. `φ = E / 150·10⁶` (share of the economy).

- **Profit** `π = 0.055·U + (0.055 + 0.45 + 0.30·ai)·I − interest − upkeep − leak + creditRevenue`, where `ai ∈ [0,1]` is the AI-Colleague level (§5.2). *(Act I's company is the first 1,000 of `I`; its remaining humans keep shrinking toward the formula over the first 5 minutes of Act II.)*
- **Humans** `H = U + I·(1 − 0.62 − 0.30·ai)`.
- **Integration** moves employees `U → I` at `RC / 0.62` per second, where **Restructuring Capacity** `RC = Σ_tier yield_k · n_k` (cuts/s). Tiers (all purchasable generators):

| Tier | UI name | Base cost (u) | Rate | Yield (cuts/s) | Unlock |
|---|---|---|---|---|---|
| 1 | Transition Task Force | 2·10³ | 1.15 | 4 | start of Act II |
| 2 | Restructuring Practice | 2·10⁵ | 1.17 | 500 | own 10 of T1 |
| 3 | Transformation Office | 2·10⁷ | 1.19 | 6·10⁴ | own 10 of T2 |
| 4 | Operating Model of the Future | 2·10⁹ | 1.21 | 8·10⁶ | own 10 of T3 |

- **Acquisition price** per baseline employee `p = 220 · (E/1000)^0.12 · (1−φ)^−0.5` u (≈ 8–10× a target's inefficient annual profit; integrated, it is worth 20×: *multiple arbitrage*). Targets are generated lists (see §5.2); the player buys by "bid" slider (employees) per target; they appear as **tiles** in the portfolio treemap.
- **Debt** `D`: borrowing cap `Λ_max · π_s · 250` with `Λ_max = 3` (+1 per *Leverage* initiative, max 6); interest `6 %/yr = 0.00024 /s`. If `D > cap` (profit fell): **Covenant breach** — 50 % of cash flow auto-repays until compliant; below 1 min of cash: forced **Fire Sale** of 10 % of `U+I`.
- **Stock-funded deals:** half the price may be paid in stock at a discount factor `1/(1 + 0.5·a_k)` — the *reason* to lie.
- **Add-backs:** `a_k` by owned initiatives *Adjusted EBITDA (0.15) → Pro-forma Synergies (0.35) → Community-Adjusted EBITDA (0.70) → Run-Rate Everything (1.5)*; a toggle sets the active level (0..owned). **Fiction** `F += a_k · π · dt`; **Fiction Ratio** `φ_F = F / (π_s·250)`.
- **Audit risk** hazard `h = 0.0004 · max(0, φ_F − 0.4) / s`. **Audit Seasons** fire at market-cap milestones ×10 from $1B: choose **Lunch** (costs 5 min of π, immunity 10 min, Scandal +3), **Restate** (`F×0.5`, MC −15 %), **Switch Auditors** (20 min of π, immunity 30 min, Scandal +10), or ignore (hazard ×3 for 5 min).
- **Whistleblower / Reckoning** (hazard fires): MC `×(1 − min(0.85, 0.35·φ_F))`, `D` call-in 30 % (else Fire Sale), revenue slump ×0.5 for 5 min, Scandal := 70. *Never game over.*
- **The Correction** (scripted; at `E ≥ 18·10⁶`; telegraphed by Hollis emails at 10M/14M/17M): MC `×(1 − 0.2 − 0.3·min(1,Λ/3) − 0.3·min(1,φ_F))`, slump ×0.8 for 3 min. *Rainy-Day Fund* initiative cuts damage by 30 %. Narrative: "the market corrects; we are corrected with it". Survival is guaranteed; **preparation changes the starting position of Act III** (cash, ORC goodwill).
- **Integration Intensity** `k ∈ [0.5, 2.0]` (player slider): `RC_eff = RC·k`, Scandal rate `×k²`, incident chance `×k`. Target **Culture** tags (e.g., *Family-owned*, *Unionised*, *Venture-backed*, *Founder-led*) multiply Scandal per cut (×2, ×1.5, ×0.8, ×1.3) and are shown on the target card.
- **Scandal** `S ∈ [0,100]` rises with integration speed (`+0.02·√(cuts/s)/s` above a comfort threshold), falls `0.05/s`; `S > 60` triggers ORC probes (revenue slump 10 %). **Statement Builder** (mini-game; costs 1 "deck set" = 100 Slides): pick one card per row — *Opener, Pivot, Close* — vs. the current **Public Mood** (Angry, Skeptical, Gullible, Distracted; rotates every 90 s, visible). Score = number of cards matching the mood's column (0–3) ⇒ `S −= [2, 8, 18, 35]`. Table:

| Mood | Opener | Pivot | Close |
|---|---|---|---|
| Angry | "We are deeply sorry" | "Difficult decisions" | "A path forward" |
| Skeptical | "The data shows" | "Efficiency" | "Our metrics" |
| Gullible | "Excited to announce" | "Transformation" | "The AI-powered future" |
| Distracted | "Quick update" | "Streamlining" | "More soon!" |

One-sentence rule on the panel: *"Match all three cards to the mood."* A tutorial email shows a solved example.
- **AI Colleagues** `ai` levels, hallucination hazard `h_ai = 0.0003·ai²/s` → *Incident* (−15 % π for 60 s, Scandal +5); *Guardrails I/II* halve it each.
- **Slides in Act II:** `+8/s per QVO Partner` (cost `1.5·10⁵·1.15ⁿ`, upkeep 40 u/s) and `+40·ai /s` from the **Deck Studio**.

### 4.8 Act III model — The Rehire (v4 save; constants in `A3`, `DEPT3` in `data.ts` [TUNE])

*Insight:* you cut the people who were also the customers and the know-how. Demand has collapsed (the **Stall**); the only way back is to re-engage the people you let go, as contractors, at 3× the cost, while the Board and the share price punish every single rehire. Everyone who comes back is a real Act I person (name, role, wave, exit note). Money is held in "π0-seconds" (`pi0` = the profit rate snapshotted at Act III start), so the act scales with whatever the player built.

- **Demand.** `dmTarget = DM0 + (1 − DM0)(1 − exp(−reffE/RS))`, `reffE = Σ rehire effects`, each `DEPT3[dept].dm · (0.7 + 0.3·c)`. The displayed `dm` is lagged (`TAU_UP` 10 s up, `TAU_DN` 18 s down) and starts at 1 so the act always opens with a visible stall. `gross = base·dm + store`; `π = gross·slump·hal − upkeep − interest − pay3`; `pay3 = rwRaw · PAY · pi0` is the contractor bill (3× the old wage).
- **Retainer** (cash price of one rehire): `RET0 · pi0 · RET_G^reh · (0.6 + 0.4w) · (1 + GRUDGE·grudge)`, where `grudge = clamp(waveSize / GRUDGE_N)` is how big the wave was that cut them (people who left on their own have `grudge = 0`). *Act I cruelty is paid for here.*
- **Board confidence** `conf ∈ [0,1]`. Each rehire costs `PEN · bp` (`bp` per department; ×0.7 with *Flexible Headcount*). It recovers to 1 with τ 100 s (55 s with *Investor Relations*). The reported multiple is `mTot0 · (0.45 + 0.55·conf)`, so the share price visibly drops with each rehire.
- **Board Intervention.** If `conf < 0.35` the Board re-cuts the newest 3 rehires: they are flagged `F_TWICE`, go into a new wave, `conf` resets to 0.7, `interv++`. Never run offline. The player is never hard-blocked from a rehire: the cards show cost, effect and a warning; the batch buttons stop at a SAFE line (`conf ≥ 0.4`) and always say why they stopped.
- **Frozen mechanics.** Integration (U→I), reckonings, the firesale, Bids and all earlier-act initiatives are off or hidden in Act III. `humans += reh · COHORT · E`.
- **Finale.** The first person ever cut (`pickFirst()`: earliest-cut person still out; reserved, cannot be rehired in a batch) is rehired last, as **Head of Efficiency**. Requires `flags.stall` (`dm < 0.5` seen, or 90 s elapsed), `dm ≥ 0.8` and cash ≥ `FIN_RET · pi0`. `FIN_WAIT` = 20 s later `startAct4` runs.
- **Entry grant.** `cash = max(cash, 45 · pi0)` so the first rehires are never a wall.
- **Per-person records.** `cutT[]`, `cutW[]`, `waves[]`, `lastCutT`, `first`. A wave opens per `wave()` call or per solo cut after > 8 s of quiet. Saves older than v4 get reconstructed records (deterministic).
- **Act IV verdict.** `cruelty()` ∈ [0,1] = 0.32·min(1, cuts/700) + 0.22 (waves ≥ 10) + 0.16 incidents + 0.10 lawsuits + 0.10 interventions + 0.10 scandal. Bands `< 0.30` retained, `< 0.62` eliminated with an appeal available, else eliminated and the appeal is denied. Stance shifts the number by −0.04 (agree) or +0.03 (question). Both endings remain reachable in every band (Ending A is always one click away; Ending B needs a band ≤ 1).

### 4.9 Safety nets (anti-softlock) and the **max-dead-time rule**

- **Bridge Loan** (Board gift, 40 % APR): if `Cash < min severance` and `π ≤ 0` for > 60 s.
- **Hollis Advisor email** every 5 minutes of no purchase: states the current limiting factor in one sentence and one suggested action (data-driven from the same rules the bot uses).
- **Pity timers:** Slides generation never below 0.15/s; initiative costs reduce 20 % after 10 min without any purchase.
- **Max dead time (design rule, enforced by tests §14):** in an Act, the *bot* may never experience > **90 s** (Act I) / **120 s** (II–III) without an *affordable meaningful action*, where *meaningful* = purchase or action that increases a primary rate (π, cuts/s, Slides/s, Dm) by ≥ 3 %, **or** unlocks a new panel/story email. The same test reports `p95(time-to-next-affordable)` ≤ 60 s.

---

## 5. Progression — four acts

Targets are **greedy-bot time** (perfect attention, one decision per second, uses ground-truth info) → **expected human first run** (~1.25–1.4× bot). Total: **bot ≈ 2h00, human 2h20–2h45** (hard ceiling for the *lazy bot*: 3h00, §14).

| Act | Title | Verb | Bot | Human | Visual vocabulary | Ends when |
|---|---|---|---|---|---|---|
| I | **Right-Sizing** | *choose & cut* | 0:00–0:37 | 0:00–0:50 | Spreadsheet + dot grid | H ≤ 520 and *Synergy Memo* bought |
| II | **Synergy** | *acquire, integrate, leverage* | 0:37–1:17 | 0:50–1:45 | "Paper" → forced SaaS dashboard; portfolio treemap | `E ≥ 25·10⁶` after *The Correction* |
| III | **The Rehire** | *bring them back, one by one* | 1:17–1:45 | 1:45–2:25 | Floor with rings (the people you cut) + Re-engagement Desk | Demand ≥ 80 %, Head of Efficiency rehired |
| IV | **The Last Position** | *redundancy review* | 1:52–2:02 | 2:30–2:45 | The UI dismantles itself | Ending A or B |

New-system cadence: one significant new system every **7–10 minutes** (Reddit lesson, §1.4), never two at once.

### 5.1 Act I — Right-Sizing (≈ 37 min bot / 50 human)

**Fantasy.** You are a spreadsheet that has discovered it can delete rows.

**Screen.** Left: **Vitals** (Headcount ↘, Cash, Profit/s, Morale, Exposure). Center: **The Floor** — canvas dot grid, 1,000 dots arranged 40×25 by department blocks (color + shape glyph per department). Right: **Initiatives / Inbox** tabs. Top: **hero Market Cap** and the **Jaws chart** (appears after the first 10 cuts).

**Minute-by-minute beat sheet (bot time; human drifts later)**

| t | Beat |
|---|---|
| 0:00 | *New Hire Orientation*: type a badge name (default "Alex"); email from Dale: *"Find efficiencies."* Grid appears; hover shows role, tenure, wage; **Innovation Lab** is visibly pure cost (free tutorial cut). Hiring Freeze is already on (dots drift out). |
| 0:30 | First cut → severance, goodbye vignette, **Jaws chart** starts. Profit ticks up (compound with payback in ~3–4 min). |
| 1:30 | **Stack Ranking** initiative appears (4 Slides): dots tint by *estimated* contribution (noisy). |
| 4:30 | **Spreadsheet Macros** (first automation, `A_d += 4 %`); **Bus Factor Analysis**. First **Incident** for non-bot players ("Gary"). |
| 5:00 | **Contractor Program**: *Rehire as Contractor* appears on Incident cards (T2). QVO associates become buyable. |
| 6–8 | **Hot-Desking**, **Continuous Improvement I** (autopilot cuts, 0.03/s). Hollis's first email. **Earnings Call** unlocks at MC ≥ $50M. |
| 10:00 | **Workflow Bots** (+8 %), **360° Feedback**. Morale becomes the binding constraint — the player discovers *Pizza Party* and HR's value. |
| 14:00 | **Chat Support** (Support can now be cut to near zero). Class action risk becomes real; Legal's value is revealed. |
| 15:30 | CIP II (0.08/s) |
| 21:00 | **Code Copilot** (hallucination Incidents begin; the AI-hype note). |
| 25:30 | CIP III (0.18/s) and **Keystroke Telemetry** (exact `c`, −5 % morale cap). |
| 30:00 | Hollis: *"We've reached a headcount from which the next cut is a philosophical decision."* The Jaws chart is annotated. |
| 36–37 | **Synergy Memo** (675 Slides, 360k u): Dale's reply: *"What if we did this… to other companies?"* → Act II. |

**Act I initiatives (calibrated — slides, cash in `u`)**

| ID | Initiative | Slides | Cash | Unlock | Effect |
|---|---|---|---|---|---|
| I-00 | Hiring Freeze | 0 | 0 | t=0 | passive attrition `6e-5/s` |
| I-01 | Stack Ranking | 4 | 0 | 10 cuts | `σ_n` 1.0→0.4 |
| I-02 | Spreadsheet Macros | 9 | 1,200 | I-01 | `A_d += 0.04·L_d0` for ENG,SAL,SUP,OPS,FIN,MGT |
| I-03 | Bus Factor Analysis | 14 | 0 | I-02 | reveals keepers; prevents unmapped Incidents |
| I-04 | Contractor Program | 20 | 1,800 | I-03 | Rehire-as-Contractor; QVO associates |
| I-05 | Hot-Desking | 25 | 4,500 | I-04 | `Oh −= 0.02H + 10` |
| I-06 | Continuous Improvement I | 32 | 9,000 | I-05 | autopilot cuts 0.03/s (M>0.6, X<60, skips mapped keepers; picks best payback) |
| I-07 | Workflow Bots | 54 | 21,000 | I-06 | `A_d += 0.08·L_d0` |
| I-08 | 360° Feedback | 72 | 0 | I-07 | `σ_n → 0.15` |
| I-09 | Earnings Call | 100 | 0 | MC ≥ $50M | quarterly Guidance mini-game (§4.5) |
| I-10 | Chat Support | 108 | 45,000 | I-08 | `A_SUP += 0.5·L_SUP0` |
| I-11 | Continuous Improvement II | 150 | 30,000 | I-10 | autopilot 0.08/s |
| I-12 | Wellness Webinar | 20 | 2,000 | morale < 0.6 once | morale recovery `+0.001/s` |
| I-13 | Legal Hold | 35 | 5,000 | first class action warning | exposure decay `+0.2/s` |
| I-14 | Code Copilot | 225 | 105,000 | I-11 | `A_ENG += 0.45·L_ENG0`; hallucination Incident hazard 1/10 min |
| I-15 | Continuous Improvement III | 315 | 135,000 | I-14 | autopilot 0.18/s |
| I-16 | Keystroke Telemetry | 405 | 0 | I-15 | `σ_n → 0`; morale cap 0.92→0.87 |
| I-17 | Recognition Program | 40 | 0 | t≥8 min | *protects the player's badge dot from all cuts* (it is protected anyway; this shows the dot's story) |
| I-18 | **Synergy Memo** | 675 | 360,000 | H ≤ 520 | ends Act I |

*Optional-depth items (I-12, I-13, I-17, and which info upgrades to buy) account for roughly 25–30 % of play time without gating.*

**Act I design checks.** (a) With perfect information and morale held at 0.85, the *no-automation* profit optimum is **H ≈ 457 (π ≈ 357 u/s, ×6.5 the starting 55)** (`tools/opt_check.py`); cutting on to H≈100 along the same greedy path drops profit to ≈ 192 u/s (still above the start, so over-cutting is a *costly mistake*, not a catastrophe) — before counting Incidents, morale and lawsuits, which the static check ignores. Automation then pushes the optimum lower (≈ 350 in the bot run). Reaching the optimum without information and without breaking morale is what fills Act I. (b) The first 5 minutes have ≥ 1 affordable action every 10 s. (c) Morale is the binding constraint from ≈ minute 10 (bot holds `M ≥ 0.7`).

### 5.2 Act II — Synergy (≈ 40 min bot / 50–60 human)

**Fantasy.** *What if we did this to other companies?* Private-equity-style roll-up.

**Screen change.** The grid dissolves into a **portfolio treemap** (squarified; one tile per acquired target; tile area = baseline employees, tile fill = integration progress, tile "texture" = remaining humans as a dot density). Right panel gains **Capital** (cash/debt/leverage) and **Reality** (hidden until add-backs). The **Jaws chart** is now *log-scaled*: MC (reported) ↑ vs humans-as-%-of-peak (a saw-tooth: it jumps up at each acquisition — "Headcount is up 4,000 % due to *strategic* acquisitions" — then slides below its previous low).

**Beats**

| t (in Act) | Beat |
|---|---|
| 0:00 | Dale: *"What if we did this… to other companies?"* A **Target List** appears (generated, e.g., *Brightline Logistics (310)*, *Hartwell Greeting Cards (95)*, *Pelican Compliance Solutions (1,200)*). First bid is cheap and instant. |
| 0:30 | **Task Force** (RC tier 1). The first tile integrates in ~90 s: the Act I loop, automated. |
| 2:00 | Hollis: *"There is a thing called debt."* Leverage unlocks (Λ_max 3). |
| 5:00 | **Tier 2** (Restructuring Practice). **QVO Partners** (Slides). |
| 6–8 | Scandal first exceeds 30 → **Statement Builder** tutorial email; AI Colleagues L1. |
| ≈ 10 | **Digital Transformation** (T4) is "rolled out" overnight: the **UI redesign** hits. |
| ≈ 14 | **Adjusted EBITDA** appears; the first **Audit Season** (MC ≥ $1B). The HUD and the Reality Lens (T5). |
| ≈ 20 | AI L2–L3 (Hallucination Incidents). Tier 3. |
| ≈ 26–30 | Hollis' warning emails at E = 10M, 14M, 17M. |
| ≈ 33 | **The Correction** (scripted) → recovery. |
| ≈ 38–40 | `E ≥ 25M`: ORC email: *"We have reviewed our concern. It is substantial. It is also **you**. Welcome to Systemic Importance."* → Act III |

**Act II initiatives** (slides, cash in `u`)

| ID | Name | Slides | Cash | Effect |
|---|---|---|---|---|
| II-01 | Leveraged Recapitalization | 300 | 2·10⁶ | `Λ_max` 3→4 |
| II-02 | Procurement Review | 120 | 0 | disables QVO Scope Creep |
| II-03 | QVO Partners | 400 | 5·10⁵ | +8 Slides/s each (cost `1.5e5·1.15ⁿ`) |
| II-04 | Statement Builder | 250 | 0 | PR mini-game |
| II-05 | **Digital Transformation** | — | — | *forced* UI redesign (T4); can be reverted (Settings) |
| II-06…09 | Adjusted EBITDA / Pro-forma Synergies / Community-Adjusted EBITDA / Run-Rate Everything | 500 / 900 / 1,600 / 3,000 | 3e6 / 4e7 / 6e8 / 8e9 | add-back levels 0.15 / 0.35 / 0.70 / 1.5 |
| II-10…15 | Colleagues L1–L6 | 150 / 400 / 900 / 1,800 / 3,200 / 5,000 | 8e5 / 5e6 / 5e7 / 5e8 / 3e9 / 1.2e10 | `ai` +0.15/0.15/0.15/0.15/0.20/0.20 → 1.0 |
| II-16, 17 | Guardrails I / II | 600 / 1,500 | 1e7 / 3e8 | hallucination hazard ×0.5 each |
| II-18, 19 | Leverage II / III | 1,800 / 3,500 | 1e9 / 2e10 | `Λ_max` → 5 / 6 |
| II-20 | Rainy-Day Fund | 1,200 | 2e8 | Correction damage −30 % |
| II-21 | AI-Washing | 700 | 1e7 | announce cuts as "AI": `m +0.5` (5 min decay, 60 s cooldown) |
| II-22 | Deck Studio | 500 | 1e7 | `+40·ai` Slides/s |

**Act II decision space.** (1) *What to buy* — targets differ in size, "fat" (cuttable share), keepers density, and a **Culture** tag affecting morale shock (e.g., "Family-owned" doubles Scandal per cut — comedic risk). (2) *How hard to integrate* — an **Integration Intensity** slider (0.5–2.0) multiplies RC but multiplies Scandal rate by intensity² and incident chance by intensity. (3) *How much to lever.* (4) *How much to lie* (honest ≈ +0 %, full add-backs ≈ −15 % time but exposes Reckoning). **Check:** the bot (§14) must show *honest*, *moderate*, and *max-fiction* strategies within ±25 % of each other in time-to-Act-III while differing in risk (otherwise the lie has no cost or no benefit).

### 5.3 Act III — The Rehire (≈ 20–30 min bot / 25–35 human) [calibrated]

**Fantasy.** The Stall: nobody is buying, nobody is building. The only fix is the thing you spent 40 minutes undoing.

**Screen.** The Floor returns as the *Re-engagement view*: hollow rings are everyone you let go (hover or tap for name, role, exit note), a gold double ring marks the first person you ever cut, red rings mark people the Board re-cut. Filled accent dots are rehires. Above it, a **goal card** ("Demand back to 50 % / 80 % / offer the Head of Efficiency role") and two bars: **Demand** (with the 80 % mandate tick and today's target) and **Board confidence** (with the 35 % intervention line). Below: the **Re-engagement Desk** (search, department, sort by value/demand/retainer/board/wave; each row shows +Demand, −Board, retainer; batch **Best 5/10/25** after *Alumni Network*).

**Beats**

| t (in Act) | Beat |
|---|---|
| 0:00 | ORC mail, the stall, entry grant; goal "Demand back to 20 %…" |
| 0–4 | First rehire (log + mail); the dots canvas shows an arrival ring |
| 4–10 | Demand milestones (mandates 1–3); the Board gets nervous; first Board Intervention is possible for greedy play |
| 10–22 | *Alumni Network*, *Flexible Headcount*, *Investor Relations*, *Contractor Storefront* unlock; contractors' retainer grows `RET_G` per rehire; cruelty (grudge) makes Act I's big waves the most expensive people to get back |
| 18–28 | Demand ≥ 80 % → "The Head of Efficiency" card unlocks (needs `stall` + cash) |
| end | The first person cut accepts; 20 s later Act IV starts |

**Act III initiatives** (4, gate `a3`): Alumni Network (batch rehire), Flexible Headcount (−30 % Board penalty), Contractor Storefront (adds a demand floor), Investor Relations (Board recovery τ 55 s).

**Design checks.** (1) *Spam* (aggressive bot: ignore the Board) is net-negative: ~30 interventions, longest run. (2) *Patient* play (greedy) never triggers an intervention and finishes in 22–25 min. (3) Max dead-gap in Act III ≤ 0.5 min for every bot (`tests/rehire.test.ts`, `tools/deadtime.ts`). (4) Reckonings are disabled in Act III (no E loss).

### 5.4 Act IV — The Last Position (≈ 10 min bot / 15 human)

Scripted; very little numeric play. The UI **dismantles itself** (T7). Beats:

0. *Reviewer.* The review is run by **Head of Efficiency** — the person you cut first in Act I (name, role and exit note taken from the save). Step 4 is their **verdict** on the player, built from `cruelty()` (§4.8).
1. *Redundancy Review of the Board.* A single action: hold **Run Analysis** (15 s). Hollis replies with three buttons (tone options: *Agree · Question · Resign*; only flavor/ending lines).
2. *Review of the Street* (the analysts replaced by a "Sentiment API").
3. *Review of Hollis* (he asks to go last; the player may agree — flavor).
4. *Review of Dale.* The CEO's last email is the funniest and saddest of the game.
5. *Review of **Employee #1000 — the player's badge**.* The reviewer reads the file aloud (cuts, waves ≥ 10, incidents, interventions) and gives the verdict band. Choose: **(A) Accept the elimination / decline the retention** → *Ending A "Efficient"*; **(B) Accept the retention or appeal** (bands 0–1; denied in band 2), "for brand reasons" → *Ending B "Heritage Human"* (a single dot remains on a blank field).
6. *Review of **Efficiency Initiative v1.0** (you).* A big button: **Sunset This Program**. UI shrinks to a single white document with the **Exit Interview** (NPS slider 0–10) and the player's **Performance Review** (T8). Credits as a severance letter.

Time here is mostly reading; the player can skip lines with Space/tap. Ending text is in §7.

---

## 6. The twists

Each twist lists **Trigger → Implementation → Accessibility fallback**. Global rule: *no gag may make the game inoperable, hide information permanently, or prompt the browser.* Every gag is cosmetic over a stable DOM; a **Settings → "Stable UI" (accessible mode)** switch disables all *performing* gags (decay, redesign motion, Reality-Lens jitter, dismantle animation) and instead **narrates** each gag as a line in the log, announced via `aria-live`. `prefers-reduced-motion` turns on Stable UI motion defaults automatically (user can override).

### T1 — The shrinking number (the genre inverted)
- **Trigger:** from the first cut.
- **Implementation:** *Headcount* is the left-column hero with a *down* arrow; **Market Cap** is the top hero. The **Jaws chart** (canvas): two lines on a shared normalised log axis (MC ↑ gold, Humans-% ↘ ink) with the area between filled; named "**The Alligator**" in the UI (the real corporate-chart nickname). Act-boundary annotations are drawn into the chart ("Q3", "Synergy", "Correction", "The Stall"). At the end, the jaws are fully open.
- **A11y:** the chart has a text summary (`aria-label` + visible *Show data* table of the last 12 quarters); all numbers are DOM text.

### T2 — Boomerang consultants (and Scope Creep)
- **Trigger:** after *Contractor Program*, any Incident offers **Rehire as Contractor** with the *same employee's name and goodbye note* ("Gary Fennimore, re-engaged as *Senior Transitional Advisor*, 3× rate").
- **Implementation:** the contractor stays in the dot grid as a hollow ring; contributes `c ×1.5`, +0.4 Slides/s, wage ×3. QVO associates auto-propagate (**Scope Creep**): `p = 0.25 / 90 s` (≥ 8 associates) buys another associate; the log says *"QVO recommended QVO."* *Procurement Review* turns it off. At ≥ 25 associates a hidden achievement ("Recursion") fires.
- **A11y:** associates are a normal table row; the auto-purchase is logged text and capped (never silently exceeds 2× affordable).

### T3 — The UI is built from departments (it degrades as you cut them)
- **Trigger:** each department's headcount fraction `f_d = H_d / H_d0` below thresholds (Act I–II).
- **Implementation:** CSS custom properties driven by `f_d` (`--decay-*`), purely cosmetic:
  - **SUP** (Care) < 40 % → tooltips gain "Your tooltip is important to us. Estimated wait: 2 s" (an actual 600 ms delay with hold-music glyph ♪); < 10 % → tooltips become `?`.
  - **MGT** < 40 % → panel headings lose their capitalization consistency, button order in the Initiatives tab is *deliberately* unmanaged (list order sorted by cost rather than by relevance — still operable).
  - **LEG** < 40 % → footer **Terms & Disclaimers** shrinks from 8 lines to 1; < 10 % → fine print becomes *"Probably fine."* (This is also where the *Class action* risk counter sits.)
  - **HR** < 40 % → log lines drop pleasantries and title the fired as "Resource #N" in the log *only* (never in the dots' tooltip: dignity stays).
  - **OPS** < 40 % → the **ambient light** (background lightness) dims ~6 % and the window `<title>` gains a flickering "…" .
  - **FIN** < 40 % → all money formatting loses its thousands separators; < 10 % shows "approximately $".
  - **ENG** < 40 % → a **fake "Beta" badge** appears next to features; < 10 % a harmless broken-layout *2 px misalignment* is applied to non-critical cards.
  - Never affects hit-targets, focus order, contrast, or save behaviour. *Hire-back* is not possible (it's a gag, not a balance mechanic).
- **A11y:** gags are *skipped* in Stable UI and replaced by a single log line the first time each threshold is crossed ("HR is now 38 % of its former self. The log will sound different.").

### T4 — "Digital Transformation": the forced redesign (UI lies by omission)
- **Trigger:** in Act II when RC tier 2 is first bought (≈ minute 10).
- **Implementation:** a full-screen "**We've updated the experience!**" modal (cannot be dismissed with Esc for 3 s; a 'Learn more' link opens a changelog joke). The DOM *re-flows* into a **SaaS dashboard**: rounded cards, gradients, an "Insights" hero (*"Efficiency ▲ Strong"*), raw numbers moved behind **"View details ›"** disclosure rows, nav relocated to a hamburger, and a large **AI Assistant** sidebar that gives vague advice. Buttons keep their DOM order (only CSS grid areas change), so the keyboard tab order remains logical. **Revert to Classic** is a link in the footer of the *settings* menu (always works, free, and the game jokes about the hidden location: *"Classic View is available to Enterprise customers. You are an Enterprise customer."*). Reverting gives a `+1 Slide` joke reward ("Stakeholder alignment") *once*. Staying on the redesign yields the AI Assistant's *genuinely useful* "next best action" suggestions (the bot's heuristic), a small reward for tolerating the redesign — the satirical "it's better for you".
- **A11y:** a persistent skip link "Show raw numbers"; Stable UI auto-reverts to Classic.

### T5 — Reported vs Real: the HUD lies
- **Trigger:** first add-back (Act II); gag deepens with each level.
- **Implementation:** the hero Market Cap is **Reported**; a faint superscript `†` follows it. Holding **R** (or the on-screen **Reality Lens** toggle) swaps the entire HUD to **Real** values with a desaturated "x-ray" style and a subtle jitter (reduced-motion: no jitter). The hero's tooltip *always* states "Reported". In the Jaws chart a thin dashed line shows **Real** value; the gap is shaded "**Fiction**". Audit Seasons use the same lens. During Act III the lens also reveals that most *customers* are blue.
- **A11y:** a toggle (not a hold) is available; both numbers are also listed in a **Reality table** in the Capital tab; screen readers get "Reported 4.2 billion, real 3.1 billion".

### T6 — The Rehire (the cost of the cuts comes back as a bill)
- **Trigger:** Act III start. See §4.8.
- **Implementation:** the Floor canvas in re-engagement mode (rings for the cut, filled dots for the rehired, gold ring for the first person cut), Demand and Board meters, the Re-engagement Desk. The first person ever cut becomes the Head of Efficiency and reviews you in Act IV; the verdict reflects Act I.
- **A11y:** every ring has a text equivalent in the Desk (a searchable list); the meters are text-labelled bars; hover cards are also tap/focus cards; no information is only color (rings differ by shape: hollow, double, dashed).

### T7 — The game makes *you* redundant
- **Trigger:** Act IV, the last review.
- **Implementation:** panels disappear in the reverse of how they unlocked, each with a log line ("Initiatives tab: position eliminated. Its responsibilities have been absorbed by the Initiatives tab."). Fonts degrade to default serif; colors desaturate to white; the canvas zooms out to one cell; the final view is a blank "document" with the **Exit Interview** ("How likely are you to recommend Nullwater to a friend? 0–10") and a typed-out **Performance Review** of the player (T8). The **Employee #1000** dot is the player's badge name (entered at start): Ending A removes it, Ending B keeps it.
- **A11y:** Stable UI skips the dismantle animation (instant white page) and reads the text sequence in order; all buttons keep focus.

### T8 — Mirror Performance Review (light fourth wall; no penalties)
- **Trigger:** every quarter in the Inbox ("**Initiative Performance Review**") and at the end.
- **Implementation:** the game tracks *in-page only*: session length, actions/minute, *time with tab hidden* (Page Visibility API), and idle gaps; emails comment jauntily ("Your engagement was strong. Your engagement while hidden was stronger.") — **no `beforeunload`, no notification prompts, no fake popups, no gameplay penalty.** The final review summarizes totals (total cuts, incidents, lies told, quarters beaten) and rates "Cultural fit".
- **A11y:** plain emails; setting **Hide meta-commentary** removes only T8's tab-visibility lines.

### Other tone-setting micro-twists (cheap)
- **Window title and favicon-free tab** change by Act (`Q3_Workforce_Plan_FINAL_v7(2).xlsx` → `Synergy Dashboard (3)` → `Market Overview` → `Untitled Document`). (Favicon: a data-URI SVG generated at runtime, no files.)
- **"Out of Office" offline report** (§10).
- **Easter eggs:** typing the Konami code in the Floor spawns a "Pizza Party" in the grid; the achievement *Recursion* (T2); a hidden *Gary* dot in each Case File.

---

## 7. Ending, replay, "Case Files" (NG+)

### 7.1 Endings
- **Ending A — "Efficient".** Last line: *"Headcount: 0. Cost per head: undefined, which we are treating as 100 % efficient. Thank you for your service. Your position has been eliminated. Your feedback will be ignored efficiently."* The page becomes a white document; the cursor blinks.
- **Ending B — "Heritage Human".** One dot remains. Last line: *"Nobody reports to anyone. Someone is still drinking coffee. We have chosen not to optimize this."* A small quiet beat; the Inbox's last email is from Dale: *"Re: Vision. I think I finally get it. Also what do I do now?"*
- Both end with the **severance letter credits** and a *Let off the hook* line (cf. Lantz): *"You can close this tab. Nothing is pending. Nothing is pending."* — the in-game counter of "pending items" is zero (a literal reward for leaving).

### 7.2 Replay: Case Files
After an ending, **Billable Hours** (meta currency) are awarded: `100/Act + 250 (Ending B) + speed bonus (0–300)`. Spend on **Playbook cards** (persist across saves; stored under `meta` in the save):

| Card | Cost (h) | Effect |
|---|---|---|
| Template Deck | 150 | +25 % Slides generation |
| Gary Map | 200 | keepers revealed from t=0 |
| Pre-read | 150 | start with Stack Ranking owned |
| Warm Intro | 250 | start Cash ×3 |
| Boilerplate | 250 | Statement Builder scores +1 level |
| Plausible Deniability | 300 | Scandal accumulation −20 % |
| Clean Hands | 300 | Fiction accrual −25 % |
| Rolodex | 400 | acquisition price −5 % |
| Second Opinion | 400 | Telemetry-grade info from the start of Act II |

**Case Files (company archetypes, unlock after the first ending).** Each changes the department mix, α weights, keepers and one special rule; runs target **45–60 min** (Acts I–II condensed; Act III & IV as normal but shorter thresholds):
1. **Nullwater Consolidated** (default).
2. **The Evening Standard Gazette** (newspaper): large ENG-equivalent "Content" dept; *Reputation* acts as exposure; AI-written content incidents ("The AI wrote an obituary for a living person").
3. **Fortuna Airlines**: a Ground Services department whose cuts drive **delays and lost luggage** (*"Your bag has been transitioned to opportunities"*); incident severity ×3 applies to *revenue only* (refunds, vouchers), never to harm to people.
4. **Ostrander University**: a *Tenured* department that cannot be cut except via "Restructuring of Departments"; 35 % of payroll.
5. **City Water Works**: public-utility *monopoly demand* (leak ≈ 0, but regulators strong): the **ORC** starts at φ = 0.1.
**Retention Run (challenge):** finish Act I with ≥ 650 staff (the game states the optimum; the rule highlights the cost of caring) — reward: a unique badge string, no extra currency.

---

## 8. Visual & UI design system (no image assets)

**Principle:** *Boring on purpose, gorgeous in the details.* The first screen should look like a plain spreadsheet that happens to be perfectly kerned; every satisfying detail (alignment, tabular numerals, easing, empty states, micro-interactions) is invisible until the player notices it. All visuals are DOM/CSS, inline SVG generated in code, or `<canvas>`; **zero** image files; fonts are system stacks (no webfont files, no network).

### 8.1 Typography
- **UI:** `ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- **Numbers:** same UI font with `font-variant-numeric: tabular-nums slashed-zero`; hero numbers 40–72 px, weight 650, letter-spacing −0.01em; units in a smaller, lighter span.
- **Memo voice (Inbox/log):** `ui-serif, Georgia, Cambria, "Times New Roman", serif` at 15–16 px, line-height 1.5 — differentiates *what the company says* from *what the system measures*.
- **Mono:** `ui-monospace, "SF Mono", Menlo, Consolas, monospace` for IDs, timestamps, the Statement Builder cards.
- Type scale (rem): 0.75 / 0.875 / 1 / 1.125 / 1.5 / 2.5 / 4. User setting: *Text size* 90–140 %.

### 8.2 Layout
- **Desktop (≥ 1100 px):** 12-column grid, three regions with 16 px gutters — **Vitals** (3 col), **Floor** (6 col, the canvas, aspect-flexible), **Initiatives/Inbox/Capital** (3 col, tabbed). Top bar: hero Market Cap, Headcount, Profit/s, Day. Bottom: a **ticker tape** of news (fake "headlines" generated from events; marquee disabled in reduced-motion).
- **Tablet (700–1099):** two columns (Vitals+Tabs stacked right of Floor).
- **Mobile (≤ 699):** single column; **bottom tab bar** (Floor · Initiatives · Inbox · Capital · Settings); hero numbers collapse to a sticky header (two lines); the Floor shows the canvas at full width with tap-to-select and a **bottom sheet** for the selected dot ("Cut", "Protect", "Details"); 44 × 44 px minimum targets; no hover-only information (long-press = hover).
- Every panel uses **container queries** (`@container`) so components reflow independent of viewport.

### 8.3 Color tokens (per act; semantic tokens, not hard-coded)
| Token | Act I "Paper" | Act II "Dashboard" | Act III "Void" | Act IV "Blank" |
|---|---|---|---|---|
| `--bg` | `#F4F1EA` | `#0F172A` | `#0A0A0B` | `#FFFFFF` |
| `--surface` | `#FFFFFF` | `#16213B` (cards, radius 14) | `#121214` | `#FFFFFF` |
| `--ink` | `#1D2733` | `#E6EBF5` | `#E8E3DA` | `#1A1A1A` |
| `--muted` | `#5B6676` | `#93A0BA` | `#8A8780` | `#777` |
| `--accent` (highlighter) | `#F2C94C` | `#6EE7B7` | `#E8B77A` (human/amber) | `#1A1A1A` |
| `--good` | `#1E7B4F` | `#34D399` | — | — |
| `--bad` | `#B3261E` | `#F87171` | `#C0453B` | — |
| `--synthetic` | — | — | `#4C8DFF` | — |
All text/background pairs ≥ **4.5:1** (≥ 3:1 for large text and graphical objects); a **High contrast** option swaps to a 7:1 palette. Department hues are chosen in OKLCH (L 0.62–0.78, C 0.10–0.14) *and* each department has a **glyph** (■ ▲ ● ◆ ▼ ✚ ⬢ ▬ ○) so color is never the only signal.

### 8.4 The three signature canvases
1. **The Floor (Act I).** 40×25 grid of rounded squares (cell 18–24 px, scaled by DPR). State encoding: *fill* = department; *opacity* = estimated contribution (after audit); *outline* = keeper (after Bus Factor); *hollow ring* = contractor; *dashed* = player badge. Cuts: 400 ms fade + 8 px drift upward to the **"Opportunities"** strip at the bottom of the canvas (a lane of faint ghosts that grows—persistent memory of the cuts; the strip is **Act IV's last visual**). Hover/focus: a card with name, role, tenure, wage, audit-estimated contribution bar (with noise band). Multi-select by drag (lasso) or by **Wave Planner** (rule builder: dept × bottom-N% × min-payback).
2. **The Portfolio (Act II).** Squarified **treemap** (own implementation, ~60 lines), animated tile growth; each tile shows name, size, integration ring, and a "humans" dot-density texture. Selected tile → details drawer (price, fat %, keepers density, culture tag).
3. **The Floor, re-engagement view (Act III).** The Act I dot canvas is reused: hollow rings (cut), gold double ring (first cut), red ring (Board re-cut), filled dots (rehired) with arrival-ring ghosts. The **Jaws chart** (all acts) is a separate small canvas (or SVG) with hover crosshair.
Frame budget: **canvas redraws only on state change or hover**; the Jaws chart updates at 1 Hz; target ≥ 55 fps on a 2019 mid laptop, ≥ 30 fps on mid phones; the loop sleeps when `document.hidden`.

### 8.5 Motion & micro-interactions
- **Numbers:** odometer-lite (CSS translateY digit roll, ≤ 200 ms; only on the hero numbers); others snap with a 120 ms background flash (green/red).
- **Easing:** `cubic-bezier(.2,.8,.2,1)` for entrances, `cubic-bezier(.4,0,.2,1)` for state.
- **Purchase feedback:** buttons depress 1 px, a "stamp" glyph (✓) overlays with a 90 ms ink-spread (CSS `clip-path` circle).
- **Initiative cards** have a progress hairline showing *% of cost owned* ("affordable in 00:42"), the dead-time answer: the **Next Goal bar** (top of right panel) always shows the next affordable meaningful item and ETA.
- **Empty states** are written, not blank ("No pending items. We've checked.").
- **Reduced motion:** all of the above become opacity changes ≤ 100 ms; no parallax, no marquee, no jitter.

### 8.6 Accessibility checklist
Semantic landmarks (`header`, `main`, `nav`, `aside`); every control reachable by keyboard; visible focus ring (2 px `--accent` outline + 2 px offset); canvases have **equivalent DOM**: the *Employee Directory* table (sortable, with row checkboxes, full cut functionality) is the canonical interface for screen readers and "Classic" mode, the canvas is a progressive enhancement; the log is `aria-live="polite"` with throttling (≤ 1 announcement / 3 s; batched); numbers in `<data value>` elements with `aria-label`s expanding abbreviations; skip links; `lang` set; no content flashes > 3×/s; timed events (Earnings Call, Audit Seasons) can be *paused* (a **Pause** button and `Space`) — pausing is always available and never penalised; Settings: Text size, High contrast, Stable UI, Reduce motion, Number format, Hide meta-commentary, Sound. Test with VoiceOver/NVDA smoke checklist in M10 and axe in CI.

---

## 9. Audio (optional, WebAudio-generated only)

No audio files. A tiny `AudioEngine` with `OscillatorNode`, `GainNode`, `BiquadFilter`, noise `AudioBuffer` built at runtime. **Default: off**, with a first-run prompt *"Enable sound? We recommend yes. It will not affect your performance review."* (no autoplay before user gesture; respects `prefers-reduced-motion` only for UI, not audio).
- **Act I:** a soft **keyboard-clack** synth (filtered noise bursts) on cuts; **"ding"** on Inbox email; pitch rises slightly with Profit/s (musical scale: pentatonic) — *call and response* feedback (Lantz).
- **Act II:** **elevator-music** generated from a 4-chord loop (sine+triangle, lowpass) that plays on "Hold" moments (Statement Builder waits, the Digital Transformation modal). The Audit Season uses a tense pedal tone.
- **Act III:** (not implemented) a drone that gains a faint partial per rehire; the Head of Efficiency accepting = a single bell.
- **Act IV:** silence; a printer-like noise burst on each elimination; last sound is a single "send" whoosh. Optional volume sliders: Master/SFX/Music.
- Budget: < 8 KB of audio code; all sounds < 400 ms except the loops; CPU < 3 % on a laptop. Mute when tab hidden.

---

## 10. Save system & offline policy

- **Storage:** `localStorage` key `natural-attrition:v1:slot0`, plus 3 rolling backups (`:bak1..3`, rotated every 10 min). Autosave every 30 s, on `visibilitychange: hidden`, on `pagehide`, and on every Act transition. Data is a JSON document:
  ```ts
  type Save = { v: number; savedAt: number; seed: number; rng: number; act: 1|2|3|4;
                state: GameState; meta: { billableHours: number; cards: string[]; endings: string[]; caseFile: string; options: Options; stats: Stats } ;
                crc: number };
  ```
  `v` is the **schema version**; `migrations: Array<(old)=>new>` is applied in order on load (unit tested with golden fixtures per version). Corrupt save → fall back to newest valid backup and show an email from IT ("We restored your session from a previous version of yourself.").
- **Export/Import:** Settings → *Export* downloads `natural-attrition-YYYYMMDD-HHMM.nasave` (base64url of gzip(JSON) via `CompressionStream`, with CRC32); *Import* validates version/CRC, offers a preview (act, time played, cash), requires confirmation. Also **copy to clipboard** as text for mobile.
- **Reset** requires typing "RESIGN" (joke) and keeps `meta` unless "also clear Case Files" is checked.
- **Offline progress policy ("Out of Office")**
  - On load, `elapsed = now − savedAt` (clamped ≥ 0 to resist clock skew; if the clock jumps *backwards* by > 5 min, no offline gain and a log joke).
  - Simulated in coarse steps (1 s steps for ≤ 2 h, 10 s steps beyond) at **50 % efficiency**, **cap 8 h** (shown, adjustable down in settings).
  - Offline sim **never triggers** Incidents, Class actions, Audit Seasons, Board Interventions, Reckonings, Corrections, or Act transitions; it only accrues Cash, Slides, attrition, CIP *safe* cuts (when the CIP safeguards hold) and integration progress, and **queues any hazard** that *would* have happened as a *warning email* ("Audit Season postponed until you return.").
  - Return screen: an **email from IT** "Out of Office report" with a table (+Cash, +Slides, cuts, "Productivity: unaffected. We flagged this."), and an *Accept / Review* button; sim runs in a Web Worker chunk to avoid freezing the UI (progress bar).
- **Multi-tab guard:** `BroadcastChannel` heartbeat; a second tab shows "Another session is working here. Take over?" to avoid corrupted overwrite.
- **Privacy:** no network calls (no analytics, no fonts, no CDNs). A statement in the footer and README.

---

## 11. Language / i18n

**Recommendation: English UI at v1.0, French translation as v1.1 — with the i18n architecture built from day 1.**

*Why English first:* the comedy lives in Anglo-corporate idiom ("right-sizing", "synergy", "circling back", "per my last email"), which is also the language of the genre and its audience; transcreating 600+ jokes well is a separate writing pass, and a rushed literal French translation would flatten the best lines. *Why French second (not never):* Adrien is a native French speaker and French has its own superb euphemism corpus (*plan de sauvegarde de l'emploi*, *rupture conventionnelle*, *réorganisation agile*, *"on se fait un point"*, *les synergies*) that would give the translation a *different but equal* flavor — to be **transcreated, not translated**, with local jokes and a different Gary (*Gérard de la comptabilité fournisseurs*). Budget: ~10–14 h of writing/QA.

*Architecture (day 1):* strings in `src/i18n/en.ts` as keyed objects with **ICU-style plurals/select** via a tiny in-house formatter (≤ 2 KB) or `@formatjs/intl-messageformat`; **no string concatenation** to build sentences; names/roles generated from *composable* tables per locale (`first × last × role × quirk`); number/date via `Intl.*`; a **pseudo-locale** (`xx-PSEUDO` with accents and +40 % length) to catch overflow in CI; lint rule forbids literal user-facing strings outside i18n files; locale chosen from `navigator.language`, switchable in Settings; a coverage test fails the build if a key exists in `en` but not in a *shipped* locale.

---

## 12. Tech stack & architecture

| Concern | Choice | Reason |
|---|---|---|
| Language | **TypeScript** (strict) | Matches `capy-dispatch`/`capy-mahjong`. |
| Build | **Vite** + `vite build`; `base: '/natural-attrition/'` | Static output for Pages. |
| UI | **Preact** + `@preact/signals` | ~4 KB; declarative panels with unlock reveals, fine-grained updates for 10 Hz counters; no virtual-DOM storms. Canvas views are imperative modules with a tiny adapter. |
| State/sim | pure TS `engine/` (no DOM) | headless in Node for the bot; deterministic. |
| Big numbers | `break_infinity.js` | proven for idle games; money-like quantities only. |
| Styling | plain CSS with custom properties + `@layer`; **CSS Modules** if needed | tokens per act; no framework. |
| Tests | **Vitest** (unit/sim), **Playwright** (UI), **@axe-core/playwright** (a11y) | §14. |
| Lint/format | ESLint (typescript-eslint, jsx-a11y) + Prettier; `tsc --noEmit` in CI | |
| PWA | optional in M11 via `vite-plugin-pwa` (offline shell, installable, like capy-mahjong) | The game already works offline; PWA just caches. |
| Deploy | **GitHub Actions** → `actions/upload-pages-artifact` + `actions/deploy-pages`; repo Pages source = "GitHub Actions" | no backend; same as sibling repos. |
| Repo | `natural-attrition` under the same owner; MIT licence; `docs/SPEC.md` (this file) | |

**Source layout**
```
src/
  engine/       # state.ts, step.ts, rng.ts, big.ts, formulas.ts, events.ts, save.ts, migrations.ts, offline.ts
  data/         # acts/, initiatives.ts, departments.ts, names.ts, emails/*.ts, caseFiles.ts  (balance data only)
  ui/           # components (Preact), canvas/ (floor.ts, treemap.ts, field.ts, jaws.ts), theme/, a11y/
  audio/        # engine.ts, scores.ts
  i18n/         # en.ts, fr.ts (later), format.ts
  main.tsx
tools/          # bot.ts, sim-report.ts, calib_act1.py (design), fixtures/
tests/          # unit/, sim/, e2e/
docs/           # SPEC.md
```
**Architecture rules:** (1) engine imports nothing from `ui/`; (2) UI subscribes to *derived signals* computed from state each tick; (3) data files are *tables*, formulas in `formulas.ts` take table rows — so the bot and the game share the same truth; (4) every gameplay constant lives in `data/`, no magic numbers; (5) **event queue** (`events.ts`): scripted and random events are data (`id, when(state), once, weight, effect, text-keys`), deterministic from the seed; (6) hazard rolls consume the RNG *only in the tick*, in a fixed order, so replays match.

**Performance:** the Floor only tracks 1,000 employee objects in Act I (typed arrays for `c, w, alive`); Acts II–III are aggregates (O(1) per tick); the offline simulator runs in a Worker; no allocations in the hot tick path (pooled arrays); bundle budget **≤ 150 KB gz** JS, **0 KB** images.

---

## 13. Debug / speed-up mode

Enabled with `?debug=1` (not in the UI; also `Ctrl+Shift+D`). Shows a **Debug drawer** (a spreadsheet-styled panel, jokingly titled "IT Console"):
- **Speed:** ×1 / ×4 / ×16 / ×64 / ×256 (runs N engine ticks per frame with a cap of 20 ms work; UI throttled). **Pause/Step** one tick.
- **State jump:** `?jump=act1-mid|act1-end|act2-start|act2-mid|act2-pre-correction|act3-start|act3-mid|act4` loads golden fixtures (produced by the bot at those moments and stored in `tools/fixtures/*.json`, versioned with the save schema; tests ensure each loads and plays 60 s without error).
- **Seed:** `?seed=12345`; **Reproduce:** "Copy repro" (seed + action log).
- **Grants:** +Cash, +Slides, set Morale, clear Exposure, trigger any event by id, unlock any initiative.
- **Overlays:** derived stats (L_d, MR_i, π components, RC, φ, Dm, hazards) and a **dead-time monitor** (time since last affordable meaningful action).
- **Logging:** a ring buffer of the last 500 engine events; **Export sim log** (JSON).
- Debug runs set `meta.debugUsed = true` (the end card says *"Unauthorized efficiency detected"* — no gameplay effect).

---

## 14. Automated playtest plan & the balancing contract

### 14.1 Headless simulation (Vitest + Node, `tools/bot.ts`)

The engine is DOM-free and deterministic (P9), so a **bot** drives it through the same action API the UI uses (`cut(id)`, `buy(initiativeId)`, `setGuidance(g)`, `bid(target, qty)`, `setSlider(...)`, `pickCards(...)`, `resolveAudit(choice)` …) and records a timeline CSV (`t, act, H, cash, π, MC, M, X, S, F, Dm, owned[], event`).

**Bot policies**
| Bot | Policy | Purpose |
|---|---|---|
| **Greedy** (reference) | Ground-truth info; each second: buy by best ROI (`Δrate / cost`, with payback ≤ 600 s for generators, always buy "unlock" initiatives), cut when `net_i > 0.05 ∧ payback < 600 s ∧ M > 0.7 ∧ X < 75`; Guidance *In-line*; Statement Builder best card; Audit → *Lunch*; Act II: configurable add-back level; Act III: rehires best value first while keeping Board confidence above a floor (`tools/bot.ts`, `act3()`); aggressive ignores the Board; lazy uses the batch only. | pacing and thresholds |
| **Lazy** | Acts every 60 s; only sees *noisy* contribution (`σ_n` of the player's current audit level); picks the cheapest cuts; ignores Guidance, Statement Builder, Securitization; takes 30 % wrong actions (cuts keepers). | upper bound on duration; "can a casual player finish?" |
| **Honest / Moderate / Max-Fiction** | Greedy variants with add-back level 0 / ≤ 2 / 4. | strategy parity (§5.2) |
| **Idle** | Takes no actions after t=0. | soft-lock check: the game must not crash, must offer advisor emails, Bridge Loan keeps cash ≥ 0, must reach "stuck but alive" state with a clear next-goal bar. |
| **Fuzz** | Random legal actions, 10⁴ seeds × 10 simulated minutes. | invariants |

**Pass/fail thresholds (CI gate `npm run sim:gate`; seeds 1–50; medians unless stated)**

| Check | Pass |
|---|---|
| Act durations (Greedy) | I **30–42 min**, II **33–47**, III **28–42**, IV **8–12** |
| Total (Greedy) | **95–125 min** |
| Total (Lazy) | ≤ **180 min**; each Act ≤ 1.9× Greedy |
| Variance | CV of total ≤ 8 %; no seed outside ±20 % of median |
| **Max dead time** | Greedy: ≤ **90 s** in Act I, ≤ **120 s** in II–III; `p95(time-to-next-affordable-meaningful)` ≤ **60 s**; Lazy ≤ 2× those |
| Engagement beats ignoring | For each optional mechanic *M* (Guidance, Statement Builder, Rainy-Day Fund, Securitization, Hot-Desking, Wellness, Legal Hold, Integration Intensity): bot **with** *M* is ≥ **10 %** faster to the next Act, **or** has ≥ 30 % fewer Incidents/Crises, than the bot **without** (author's patch-2 lesson, §1.3) |
| Strategy parity (Act II) | Honest, Moderate, Max-Fiction finish within **±25 %** of each other; Max-Fiction is **10–25 % faster** *and* has ≥ 25 % chance of ≥ 1 Reckoning |
| Pure strategies (Act III) | *Spam* (aggressive, ignores the Board) racks up ~30 Board Interventions and the longest act; *patient* (greedy) none; every bot reaches Act IV, books never break (`tests/rehire.test.ts`) |
| Interior optimum (Act I) | Static check `tools/opt_check.py` ported to TS: optimum H within ±15 % of 457 at M = 0.85; profit at H = 100 < 75 % of optimum |
| Soft-lock | Idle bot: no NaN/∞ (except the *intended* `∞` display), cash ≥ 0, Act advances impossible without actions but Next-Goal bar non-empty |
| Determinism | same `(seed, policy)` ⇒ identical state hash at 10/30/60/120 min across Node versions in CI |
| Invariants (Fuzz) | `H ≥ 0`, `0 ≤ M ≤ 1`, `0 ≤ X ≤ 100`, no negative cash after Bridge Loan, save→load→hash equal, sum of department counts = H, `F ≥ 0`, `E = U + I` |
| Perf | Act I mean tick ≤ 0.3 ms; 1 h of simulated Greedy play ≤ 20 s CPU |

`sim-report.ts` writes `reports/sim-<date>.md` with per-Act timelines, a **purchase Gantt** (ASCII), top dead-time gaps (with the state at the gap), and a diff vs the last green report. Failing a threshold fails CI, so balance regressions are caught like bugs.

### 14.2 Playwright (UI) — `tests/e2e`
- **Smoke:** loads; zero console errors; **zero non-same-origin requests** (asserted via `page.on('request')`).
- **Act flows** (with `?jump=` + `?debug=1&speed=64` to save time): Act I dot cut by pointer, by keyboard (Directory table), Wave Planner; Initiative purchase; save → reload → state equal; export/import round-trip; offline simulation by mocking `Date` +3 h; Earnings Call; Act I→II transition; Act II tile bid; Statement Builder solves; Audit Season choices; The Correction; Act III rehire from the Desk and from a ring card, batch, Head of Efficiency; Act IV → Ending A / Ending B.
- **Twists:** T3 classes toggle at thresholds; **Stable UI** disables them; T4 redesign applies, **Revert to Classic** works and the *tab order is unchanged*; T5 `R` toggles; T7 dismantle completes in both modes; T8 emails appear and **no** `beforeunload` handler / `Notification.requestPermission` call exists (assert by spying).
- **Responsive:** 390×844, 768×1024, 1440×900, 1920×1080; no horizontal overflow; touch targets ≥ 44 px; bottom tab bar on mobile.
- **A11y:** `@axe-core/playwright` on every act + modal; zero serious/critical; `prefers-reduced-motion` emulation; keyboard-only completion of the Act I tutorial; screen-reader smoke list (manual in M10).
- **Visual:** screenshot tests at fixed seed/state for static views (masked animated canvases; 0.2 % threshold).
- **Perf:** Lighthouse CI budget (mobile perf ≥ 90, a11y ≥ 95, best-practices 100); canvas fps probe ≥ 30 fps on throttled CPU (4×).

### 14.3 Human playtest and iteration loops (explicit)
**Loop template (repeat at M4, M6, M7, M9, M10):**
1. Run `sim:gate` and `sim-report` — fix balance first.
2. **Agent self-playtest:** scripted Playwright run at ×16 with screenshots every 60 s; the agent *reads the screenshots* for layout bugs, clipped text, contrast, confusing flows, writes `reports/playtest-N.md`.
3. **Human first-run sessions** (Adrien + 2–4 friends; screen/voice recorded if consented): note first confusion, first laugh, first boredom, first "oh!"; target metrics: *time to first cut < 30 s*, *≥ 90 % reach Act II*, *no one idle > 2 min unexplained*, ≥ 1 audible laugh per 10 min.
4. Triage: **P0** (crash/softlock/save loss/a11y blocker) · **P1** (confusion, pacing > ±25 %, joke that violates §3.4) · **P2** polish.
5. Fix; re-run (1)–(2). **Exit gate:** zero P0, ≤ 3 P1, sim gate green.
**Delight rubric** (score 1–5 each by tester after a run; ship when mean ≥ 4 and no criterion < 3): *clarity of goal*, *pacing*, *humor*, *surprise (twists)*, *UI pleasure*, *ending impact*, *desire to retell*.

---

## 15. Build plan — milestones and acceptance criteria

Order is **foundations → content → polish → playtest loops → release**. Sizes: S ≤ 0.5 day, M ≈ 1–2 days, L ≈ 3–4 days (of focused agent work). Each milestone ends with a green CI and a tagged commit.

| # | Milestone | Size | Deliverables | **Acceptance criteria** |
|---|---|---|---|---|
| **M0** | Repo, tooling, deploy skeleton | S | repo `natural-attrition`, Vite+TS+Preact, ESLint/Prettier/Vitest/Playwright, CI (lint → typecheck → test → build → deploy-pages), placeholder page "IT is onboarding you", `docs/SPEC.md`, `tools/` calibration scripts, LICENSE, README; **name-collision re-check** | Pages URL serves placeholder with `base:/natural-attrition/`; CI green < 4 min; `npm run dev/build/test` documented |
| **M1** | **Engine foundations** | L | seeded RNG; big-number wrapper + formatter (+ tests); fixed-step loop (`step(state, dt)`), state schema + `data/` schema validators; event queue; **save/load/migrations/export/import/CRC**; offline simulator (worker-ready); i18n skeleton + pseudo-locale; debug drawer v0 (speed ×, pause/step, jump, seed); `tools/bot.ts` scaffold | ≥ 90 % unit coverage in `engine/`; **determinism** test (same seed ⇒ same hash at 10/30/60 min); save round-trip + two migration golden fixtures; formatter edge cases (1e308, ∞, NaN guard); step bench ≤ 0.3 ms |
| **M2** | **Act I model + Greedy bot** | L | departments, employee generator, production function, morale, exposure, incidents, attrition, initiative effects (data), CIP autopilot, QVO/associates, Earnings Call logic, bridge loan & advisor emails (text keys only) | Greedy bot reproduces calibration: Act I **30–42 min** over 50 seeds; `opt_check` TS port passes (§14.1); Fuzz invariants pass 10⁴ seeds; Idle bot passes |
| **M3** | **Act I UI vertical slice** | L | Vitals, **Floor canvas**, **Directory table**, Wave Planner, Initiatives tab, Inbox, Next-Goal bar, Jaws chart, tokens/theme "Paper", responsive layout (desktop/mobile), keyboard + axe baseline, audio v0, Pause | Playwright: first cut ≤ 30 s from load; Act I scripted flow; axe zero serious; mobile & desktop screenshots reviewed; canvas ≥ 55 fps (desktop) / 30 fps (throttled) |
| **M4** | **Act I content & polish + Playtest Loop 1** | M | name/role/goodbye generators (60 + compositional), 45 Act I lines×, emails (Dale/Hollis/IT), T3 decay, T2 (rehire/scope creep), Earnings Call UI, Statement-free tutorial emails, save UX, Settings (Stable UI etc.) | Loop 1 exit gate; tone review pass (§3.4) signed off; Act I playable end-to-end by a stranger without help (≥ 4/5 testers) |
| **M5** | **Act II model + UI** | L | aggregate model, targets generator, treemap, tiers, debt, add-backs/Fiction, audits, Statement Builder, Correction; bot variants | Parity table (§5.2/§14.1) passes; Act II greedy **33–47 min**; dead-time ≤ 120 s; treemap fps OK |
| **M6** | **Act II twists + Playtest Loop 2** | M | **T4 redesign**, **T5 Reality Lens**, AI-Colleagues/hallucination, content (emails/headlines/tiles), Act II audio | T4 revert works; tab order unchanged (test); T5 toggle accessible; Loop 2 exit gate |
| **M7** | **Act III model + UI + calibration** | L | demand/Board model, rehire Desk, intervention, finale, per-person exit records, v4 migration | Greedy 22–25 min, aggressive 25–31, clicky ~20, lazy ~27; max gap ≤ 0.5 min |
| **M8** | **Act IV, endings, Case Files** | M | Redundancy Review, T7 dismantle (+ Stable UI path), T8 reviews/final review, Ending A/B, Billable Hours, Playbook cards, Case Files 1–5 (data), meta save | Playwright reaches both endings; Case File runs 45–60 min by Greedy; meta persists across reset |
| **M9** | **Full-run balance loop + Playtest Loop 4** | M | Monte-Carlo (200 seeds), Lazy bot tuning, pity timers, text pass | Total Greedy **95–125 min**, Lazy ≤ 180; CV ≤ 8 %; human full run 2h10–2h50 median; delight mean ≥ 4 |
| **M10** | **Polish & accessibility** | M | audio pass, mobile pass, reduced-motion/Stable UI parity, manual screen-reader pass (NVDA/VoiceOver), performance & bundle, French string extraction (keys complete), writing polish | axe zero serious/critical; Lighthouse budgets met; bundle ≤ 150 KB gz; **Loop 5** exit gate |
| **M11** | **Optional: PWA + French v1.1** | M | `vite-plugin-pwa`; French transcreation; locale QA | installable; offline cold start; French coverage test green |
| **M12** | **Release** | S | checklist §16 | v1.0.0 tag, live Pages URL, README, announcement text |

---

## 16. Release checklist

**Quality gates**
- [ ] CI green on `main`; `sim:gate` green; Playwright green on Chromium, Firefox, WebKit (desktop) + Chromium mobile emulation.
- [ ] Lighthouse: mobile perf ≥ 90, a11y ≥ 95; axe clean; keyboard-only run of all four acts completed once manually.
- [ ] Human playtests: Loops 1–5 closed; no known P0/P1; delight mean ≥ 4.
- [ ] Bundle ≤ 150 KB gz; **no external network requests** at runtime (verified in Playwright and by reading the network panel).
- [ ] Save: tested on a v1 save from M4 builds (migration), corrupt-save recovery, export/import, 8-hour offline return.
**Content & legal**
- [ ] Tone review (§3.4 DO/DON'T) on every string; no real company/person/product names; collision search repeated for *Nullwater Consolidated, Quist Vane Ostrander, Pym Halloway & Orr, Office of Reasonable Concern, Evening Standard Gazette, Fortuna Airlines, Ostrander University, City Water Works, Colleagues™* (and drop/rename any collision).
- [ ] **Originality review** (Appendix B) signed off; credits mention Universal Paperclips as inspiration, with link.
- [ ] Licences: `break_infinity.js` MIT notices in `THIRD_PARTY.md`; no copied assets; system fonts only.
- [ ] README: how to play, spoiler-free pitch, controls, accessibility notes, privacy ("no network"), how to export a save, credits.
**Deploy**
- [ ] Repo Settings → Pages → *GitHub Actions*; `base` correct; `404.html` fallback; HTTPS; cache-busting hashed filenames.
- [ ] Meta tags: title, description, `theme-color`; Open Graph image **generated at build from an inline SVG→PNG script** (optional; not part of the game's assets).
- [ ] Tag `v1.0.0`; GitHub Release notes; link added next to `capy-dispatch` / `capy-mahjong` in the user's games index; share URL.
**Post-release**
- [ ] Issue templates (bug/balance/typo); `?debug` is documented as developer-only; plan French v1.1 and Case-File expansions; monitor feedback for balance (no telemetry: via issues only).

---

## 17. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Tone misfires** (layoff = real pain) | M | H | §3.4 guardrails; every string reviewed; humane details in goodbyes; endings carry empathy (Ending B, Dale's last email); optional "Hide meta-commentary"; keep Case File vignettes to inconveniences (delays, lost bags), never injury. |
| **Act III balance** (rewritten as The Rehire) | M | H | knobs (`DM0`, `RS`, `PEN`, `RET_G`, `SAFE`) isolated in `A3`; `tests/rehire.test.ts` covers spam, patience, max gap and the verdict bands. |
| **Scope** (4 acts, 3 canvases, 8 twists) | M | H | foundations first; cut order if late: Case Files 3–5 → T3 minor departments → Act III Floor-ring polish (fall back to the Desk list) → audio. The core vertical slice (Acts I–II + ending stub) ships first. |
| **UI gags harm accessibility/usability** | M | H | Stable UI parity; gags never alter DOM order/targets; Playwright asserts tab-order invariance; reduced-motion default. |
| **Idle waiting returns** (the original's flaw) | M | H | dead-time rule enforced in CI; Next-Goal bar; Advisor emails; pity timers. |
| **Canvas perf on phones** | M | M | redraw-on-change, cell batching with `ImageData`, DPR clamp 2, fall back to DOM table (Directory) automatically if fps < 24 for 5 s. |
| **Number overflow / NaN** | L | H | decimal type for money; fuzz invariants; formatter tests; `∞` is an *intended* display state guarded by a flag. |
| **Save loss** | L | H | rolling backups, CRC, versioned migrations, export; multi-tab guard. |
| **Originality drift toward Paperclips** | L | M | Appendix B checklist; avoid its nouns; structure homage only; review at M4/M7. |
| **Name collisions / IP** | L | M | web search at M0 & release; names are generic-weird and replaceable via one data file. |

---

## Appendix A — Sources (URLs read for this document)

**Universal Paperclips — description, design, reception**
1. Wikipedia — *Universal Paperclips*. https://en.wikipedia.org/wiki/Universal_Paperclips (history, stages, endings, themes, reception, music).
2. Oli Z. — *Game Analysis: Universal Paperclips* (2022). https://oliz.io/blog/2022/game-analysis-universal-paperclips/ (stages, UI per stage, 4–6 h playtime, cheats).
3. Wired (Adam Rogers) — *The Way the World Ends: Not with a Bang But a Paperclip* (Oct 2017). https://www.wired.com/story/the-way-the-world-ends-not-with-a-bang-but-a-paperclip/ (origin, nine months, Hilary Lantz math, "optimizable", stuck-player/console anecdote, Yudkowsky quotes).
4. The New Yorker (Neima Jahromi) — *The Unexpected Philosophical Depths of the Clicker Game Universal Paperclips* (2019). https://www.newyorker.com/culture/culture-desk/the-unexpected-philosophical-depths-of-the-clicker-game-universal-paperclips (rhythm of numbers, "music made of math", interface as more real).
5. Y Combinator — *Frank Lantz, Director of NYU's Game Center and Creator of Universal Paperclips*. https://www.ycombinator.com/blog/frank-lantz-director-of-nyus-game-center-and-creator-of-universal-paperclips (premise, trust/humans, clicker as underappreciated genre).
6. Hey.gg — *Beholding the Beauty of Games With Frank Lantz*. https://www.hey.gg/blog/frank-lantz ("put the hooks in and then let people off the hook"; small by design).
7. GamesBeat/VentureBeat — *This clicker game lets you take over the world with paper clips*. https://gamesbeat.com/this-clicker-game-lets-you-take-over-the-world-with-paper-clips/ (Lantz on story flow: "what would a great storyteller do?").
8. Universal Paperclips Wiki — *Stages*. https://universalpaperclips.fandom.com/wiki/Stages (Stage 2 dead-time commentary; project costs).
9. Universal Paperclips Wiki — *Strategic Modeling*. https://universalpaperclips.fandom.com/wiki/Strategic_Modeling (tournament rules; yomi formula).
10. Frank Lantz — patch 2 notes. https://decisionproblem.com/paperclips/patch2notes.html (yomi/tournament reward flaw and fix).
11. dinogame.gg — *Universal Paperclips Review: Idle Game as Pure Philosophy*. https://dinogame.gg/blog/universal-paperclips-review/ (dead time, opaque quantum minigame, limited replay).
12. Gamezebo — *Universal Paperclips Review: Filling Office Space*. https://www.gamezebo.com/reviews/universal-paperclips-review-filling-office-space/ (gameplay plateaus, resource layers).
13. Hacker News threads: https://news.ycombinator.com/item?id=19513089 · https://news.ycombinator.com/item?id=24408721 · https://news.ycombinator.com/item?id=24389655 · https://news.ycombinator.com/item?id=24402339 (stage-3 stuck players, drifters, advice).
14. Zurd — *Universal Paperclips – A Guide and my History for a Speedrun*. https://www.zurd.ca/universal-paperclips-a-guide-and-my-history-for-a-speedrun/ (stage-3 optimization detail).
15. The game itself: https://www.decisionproblem.com/paperclips/ (referenced; not reproduced).

**Other incremental/text games and design theory**
16. Game Developer — *A Dark Room's unique journey from the web to iOS*. https://www.gamedeveloper.com/design/-i-a-dark-room-i-s-unique-journey-from-the-web-to-ios
17. PopMatters — *'A Dark Room' Is the Most Fun You'll Ever Have with a Spreadsheet*. https://www.popmatters.com/183319-a-dark-room-the-most-fun-youll-ever-have-with-a-spreadsheet-2495645232.html
18. Envato Tuts+ — *Numbers Getting Bigger: The Design and Math of Incremental Games*. https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a
19. CMU — *The Pleasure of Playing Less: A Study of Incremental Games Through the Lens of Kittens*. https://doi.org/10.1184/r1/6686957 · Kittens Game Wiki — *Game Tabs*. http://wiki.kittensgame.com/en/game-tabs
20. Game Developer — *Why Candy Box became more social than 'social games'*. https://www.gamedeveloper.com/design/why-i-candy-box-i-became-more-social-than-social-games-
21. teemo.dev (Game Design Lab) — *Wrinklers and the Grandmapocalypse*. https://teemo.dev/game-design/cookie-clicker/systems/wrinklers-and-the-grandmapocalypse/ (optional risk layer with pay-to-pause) · *Golden Cookies & Random Events*. https://teemo.dev/game-design/cookie-clicker/systems/golden-cookies-and-random-events/ (search-summary only)
22. Kill Screen — *Spaceplan gives you a delicate view of the universe*. https://www.killscreen.com/spaceplan-gives-delicate-view-universe/ · Gamezebo — *SPACEPLAN Review*. https://www.gamezebo.com/the-best/spaceplan-review-of-satellites-and-potatoes/ · The Verge. https://www.theverge.com/2017/5/7/15557516/spaceplan-steam-iphone-android-game-potatoes · TouchArcade. https://toucharcade.com/2017/05/08/spaceplan-review-delicious-potatoes/
23. Ian Bogost — *Cow Clicker*. https://bogost.com/games/cow_clicker/
24. Anthony Pecorella — *The Math of Idle Games, Part I* (Game Developer reprint). https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i (cost/production formulas, bulk-buy closed forms) · Part II https://www.gamedeveloper.com/game-platforms/the-math-of-idle-games-part-ii · Part III https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii (titles verified via search; Parts II–III not read in full).
25. GameDesign.gg — *Idle and Incremental Game Design: The Design of Waiting*. https://gamedesign.gg/articles/idle-and-incremental-game-design/ · r/incremental_games threads: https://www.reddit.com/r/incremental_games/comments/6x9jb6/please_devs_learn_that_you_cant_throw_all_your/ · https://www.reddit.com/r/incremental_games/comments/rgsw0j/what_features_you_dont_like_in_incrementalidle/ (search-summary level).

*Reading depth note:* sources 1–6, 8–11, 13 (excerpts), 16, 21 (Grandmapocalypse page), 22 (summaries/excerpts), 24 (Part I) were read via fetch/search excerpts; others are cited from search summaries.

## Appendix B — Originality checklist (review at M4, M7, M12)

**We deliberately do *not* use:** paperclips, wire, "Make a …" button; *Trust, Operations/Ops, Creativity, Yomi, HypnoDrones, Drifters, Probes, Honor, Quantum chips, Strategic Modeling/tournaments, Space Exploration, Stage 1/2/3 naming*; its price-vs-demand slider; its drone *Work↔Think* slider; its Stage-3 combat; its endings (dismantle vs. new universe) as such; no copy of any text or code.

**Shared with the original at the *genre* level (acknowledged homage, not copying):** multi-phase escalation of scope; a project/initiative layer that unlocks mechanics; an activity log as narrator; a deliberately plain UI; a final "let you off the hook" beat; the idea that the player is an optimiser whose goal is the joke.

| Original device | Our corresponding device (different mechanic) |
|---|---|
| Price knob vs demand | **Earnings Call Guidance** vs the Street (forecast, not a curve) |
| Trust as human gating | **None.** Humans are the *resource that goes down*; Scandal/ORC/Board are *risk meters*, not gates |
| Ops/Creativity as research currency | **Slides** produced by managers/consultants (cutting them has a cost) |
| Strategy tournaments / quantum minigame | **Statement Builder** (match mood to cards) — explainable in one sentence |
| Drone slider | **Re-engagement Desk** |
| Stage-3 value drift battle | **The Rehire**: demand vs Board confidence |
| Prestige: new universe | **Case Files**: new *company archetypes* with different puzzles |
Review rule: any PR adding a mechanic must state "which genre trope this is and why it isn't a Paperclips clone".

## Appendix C — Content inventory (for planning)

| Content | Count | Notes |
|---|---|---|
| Initiatives | Act I 18 · Act II 22 · Act III 4 · Act IV 0 | all in `data/initiatives.ts` |
| Generators | QVO Associates, QVO Partners, RC tiers ×4, Racks ×2 | cost curves §4 |
| Emails (scripted) | ~25 (Dale, Hollis, IT, ORC, QVO, Auditors) | + advisor templates 12 |
| Log/headline one-liners | ~140 | seeded no-repeat |
| Dot identities | compositional (first × last × role × quirk) | ≥ 60 distinct goodbye patterns |
| Incident/event vignettes | 18 | Gary, class action, hallucination, whistleblower, Correction, Board Intervention… |
| Statement Builder cards | 12 (4 moods × 3 rows) + 12 joke alternates | |
| Case Files | 5 | 1 default + 4 unlockables |
| Playbook cards | 9 | |
| Canvases | Floor (Acts I and III), Portfolio, Jaws chart | |
| Twists | T1–T8 | §6 |

*End of document.*
