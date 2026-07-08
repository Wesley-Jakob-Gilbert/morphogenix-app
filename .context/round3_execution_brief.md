# Round 3 — Execution Brief

## Mission
Execute all P0 and P1 items from `docs/UI_CRITIQUE_ROUND_3.md`. Skip all P2 items (Wes has explicitly held them). Land all work on the existing branch `feature/oura-polish-v3`.

## Branch
`feature/oura-polish-v3` — already created, already pushed. DO NOT touch `master` or `develop`.

## Founder
Wes Gilbert. Solo founder, MorphoGenix, Albuquerque NM. NEVER call him Willy.

## Decisions locked (from Wes, July 8)
Wes accepted all 6 recommendations from my critique response:

1. **Stateful color thresholds** — implement these defaults; Wes will adjust with real user data later:
   - **Posture Score**: `>80` optimal (teal), `60-80` attention (amber), `<60` improve (state-red)
   - **Palatal Pressure** (unit: N, plausible-range wearable): `0.5-1.5` optimal (teal), `0.3-0.5 or 1.5-2.0` attention (amber), `<0.3 or >2.0` improve (state-red)
   - **Clench Events** (per hour): `<10` optimal (teal), `10-25` attention (amber), `>25` improve (state-red)
   - **Nasal Breathing Score**: `>70` optimal (teal), `50-70` attention (amber), `<50` improve (state-red)

2. **"Improve" color** — Allow ONE state-only derived red: `#FF6B6B`. Add it to `colors.js` as `stateRed` (or `warningRed`). It MUST NEVER appear decoratively — only when a metric is in the "improve" threshold. Update the locked palette comment in `colors.js` to explain this is a state-only extension.

3. **History dead-press** — Haptic-only for now. Add `haptics.selection()` on press; keep the visual press feedback; do NOT build a detail screen (deferred).

4. **Bespoke SVG glyphs** — Deferred. Do NOT touch iconography. Ionicons stay.

5. **Motion philosophy** — RESTRAINED. Add ONLY:
   - Chart draw-on animation (~600ms, `Easing.out(Easing.cubic)`, respect reduce-motion)
   - Everything else in the critique's §5 that is P0/P1
   - DO NOT add tab-focus fades, DO NOT add period-pill cross-fades (those are P2 or Wes-veto)

6. **Ring gradient vs solid state color** — SOLID STATE COLOR. Refactor `ScoreRing` so the arc renders in ONE color derived from the value + threshold (teal/amber/state-red). This is the biggest identity move in the round. The current teal→amber→violet gradient sweep goes away; the value maps to a single state color instead.

## Items to ship (P0 + P1 only)

Follow the exact punchlist in `docs/UI_CRITIQUE_ROUND_3.md` §9. Reproduced here for clarity:

### P0 (must ship)
1. **#1 — `PositionLog` dot fix + `MetricTile` sheen id slugify**
   - `PositionLog.js:199` — change `borderRadius: 4` → `borderRadius: 999`
   - `MetricTile.js:23` — slugify title in the SVG `id={\`sheen-${slug}\`}` (e.g., lowercase + strip non-alphanumerics)

2. **#2 — Route Analytics + History hero numerals through the Inter Black display face**
   - `AnalyticsScreen.js:417` (`heroNumber`) — add `fontFamily: typography.familyDisplay` (or route through `typography.text.hero`)
   - `HistoryScreen.js` — audit for any hero numerals and apply the same fix
   - Check ALL screens for numerals larger than ~24px that lack `familyDisplay`

3. **#3 — Unify all card surfaces on the elevated material**
   - `AnalyticsScreen.js:395` (`styles.section`) — elevated material + soft shadow, KEEP the 3px accent left border
   - `HistoryScreen.js:246` (`styles.row`) — elevated material
   - `AccountScreen.js:254` (`styles.sectionBody`) — elevated material
   - `src/components/BleConnectCard.js:176` (`styles.card`) — elevated material
   - Any modal card (About modal) — elevated material
   - Elevated material = `backgroundColor: colors.surfaceElevated`, border `colors.ink`, soft multi-layer shadow matching the existing pattern in `MetricTile.js`
   - PREFER refactoring the shadow/border into a shared `styles.elevatedCard` or a helper if it's clean — but do NOT over-engineer

