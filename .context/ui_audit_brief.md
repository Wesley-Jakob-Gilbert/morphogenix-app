# UI Audit Brief — Oura/Apple Watch Polish, Round 2

## Mission
Audit the current MorphoGenix React Native app UI and propose a concrete improvement roadmap to make it feel more like Oura Ring or Apple Watch / Apple Fitness apps.

This is **round 2**. Round 1 already shipped (commit `5ecb905`): depth tokens, ScoreRing, elevated surfaces. Read `.context/prior_roadmap.md` first to see what was already done so you don't repeat it.

## Context

- **App:** MorphoGenix — intraoral biometric wearable (smart oral device measuring palatal pressure + head position via IMU).
- **Founder:** Wes Gilbert (NOT Willy — never call him Willy). Solo founder, Albuquerque NM.
- **Business model:** Oura/Whoop-style premium subscription. Some features marked PREMIUM FEATURE.
- **Stack:** Expo SDK 54, React Native 0.81, react-navigation, react-native-reanimated, Skia, victory-native, JavaScript only (no TypeScript).
- **Branch:** `develop` (private repo). Do NOT touch master.

## Locked design tokens (do not change)

- Palette: navy `#0B1220`, teal `#29E0C8`, amber `#F5B343`, violet `#8A6CFF`, surface `#141B2D`
- Dark mode only
- Morphoday: noon-to-noon (not midnight-to-midnight)
- Demo mode default on
- JavaScript only — no TypeScript additions

## What I'm looking for

A written roadmap document, NOT code changes yet. Save it to `docs/OURA_INSPIRED_ROADMAP_V2.md`.

Audit the current state of:
- `src/screens/HomeScreen.js`, `AnalyticsScreen.js`, `HistoryScreen.js`, `AccountScreen.js`
- All `src/components/*.js`
- `src/theme/colors.js`, `spacing.js`, `typography.js`

Then propose 5-10 specific, high-impact UI/UX improvements that would close the gap to Oura/Apple Watch fidelity. For each:
- What to change
- Why (cite specific Oura or Apple design patterns)
- Files to touch
- Rough effort (S/M/L)
- Priority (P0/P1/P2)

## Specific things I want you to evaluate

1. **Tab bar style** — Does it feel like Apple's TabView (frosted, translucent, SF-style icons)? Or generic?
2. **Typography hierarchy** — Oura uses serif accents for big numbers (Tiempos / GT Sectra-ish). Apple Watch uses SF Pro Rounded for ring numbers. What font story should we adopt?
3. **Card depth + shadow language** — Oura uses very subtle gradients on cards. Are we using flat fills?
4. **Loading + empty states** — Apple uses shimmer/skeleton. What do we do?
5. **Number animations** — Apple Watch numbers count up. Do our score numbers animate?
6. **Haptics** — Do we use expo-haptics on interactions? Apple Watch is HEAVY on haptic feedback.
7. **Color use** — Oura uses readiness color (green/yellow/red) prominently. Are we using our amber/teal/violet meaningfully or decoratively?
8. **Screen transitions** — Stack navigator default vs. shared-element transitions?
9. **Hero card** — Currently a trapezoid palate visualization. Does it feel premium or DIY?
10. **PREMIUM FEATURE pill placement** — Currently top-right gold all-caps. Is the placement consistent and tasteful?

## Reference apps to study (you can search the web for screenshots/reviews)

- Oura Ring app (gen 4 / 2024 redesign)
- Apple Fitness / Activity app (rings, summary view)
- Whoop 4.0 app (recovery score, strain)
- Bevel (NOT a real comparison, just for the dark-mode wellness aesthetic)
- AutoSleep / Pillow (sleep tracking analogues)

## Deliverable

A single Markdown file at `docs/OURA_INSPIRED_ROADMAP_V2.md`:

1. **Audit summary** — 1 paragraph per screen on current state vs. Oura/Apple standard
2. **Round 1 retrospective** — quick honest take: what worked from `5ecb905`, what didn't land
3. **Proposed improvements table** — the 5-10 items with all the metadata above
4. **Recommended execution order** — which items chain (e.g., font system before number animation)
5. **Open questions for Wes** — anything that needs his input before implementing

DO NOT write code yet. DO NOT make a new branch. Just produce the roadmap.

## Style for the doc

- Concrete, specific, opinionated
- Cite reference apps with URLs where possible
- No fluff, no "this would be nice"
- Files paths in backticks
- Effort in S (≤2 hrs) / M (half day) / L (full day+)

## Working directory
`/home/user/workspace/morphogenix-app`
