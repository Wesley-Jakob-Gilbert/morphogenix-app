# Oura-Inspired UI Polish — Roadmap

**Owner:** Wes Gilbert (solo founder, MorphoGenix)
**Branch:** `develop`
**Scope:** Superficial, surface-level visual polish only. No new screens, no new data sources, no new libraries, no changes to BLE/firmware/live-data flow. JavaScript only. Locked color palette preserved.

This document is the output of Phase 1 (research) and Phase 2 (roadmap) of the Oura-inspired polish initiative. It captures what we can borrow from the Oura Ring app's visual language without diluting the MorphoGenix brand, then breaks the work into discrete, parallelizable tasks.

---

## Phase 1 — Research: Oura Ring App Design Vocabulary

Sources consulted:
- [Oura — Introducing the New Oura App Design](https://ouraring.com/blog/new-oura-app-experience/) — the 2024 redesign condensed five tabs into three (Today / Vitals / My Health), with the Today tab styled like a news app's "Top Stories" page: most-relevant insight first, generous spacing, scores pinned to the top.
- [Oura — Your Readiness Score & How To Measure It](https://ouraring.com/blog/readiness-score/) — the iconic numeric score (0–100) with a circular progress ring and color-coded contributor bars (green/optimal, amber/pay-attention, red/improve).
- [Reddit r/ouraring — reactions to the new visuals](https://www.reddit.com/r/ouraring/comments/1ovdod4/i_love_the_new_visuals/) — community feedback praising the refreshed visuals while criticizing an overly condensed serif heading font for hurting quick readability (a cautionary note for our typography work).
- [Nielsen Norman Group — Dark Mode: Issues to Avoid](https://www.nngroup.com/articles/dark-mode-users-issues/) — depth in dark mode is created by using the darkest color for the bottom layer and progressively lighter surfaces for elements "closer" to the user; thin dividers get swallowed, so use subtle color differentiation and soft layered shadows rather than hairline borders.
- [Proto.io — The Secret to Killer UX: Microinteractions](https://blog.proto.io/secret-killer-ux-design-microinteractions/) — microinteractions should be subtle, purposeful, and stylistically consistent with the overall interface; never over-designed.

### What Oura does well (5–8 points)

1. **Iconic numeric score in a ring.** A single large 0–100 number sits inside a thin circular progress arc. It is instantly legible, emotionally reassuring, and the visual anchor of the whole app.
2. **Calm, generous whitespace.** Information density is deliberately low. Cards breathe; one idea per card; the "most important thing" gets the top of the screen ("Top Stories" model).
3. **Layered dark-mode depth.** Surfaces feel stacked via soft, diffuse shadows and slightly-lighter card fills over a near-black base — not hairline borders. Depth communicates hierarchy without clutter.
4. **Restrained accent color.** Color is used sparingly and meaningfully — accents signal state (optimal / attention / improve), not decoration. The base palette is quiet so the data color pops.
5. **Clear typographic hierarchy.** Big display numbers, small all-caps micro-labels above them, and quiet secondary captions. The eye always knows what to read first.
6. **Contributor / progress bars.** Sub-metrics are shown as short labeled progress bars with state color, giving a quick scan of "what's good / what needs attention."
7. **Soft, rounded geometry.** Large corner radii, pill-shaped status chips, and rounded progress caps give a friendly, premium, calm feel.
8. **Subtle micro-interactions.** Pull-to-refresh, gentle press states, and quietly animated live indicators — feedback that is felt more than seen.

### What we can interpolate without breaking our brand

These map directly onto our existing components and tokens. All use the **locked palette** (`navy #0B1220`, `teal #29E0C8`, `amber #F5B343`, `violet #8A6CFF`, `surface #141B2D`) plus new **neutral depth tokens** (darker base + slightly-lighter elevated surfaces + hairline-ink border) that we are explicitly allowed to add.

- **Oura-style score ring** around our headline metric. A thin circular SVG progress arc (teal→amber→violet ramp consistent with our palate map) with the large number centered. Reusable `<ScoreRing>` component.
- **Display-weight typography scale.** Add a heavier display weight + tighter letter-spacing + a larger `display` size for hero numbers, plus a refined micro-label spec (all-caps, tracked). Keeps the existing sizes intact for backward compatibility.
- **Depth-tier surfaces on metric tiles.** Replace the flat single-fill tile with a layered look: slightly-lighter elevated surface, a soft multi-layer shadow (native) / subtle inner hairline border, and a faint radial gradient sheen drawn with `react-native-svg` (already installed).
- **Polished hero card container.** Same depth-tier treatment + refined header (micro-label + title spacing + the existing Live pill) on `PalateHeroCard`. The locked trapezoid/sensor SVG layout is untouched.
- **Calm takeaway card depth.** Apply the same elevated-surface depth language to `TakeawayCard`, and tidy the citation/footer rhythm — without touching the PREMIUM FEATURE pill's text or position.
- **Refined color-scale legend.** Quiet the legend container so the palate map reads as the hero (subtle, optional — folded into the hero-card task if needed).

### Out of scope (would dilute MorphoGenix identity)

- **Do NOT adopt Oura's three-tab IA** (Today / Vitals / My Health) — our navigation and screens are fixed.
- **Do NOT copy Oura's serif display font** — community feedback flags it as hurting readability, and it is off-brand for an intraoral biometric product. Stay with the system sans stack.
- **Do NOT introduce Oura's specific score semantics** (Readiness / Sleep / Activity). Our metrics are Posture, Palatal Pressure, Clench, Nasal Breathing — keep our own vocabulary.
- **Do NOT add new screens, charts, onboarding, or data sources.** Polish only.
- **Do NOT add libraries.** Use only what's installed (`react-native-svg`, `reanimated`, `expo-haptics`).
- **Do NOT change the locked palette tokens**, the trapezoid/sensor layout, the live-data flow, `BleStreamer.js`, or the firmware contract.
- **Do NOT change the PREMIUM FEATURE pill** text or position.

---

## Phase 2 — Roadmap (discrete, parallelizable tasks)

**Token prerequisites (done by orchestrator before workers spawn):**
- `src/theme/colors.js` — add neutral depth tokens: `base` (darker than navy for the app floor), `surfaceElevated` (slightly lighter than `surface`), `ink` (hairline border), `inkSoft` (faint divider). Locked tokens unchanged.
- `src/theme/typography.js` — add `weights.display`, `sizes.display`, `lineHeights.display`, and a `micro` label spec (size + letterSpacing). Existing keys unchanged.

**Parallel worker tasks (one subagent each, no shared files):**

| # | Task | File(s) (sole owner) | Visual change |
|---|------|----------------------|---------------|
| 1 | **ScoreRing component** | `src/components/ScoreRing.js` (new) + `src/components/__tests__/ScoreRing.test.js` (new) | New reusable Oura-style circular score ring: thin SVG progress arc (teal→amber→violet, palette ramp), big centered display number, optional label. Pure, testable geometry helper. |
| 2 | **Metric tile depth tier** | `src/components/MetricTile.js` | Elevated surface fill, soft multi-layer shadow + subtle inner hairline border, faint SVG radial sheen. Display-weight hero number. Sparkline preserved. |
| 3 | **Hero card polish** | `src/components/PalateHeroCard.js` | Depth-tier container + refined header rhythm (micro-label + title) and Live pill polish. Locked trapezoid/sensor SVG untouched. |
| 4 | **Takeaway card depth** | `src/components/TakeawayCard.js` | Same elevated-surface depth language + tightened citation/footer rhythm. PREMIUM FEATURE pill text/position untouched. |

All four tasks consume the finalized depth + typography tokens, use only existing libraries, are JavaScript-only, and must keep all 19 tests passing. No two tasks edit the same file, so they run fully in parallel.
