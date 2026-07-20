# UI/UX Critique — Round 3

**For:** Wes Gilbert (solo founder, MorphoGenix · Albuquerque NM)
**From:** Senior product designer, brutal-honesty mode
**Scope:** Style/craft critique only. No code, no branch, no commits. JavaScript-only recommendations. Locked palette (navy `#0B1220`, teal `#29E0C8`, amber `#F5B343`, violet `#8A6CFF`, surface `#141B2D` + depth tokens). Dark mode only.
**Relationship to prior rounds:** Round 1 shipped depth tokens + `ScoreRing` + elevated Home cards. Round 2 shipped Inter fonts, animated `ScoreRing`, frosted tab bar, haptics wrapper (merged `b4695e5`), and *planned* items #4–#10 in `round2_roadmap.md` that are NOT yet built. This doc does not re-recommend shipped work; where it lands on a planned R2 item it says so explicitly.

---

## 1. Executive verdict

MorphoGenix is a **competent Expo app wearing an Oura costume on exactly one screen**. Home is genuinely close to the real thing; the moment you leave it, the illusion collapses into flat cards, system-fallback numerals, and a chart language that looks hand-rolled because it is. The single biggest problem is not any one screen — it's that the app has **two visual languages fighting each other**, and the "cheap" one wins on 3 of 4 tabs.

Per screen: **Home** feels premium because the `ScoreRing` and elevated cards do real work; **Analytics** feels like a developer's debug view with a coat of teal; **History** feels like a to-do list app that happens to show wellness scores; **Account** is the most honest screen — it's fine because iOS Settings is easy to imitate, but it's inconsistent with Home. You are one disciplined pass away from "this is a real product," and three passes away from "indistinguishable from Oura."

---

## 2. The gap — five design principles the app is missing

