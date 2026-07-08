import {
  chartPoints,
  polylineString,
  areaPathString,
  targetY,
  polylineLength,
  CHART_DRAW_MS,
} from '../AnalyticsScreen';

// react-native-reanimated is imported at module top in AnalyticsScreen; mock it
// so requiring the module doesn't pull the native runtime. We only exercise the
// pure geometry exports here.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (c) => c },
  Easing: { out: (fn) => fn, cubic: (t) => t },
  useReducedMotion: () => false,
  useSharedValue: (v) => ({ value: v }),
  useAnimatedProps: (fn) => {
    try {
      return fn();
    } catch (_) {
      return {};
    }
  },
  withTiming: (to) => to,
  cancelAnimation: () => {},
}));

// Round 3 #7 — Analytics chart geometry. These lock the pure layout math that
// backs the area fill, baseline, target guide, and draw-on reveal.

describe('chartPoints', () => {
  it('maps a series into padded chart space with high values near the top', () => {
    const { points, min, max } = chartPoints([0, 50, 100], 320, 80, 6, 8);
    expect(points).toHaveLength(3);
    expect(min).toBe(0);
    expect(max).toBe(100);
    // First point sits at left pad, last at width - pad.
    expect(points[0].x).toBeCloseTo(6);
    expect(points[2].x).toBeCloseTo(314);
    // Higher value -> smaller y (closer to top).
    expect(points[2].y).toBeLessThan(points[0].y);
  });

  it('handles a flat series without dividing by zero', () => {
    const { points } = chartPoints([5, 5, 5]);
    expect(points.every((p) => Number.isFinite(p.y))).toBe(true);
  });

  it('is safe on empty / non-array input', () => {
    expect(chartPoints([]).points).toHaveLength(1);
    expect(chartPoints(undefined).points).toHaveLength(1);
  });
});

describe('polylineString', () => {
  it('renders "x,y x,y" pairs', () => {
    const str = polylineString([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
    expect(str).toBe('1.0,2.0 3.0,4.0');
  });
});

describe('areaPathString', () => {
  it('opens with a moveto and closes back to the baseline', () => {
    const path = areaPathString(
      [
        { x: 6, y: 10 },
        { x: 100, y: 20 },
      ],
      80,
      8
    );
    expect(path.startsWith('M 6.0 10.0')).toBe(true);
    // Baseline is height - padY = 72; path must return there and close.
    expect(path).toContain('72');
    expect(path.trim().endsWith('Z')).toBe(true);
  });

  it('returns empty string for no points', () => {
    expect(areaPathString([])).toBe('');
  });
});

describe('targetY', () => {
  it('returns a y inside the band for an in-range target', () => {
    const y = targetY(80, 70, 90, 80, 8);
    expect(y).toBeGreaterThanOrEqual(8);
    expect(y).toBeLessThanOrEqual(72);
  });

  it('returns null when the target is out of the plotted window', () => {
    expect(targetY(200, 70, 90)).toBeNull();
  });

  it('returns null when target is not a number', () => {
    expect(targetY(undefined, 0, 100)).toBeNull();
  });
});

describe('polylineLength', () => {
  it('sums segment lengths', () => {
    // 3-4-5 triangle: horizontal 3 then vertical 4 -> 3 + 4 = 7.
    const len = polylineLength([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
    ]);
    expect(len).toBeCloseTo(7);
  });

  it('is 0 for a single point', () => {
    expect(polylineLength([{ x: 1, y: 1 }])).toBe(0);
  });
});

describe('CHART_DRAW_MS', () => {
  it('is the restrained ~600ms draw-on window (Wes decision #5)', () => {
    expect(CHART_DRAW_MS).toBe(600);
  });
});
