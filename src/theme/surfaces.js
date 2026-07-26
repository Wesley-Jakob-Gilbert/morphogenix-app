import colors from './colors';

export const glassDark = 'rgba(11, 18, 32, 0.55)';
export const glassLight = 'rgba(255, 255, 255, 0.15)';
export const glassBorder = 'rgba(255, 255, 255, 0.12)';

/**
 * Shared surface materials (Round 3 #3 — "one material, everywhere").
 *
 * Round 1 lifted a handful of cards (MetricTile, TakeawayCard, PositionLog,
 * PalateHeroCard) onto an elevated material — lighter surface, hairline inner
 * border, soft multi-layer shadow — while Analytics / History / Account /
 * BleConnectCard / the About modal stayed on the flat `colors.surface` +
 * `rgba(255,255,255,0.05)` hairline. That left two card languages in one build.
 *
 * `elevatedCard` is now THE card material. It matches the exact shadow/border
 * pattern MetricTile shipped with, so the previously-lifted cards are visually
 * unchanged and the flat ones are brought up to parity. Radius is intentionally
 * NOT set here so each call site keeps its own corner radius (18 vs 22).
 */
export const elevatedCard = {
  backgroundColor: colors.surfaceElevated,
  borderWidth: 1,
  borderColor: colors.ink,
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.35,
  shadowRadius: 16,
  elevation: 6,
};

export default {
  elevatedCard,
  glassDark,
  glassLight,
  glassBorder,
};
