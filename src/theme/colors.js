const colors = {
  // --- LOCKED PALETTE (DO NOT CHANGE) ---
  navy: '#0B1220',
  teal: '#29E0C8',
  amber: '#F5B343',
  violet: '#8A6CFF',
  white: '#FFFFFF',
  muted: '#8B93A7',
  surface: '#141B2D',

  // --- STATE-ONLY EXTENSION (Round 3, Wes decision #2, July 8) ---
  // `stateRed` is the ONLY red in the app and is a *state* color, not a
  // decorative palette member. It renders EXCLUSIVELY when a metric falls into
  // the "improve" threshold band (see src/theme/metricState.js). It MUST NEVER
  // be used as a static accent, border, chip, or any decorative surface. If you
  // are reaching for red for anything other than a live "improve" metric state,
  // you are using the wrong token.
  stateRed: '#FF6B6B',

  // --- PREMIUM TIER EXTENSION (Round 3, Wes decision, July 8) ---
  // Subtle gold reserved for the "PREMIUM FEATURE" pill. Distinct from `amber`
  // (a data/attention color) so it reads as "tier," not "metric." Consumed by
  // src/components/PremiumPill.js. Not a general-purpose accent.
  premiumGold: '#E5C572',

  // --- Neutral depth tokens (Oura-style layered dark mode) ---
  // Depth order, darkest -> lightest: base -> navy -> surface -> surfaceElevated.
  // Per NN/g dark-mode guidance, the bottom layer is darkest and elevated
  // surfaces are progressively lighter to read as "closer" to the user.
  base: '#070C16', // app floor, darker than navy
  surfaceElevated: '#1A2336', // cards lifted above `surface`
  ink: 'rgba(255, 255, 255, 0.08)', // hairline inner border on elevated surfaces
  inkSoft: 'rgba(255, 255, 255, 0.04)', // faint divider / inner sheen
  shadow: '#000000', // shadow color for soft multi-layer elevation
};

export default colors;
