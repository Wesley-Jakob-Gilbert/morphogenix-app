const colors = {
  // --- SWISS ALPS PALETTE ---
  snow: '#FFFFFF',
  snowSoft: '#F4F6F8',
  emerald: '#7DD3B8',
  emeraldDeep: '#4FA88A',
  sky: '#8FC5E5',
  skyDeep: '#5A93B8',
  stone: '#6B7280',
  stoneDark: '#374151',

  // --- LEGACY PALETTE (kept for compatibility) ---
  // @deprecated — being phased out in Swiss Alps refresh
  navy: '#0B1220',
  // @deprecated — being phased out in Swiss Alps refresh
  teal: '#29E0C8',
  // @deprecated — being phased out in Swiss Alps refresh
  amber: '#F5B343',
  // @deprecated — being phased out in Swiss Alps refresh
  violet: '#8A6CFF',
  // @deprecated — being phased out in Swiss Alps refresh
  white: '#FFFFFF',
  // @deprecated — being phased out in Swiss Alps refresh
  muted: '#8B93A7',
  // @deprecated — being phased out in Swiss Alps refresh
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
  // @deprecated — being phased out in Swiss Alps refresh
  base: '#070C16', // app floor, darker than navy
  // @deprecated — being phased out in Swiss Alps refresh
  surfaceElevated: '#1A2336', // cards lifted above `surface`
  // @deprecated — being phased out in Swiss Alps refresh
  ink: 'rgba(255, 255, 255, 0.08)', // hairline inner border on elevated surfaces
  // @deprecated — being phased out in Swiss Alps refresh
  inkSoft: 'rgba(255, 255, 255, 0.04)', // faint divider / inner sheen
  // @deprecated — being phased out in Swiss Alps refresh
  shadow: '#000000', // shadow color for soft multi-layer elevation
};

export default colors;
