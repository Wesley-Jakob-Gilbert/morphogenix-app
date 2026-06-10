const colors = {
  // --- LOCKED PALETTE (DO NOT CHANGE) ---
  navy: '#0B1220',
  teal: '#29E0C8',
  amber: '#F5B343',
  violet: '#8A6CFF',
  white: '#FFFFFF',
  muted: '#8B93A7',
  surface: '#141B2D',

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
