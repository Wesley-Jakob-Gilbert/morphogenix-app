# Oura Polish v2 — Execution Brief (P0 chain)

## Mission
Implement the P0 items from `docs/OURA_INSPIRED_ROADMAP_V2.md` plus the haptics utility (P1 but a dependency). Land all of it on the existing feature branch.

## Branch
`feature/oura-polish-v2` (already created, already pushed). DO NOT branch off again, DO NOT touch `master` or `develop` directly. Commit and push to `feature/oura-polish-v2`.

## Founder
Wes Gilbert. Solo founder, MorphoGenix, Albuquerque NM. NEVER call him Willy.

## Decisions locked (from Wes, June 13)
- **Font: Inter** — use the free Inter family (OFL license). Bundle `Inter-Regular`, `Inter-Medium`, `Inter-SemiBold`, `Inter-Bold`, and `Inter-Black` (or Inter Display equivalents) via `expo-font`. Load through `useFonts()` in `App.js`. Fonts are at https://fonts.google.com/specimen/Inter or via `@expo-google-fonts/inter` (preferred — npm install it).
- **"Improve" color: Violet `#8A6CFF`** — Wes wants palette purity preserved. Do NOT introduce a red. Use the locked violet for the worst readiness state. (This decision applies to future work; for THIS round, just the font + animations + tab bar + haptics util.)
- **Palette is locked:** navy `#0B1220`, teal `#29E0C8`, amber `#F5B343`, violet `#8A6CFF`, surface `#141B2D`. Plus existing depth tokens (`base`, `surfaceElevated`, `ink`, `inkSoft`, `shadow`).
- **JavaScript only — no TypeScript.**
- **Dark mode only.**

## Items to ship (this round only)

### #1 — Inter font system (P0)
- `npm install @expo-google-fonts/inter expo-font` (expo-font is already installed; verify version)
- In `App.js`, call `useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_900Black })`
- Gate the root render on `fontsLoaded` (return a minimal `<View style={{flex:1, backgroundColor: colors.base}} />` placeholder during load — NOT a SplashScreen change; that's a separate concern)
- In `src/theme/typography.js`:
  - Set `family.regular = 'Inter_400Regular'`, `family.medium = 'Inter_500Medium'`, `family.semibold = 'Inter_600SemiBold'`, `family.bold = 'Inter_700Bold'`
  - Add `familyDisplay = 'Inter_900Black'` for big numerals
  - Update the `value`, `hero`, `display` text styles to use `familyDisplay`
  - Body styles use `family.regular`/`family.medium` as appropriate
- Verify all existing `Text` components inherit cleanly. Where styles bypass the theme (look for raw `fontWeight: '900'`), patch to use the family token.
- DO NOT change the visual weight hierarchy — just swap from system font to Inter.

### #2 — Animated ScoreRing (P0)
- In `src/components/ScoreRing.js`, animate:
  - The arc `strokeDashoffset` from full-circumference → target offset over ~900ms with `Easing.out(Easing.cubic)`
  - The centered number counts up from 0 → final value over the same duration
- Use `react-native-reanimated` (v4) — `useSharedValue`, `useAnimatedProps`, `withTiming`. The pattern matches what's already in `PalateHeroCard`.
- Trigger animation on mount AND when `value` prop changes (cancel previous, restart).
- Respect OS reduce-motion: use `useReducedMotion()` from `react-native-reanimated` (or `AccessibilityInfo.isReduceMotionEnabled`). If true, snap to final state, skip animation.
- On animation settle, fire `haptics.selection()` (uses the wrapper from #6).
- Keep `ringFraction` and `formatValue` helpers pure and testable. Update tests in `src/components/__tests__/ScoreRing.test.js` to cover the new animation gating logic (mock reanimated values).

### #3 — Frosted tab bar + tab-change haptic (P0)
- In `src/navigation/RootNavigator.js`:
  - Set `tabBarStyle.position: 'absolute'`, `backgroundColor: 'transparent'`, with a top hairline `borderTopColor: colors.ink, borderTopWidth: StyleSheet.hairlineWidth`
  - Add `tabBarBackground: () => <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />` (import from `expo-blur` — install if missing)
  - On web, BlurView degrades — wrap with `Platform.select` so web falls back to `backgroundColor: 'rgba(20, 27, 45, 0.85)'` (semi-opaque surface)
  - Add `listeners={({ navigation }) => ({ tabPress: () => haptics.selection() })}` to each tab screen
- The 4 screens (`HomeScreen`, `AnalyticsScreen`, `HistoryScreen`, `AccountScreen`) need `contentContainerStyle: { paddingBottom: 90 }` (or matching tab bar height + safe area) so content scrolls UNDER the bar, not behind it.
- Keep teal active tint, muted inactive tint. Keep Ionicons for now (icon redesign is a separate concern).

### #6 — Haptics util (P1 — promoted to P0 because #2 and #3 depend on it)
- Create `src/utils/haptics.js`:
  ```js
  import * as Haptics from 'expo-haptics';
  import { Platform } from 'react-native';
  
  const noop = () => {};
  
  export const haptics = Platform.OS === 'web' ? {
    selection: noop, light: noop, medium: noop, heavy: noop, success: noop, warning: noop, error: noop,
  } : {
    selection: () => Haptics.selectionAsync(),
    light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  };
  ```
- Wire into ScoreRing (#2 settle) and tab bar (#3 tabPress). DO NOT roll out broadly yet — that's a separate P1 item.

## What NOT to do this round
- Do NOT unify card depth on Analytics/History/Account (P1 #4 — separate round)
- Do NOT add stateful metric color (P1 #5 — separate round; needs Wes's thresholds)
- Do NOT broadcast haptics to all interactions (P1 #6 broader rollout — separate round)
- Do NOT add skeletons, chart animations, premium tier extension, or hero legend polish (P2 — separate rounds)
- Do NOT touch app icon / splash (separate concern for TestFlight prep)

## Quality bar
- All existing Jest tests must pass: `npm test` from repo root
- New tests for ScoreRing animation gating
- No new TypeScript files
- No new dependencies beyond `@expo-google-fonts/inter` and `expo-blur` (verify expo-blur isn't already installed via `package.json`)
- Run a final `npm test` before final commit
- Commits should be atomic per item (4 commits ideal: font foundation, haptics util, ScoreRing animation, tab bar)
- Commit messages: detailed, multi-line, explain rationale and reference roadmap item numbers

## Git workflow
- Already on branch `feature/oura-polish-v2`
- Use `api_credentials=["github"]` for `git push`
- Author: `Wes Gilbert <wes@morphogenix.ai>`
- Push to `origin/feature/oura-polish-v2` after each commit (or at the end — your call, but at least once at the very end)
- Do NOT open a PR — Wes will do that after review

## Working directory
`/home/user/workspace/morphogenix-app`

## When done
Report:
1. Commit SHAs (4 commits ideal)
2. Test results (`npm test` output summary)
3. What files changed
4. Any deviations from this brief (with rationale)
5. Anything that surprised you or needs Wes's review before merge
