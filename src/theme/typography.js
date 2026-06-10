const typography = {
  family: undefined,
  weights: {
    regular: '400',
    medium: '600',
    bold: '800',
    display: '900', // heaviest weight for hero/score display numbers (Oura-style)
  },
  sizes: {
    tiny: 11,
    caption: 12,
    body: 15,
    callout: 17,
    title: 24,
    hero: 32,
    display: 44, // large display number for score rings / hero metrics
  },
  lineHeights: {
    caption: 16,
    body: 21,
    callout: 23,
    title: 30,
    hero: 38,
    display: 48,
  },
  // All-caps micro-label spec (the small tracked label above a value).
  micro: {
    size: 11,
    letterSpacing: 1.2,
  },
};

export default typography;
