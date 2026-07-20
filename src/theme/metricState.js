import colors from './colors';

/**
 * Stateful metric color (Round 3 #6 — Wes decisions #1, #2, #6, July 8).
 *
 * Turns a metric's numeric value into a *state* — 'optimal' | 'attention' |
 * 'improve' — and maps that state to a single palette color. This is what makes
 * color MEAN something on the tiles and the ScoreRing arc, instead of a fixed
 * per-tile decoration.
 *
 * State -> color:
 *   optimal   -> teal      (colors.teal)
 *   attention -> amber     (colors.amber)
 *   improve   -> state-red (colors.stateRed)  <-- the ONLY use of stateRed
 *
 * Thresholds are the locked Round 3 defaults (Wes will tune with real user data
 * later). Higher-is-better for Posture / Nasal; Pressure is a band (a
 * comfortable middle is best, too low OR too high is worse); Clench is
 * lower-is-better (events per hour).
 *
 *   Posture  (score 0..100):  >80 optimal | 60..80 attention | <60 improve
 *   Pressure (N):             0.5..1.5 optimal | 0.3..0.5 or 1.5..2.0 attention
 *                             | <0.3 or >2.0 improve
 *   Clench   (events / hr):   <10 optimal | 10..25 attention | >25 improve
 *   Nasal    (score 0..100):  >70 optimal | 50..70 attention | <50 improve
 *
 * Boundary convention: band edges resolve to the BETTER (higher) state. e.g. a
 * Posture of exactly 80 is 'attention' (not optimal), exactly 60 is 'attention'
 * (not improve). This is documented per-metric below.
 */

export const OPTIMAL = 'optimal';
export const ATTENTION = 'attention';
export const IMPROVE = 'improve';

// Known metric keys. Accepts a few aliases used across screens/tiles.
const METRIC_ALIASES = {
  posture: 'posture',
  'posture score': 'posture',
  pressure: 'pressure',
  'palatal pressure': 'pressure',
  clench: 'clench',
  'clench events': 'clench',
  nasal: 'nasal',
  'nasal breathing': 'nasal',
};

/**
 * Coerce a possibly-stringy value ("87/100", "0.61 N", "3 / hr", 94) to a
 * finite number by taking the leading numeric token. Returns NaN if none.
 */
export function parseMetricValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const m = value.match(/-?\d+(\.\d+)?/);
    if (m) return parseFloat(m[0]);
  }
  return NaN;
}

function normalizeMetric(metric) {
  if (!metric) return null;
  return METRIC_ALIASES[String(metric).trim().toLowerCase()] || null;
}

/**
 * getMetricState(metric, value) -> 'optimal' | 'attention' | 'improve'
 *
 * Unknown metric or non-numeric value falls back to 'optimal' (neutral/on-brand
 * teal) so a bad input never paints a false alarm.
 */
export function getMetricState(metric, value) {
  const key = normalizeMetric(metric);
  const v = parseMetricValue(value);
  if (key === null || !isFinite(v)) return OPTIMAL;

  switch (key) {
    case 'posture':
      // >80 optimal | 60..80 attention | <60 improve.
      if (v > 80) return OPTIMAL;
      if (v >= 60) return ATTENTION;
      return IMPROVE;

    case 'nasal':
      // >70 optimal | 50..70 attention | <50 improve.
      if (v > 70) return OPTIMAL;
      if (v >= 50) return ATTENTION;
      return IMPROVE;

    case 'clench':
      // Lower is better. <10 optimal | 10..25 attention | >25 improve.
      if (v < 10) return OPTIMAL;
      if (v <= 25) return ATTENTION;
      return IMPROVE;

    case 'pressure': {
      // Band. 0.5..1.5 optimal | 0.3..0.5 or 1.5..2.0 attention | <0.3 or >2.0
      // improve.
      if (v >= 0.5 && v <= 1.5) return OPTIMAL;
      if ((v >= 0.3 && v < 0.5) || (v > 1.5 && v <= 2.0)) return ATTENTION;
      return IMPROVE;
    }

    default:
      return OPTIMAL;
  }
}

/**
 * getStateColor(state) -> palette color.
 * Unknown state falls back to teal (optimal).
 */
export function getStateColor(state) {
  switch (state) {
    case ATTENTION:
      return colors.amber;
    case IMPROVE:
      return colors.stateRed;
    case OPTIMAL:
    default:
      return colors.teal;
  }
}

/**
 * Convenience: metric + value -> color, in one call.
 */
export function getMetricColor(metric, value) {
  return getStateColor(getMetricState(metric, value));
}

export default { getMetricState, getStateColor, getMetricColor, parseMetricValue };
