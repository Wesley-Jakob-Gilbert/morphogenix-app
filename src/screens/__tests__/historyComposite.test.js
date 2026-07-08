import {
  dayCompositeFraction,
  dayCompositeScore,
  compositeColor,
} from '../HistoryScreen';
import colors from '../../theme/colors';

// Round 3 #10 — the per-row composite score + heatmap color mapping. These lock
// the blend (higher-is-better on 0..1) and the documented 3-band color signal.

const strongDay = { posture: 95, nasal: 96, clench: 2, pressure: '1.0 N' };
const weakDay = { posture: 55, nasal: 45, clench: 14, pressure: '2.4 N' };

describe('dayCompositeFraction', () => {
  it('returns 0..1', () => {
    const f = dayCompositeFraction(strongDay);
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThanOrEqual(1);
  });

  it('scores a strong day well above a weak day', () => {
    expect(dayCompositeFraction(strongDay)).toBeGreaterThan(
      dayCompositeFraction(weakDay)
    );
  });

  it('rewards pressure near the ~1.0 N comfort center', () => {
    const centered = dayCompositeFraction({ posture: 80, nasal: 80, clench: 5, pressure: '1.0 N' });
    const farOff = dayCompositeFraction({ posture: 80, nasal: 80, clench: 5, pressure: '2.5 N' });
    expect(centered).toBeGreaterThan(farOff);
  });

  it('is safe on missing / null input', () => {
    expect(dayCompositeFraction(null)).toBe(0);
    expect(dayCompositeFraction({})).toBeGreaterThanOrEqual(0);
  });
});

describe('dayCompositeScore', () => {
  it('is the fraction rounded to 0..100', () => {
    const score = dayCompositeScore(strongDay);
    expect(score).toBe(Math.round(dayCompositeFraction(strongDay) * 100));
    expect(score).toBeGreaterThan(80);
  });
});

describe('compositeColor (documented 3-band signal)', () => {
  it('teal for a strong composite (>= 0.85)', () => {
    expect(compositeColor(0.9)).toBe(colors.teal);
    expect(compositeColor(0.85)).toBe(colors.teal);
  });
  it('amber for a middling composite (0.70..0.85)', () => {
    expect(compositeColor(0.75)).toBe(colors.amber);
    expect(compositeColor(0.7)).toBe(colors.amber);
  });
  it('violet for a low composite (< 0.70)', () => {
    expect(compositeColor(0.6)).toBe(colors.violet);
    expect(compositeColor(0)).toBe(colors.violet);
  });
});