### Principle 1 — **One material, everywhere**
Premium apps commit to a *single* surface material and repeat it religiously. Oura's redesign is built on "a simplified component language that supports quick comprehension" ([Instrument — Oura app](https://www.instrument.com/work/oura-app)); WHOOP's three-color, one-tile vocabulary means "users learn the visual language once and it applies everywhere" ([925Studios — WHOOP breakdown](https://www.925studios.co/blog/whoop-design-breakdown)).
**How MorphoGenix violates it:** Round 1 upgraded 3 of ~8 card surfaces to `surfaceElevated` + `colors.ink` + soft shadow. The rest — Analytics sections (`AnalyticsScreen.js:395`), History rows (`HistoryScreen.js:246`), Account sections (`AccountScreen.js:254`), `BleConnectCard`, the About modal — still use flat `colors.surface` with `rgba(255,255,255,0.05)` hairline borders. You literally have a "before" and "after" living in the same build.
**Fix hint:** Pick the elevated material as *the* card. Delete the flat one. (This is **R2 P1 #4** — reinforced and escalated to P0 here.)

### Principle 2 — **Numerals are the brand**
On Oura and Apple Watch, the big number *is* the product. WHOOP renders its Recovery score "at roughly 72pt equivalent, making it readable from arm's length" ([925Studios](https://www.925studios.co/blog/whoop-design-breakdown)); Apple uses SF Pro Rounded for ring numerals ([Apple — Activity rings HIG](https://developer.apple.com/design/human-interface-guidelines/activity-rings)).
**How MorphoGenix violates it:** R2 loaded Inter and wired `familyDisplay` (Inter Black) into `ScoreRing` and `MetricTile`. But the **biggest numbers on Analytics and History never got the display face**. `AnalyticsScreen.js:417` renders the 38px hero (`87/100`, `0.61 N`) with `fontWeight: typography.weights.bold` and *no `fontFamily`* — so it falls back to Inter Regular at a bold weight, not the Black display cut. Same story for chart values. Your hero numerals are inconsistent between tabs.
**Fix hint:** Route every hero numeral through `typography.text.hero`/`display`. (Refines **R2 #1**, which is marked shipped but only half-applied.)

### Principle 3 — **Motion is information, not decoration**
Apple's rings *fill* and *count up* to tell you a story ([Apple — Close Your Rings](https://www.apple.com/watch/close-your-rings/)); WHOOP's "transitions between tiers use smooth animations that maintain spatial context, so users always know where they are" ([925Studios](https://www.925studios.co/blog/whoop-design-breakdown)).
**How MorphoGenix violates it:** Motion exists in exactly two places — the `ScoreRing` fill (`ScoreRing.js:105`, 900ms) and the `PalateHeroCard` live-dot pulse (`PalateHeroCard.js:82`, 720ms). Every other transition is instant: period-pill switches on Analytics snap, charts appear fully drawn, History rows have no entrance, tab screens hard-cut. Nothing carries continuity.
**Fix hint:** Add a shared draw-on for charts and a 120–180ms cross-fade on period/data changes. (Overlaps **R2 P2 #8** for charts; the transition work is new.)

### Principle 4 — **Progressive disclosure by depth, not by dump**
Oura rebuilt its visualizations "around three adaptable levels" — glanceable indicators, focused metrics, then "precise exploratory views" ([Instrument](https://www.instrument.com/work/oura-app)). WHOOP: "Each tile is a doorway, not a destination… New data lives behind new tiles, not crammed into existing ones" ([925Studios](https://www.925studios.co/blog/whoop-design-breakdown)).
**How MorphoGenix violates it:** Analytics dumps all four metrics' hero number + chart + 3 stats + a "meaning" sentence onto one scroll, every one styled identically with equal weight. Nothing is a doorway. History rows are `Pressable` but "press goes nowhere" (`HistoryScreen.js:168`). There is no depth — just a flat wall of equally-loud cards.
**Fix hint:** Make Analytics sections collapse to a glanceable summary that expands the chart+stats on tap; give the dead History press a real destination or at least a haptic + expand. (The dead-press is called out in **R2 open question #6**.)

### Principle 5 — **Optical rhythm, not token rhythm**
Great apps space things by eye, using a scale with enough steps to create *tension* between tight and loose. Oura's redesign leans on "clearer layouts" and an "updated grid and layout system" ([Instrument](https://www.instrument.com/work/oura-app)).
**How MorphoGenix violates it:** Nearly every vertical gap in the app is `spacing.lg` (16px). Card-to-card, header-to-content, section-to-section — all 16. The scale (`spacing.js`) jumps 32 → 48 with nothing between, so there's no "large but not huge" step. The result is a monotonous, evenly-gray rhythm with no breathing room around hero moments and no compression around dense lists.
**Fix hint:** Add `xl2: 20` and `xxl: 40`; give hero blocks more air (28–32) and tighten stat lists (8–10). Uses the existing token file only.

---

## 3. Screen-by-screen critique

### Home — *"Feels like Oura because the ring and the hero card do real work."*
The strongest screen, and it earns it. Ranked issues:

1. **The metric grid undercuts the ring it sits below.** (Most severe.) The `ScoreRing` shows animated, real posture; then four `MetricTile`s below show `sparkline={[20,24,26,25,29,31]}` — hard-coded arrays (`HomeScreen.js:145,154,164,173`) that never change and don't match the tile value. A designer's eye reads "the top is real, the bottom is fake." *Fix:* drive sparklines from the same smoothed series feeding the value, or drop them until real. Also make color stateful — Posture and Nasal both render teal (`:143,:171`) regardless of value, so color is decoration, the opposite of WHOOP where "every hue carries meaning" ([925Studios](https://www.925studios.co/blog/whoop-design-breakdown)). *(Reinforces **R2 P1 #5**.)*
2. **The greeting/ring block has no negative space contract.** `welcomeBlock` (`HomeScreen.js:234`) puts "Good morning, Wes" and the 104px ring in a `space-between` row with `paddingRight: spacing.lg`. The ring crowds the right edge; the greeting crowds the left. Oura pins the score with generous air around it. *Fix:* increase top margin to ~28px, give the ring an 8–12px right inset, and let the greeting wrap to two lines gracefully.
3. **Wear-time caption is an orphan.** `WearTimeCaption` (`HomeScreen.js:130`) is a bare icon+text line floating between the hero and the Takeaway with `marginTop: spacing.lg / marginBottom: spacing.md`. It reads like a debug label, not a designed element. *Fix:* fold it into the hero card footer or the ring's sublabel.
4. **Brand row logo chip is a stray rounded square.** `logoWrap` (`HomeScreen.js:211`) is a 56×44 `colors.surface` rounded rect behind an SVG mountain — flat, un-elevated, inconsistent with everything else. *Fix:* drop the chip background or make it match the elevated material.

### Analytics — *"Feels like a debug view because every section is identical and flat."*
1. **Flat surface regression.** (Most severe.) `styles.section` (`:395`) is flat `colors.surface` + a 3px accent left-border — the "before" language. Next to Home's lifted cards this looks unfinished. *Fix:* elevated material + soft shadow; keep the accent edge. *(This is **R2 P1 #4**, escalated.)*
2. **Hand-rolled charts read DIY.** `LineChart`/`BarChart` (`:283,:318`) are single-stroke polylines/bars — no baseline, no area fill, no axis hint, no entrance, `victory-native`+Skia installed but unused. Apple Health uses thin lines with a soft area gradient under the trend and a highlighted point; WHOOP's Recovery chart has "color-coded zones." *Fix:* add a teal→transparent area fill, a faint baseline, a draw-on, and keep the last-point dot you already have. *(Elaborates **R2 P2 #8**.)*
3. **Hero numerals miss the display face.** `heroNumber` (`:417`) has no `fontFamily` — the biggest numbers on this screen aren't Inter Black. *(See Principle 2; refines **R2 #1**.)*
4. **Period pills have no motion or haptic and the active state is muddy.** `pillActive` (`:384`) swaps background `surface`→`navy` and text muted→teal, but the change snaps and is silent. `AnalyticsScreen.js` doesn't import the haptics wrapper. *Fix:* 150ms cross-fade on the pill background + `haptics.selection()` on change. *(Reinforces **R2 P1 #6**.)*
5. **"Meaning" line is italic — a cheap tell.** `styles.meaning` (`:452`) uses `fontStyle: 'italic'`. System-italic Inter looks like a fallback. *Fix:* drop italic, use `colors.muted` at regular weight with a hair more line-height.

### History — *"Feels like a task list because rows are flat, chips are loud, and the heatmap is a mystery strip."*
1. **The 14-cell heatmap has no legend and no meaning.** (Most severe.) `Heatmap` (`:131`) hard-codes teal/amber/violet by threshold in `compositeColor` (`:160`) with only "14d ago / Today" labels. There is no key for what a color *means*, so it reads decorative — exactly the Ultrahuman failure a reviewer flagged: color coding "isn't very sensible" ([Business Insider — Ultrahuman review](https://www.businessinsider.com/guides/tech/ultrahuman-ring-air-review)). *Fix:* add a tiny inline legend (low→high) and label week boundaries so the strip reads as time.
2. **Rows are flat + dead.** `styles.row` (`:246`) is flat `colors.surface` + `rgba(255,255,255,0.05)` border, and the `Pressable` "press goes nowhere" (`:168`). *Fix:* elevated material; add a haptic-only press now, a detail route later. *(R2 #4 + open question #6.)*
3. **Chip overload.** Each row shows four bordered pill chips (`:177`) with dots — 4 chips × 8 rows = 32 loud pills competing with the row's own label. Apple/Oura would show one composite indicator per row and reserve detail for the tap. *Fix:* collapse to a single composite score + color dot per row; move the four metrics into the (future) detail.
4. **`daySub` semantics are inconsistent.** Rows mix "Today/Mon Apr 28" with "Sat Apr 26/Weekend" and empty subs (`:39–:97`) — the label/sub pattern isn't uniform, which looks sloppy on scan.

### Account — *"Feels correct because iOS Settings is easy — but it's the wrong material for this app."*
1. **Flat sections again.** `sectionBody` (`:254`) is flat `colors.surface` + hairline border. Consistent with History/Analytics, inconsistent with Home. *Fix:* elevated material. *(R2 #4.)*
2. **Every control is silent.** The `+`/`−` posture adjuster (`:78–:89`), all `PushRow` taps (`:208`), and — most painfully — "Calibrate Supine" (`:104`) fire no haptic. Calibration succeeding is the one moment a `notificationAsync(Success)` would land hard, and it does nothing. *Fix:* wire the haptics wrapper. *(Reinforces **R2 P1 #6**.)*
3. **Calibrate failure is invisible.** `onCalibrateSupine` (`:38`) silently returns when there's no IMU data. The user taps a teal button and *nothing happens* — no toast, no shake, no error haptic. That's a trust killer. *Fix:* `haptics.warning()` + a one-line inline "No sensor data — connect a device."
4. **Chevron and adjuster glyphs are text characters.** `›` (`:215`) and `−`/`+` (`:82,:88`) are literal strings, not icons — they'll render in Inter and look slightly off-baseline versus a real chevron. *Fix:* use `Ionicons chevron-forward` / `remove` / `add` for optical consistency.

---

## 4. Component-level critique

### `ScoreRing` (the crown jewel)
**Works:** Thin gradient arc (teal→amber→violet), Inter Black centered numeral, clean count-up + 900ms `Easing.out(Easing.cubic)` fill, reduce-motion respected, settle haptic (`ScoreRing.js:105–115`). This is the most Oura-correct element you have.
**Doesn't:** (a) The gradient ramp is *fixed* — it always runs teal→amber→violet regardless of the score, so a great posture score still shows violet at the arc tip. On Oura/WHOOP the ring color *is* the state. (b) `fontWeight: typography.weights.display` ('900') is applied *alongside* `fontFamily: familyDisplay` (`:266–267`) — the numeric weight is a no-op for a named font and is cargo-cult styling. (c) The label uses a magic `fontSize: 10` (`:279`) that bypasses the type scale.
**Refinements:** Tint the whole arc by state (single hue that shifts teal→amber→violet by value); drop the redundant `fontWeight`; route the label through `typography.micro`.

### `MetricTile`
**Works:** Elevated surface, soft multi-layer shadow, faint accent radial sheen (`MetricTile.js:20–30`), Inter Black value, press scale 0.99.
**Doesn't:** (a) Fake sparklines (see Home #1). (b) Fixed per-tile accent, not stateful. (c) Press is silent — the *primary* interaction on the home screen has no haptic. (d) `RadialGradient id={`sheen-${title}`}` uses the title string as an SVG id (`:23`); titles with spaces ("Palatal Pressure") produce ids with spaces, which is fragile across renderers.
**Refinements:** Stateful accent (**R2 #5**); `haptics.selection()` on press-in (**R2 #6**); slugify the sheen id.

### `PalateHeroCard`
**Works:** Elevated 28px-radius hero, well-composed dome SVG, live-dot pulse driven by `isStreaming`. This is your signature visualization and it's good.
**Doesn't:** (a) The heading uses `fontWeight: typography.weights.display` ('900') on `fontFamily: family.bold` (`:279`) — same no-op weight bug as ScoreRing. (b) `heroBody` is a fixed `minHeight: 240` row with the legend crammed to the right; the legend's `barWrap` still has a hard `colors.navy` chip (`ColorScaleLegend.js:51`) that fights the floating aesthetic. (c) The Live/Idle pill (`:283`) uses `colors.base` fill + `colors.ink` border — fine, but the dot pulse scaling to `0.9 + pulse*0.28` can clip against the pill edge at peak.
**Refinements:** Fix the weight; let the gradient legend bar float without the navy chip (**R2 P2 #10**); clamp the pulse scale.

### `TakeawayCard` + the PREMIUM pill system
**Works:** Elevated material, tasteful gold pill (`#E5C572`) distinct from amber so it reads "tier" not "data" (`TakeawayCard.js:136`), clean citation rhythm.
**Doesn't:** The pill styling is **copy-pasted** into `PositionLog.js:11,159` with a comment admitting "intentional duplication." Two hard-coded `PREMIUM_GOLD` constants and two identical pill styleblocks will drift. That's a maintainability tell, not a visual one — but it's exactly how a solo codebase accumulates inconsistency.
**Refinements:** Extract a `PremiumPill.js` (JS, no new deps) and import it in both places. *(This is the extraction half of **R2 P2 #9**; do it even if you don't add a second surface yet.)*

### `PositionLog`
**Works:** Matches the elevated language, clean three-column log rows, sensible position→color map.
**Doesn't:** The status dot is `width:8, height:8, borderRadius:4` (`PositionLog.js:199–202`) — that's a **rounded square, not a circle**. Every other dot in the app (MetricTile `:105`, Analytics `:415`, History chip `:296`) uses `borderRadius` ≥ the size to make a circle. This one is subtly wrong and will read as "off" to anyone with a designer's eye.
**Refinement:** `borderRadius: 8` (or `999`). One-line fix, high embarrassment-avoidance value.

### Tab bar (`RootNavigator`)
**Works:** Frosted `BlurView` (intensity 80, dark), floating `position:absolute`, top hairline, tab-change haptic, web fallback (`RootNavigator.js:30–69`). This shipped in R2 and correctly killed the biggest "generic Expo" tell.
**Doesn't:** Labels force `fontFamily: family.bold` *and* `fontWeight: weights.bold` (`:84–85`) — same redundant-weight pattern. Active/inactive is a color swap only; Apple's tabs also subtly scale/weight the active icon.
**Refinement:** Drop the redundant `fontWeight`; consider a 1.05 active-icon scale.

---

## 5. Motion + haptics audit

You have `reanimated` 4 and `expo-haptics` and use them **thinly** — two animations, two haptic call-sites (ring settle, tab change).

**Where motion should carry information:**
- **Analytics chart draw-on:** stroke a `strokeDasharray` reveal over ~600ms `Easing.out(Easing.cubic)`, staggered ~80ms per section. Respect reduce-motion (you already have the `useReducedMotion` pattern in `ScoreRing.js:69`). *(R2 P2 #8.)*
- **Period-pill change:** cross-fade the section content 120–150ms instead of hard-swapping `DATA[period]`. Continuity tells the user "same metric, different window."
- **Tile press:** you have a static `scale: 0.99` (`MetricTile.js:90`); make it a spring (`withSpring`, damping ~18) so it feels tactile, not stepped.
- **Screen transitions:** the default tab cut is abrupt; a 200ms fade on tab focus would match Apple's spatial continuity.

**Where haptics should reinforce (all via the existing `haptics` wrapper, currently scoped to ring+tab only):**
- Tile press → `selection()` (press-in).
- Analytics period change → `selection()`.
- History row press → `selection()`.
- Account `+/−` → `selection()`; `PushRow` → `selection()`.
- **Calibrate Supine success → `success()`; failure → `warning()`.** This is the highest-value single haptic in the app.
Durations/types: keep selection ticks for navigation/adjust; reserve `success`/`warning` notifications for state changes (calibration). *(This whole list is **R2 P1 #6** — reinforced; the wrapper explicitly says not to wire these yet, so this round is the go-ahead.)*

---

## 6. Iconography + illustration

Ionicons is **not actively hurting you** — it's a clean, neutral set and appears in only two spots (tab bar, `WearTimeCaption`). But it's not *helping* build identity either, and you have two problems:

1. **You're mixing icon fonts with typographic glyphs.** The chevron `›` and adjuster `−`/`+` in Account are text characters, not icons (`AccountScreen.js:215,82,88`). That inconsistency — some affordances are Ionicons, some are Inter glyphs — is a subtle tell. Standardize on Ionicons for all affordances.
2. **The tab icons are generic.** `home / analytics / calendar / person` (`RootNavigator.js:18–21`) are the four most default icons in existence. `analytics` (a bar chart) for a trends tab and `calendar` for History are fine, but they say nothing about *oral biometrics*.

**A realistic bespoke icon story without a studio:** you already draw custom SVG (the mountain logo, the palate dome). Extend that to **2–4 metric glyphs** — a posture spine, a palate arch, a clench/jaw mark, a nasal airflow curve — as simple stroke SVGs reused on tiles, Analytics eyebrows, and History chips. A weekend of `react-native-svg` work, no dependency, converting four text labels into a learned-once visual vocabulary ([925Studios](https://www.925studios.co/blog/whoop-design-breakdown)). Keep Ionicons for the tab bar and system affordances.

---

## 7. Charts + data presentation

Right now the chart language is: single-color 2.5px polyline, one end dot, no baseline, no fill, no axis, no animation (`AnalyticsScreen.js:283–347`); plus a sparkline that's the same idea at 3px stroke (`MetricTile.js:45`); plus the History heatmap strip. It's *clean* but it's *flat and DIY*.

Apple Health's chart aesthetic is the target: **thin lines, a soft area gradient under the trend, generous whitespace, minimal-to-no axes, and a highlighted contextual peak/last point** (the classic Health line chart uses a 1.5px stroke, an `area-gradient` fill, and a single accent dot — [Apple Health line chart reference](https://gist.github.com/rwieruch/7b90f99823ee1feda28a)). WHOOP layers "color-coded zones" behind the line so the chart answers a question, not just plots points ([925Studios](https://www.925studios.co/blog/whoop-design-breakdown)).

**Concrete moves (no new deps — you have Skia + victory-native):**
- Add a **teal→transparent vertical area fill** under each line (`react-native-svg` `LinearGradient` + a closed `Path`). This one change does 70% of the "premium" lift.
- Add a **faint baseline** at the min and a **1px target guide** where relevant (posture target 80).
- Thin the stroke to **~1.75px** and keep the end dot but add a subtle halo.
- **Draw-on animation** (Section 5).
- For the **heatmap**, add a legend and, since the brief forbids new visualizations for their own sake, keep the strip but make the color *mean* something explicit (Section 3, History #1).

Do **not** invent new chart types — the brief is clear that copying visualizations isn't the goal. Improve the *rendering* of the charts you have.

---

## 8. The "cheap" tells (the section Wes will care about most)

Enumerated, most-damaging first. These are the specific details that scream "Expo app shipped last week":

1. **Two card materials in one app.** Elevated on Home, flat `colors.surface` everywhere else. Nothing says "unfinished" louder. (Analytics `:395`, History `:246`, Account `:254`, BleConnectCard `:176`.)
2. **Fake, frozen sparklines.** Hard-coded arrays that never move and don't match the number above them (`HomeScreen.js:145–173`). A live health app with dead micro-charts is an immediate tell.
3. **Hero numerals falling back to non-display Inter on 2 of 4 tabs.** Analytics `:417` and History rely on `fontWeight` with no display `fontFamily`. Your best asset (big numbers) is inconsistent.
4. **A dot that isn't round.** `PositionLog.js:199` — `borderRadius:4` on an 8×8 square. Tiny, but it's the kind of thing a designer spots in 2 seconds.
5. **`Text.defaultProps` global mutation** (`App.js:41–45`). This is deprecated in React 18+ and logs a warning; it's a fragile way to set a default font and will break in a future RN. Move the base family into a `Text` wrapper or `theme` and delete the mutation.
6. **Italic body text.** `styles.meaning` (`AnalyticsScreen.js:452`) — synthetic italic Inter reads as a fallback font, not a design choice.
7. **Text-glyph affordances mixed with icon-font affordances** (Account chevrons/adjusters vs Ionicons).
8. **Silent primary interactions.** Tapping a metric tile — the main gesture on Home — does nothing tactile. Silence where users expect a tick reads as unpolished.
9. **A dead press target.** History rows depress (`opacity 0.78`) then do nothing (`HistoryScreen.js:168`). Felt immediately.
10. **Redundant `fontWeight` next to named font families** across ScoreRing, PalateHeroCard, PositionLog, tab labels. Harmless functionally, but it's the fingerprint of copy-pasted styles rather than a designed type system.
11. **Magic numbers off the scale.** `fontSize: 10` (ScoreRing label), `fontSize: 38` (Analytics hero), ad-hoc `marginTop: 2`/`3`/`6` scattered around — the type/space scale isn't actually enforced.
12. **`WearTimeCaption` orphan line** floating between hero cards with no container.

Fixing 1–4 alone moves the app from "hobby" to "credible."

---

## 9. Prioritized punchlist

Ordered by punch-per-unit-effort. Effort: **S** ≤2h · **M** ≈ half day · **L** ≈ full day+.

| # | Change | Effort | Priority | Round-2 relation |
|---|--------|--------|----------|------------------|
| 1 | Fix `PositionLog` dot `borderRadius: 4`→`8`; slugify `MetricTile` sheen id | S | **P0** | new |
| 2 | Route Analytics + History hero numerals through the Inter Black display face (`typography.text.hero`) | S | **P0** | refines R2 #1 |
| 3 | Unify all card surfaces on the elevated material (Analytics/History/Account/BleConnectCard/modal) | M | **P0** | reinforces R2 P1 #4 (escalated) |
| 4 | Wire `haptics` wrapper into tile press, period pills, History rows, Account adjuster/PushRow, Calibrate (success/warning) | S | **P0** | reinforces R2 P1 #6 |
| 5 | Replace fake sparklines with real series (or remove until real); slugify ids | M | **P0** | reinforces R2 P1 #5 |
| 6 | Stateful metric color (teal/amber/violet by value) on tiles + optional ring tint | M | **P1** | reinforces R2 P1 #5 |
| 7 | Add area-gradient fill + baseline + draw-on to Analytics charts | L | **P1** | elaborates R2 P2 #8 |
| 8 | Remove redundant `fontWeight` beside named families; drop Analytics italic; enforce type scale | S | **P1** | new |
| 9 | Extract `PremiumPill.js`; de-duplicate `PREMIUM_GOLD` | S | **P1** | extraction half of R2 P2 #9 |
| 10 | History heatmap legend + meaningful color + composite-per-row (collapse 4 chips) | M | **P1** | new |
| 11 | Replace `Text.defaultProps` mutation with a `Text` wrapper / theme default | S | **P1** | new |
| 12 | Period-pill + data cross-fade (120–150ms); spring tile press | M | **P2** | new |
| 13 | Add spacing steps (`xl2:20`, `xxl:40`); give hero blocks air, tighten stat lists | S | **P2** | new |
| 14 | Standardize Account affordances on Ionicons (chevron/add/remove) | S | **P2** | new |
| 15 | Bespoke stroke-SVG glyphs for the four metrics (posture/palate/clench/nasal) | M | **P2** | new |

---

## 10. Open questions for Wes

1. **Stateful color thresholds.** To make color mean something (Principle 1/Home #1, item #6), I need cutoffs for optimal/attention/improve on Posture, Pressure, Clench, Nasal. This is a product/medical-tone call, not a visual one — **needs your taste input.** *(Also R2 open question #2.)*
2. **The "improve" color.** The locked palette has no red. Do you want the worst state to use violet `#8A6CFF` (on-brand but reads "high," not "bad"), or allow a single derived red for state-only use? **Needs your taste input.** *(R2 open question #3.)*
3. **History row destination.** Fixing the dead press (item #4/#10) is cheap as a haptic, but the *right* fix is a day-detail screen — which doesn't exist and would be a new feature (out of scope for a polish round). Haptic-only now, or is a detail screen on the table? **Your call.**
4. **Bespoke metric glyphs (item #15).** Worth a weekend, but the *style* of the glyphs (anatomical vs abstract, filled vs stroke) is a brand-identity decision I shouldn't make for you. **Needs your taste input.**
5. **How much motion is "you"?** MorphoGenix is a clinical/biometric product. Apple/Oura motion is playful-calm; some medical products stay deliberately still. Not sure where you want to sit — **needs your taste input** before I push the chart/transition animation work (items #7, #12).
6. **Ring gradient vs solid state color.** Recoloring the whole `ScoreRing` arc by state (Component §4) changes its character from "spectrum" to "signal." That's a meaningful identity shift for your most recognizable element — **needs your taste input** before I touch it.

---

*End of Round 3 critique.*
