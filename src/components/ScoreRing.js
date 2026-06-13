import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

/**
 * ScoreRing
 *
 * Oura-style circular score ring: a thin background track with a colored
 * progress arc that fills clockwise from the top, and a large display number
 * centered inside. The arc uses our locked palette ramp (teal -> amber ->
 * violet) so it reads consistently with the palate pressure map.
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
  const dashOffset = circumference * (1 - fraction);
  const center = size / 2;

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
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#scoreRingRamp)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>

      <View style={styles.center} pointerEvents="none">
        <View style={styles.valueRow}>
          <Text style={styles.value}>{formatValue(value)}</Text>
          {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        </View>
        {label ? <Text style={styles.label}>{label}</Text> : null}
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
    fontSize: typography.micro.size,
    letterSpacing: typography.micro.letterSpacing,
    fontWeight: typography.weights.bold,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
});
