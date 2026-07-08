# Oura / Apple Watch UI Polish — Roadmap V2

**Owner:** Wes Gilbert (solo founder, MorphoGenix · Albuquerque NM)
**Branch:** `develop` (private). Do NOT touch `master`.
**Scope of this doc:** Written roadmap only — no code, no new branch, no commits.
**Stack:** Expo SDK 54, React Native 0.81, react-navigation 7, react-native-reanimated 4, react-native-svg 15, victory-native 41, @shopify/react-native-skia 2, expo-haptics 15, expo-font 14, zustand. **JavaScript only — no TypeScript.**
**Locked tokens (unchanged):** navy `#0B1220`, teal `#29E0C8`, amber `#F5B343`, violet `#8A6CFF`, surface `#141B2D`. Dark mode only. Morphoday noon-to-noon. Demo mode default on. PREMIUM FEATURE pill = top-right gold all-caps.

This is **Round 2**. Round 1 shipped in commit `5ecb905` (depth tokens, `ScoreRing`, elevated surfaces on the three Home cards). This document does **not** repeat that work — it audits what landed, then proposes the next set of high-impact moves to close the gap to Oura Ring (2024/2025 redesign) and Apple Fitness / Apple Watch fidelity.

---

## 1. Audit Summary — Current State vs. Oura / Apple Standard

