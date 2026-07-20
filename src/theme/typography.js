// Typography tokens (Roadmap V2 #1 — Inter font system).
//
// The whole app previously rendered in the platform default face
// (`family: undefined` → San Francisco / Roboto / system). We now bundle the
// Inter family (OFL) via `@expo-google-fonts/inter`, load it in `App.js` with
// `useFonts`, and select weight through the family name — which is how custom
// fonts pick weight in React Native (a numeric `fontWeight` does NOT select a
// weight for a bundled face; the family name carries the weight).
//
// Locked decision (Wes, June 13): use Inter, keep the visual weight hierarchy
// exactly as it was — this is a font swap, not a weight redesign.

// Weight-keyed Inter family names. These are the strings registered by
// `useFonts({ Inter_400Regular, ... })` in App.js.
const family = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

// Heaviest Inter cut, reserved for big numerals (ScoreRing / hero / display).
const familyDisplay = 'Inter_900Black';

const typography = {
  family,
  familyDisplay,
  weights: {
    // Retained as numeric tokens for any system-font fallback path and so
    // existing `fontWeight: typography.weights.X` references stay valid. With
    // Inter loaded, the family name (above / in the `text` styles) is what
    // actually drives the rendered weight.
    regular: '400',
    medium: '600',
    bold: '800',
    display: '900', // heaviest weight for hero/score display numbers (Oura-style)
  },
  sizes: {
    micro: 10, // ScoreRing sub-label (was a magic `fontSize: 10`) — Round 3 #8
    tiny: 11,
    caption: 12,
    body: 15,
    callout: 17,
    title: 24,
    // Analytics section hero numeral (was a magic `fontSize: 38`) — Round 3 #8.
    // Sits between `hero` (32) and `display` (44).
    heroNumber: 38,
    hero: 32,
    display: 44, // large display number for score rings / hero metrics
  },
  lineHeights: {
    caption: 16,
    body: 21,
    callout: 23,
    title: 30,
    heroNumber: 44, // matches sizes.heroNumber (38) — Round 3 #8
    hero: 38,
    display: 48,
  },
  // Canonical text styles. Components should spread these where practical so
  // the Inter family + weight hierarchy stays in one place. Big numerals use
  // the Black display face; body/label copy uses regular/medium Inter.
  text: {
    display: {
      fontFamily: familyDisplay,
      fontSize: 44,
      lineHeight: 48,
      letterSpacing: -1,
    },
    hero: {
      fontFamily: familyDisplay,
      fontSize: 32,
      lineHeight: 38,
      letterSpacing: -0.5,
    },
    value: {
      fontFamily: familyDisplay,
      fontSize: 44,
      lineHeight: 48,
      letterSpacing: -1,
    },
    title: {
      fontFamily: family.bold,
      fontSize: 24,
      lineHeight: 30,
    },
    body: {
      fontFamily: family.regular,
      fontSize: 15,
      lineHeight: 21,
    },
    bodyMedium: {
      fontFamily: family.medium,
      fontSize: 15,
      lineHeight: 21,
    },
    caption: {
      fontFamily: family.medium,
      fontSize: 12,
      lineHeight: 16,
    },
  },
  // All-caps micro-label spec (the small tracked label above a value).
  micro: {
    size: 11,
    letterSpacing: 1.2,
  },
};

export default typography;
