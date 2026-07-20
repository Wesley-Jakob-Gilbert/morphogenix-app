import {
  getMetricState,
  getStateColor,
  getMetricColor,
  parseMetricValue,
  OPTIMAL,
  ATTENTION,
  IMPROVE,
} from '../metricState';
import colors from '../colors';

// Round 3 #6 — stateful metric color (Wes decisions #1, #2, #6, July 8).
// These lock the threshold bands and the state->color mapping so the ring and
// tiles keep meaning color, and so stateRed can NEVER escape the 'improve' path.

describe('parseMetricValue', () => {
  it('returns numbers unchanged', () => {
    expect(parseMetricValue(87)).toBe(87);
    expect(parseMetricValue(0.62)).toBeCloseTo(0.62);
  });

  it('extracts the leading numeric token from strings', () => {
    expect(parseMetricValue('87/100')).toBe(87);
    expect(parseMetricValue('0.62 N')).toBeCloseTo(0.62);
    expect(parseMetricValue('3 / hr')).toBe(3);
    expect(parseMetricValue('-5 deg')).toBe(-5);
  });

  it('returns NaN for non-numeric / nullish input', () => {
    expect(Number.isNaN(parseMetricValue('n/a'))).toBe(true);
    expect(Number.isNaN(parseMetricValue(undefined))).toBe(true);
    expect(Number.isNaN(parseMetricValue(null))).toBe(true);
  });
});

describe('getMetricState — Posture (>80 / 60..80 / <60, higher better)', () => {
  it('optimal above 80', () => {
    expect(getMetricState('posture', 81)).toBe(OPTIMAL);
    expect(getMetricState('posture', 100)).toBe(OPTIMAL);
  });
  it('boundary 80 resolves to attention (band edge -> better state)', () => {
    expect(getMetricState('posture', 80)).toBe(ATTENTION);
  });
  it('attention in 60..80', () => {
    expect(getMetricState('posture', 70)).toBe(ATTENTION);
  });
  it('boundary 60 resolves to attention', () => {
    expect(getMetricState('posture', 60)).toBe(ATTENTION);
  });
  it('improve below 60', () => {
    expect(getMetricState('posture', 59)).toBe(IMPROVE);
    expect(getMetricState('posture', 0)).toBe(IMPROVE);
  });
  it('accepts the "posture score" alias and stringy values', () => {
    expect(getMetricState('Posture Score', '81/100')).toBe(OPTIMAL);
  });
});

describe('getMetricState — Nasal (>70 / 50..70 / <50, higher better)', () => {
  it('optimal above 70', () => {
    expect(getMetricState('nasal', 71)).toBe(OPTIMAL);
  });
  it('boundary 70 -> attention', () => {
    expect(getMetricState('nasal', 70)).toBe(ATTENTION);
  });
  it('attention in 50..70', () => {
    expect(getMetricState('nasal', 55)).toBe(ATTENTION);
  });
  it('boundary 50 -> attention', () => {
    expect(getMetricState('nasal', 50)).toBe(ATTENTION);
  });
  it('improve below 50', () => {
    expect(getMetricState('nasal', 49)).toBe(IMPROVE);
  });
  it('accepts the "nasal breathing" alias', () => {
    expect(getMetricState('Nasal Breathing', 80)).toBe(OPTIMAL);
  });
});

describe('getMetricState — Clench (<10 / 10..25 / >25, lower better)', () => {
  it('optimal below 10', () => {
    expect(getMetricState('clench', 9)).toBe(OPTIMAL);
    expect(getMetricState('clench', 0)).toBe(OPTIMAL);
  });
  it('boundary 10 -> attention', () => {
    expect(getMetricState('clench', 10)).toBe(ATTENTION);
  });
  it('attention in 10..25', () => {
    expect(getMetricState('clench', 20)).toBe(ATTENTION);
  });
  it('boundary 25 -> attention', () => {
    expect(getMetricState('clench', 25)).toBe(ATTENTION);
  });
  it('improve above 25', () => {
    expect(getMetricState('clench', 26)).toBe(IMPROVE);
  });
  it('accepts the "clench events" alias', () => {
    expect(getMetricState('Clench Events', '3 / hr')).toBe(OPTIMAL);
  });
});

describe('getMetricState — Pressure (band 0.5..1.5 optimal)', () => {
  it('optimal inside 0.5..1.5', () => {
    expect(getMetricState('pressure', 0.5)).toBe(OPTIMAL);
    expect(getMetricState('pressure', 1.0)).toBe(OPTIMAL);
    expect(getMetricState('pressure', 1.5)).toBe(OPTIMAL);
  });
  it('attention on the low shoulder 0.3..<0.5', () => {
    expect(getMetricState('pressure', 0.3)).toBe(ATTENTION);
    expect(getMetricState('pressure', 0.49)).toBe(ATTENTION);
  });
  it('attention on the high shoulder >1.5..2.0', () => {
    expect(getMetricState('pressure', 1.6)).toBe(ATTENTION);
    expect(getMetricState('pressure', 2.0)).toBe(ATTENTION);
  });
  it('improve below 0.3 or above 2.0', () => {
    expect(getMetricState('pressure', 0.29)).toBe(IMPROVE);
    expect(getMetricState('pressure', 2.01)).toBe(IMPROVE);
  });
  it('accepts the "palatal pressure" alias and "N" suffix', () => {
    expect(getMetricState('Palatal Pressure', '0.62 N')).toBe(OPTIMAL);
  });
});

describe('getMetricState — fallbacks', () => {
  it('unknown metric falls back to optimal', () => {
    expect(getMetricState('heartRate', 40)).toBe(OPTIMAL);
  });
  it('non-numeric value falls back to optimal', () => {
    expect(getMetricState('posture', 'n/a')).toBe(OPTIMAL);
  });
  it('nullish metric falls back to optimal', () => {
    expect(getMetricState(undefined, 10)).toBe(OPTIMAL);
    expect(getMetricState(null, 10)).toBe(OPTIMAL);
  });
});

describe('getStateColor — state -> palette', () => {
  it('optimal -> teal', () => {
    expect(getStateColor(OPTIMAL)).toBe(colors.teal);
  });
  it('attention -> amber', () => {
    expect(getStateColor(ATTENTION)).toBe(colors.amber);
  });
  it('improve -> stateRed (the ONLY use of stateRed)', () => {
    expect(getStateColor(IMPROVE)).toBe(colors.stateRed);
  });
  it('unknown state -> teal', () => {
    expect(getStateColor('mystery')).toBe(colors.teal);
    expect(getStateColor(undefined)).toBe(colors.teal);
  });
});

describe('getMetricColor — metric+value -> color in one call', () => {
  it('maps a strong posture to teal', () => {
    expect(getMetricColor('posture', 92)).toBe(colors.teal);
  });
  it('maps a mid posture to amber', () => {
    expect(getMetricColor('posture', 70)).toBe(colors.amber);
  });
  it('maps a poor posture to stateRed', () => {
    expect(getMetricColor('posture', 40)).toBe(colors.stateRed);
  });
});