### `HomeScreen.js`
The strongest screen. It has a real information hierarchy: brand row → "Good morning, Wes" greeting → a `ScoreRing` for posture → hero palate card → wear-time caption → Takeaway → a 2×2 metric grid. This is genuinely close to Oura's "Today / Top Stories" model ([Oura — New App Design](https://ouraring.com/blog/new-oura-app-experience/)), where the single most-important score is pinned to the top. **Gaps:** the headline `ScoreRing` arc and the metric numbers render statically — Apple Watch rings and numbers animate/count on appear ([Apple — Close Your Rings](https://www.apple.com/watch/close-your-rings/)), and we don't. The four metric tiles use hard-coded dummy `sparkline` arrays and a fixed accent color per tile (Nasal reuses teal), so color is **decorative, not stateful** — the opposite of Oura/Whoop, where color *is* the readiness signal ([Whoop 101 — Recovery green/yellow/red](https://developer.whoop.com/docs/whoop-101/)). Pull-to-refresh fires one `Haptics.selectionAsync()`, but tapping a tile (the primary interaction) is silent.

### `AnalyticsScreen.js`
Functionally rich — three period pills (Today / 7d / 30d), four metric sections each with a hero number, a hand-rolled SVG line/bar chart, a stat list, and an italic "meaning" line. The deep-link anchor scroll from Home tiles is a nice touch. **Gaps:** every section card uses the **flat `colors.surface` fill with a 1px accent left-border** — it never got the Round 1 depth treatment (`surfaceElevated` + soft shadow + sheen), so it visually regresses from the Home cards. Charts are static one-color polylines with no gradient fill, no baseline, no axis hints, and no entrance animation; Oura and Apple Fitness both use soft area-gradient fills under trend lines and animate them in. `victory-native` and Skia are installed but unused here. The period pills don't fire haptics.

### `HistoryScreen.js`
A 14-day composite heatmap strip plus a "Recent" list of morphoday rows with metric chips. The heatmap → list pattern is sound and Oura-like. **Gaps:** rows use flat `colors.surface` + `rgba(255,255,255,0.05)` hairline borders (again, no depth tier). The heatmap is a single horizontal strip of 14 cells — Oura/Apple Fitness use a calendar-grid or a clearly labeled trend that reads as "weeks." `compositeColor()` hard-codes teal/amber/violet by threshold, but there's no legend explaining what the colors *mean*, so it reads decorative. Rows are `Pressable` but the press goes nowhere (no detail screen) and there's no haptic.

### `AccountScreen.js`
Clean iOS-Settings-style grouped sections (Profile, Device, Head Position, Preferences, About, Legal) with an About modal. This is the most "stock-correct" screen and needs the least work. **Gaps:** sections use flat `colors.surface` with hairline borders (consistent with History/Analytics, inconsistent with Home). The posture-target `+`/`−` adjuster and all `PushRow` taps are silent — Apple's Settings-style rows give a light selection tick. The "Calibrate Supine" button is the one place a success haptic would land hard and currently doesn't fire one.

### `RootNavigator.js` (tab bar)
A standard `createBottomTabNavigator` with a **solid opaque `colors.surface` background** and default Ionicons (filled when focused, outline when not). It is functional but generic — it does **not** read like Apple's translucent/frosted `TabView`, which floats a blurred material over scrolling content ([Apple — Liquid Glass / materials](https://www.youtube.com/watch?v=jGztGfRujSE)). No blur, no top hairline that reads as a material edge, no haptic on tab change. This is the single biggest "this is an Expo app" tell.

### Theme (`colors.js`, `spacing.js`, `typography.js`)
Tokens are in good shape after Round 1: depth tokens (`base`, `surfaceElevated`, `ink`, `inkSoft`, `shadow`) exist and are correct per NN/g layered-dark-mode guidance. **The critical gap is typography:** `family: undefined` means the entire app renders in the platform default (San Francisco on iOS, Roboto on Android, system on web). `expo-font` is installed but **no font is ever loaded**, and `weights.display = '900'` is applied to a generic system face. Oura uses a distinct display face for big numbers and Apple uses **SF Pro Rounded** for ring numerals ([Apple — Activity rings HIG](https://developer.apple.com/design/human-interface-guidelines/activity-rings)). We have no font story at all — every number, from the `ScoreRing` to the tiles to the Analytics heroes, is generic.

---

## 2. Round 1 Retrospective (commit `5ecb905`)

**What worked:**
- **`ScoreRing` is a genuine win.** The teal→amber→violet gradient arc with a centered display number is the most Oura-correct element in the app and the right anchor for the Home screen. The pure `ringFraction` / `formatValue` helpers are clean and testable.
- **Depth tokens were the right abstraction.** `surfaceElevated` + `ink` + soft shadow + radial sheen on `MetricTile`, `PalateHeroCard`, and `TakeawayCard` reads materially "lifted" and is consistent with NN/g dark-mode depth guidance. These three cards look premium.
- **The PREMIUM FEATURE pill** (gold, tracked all-caps, top-right of TakeawayCard) is tasteful and correctly signals "tier" rather than "data" by using a separate gold (`#E5C572`) distinct from the amber metric accent.

**What didn't land / what's now inconsistent:**
- **Depth was applied to only 3 of ~8 card surfaces.** Analytics sections, History rows, and Account sections were left on the old flat `colors.surface` + hairline-rgba look. The app now has **two visual languages** for cards, and the un-upgraded screens look like the "before." This is the most jarring debt Round 1 created.
- **The `ScoreRing` arc and all numbers are static.** Round 1 added the *shape* of an Oura ring but not the *motion* — Apple's entire ring identity is the count-up + arc-fill animation. We shipped the still frame.
- **`weights.display = '900'` over a system font is a half-measure.** Heavier weight on San Francisco helps a little, but without a real display face the "Oura/Apple numeral" feel isn't there. The token was added in anticipation of a font that never got loaded.
- **The PREMIUM pill only appears once** (TakeawayCard). The placement/style is correct, but there's no second premium surface to establish it as a recurring system element, so it reads as a one-off rather than a tier language.

---

## 3. Proposed Improvements

Effort: **S** ≤2 hrs · **M** ≈ half day · **L** ≈ full day+. Priority: **P0** (do first, unblocks others / biggest gap) · **P1** · **P2**.

| # | Improvement | What to change | Why (reference pattern) | Files | Effort | Priority |
|---|-------------|----------------|--------------------------|-------|--------|----------|
| 1 | **Load a real display font for numerals** | Bundle one rounded/geometric numeric face (e.g. a free SF-Rounded analog or a licensed display face Wes approves) via `expo-font` `useFonts` in `App.js`; gate render on `fontsLoaded`; set `typography.family` (+ a `familyDisplay`) and wire it into `value`/`hero`/`display` text styles. Keep the system fallback so nothing breaks if the font fails. | Oura's big numbers and Apple Watch's ring numerals are the brand. Right now `family: undefined` means everything is generic system text ([Apple — Activity rings](https://developer.apple.com/design/human-interface-guidelines/activity-rings)). This is the highest-leverage single change. | `App.js`, `src/theme/typography.js`, `src/components/ScoreRing.js`, `src/components/MetricTile.js`, `assets/fonts/*` | M | **P0** |
| 2 | **Animate the ScoreRing (arc fill + count-up)** | Drive `strokeDashoffset` with a reanimated shared value (animate from full offset → target over ~900ms, `Easing.out`), and count the centered number up from 0 → value. Respect reduce-motion; fall back to static on web if needed. Add a light `Haptics.selectionAsync()` when the ring settles. | Apple Watch rings *fill* and numbers *count up* on appear — it's the signature microinteraction ([Apple — Close Your Rings](https://www.apple.com/watch/close-your-rings/)). Round 1 shipped the static frame; this completes it. Reanimated 4 is already installed and used in `PalateHeroCard`. | `src/components/ScoreRing.js` | M | **P0** |
| 3 | **Frosted / translucent tab bar + tab-change haptic** | Set `tabBarStyle.position: 'absolute'` with a `BlurView`-style translucent background (Expo `blur` material) and a top hairline (`colors.ink`); pad Home/Analytics/History/Account scroll content so it scrolls *under* the bar. Fire `Haptics.selectionAsync()` on `tabPress`. Keep teal active / muted inactive tints. | Apple's `TabView` floats a blurred material over content; our solid `colors.surface` bar is the biggest "generic Expo app" tell ([Apple — materials/Liquid Glass](https://www.youtube.com/watch?v=jGztGfRujSE)). Web can degrade to a semi-opaque fill. | `src/navigation/RootNavigator.js`, minor `contentContainerStyle` padding in the 4 screens | M | **P0** |
| 4 | **Unify card depth across Analytics, History, Account** | Replace flat `colors.surface` + `rgba(...)` hairline borders with the Round 1 depth language (`surfaceElevated`, `colors.ink` border, soft shadow, optional faint accent sheen) on Analytics sections, History rows, and Account sections. Keep the Analytics accent left-border. | Round 1 only upgraded 3 of ~8 card surfaces, leaving two visual languages. Unifying on one elevated material removes the "before/after" split and matches Oura's consistent layered surfaces (NN/g layered dark-mode depth). | `src/screens/AnalyticsScreen.js`, `src/screens/HistoryScreen.js`, `src/screens/AccountScreen.js` | M | **P1** |
| 5 | **Make metric color stateful (readiness semantics)** | Add a small pure helper (e.g. `src/utils/metricState.js`) mapping each metric's value to optimal / attention / improve, and drive the tile accent dot + sparkline color + (optionally) the ScoreRing tint from state instead of a fixed per-tile color. Keep the locked palette: teal = optimal, amber = attention, violet/red-ish = improve. | Oura and Whoop use color *as the signal* — green/yellow/red tells you at a glance what needs attention ([Whoop 101](https://developer.whoop.com/docs/whoop-101/), [Oura — New App Design](https://ouraring.com/blog/new-app-design/)). Today Nasal and Posture both render teal regardless of value, so color is decorative. | `src/utils/metricState.js` (new), `src/components/MetricTile.js`, `src/screens/HomeScreen.js` | M | **P1** |
| 6 | **Haptics across primary interactions** | Add `expo-haptics` to: metric-tile press (`selectionAsync` on press-in), Analytics period-pill change, History row press, Account `+/−` adjuster and `PushRow`, and a `notificationAsync(Success)` on "Calibrate Supine." Centralize in a tiny `src/utils/haptics.js` wrapper that no-ops on web. | Apple Watch/iOS lean heavily on haptics for "causality, harmony, utility" ([Apple — Feedback HIG](https://developer.apple.com/design/human-interface-guidelines/feedback)). We only fire on pull-to-refresh and the demo pill today. | `src/utils/haptics.js` (new), `MetricTile.js`, `AnalyticsScreen.js`, `HistoryScreen.js`, `AccountScreen.js` | S | **P1** |
| 7 | **Skeleton / shimmer loading states** | Add a reusable `<Skeleton>` (pulsing/shimmering rounded blocks on `surfaceElevated`) and show skeleton placeholders for the ScoreRing, hero card, and metric grid during the brief pre-first-packet / refresh window instead of snapping in values. Left-to-right shimmer, slow and steady. | Apple/Facebook-style skeletons reduce *perceived* wait and signal structure; we currently render placeholder constants with no loading affordance ([NN/g — Skeleton Screens 101](https://www.nngroup.com/articles/skeleton-screens/), [UX Collective — skeleton screens](https://uxdesign.cc/what-you-should-know-about-skeleton-screens-a820c45a571a)). | `src/components/Skeleton.js` (new), `src/screens/HomeScreen.js` | M | **P2** |
| 8 | **Animated, gradient-filled Analytics charts** | Replace the hand-rolled static `LineChart`/`BarChart` with charts that have a soft area-gradient fill under the line (teal→transparent), an animated draw-on, a baseline, and a highlighted last point. Use the already-installed `victory-native`/Skia rather than adding libs. | Oura and Apple Fitness trend views use gradient area fills + entrance animation; our flat single-stroke polylines look DIY ([Oura — New App Design](https://ouraring.com/blog/new-app-design/)). No new dependency required. | `src/screens/AnalyticsScreen.js` (extract a `TrendChart.js` component) | L | **P2** |
| 9 | **Extend the PREMIUM tier language to a second surface** | Reuse the existing gold pill on one more premium surface — e.g. a locked/teaser state on an Analytics "Discoveries"-style insight, or a premium badge on the History detail. Keep text/position/color identical to TakeawayCard so it reads as a *system*. | Oura's redesign leans on Advisor/Discoveries as premium insight surfaces ([Oura — New App Design](https://ouraring.com/blog/new-app-design/)). One pill reads as a one-off; a second establishes the subscription tier visually. Do **not** change the existing pill. | `src/components/TakeawayCard.js` (extract `PremiumPill.js`), `src/screens/AnalyticsScreen.js` | S | **P2** |
| 10 | **Polish hero-card legend + live pill** | Quiet the `ColorScaleLegend` container (drop the hard navy chip, let the gradient bar float), and give the "Live/Idle" pill a softer, more Oura-like resting state. Keep the locked trapezoid/sensor SVG and the FSR layout untouched. | The hero is the most "DIY"-feeling element per the brief; tightening the legend and live indicator lifts perceived quality without touching the locked visualization ([Oura — New App Design](https://ouraring.com/blog/new-app-design/)). | `src/components/ColorScaleLegend.js`, `src/components/PalateHeroCard.js` | S | **P2** |

---

## 4. Recommended Execution Order

There are real dependencies — do the foundation before the motion, and the motion before the decoration.

1. **#1 Display font (P0)** — must come first. Every number on every screen inherits this; animating numerals (#2) before the font is set means redoing the type styles. Land this, verify `fontsLoaded` gating doesn't flash, then build on it.
2. **#2 Animated ScoreRing (P0)** — depends on #1 (animate the *final* typeface, not the system fallback). Highest-visibility single interaction.
3. **#3 Frosted tab bar + tab haptic (P0)** — independent of #1/#2; can run in parallel. Biggest "generic app" fix. Bundles the first haptic.
4. **#6 Haptics wrapper (P1)** — build the `haptics.js` util here; #2 and #3 can consume it once it exists, so if scheduling allows, land the *wrapper* early even though the broader rollout is P1.
5. **#4 Unify card depth (P1)** — pure styling, no logic; safe to do once the font lands (so depth + type ship together on Analytics/History/Account). Removes the two-language inconsistency.
6. **#5 Stateful color (P1)** — depends on #4 only loosely; needs the `metricState` helper, then feeds tile accents and (optionally) the ScoreRing tint from #2.
7. **#7 Skeletons (P2)** — needs the depth tokens (#4) and font (#1) so the placeholders match the real surfaces.
8. **#8 Animated gradient charts (P2)** — largest single item; do after the cheaper P0/P1 wins. Self-contained in a new `TrendChart.js`.
9. **#9 Premium tier extension (P2)** and **#10 Hero legend polish (P2)** — final decorative passes; independent, can close out in any order.

**Chains to remember:** font (#1) → numeral animation (#2) and → skeletons (#7); haptics util (#6) → tab haptic (#3) and ring-settle haptic (#2); depth unify (#4) → skeletons (#7) + stateful color (#5).

---

## 5. Open Questions for Wes

1. **Font licensing.** A real display face is the #1 lever. Do you have a licensed face you want (and rights to bundle), or should we use a free SF-Pro-Rounded analog (e.g. a libre rounded geometric)? This blocks #1/#2/#7. *Note: prior round-1 community feedback flagged Oura's condensed serif as hurting readability — recommend a rounded sans for numerals, not a serif.*
2. **Readiness color semantics (#5).** Are you comfortable assigning state thresholds (optimal/attention/improve) to Posture, Pressure, Clench, and Nasal? If so, what are the cutoffs? This changes when a tile turns amber/violet, which is a product/medical-tone decision, not just visual.
3. **"Improve" color.** The locked palette has no red. For the worst readiness state, do we use violet `#8A6CFF` (on-brand but reads "high" not "bad"), or do you want to allow a single derived red for state-only use (never decorative)? This is the one place the locked palette is under-specified for Oura/Whoop-style semantics.
4. **Tab-bar blur on web.** `BlurView` materials degrade on `react-native-web`. OK to fall back to a semi-opaque `surface` fill on web while native gets the true frosted material (#3)?
5. **Second premium surface (#9).** Where do you want the next PREMIUM pill — a locked "Discoveries"-style insight on Analytics, or a premium badge on a History detail view? (A History detail screen doesn't exist yet; rows currently press to nowhere.)
6. **History rows press target.** History `DayRow`s are `Pressable` but go nowhere. Out of scope for a polish round, but flagging: the dead press is felt. Add a haptic-only press state now, or leave inert until a detail screen exists?
7. **Reduce-motion.** Should the count-up/arc-fill (#2) and chart draw-on (#8) respect the OS reduce-motion setting and snap to final state? (Recommended yes, per Apple HIG.)

---

### Appendix — References

- Oura — Introducing the New Oura App Design (2024 redesign, Today/Vitals/My Health, "Top Stories" model): https://ouraring.com/blog/new-oura-app-experience/
- Oura — A New Look for the Oura App (2025 refresh, color-as-state signal, Advisor/Discoveries): https://ouraring.com/blog/new-app-design/
- Apple — Activity rings (Human Interface Guidelines): https://developer.apple.com/design/human-interface-guidelines/activity-rings
- Apple — Close Your Rings (ring fill + count-up identity): https://www.apple.com/watch/close-your-rings/
- Apple — Feedback / Playing haptics (HIG): https://developer.apple.com/design/human-interface-guidelines/feedback
- Apple — Introducing Liquid Glass / materials (translucent tab/material language): https://www.youtube.com/watch?v=jGztGfRujSE
- Whoop 101 — Strain/Recovery green-yellow-red color semantics: https://developer.whoop.com/docs/whoop-101/
- NN/g — Skeleton Screens 101: https://www.nngroup.com/articles/skeleton-screens/
- UX Collective — Everything you need to know about skeleton screens (shimmer vs pulse): https://uxdesign.cc/what-you-should-know-about-skeleton-screens-a820c45a571a
- NN/g — Dark Mode: Issues to Avoid (layered depth, cited in Round 1): https://www.nngroup.com/articles/dark-mode-users-issues/
