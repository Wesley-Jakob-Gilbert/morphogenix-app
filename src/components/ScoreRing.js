import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import { haptics } from '../utils/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Animation timing (Roadmap V2 #2). Apple Watch rings fill + count up on
// appear over a short, eased window; we match that feel.
export const ANIM_DURATION_MS = 900;

/**
 * ScoreRing
 *
 * Oura-style circular score ring: a thin background track with a colored
 * progress arc that fills clockwise from the top, and a large display number
 * centered inside. The arc uses our locked palette ramp (teal -> amber ->
 * violet) so it reads consistently with the palate pressure map.
 *
 * Roadmap V2 #2 — the arc now FILLS and the centered number COUNTS UP on
 * mount and whenever `value` changes (Apple Watch ring identity). Motion is
 * driven by react-native-reanimated. The OS reduce-motion setting is
 * respected: when on, the ring snaps to its final state with no animation.
 * A light selection haptic fires once the fill settles.
 *
 * This is purely a visual/presentational component — no data fetching, no BLE.
 *
 * Props:
 *   value: number            // the headline number to show (e.g. 87)
 *   max?: number             // denominator for progress fraction (default 100)
 *   label?: string           // small all-caps micro-label under the number
 *   size?: number            // outer diameter in px (default 132)
 *   strokeWidth?: number     // arc thickness (default 10)
 *   suffix?: string          // optional small unit shown after the number
 */
export default function ScoreRing({
  value,
  max = 100,
  label,
  size = 132,
  strokeWidth = 10,
  suffix,
}) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
  const fraction = ringFraction(numericValue, max);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = dashOffsetForFraction(fraction, circumference);
  const center = size / 2;

  // Reduce-motion gate (OS accessibility setting). When true we skip motion
  // and snap to the final state, per Apple HIG. `reduceMotion` is a plain
  // boolean derived from the platform on mount.
  const reduceMotion = useReducedMotion();
  const animate = shouldAnimate(reduceMotion);

  // Shared progress 0..1. Drives BOTH the arc offset and the count-up number
  // from a single source of truth so they stay in lockstep.
  const progress = useSharedValue(animate ? 0 : 1);

  // The count-up number is mirrored into React state so the centered <Text>
  // re-renders as progress advances. A derived value reads `progress` on the
  // UI thread and hops to JS to set state.
  const [displayNum, setDisplayNum] = useState(() =>
    animate ? 0 : displayValueFor(value, 1)
  );

  const setDisplay = React.useCallback(
    (p) => setDisplayNum(displayValueFor(value, p)),
    [value]
  );

  useDerivedValue(() => {
    runOnJS(setDisplay)(progress.value);
  }, [progress, setDisplay]);

  useEffect(() => {
    if (!animate) {
      // Snap: cancel anything in flight, pin to final, no haptic ceremony.
      cancelAnimation(progress);
      progress.value = 1;
      setDisplayNum(displayValueFor(value, 1));
      return undefined;
    }

    // (Re)start the fill from zero on mount and whenever `value` changes.
    cancelAnimation(progress);
    progress.value = 0;
    setDisplayNum(0);
    progress.value = withTiming(
      1,
      { duration: ANIM_DURATION_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        // Fire the settle haptic only on a clean finish (not on interrupt /
        // unmount), and only when motion actually played.
        if (finished) {
          runOnJS(haptics.selection)();
        }
      }
    );

    return () => {
      cancelAnimation(progress);
    };
    // numericValue is the stable, parsed driver of the target; re-run on change.
  }, [animate, value, numericValue, progress]);

  // Animate the arc offset from full circumference (empty) -> target offset.
  const animatedArcProps = useAnimatedProps(() => {
    const offset =
      circumference - (circumference - targetOffset) * progress.value;
    return { strokeDashoffset: offset };
  }, [circumference, targetOffset]);

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel={`${label ? label + ': ' : ''}${numericValue} of ${max}`}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="scoreRingRamp" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.teal} />
            <Stop offset="0.62" stopColor={colors.amber} />
            <Stop offset="1" stopColor={colors.violet} />
          </LinearGradient>
        </Defs>

        {/* Background track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.ink}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress arc — rotated -90deg so it starts at 12 o'clock */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#scoreRingRamp)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedArcProps}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>

      <View style={styles.center} pointerEvents="none">
        <View style={styles.valueRow}>
          <Text style={styles.value}>{formatValue(displayNum)}</Text>
          {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        </View>
        {label ? (
          <Text
            style={[styles.label, { maxWidth: size - strokeWidth * 2 - 16 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// Pure, testable geometry helper: clamps the value/max into a 0..1 fraction.
export function ringFraction(value, max = 100) {
  const v = typeof value === 'number' ? value : parseFloat(value);
  const m = typeof max === 'number' && max !== 0 ? max : 100;
  if (!isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v / m));
}

// Pure helper: the stroke-dash offset for a given fill fraction. At fraction 0
// the arc is fully hidden (offset = circumference); at 1 it is fully drawn
// (offset = 0).
export function dashOffsetForFraction(fraction, circumference) {
  const f = isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const c = isFinite(circumference) && circumference > 0 ? circumference : 0;
  return c * (1 - f);
}

// Pure gating helper for the animation. We animate unless the OS reduce-motion
// setting is on. Kept separate so the gating logic is unit-testable without
// rendering reanimated.
export function shouldAnimate(reduceMotion) {
  return !reduceMotion;
}

// Pure helper: the numeric value to display at animation progress `p` (0..1).
// Counts up from 0 toward the final value. Strings (e.g. "87/100") have their
// leading number scaled; non-numeric input yields the original value at p=1.
export function displayValueFor(value, p) {
  const clamped = isFinite(p) ? Math.max(0, Math.min(1, p)) : 1;
  if (typeof value === 'number') {
    return Math.round(value * clamped);
  }
  if (typeof value === 'string') {
    const lead = value.match(/^-?\d+(\.\d+)?/);
    if (lead) {
      const n = parseFloat(lead[0]);
      const hasDecimal = lead[0].includes('.');
      const scaled = n * clamped;
      // Preserve one decimal place for fractional values (e.g. "0.62 N").
      return hasDecimal ? Math.round(scaled * 100) / 100 : Math.round(scaled);
    }
    return clamped >= 1 ? value : 0;
  }
  return clamped >= 1 ? value : 0;
}

// Display-format the headline value. If it's already a string (e.g. "87/100")
// take the leading number so the ring center stays clean.
export function formatValue(value) {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    const lead = value.match(/^-?\d+(\.\d+)?/);
    return lead ? lead[0] : value;
  }
  return '';
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  value: {
    color: colors.white,
    fontSize: typography.sizes.display,
    lineHeight: typography.lineHeights.display,
    // Headline numeral → Inter Black display face (Roadmap V2 #1).
    fontFamily: typography.familyDisplay,
    fontWeight: typography.weights.display,
    letterSpacing: -1,
  },
  suffix: {
    color: colors.muted,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    marginTop: spacing.sm,
    marginLeft: 2,
  },
  label: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: typography.weights.bold,
    marginTop: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