4. **#4 — Wire `haptics` wrapper into all missing interactions**
   - `MetricTile.js` — `haptics.selection()` on press-in
   - `AnalyticsScreen.js` — period pill change → `haptics.selection()`
   - `HistoryScreen.js:168` — row press → `haptics.selection()` (this is the dead-press fix from Wes decision #3)
   - `AccountScreen.js` — `+/−` adjuster → `haptics.selection()`, `PushRow` → `haptics.selection()`
   - `AccountScreen.js:104` (`onCalibrateSupine`) — SUCCESS → `haptics.success()`, FAILURE (no IMU data) → `haptics.warning()` + inline error message "No sensor data — connect a device."

5. **#5 — Replace fake sparklines with real series (or remove until real)**
   - `HomeScreen.js:145,154,164,173` — the hard-coded `sparkline={[20,24,26,25,29,31]}` arrays are fake
   - Two options — pick the RIGHT one per tile based on whether we have real time-series data:
     - If the tile has a real underlying series (e.g., Palatal Pressure has streamed data from `BleStreamer`) → wire the sparkline to the last ~30 samples of the smoothed series
     - If the tile does NOT have real data (Posture, Clench, Nasal Breathing in demo mode) → REMOVE the sparkline until real data exists, do NOT show a fake one
   - Read `src/services/streamer/BleStreamer.js` and `src/screens/HomeScreen.js` state to figure out what's real
   - Verify via `npm test` that removing the prop doesn't break MetricTile (it should accept `sparkline` as optional)

### P1 (must also ship)
6. **#6 — Stateful metric color on tiles + ring**
   - Create `src/theme/metricState.js` exporting `getMetricState(metric, value)` → `'optimal' | 'attention' | 'improve'`
   - Create `getStateColor(state)` → returns `colors.teal | colors.amber | colors.stateRed`
   - Wire into `MetricTile.js` (accent color) and `ScoreRing.js` (arc color — this is decision #6, SOLID state color, not gradient)
   - The thresholds are in decisions locked above

7. **#7 — Add area-gradient fill + baseline + draw-on to Analytics charts**
   - `AnalyticsScreen.js:283–347` (`LineChart` / `BarChart`)
   - Add teal→transparent vertical area fill under each line using `react-native-svg` `LinearGradient` + closed `Path`
   - Add a faint baseline at min value
   - Add a 1px target-guide line where relevant (e.g., posture target 80)
   - Thin stroke to ~1.75px, keep end dot, add subtle halo (radial gradient dot)
   - Draw-on animation: `strokeDasharray` reveal, ~600ms, `Easing.out(Easing.cubic)`, respect `useReducedMotion`

8. **#8 — Remove redundant `fontWeight` beside named families; drop italic; enforce type scale**
   - Sweep the codebase for `fontFamily: family.X` styles that ALSO set `fontWeight` — remove the redundant numeric weight (it's a no-op for named font families)
   - `AnalyticsScreen.js:452` (`styles.meaning`) — drop `fontStyle: 'italic'`, use `colors.muted` at regular weight with slightly more line-height
   - Enforce type scale: replace magic `fontSize: 10`, `fontSize: 38`, `marginTop: 2/3/6` with the nearest scale token. Where a scale step doesn't exist, add it to `spacing.js` or `typography.js` first.

9. **#9 — Extract `PremiumPill.js`; de-duplicate `PREMIUM_GOLD`**
   - Create `src/components/PremiumPill.js` — a small self-contained component. Props: none (or optional `label` defaulting to `"PREMIUM FEATURE"`).
   - Export the gold constant (`#E5C572`) either as a prop-defaulted constant in the component OR add `colors.premiumGold` to `colors.js`. Prefer the second.
   - Replace the copy-pasted pill in `TakeawayCard.js:136` and `PositionLog.js:11,159` with imports of `PremiumPill`
   - Verify visual parity — the pill MUST render identically to before

10. **#10 — History heatmap legend + meaningful color + composite-per-row**
    - `HistoryScreen.js:131` (`Heatmap`) — add a small inline legend (low→high, single sentence + gradient bar) at the top or bottom of the strip
    - The color mapping in `compositeColor` (`:160`) should be documented — what does teal vs amber vs violet mean here?
    - Row collapse: replace the 4-chip-per-row pattern (`:177`) with a SINGLE composite score + a single color dot per row. Move the 4 individual metrics into a to-be-built detail view (which we're NOT building this round, per Wes decision #3) — for now, just collapse to the composite indicator so rows read cleanly.
    - Fix `daySub` inconsistency (`:39–:97`): make the label/sub pattern uniform. If a row is today, show "Today"; otherwise show `Mon Apr 28` in the primary label and skip the sub. No mixed "Weekend" strings.

11. **#11 — Replace `Text.defaultProps` mutation with a proper solution**
    - `App.js:41–45` mutates `Text.defaultProps.style` — this is deprecated in React 18+ and logs warnings
    - Fix: create `src/components/AppText.js` — a thin `Text` wrapper that applies the default `fontFamily: family.regular` and `color: colors.ink` via style prop
    - Replace `Text` imports with `AppText` throughout the codebase where the default font matters
    - Keep native `Text` where explicit styling is already applied
    - OR: use a context provider approach if simpler
    - Pick whichever approach is cleanest and lowest-risk

## Items EXPLICITLY OUT OF SCOPE (do not touch)
- P2 items #12, #13, #14, #15 (Wes: "P2: hold")
- Day-detail screen for History (Wes decision #3 — deferred)
- Bespoke SVG metric glyphs (Wes decision #4 — deferred)
- App icon or splash screen changes
- BLE stack migration (that's a separate track for TestFlight prep)
- Anything not explicitly listed in items 1–11 above

## Constraints
- **JavaScript only** — NO TypeScript files
- **Dark mode only**
- **Locked palette**: navy `#0B1220`, teal `#29E0C8`, amber `#F5B343`, violet `#8A6CFF`, surface `#141B2D` + depth tokens
- **NEW addition allowed**: `stateRed` (or `warningRed`) `#FF6B6B` in `colors.js`, marked in the file's comment as a state-only color that must NOT appear decoratively
- **NEW addition allowed**: `premiumGold` `#E5C572` in `colors.js`
- **NO new dependencies** — you have `react-native-svg`, `react-native-reanimated`, `expo-haptics`, `expo-blur`, `victory-native`, `@shopify/react-native-skia`
- Author commits as `Wes Gilbert <wes@morphogenix.ai>` via `git -c user.email="wes@morphogenix.ai" -c user.name="Wes Gilbert" commit ...`
- Push with `api_credentials=["github"]`

## Quality bar
- **All existing tests must pass**: `npm test` before AND after each commit
- **Add tests** for:
  - `getMetricState()` — one test per threshold boundary per metric
  - `getStateColor()` — mapping tests
  - `ScoreRing` state color — verify solid color renders per state (mock reanimated values)
  - `PremiumPill` — renders correctly with default and custom label
- **No new peer-dep warnings** beyond the existing expo-router conflict
- **Commit atomically** — one commit per item ideally (11 commits), or logical groupings (e.g., "P0 items 1+2+4 as one commit" is fine if they're related). Aim for 6–11 commits total.
- **Commit messages must be detailed**: multi-line, explain what/why, reference item numbers from the punchlist and the critique doc

## Git workflow
- Already on branch `feature/oura-polish-v3`
- After each commit or logical group, push to `origin/feature/oura-polish-v3`
- Do NOT open a PR — Wes will merge after review
- Do NOT touch `master` or `develop`

## When done
Report:
1. Commit SHAs and one-line summaries
2. Final `npm test` output summary (X passed / Y suites)
3. Files changed (grouped by punchlist item)
4. Any deviations from this brief with rationale
5. Anything that surprised you or needs Wes's review before merge
6. Screenshot recommendations — 3–4 areas of the app Wes should specifically visually verify

## Working directory
`/home/user/workspace/morphogenix-app`

## Reference docs (read these fully before starting)
1. `docs/UI_CRITIQUE_ROUND_3.md` — the source of truth for this round
2. `.context/round1_shipped.md` — what's already shipped in round 1
3. `.context/round2_roadmap.md` — round 2 (some items reinforced here)
4. Prior brief `.context/oura_polish_v2_brief.md` — the last execution brief, for style/tone precedent
