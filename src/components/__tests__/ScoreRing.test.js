import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import ScoreRing, {
  ringFraction,
  formatValue,
  dashOffsetForFraction,
  shouldAnimate,
  displayValueFor,
  ANIM_DURATION_MS,
} from '../ScoreRing';
import { haptics } from '../../utils/haptics';
import colors from '../../theme/colors';

// --- Reanimated mock (Roadmap V2 #2 animation gating) -----------------------
//
// We mock react-native-reanimated so the ScoreRing's motion hooks are
// deterministic and synchronous in tests. `useReducedMotion` is mocked via a
// controllable holder so each test can flip the OS reduce-motion gate.
// `withTiming` invokes its completion callback synchronously with finished=true
// so we can assert the settle haptic fires on a normal (animated) run.
const reduceMotionHolder = { value: false };

jest.mock('react-native-reanimated', () => {
  const sharedValues = [];
  return {
    __esModule: true,
    default: {
      // Animated.createAnimatedComponent(Comp) -> passthrough component.
      createAnimatedComponent: (Comp) => Comp,
    },
    Easing: {
      out: (fn) => fn,
      cubic: (t) => t,
    },
    useReducedMotion: () => reduceMotionHolder.value,
    useSharedValue: (init) => {
      const sv = { value: init };
      sharedValues.push(sv);
      return sv;
    },
    useDerivedValue: () => {
      // In real reanimated the derived fn runs reactively on the UI thread,
      // never during the JS render pass. We intentionally do NOT invoke it
      // here (doing so would call setState during render). The count-up math
      // is covered directly by the displayValueFor unit tests.
      return { value: 0 };
    },
    useAnimatedProps: (fn) => {
      try {
        return fn();
      } catch (_) {
        return {};
      }
    },
    withTiming: (toValue, _config, callback) => {
      // Synchronously "complete" the animation.
      if (typeof callback === 'function') callback(true);
      return toValue;
    },
    cancelAnimation: () => {},
    runOnJS: (fn) => fn,
  };
});

