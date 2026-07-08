# Round 3 — UI/UX Critique Brief

## Mission

Conduct a **critical, opinionated design critique** of the current MorphoGenix mobile app. Recommend improvements to make it feel closer to Oura Ring / Apple Watch / Apple Health / Apple Fitness apps **in style** — not by copying their features or exact visualizations, but by matching the design language, information density, tension, restraint, and craft that make those apps feel premium.

This is **round 3**. Rounds 1 and 2 already shipped substantial work — do NOT re-recommend anything already done or already planned.

## Founder

Wes Gilbert. Solo founder, MorphoGenix, Albuquerque NM. NEVER call him Willy. He is technically strong (biomedical hardware, embedded systems, React Native) but wants a designer's eye on style — so DO NOT hedge, DO NOT couch things politely. Be direct.

## What NOT to re-recommend (previous work)

Read `.context/round1_shipped.md` (round 1 shipped in commit `5ecb905`) and `.context/round2_roadmap.md` (round 2 shipped commits `217dc8a` through `80193bf`, merged as `b4695e5`).

**Round 1 already shipped:**
- Depth tokens (base, surfaceElevated, ink, inkSoft, shadow) in `src/theme/colors.js`
- ScoreRing component (static frame)
- MetricTile depth styling
- PalateHeroCard polish
- TakeawayCard depth + PREMIUM FEATURE pill

**Round 2 already shipped:**
- Inter font system via @expo-google-fonts/inter (Regular, Medium, SemiBold, Bold, Black)
- typography.familyDisplay token for big numerals
- Animated ScoreRing (arc fill + count-up + reduce-motion + settle haptic)
- Frosted BlurView tab bar with tab-change haptic
- src/utils/haptics.js wrapper
- Screen bottom padding for tab bar clearance

**Round 2 roadmap items already IDENTIFIED but not yet shipped (P1/P2 items in `.context/round2_roadmap.md`):**
Read the whole file. If your critique lands on something already in that roadmap, it's fine to reinforce or refine — but explicitly note "this reinforces round 2 P1 #X" or "this refines round 2 P2 #Y." Don't pretend it's a new insight.

## The critique you should deliver

**Style over feature.** Wes explicitly said: recommend improvements for **looking closer** to Oura/Apple/Health, not just copying their features and visualizations. So:

- Focus on the **feel**: information hierarchy, whitespace, rhythm, motion timing, tactile detail, restraint, typographic tension
- Focus on the **craft**: pixel-level details, alignment, optical corrections, iconography quality, chart aesthetics
- Focus on the **premium signals**: what makes Oura feel worth $6.99/mo and Apple Watch feel worth $400 — versus a hobbyist Expo app that shipped last week
- Do NOT propose new features (that's Wes's call)
- Do NOT propose new data visualizations for their own sake (Wes explicitly said "not necessarily just copying their visualizations")
- DO propose changes to how existing data is presented

## What to actually do

1. **Read every file** under `src/screens/`, `src/components/`, `src/theme/`, `src/navigation/`, `App.js`
2. **Read the roadmap docs** in `.context/round1_shipped.md` and `.context/round2_roadmap.md` completely
3. **Research current-generation design of:**
   - Oura app (2024-2026)
   - Apple Health app (iOS 18+)
   - Apple Fitness+ app
   - Apple Watch built-in Activity, Workout, Vitals apps
   - Bevel (dark-mode wellness reference)
   - Whoop app
   - Ultrahuman Ring app
   - AutoSleep and Pillow (sleep-tracking specifics)
   - Reference articles or design breakdowns where useful
4. **Write the critique** as `docs/UI_CRITIQUE_ROUND_3.md`

## Deliverable format

Structure the critique as follows:

### 1. Executive verdict (2-3 sentences)
Honest overall read on where the app sits on the spectrum from "clearly a hobby project" to "indistinguishable from Oura/Apple." One sentence per screen if that helps.

### 2. The gap — five design principles the app is missing
Not five items to fix. Five **principles** that Oura/Apple/Health apps share and MorphoGenix doesn't. Think patterns like "purposeful negative space," "typographic voice," "one hero moment per screen," "motion as information," "consistent depth grammar" — but come up with your own that are specific to what you see. For each principle:
- Name it (bold, memorable)
- 1-2 sentence definition
- Reference example from Oura/Apple with URL if possible
- How MorphoGenix currently violates or misses it
- 1-line hint at the fix (not full implementation)

### 3. Screen-by-screen critique (Home, Analytics, History, Account)
For each screen:
- One-line summary of current feel ("feels like X because Y")
- 3-5 specific issues, ranked most-to-least severe
- Each issue: what it is, why it hurts, concrete fix (be specific — component names, spacing values, timing constants)

### 4. Component-level critique
Pick the 4-6 most impactful components (your call — likely ScoreRing, PalateHeroCard, MetricTile, TakeawayCard, PositionLog, tab bar). For each:
- What works
- What doesn't
- 1-3 pointed refinements

### 5. Motion + haptics audit
The app has reanimated + expo-haptics but uses them thinly. What's missing? Where should motion carry information? Where should haptics reinforce? Be specific about durations, easings, and haptic types.

### 6. Iconography + illustration
Currently using Ionicons. Is that hurting the app? What would a bespoke icon story look like without going full custom-illustration studio?

### 7. Charts + data presentation
The app has victory-native + Skia but the current chart aesthetics are unclear. Critique the chart language against Apple Health's chart aesthetic (thin lines, generous whitespace, minimal axes, contextual peaks).

### 8. The "cheap" tells
Be direct: what specific details, right now, make this app read as an Expo app rather than a shipped consumer product? Enumerate them. This is the section Wes will value most.

### 9. Prioritized punchlist (10-15 items)
Table format:
| # | Change | Effort (S/M/L) | Priority (P0/P1/P2) | Round-2 relation |
|---|---|---|---|---|
Order by punch-per-unit-effort. P0 = do next. Round-2 relation = "new" or "reinforces R2 #X" or "refines R2 #Y."

### 10. Open questions for Wes
Anything that needs his taste input before implementation.

## Constraints

- **DO NOT write code.** No .js edits. No new branch.
- **Save only:** `docs/UI_CRITIQUE_ROUND_3.md` (single file, untracked, uncommitted).
- **JavaScript only** in any suggestions — no TypeScript.
- **Palette is locked**: navy #0B1220, teal #29E0C8, amber #F5B343, violet #8A6CFF, surface #141B2D + depth tokens.
- **Dark mode only.**
- **PREMIUM FEATURE pill:** top-right, gold, all-caps — do NOT propose moving it.
- **Wes is a solo founder.** Effort estimates should be realistic for one person shipping between hardware iterations.

## Style for the doc

- Blunt, opinionated, specific
- No "this could potentially benefit from consideration"
- Show your reasoning briefly, then land the recommendation
- Cite reference apps with URLs
- Use file paths in backticks, spacing values in `px`, timing in `ms`
- If you're not sure about something, say "not sure — needs Wes's taste input" instead of hedging

## Working directory

`/home/user/workspace/morphogenix-app`

## Length target

Long enough to be genuinely useful, short enough to read in 15 minutes. Aim for 2500-4000 words in the final doc.
