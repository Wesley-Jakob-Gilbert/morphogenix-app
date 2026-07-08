const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  // Round 3 (#8): a "snug" step between lg (16) and xl (24) so tight stat
  // lists / small gaps can leave the ad-hoc marginTop: 2/3/6 magic numbers
  // behind and land on a real token.
  lgPlus: 20,
  xl: 24,
  // Round 3 (#8): hero blocks want "large but not huge" air; the scale used to
  // jump 32 -> 48 with nothing between. xxlPlus (40) fills that gap.
  xxl: 32,
  xxlPlus: 40,
  xxxl: 48,
};

export default spacing;