// Silence/track the settle haptic.
jest.mock('../../utils/haptics', () => ({
  haptics: {
    selection: jest.fn(),
    light: jest.fn(),
    medium: jest.fn(),
    heavy: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

beforeEach(() => {
  reduceMotionHolder.value = false;
  jest.clearAllMocks();
});

// --- Pure geometry helpers --------------------------------------------------

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

// --- Animation helpers (Roadmap V2 #2) --------------------------------------

describe('dashOffsetForFraction', () => {
  const C = 100;

  it('is full circumference (empty arc) at fraction 0', () => {
    expect(dashOffsetForFraction(0, C)).toBe(100);
  });

  it('is zero (full arc) at fraction 1', () => {
    expect(dashOffsetForFraction(1, C)).toBe(0);
  });

  it('is half circumference at fraction 0.5', () => {
    expect(dashOffsetForFraction(0.5, C)).toBe(50);
  });

  it('clamps out-of-range fractions', () => {
    expect(dashOffsetForFraction(2, C)).toBe(0);
    expect(dashOffsetForFraction(-1, C)).toBe(100);
  });

  it('guards against bad circumference', () => {
    expect(dashOffsetForFraction(0.5, 0)).toBe(0);
    expect(dashOffsetForFraction(0.5, NaN)).toBe(0);
  });
});

describe('shouldAnimate (reduce-motion gating)', () => {
  it('animates when reduce-motion is off', () => {
    expect(shouldAnimate(false)).toBe(true);
  });

  it('snaps (no animation) when reduce-motion is on', () => {
    expect(shouldAnimate(true)).toBe(false);
  });
});

describe('displayValueFor (count-up)', () => {
  it('counts a number up from 0 to the final value', () => {
    expect(displayValueFor(80, 0)).toBe(0);
    expect(displayValueFor(80, 0.5)).toBe(40);
    expect(displayValueFor(80, 1)).toBe(80);
  });

  it('rounds intermediate numbers', () => {
    expect(displayValueFor(87, 0.5)).toBe(44); // 43.5 -> 44
  });

  it('scales the leading number of a string value', () => {
    expect(displayValueFor('90/100', 0.5)).toBe(45);
    expect(displayValueFor('90/100', 1)).toBe(90);
  });

  it('preserves one/two decimals for fractional string values', () => {
    expect(displayValueFor('0.62 N', 1)).toBeCloseTo(0.62);
    expect(displayValueFor('0.62 N', 0.5)).toBeCloseTo(0.31);
  });

  it('clamps progress and handles non-numeric input', () => {
    expect(displayValueFor(50, 2)).toBe(50);
    expect(displayValueFor(50, -1)).toBe(0);
    expect(displayValueFor('n/a', 1)).toBe('n/a');
    expect(displayValueFor('n/a', 0)).toBe(0);
  });
});

// --- Render-level gating behavior -------------------------------------------

describe('ScoreRing animation gating (rendered)', () => {
  it('fires the settle haptic once when motion plays (reduce-motion OFF)', () => {
    reduceMotionHolder.value = false;
    let tree;
    act(() => {
      tree = TestRenderer.create(<ScoreRing value={87} label="Posture" />);
    });
    expect(haptics.selection).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('does NOT fire the settle haptic when reduce-motion is ON (snaps)', () => {
    reduceMotionHolder.value = true;
    let tree;
    act(() => {
      tree = TestRenderer.create(<ScoreRing value={87} label="Posture" />);
    });
    expect(haptics.selection).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('renders the final value immediately when reduce-motion is ON', () => {
    reduceMotionHolder.value = true;
    let tree;
    act(() => {
      tree = TestRenderer.create(<ScoreRing value={87} label="Posture" />);
    });
    const texts = tree.root
      .findAllByType(require('react-native').Text)
      .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : t.props.children));
    expect(texts).toContain('87');
    act(() => tree.unmount());
  });

  it('uses the expected ~900ms fill duration', () => {
    expect(ANIM_DURATION_MS).toBe(900);
  });
});

// --- Solid state color (Round 3 #6, Wes decision #6) ------------------------
//
// The arc must render in ONE solid color derived from the value's state
// (teal = optimal, amber = attention, stateRed = improve), never the old
// teal->amber->violet gradient. We locate the progress Circle by its
// strokeLinecap="round" (the background track has no linecap) and assert its
// `stroke`. Reduce-motion is ON here so the render is a stable snapshot.
describe('ScoreRing solid state color', () => {
  beforeEach(() => {
    reduceMotionHolder.value = true;
  });

  function arcStroke(tree) {
    const Circle = require('react-native-svg').Circle;
    const arc = tree.root
      .findAllByType(Circle)
      .find((c) => c.props.strokeLinecap === 'round');
    return arc && arc.props.stroke;
  }

  it('paints the arc teal for an optimal posture (>80)', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<ScoreRing value={92} label="Posture" />);
    });
    expect(arcStroke(tree)).toBe(colors.teal);
    act(() => tree.unmount());
  });

  it('paints the arc amber for an attention posture (60..80)', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<ScoreRing value={70} label="Posture" />);
    });
    expect(arcStroke(tree)).toBe(colors.amber);
    act(() => tree.unmount());
  });

  it('paints the arc stateRed for a poor posture (<60)', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<ScoreRing value={40} label="Posture" />);
    });
    expect(arcStroke(tree)).toBe(colors.stateRed);
    act(() => tree.unmount());
  });

  it('honors an explicit stateColor override', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(
        <ScoreRing value={40} label="Posture" stateColor={colors.teal} />
      );
    });
    expect(arcStroke(tree)).toBe(colors.teal);
    act(() => tree.unmount());
  });

  it('never renders the old gradient url reference', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<ScoreRing value={92} label="Posture" />);
    });
    expect(arcStroke(tree)).not.toMatch(/url\(/);
    act(() => tree.unmount());
  });
});
