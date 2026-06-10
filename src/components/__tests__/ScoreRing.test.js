import { ringFraction, formatValue } from '../ScoreRing';

describe('ringFraction', () => {
  it('returns 0..1 for in-range values', () => {
    expect(ringFraction(0, 100)).toBe(0);
    expect(ringFraction(50, 100)).toBe(0.5);
    expect(ringFraction(100, 100)).toBe(1);
  });

  it('clamps values above max and below zero', () => {
    expect(ringFraction(150, 100)).toBe(1);
    expect(ringFraction(-20, 100)).toBe(0);
  });

  it('respects a custom max', () => {
    expect(ringFraction(5, 10)).toBe(0.5);
  });

  it('parses numeric strings', () => {
    expect(ringFraction('87', 100)).toBeCloseTo(0.87);
  });

  it('handles invalid input safely', () => {
    expect(ringFraction(undefined, 100)).toBe(0);
    expect(ringFraction(NaN, 100)).toBe(0);
    expect(ringFraction(50, 0)).toBe(0.5); // falls back to max=100
  });
});

describe('formatValue', () => {
  it('stringifies numbers', () => {
    expect(formatValue(87)).toBe('87');
  });

  it('extracts the leading number from a string', () => {
    expect(formatValue('87/100')).toBe('87');
    expect(formatValue('0.62 N')).toBe('0.62');
  });

  it('returns empty string for nullish input', () => {
    expect(formatValue(undefined)).toBe('');
    expect(formatValue(null)).toBe('');
  });
});
