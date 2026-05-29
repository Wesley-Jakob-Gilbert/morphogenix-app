import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import ColorScaleLegend from './ColorScaleLegend';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// 6 FSR sensors matching the actual hardware prototype:
//   - 4 palate sensors arranged in a trapezoid (back pair wider apart than
//     front pair) sitting inside the half-dome shell.
//   - 2 clench sensors positioned outside the dome at molar height (same Y
//     as the back palate row) to detect teeth clenching.
//
// Each sensor is ~fingernail-sized; circles stay small relative to the
// dome so the shape of the prototype reads clearly.
//
// viewBox: 0 0 280 200. Dome bounding box: x in [30..250] (W=220),
// y in [25..185] (H=160). Dome center x = 140. Top of dome = posterior;
// bottom of dome (flat edge) = anterior near teeth.
//
// Canonical sensor index mapping:
//   0: palate back-left    1: palate back-right    (trapezoid wide row, y=90)
//   2: palate front-left   3: palate front-right   (trapezoid narrow row, y=145)
//   4: molar clench-left   5: molar clench-right   (outside dome, y=90)
const DOME_PATH =
  'M30 185 C30 95, 80 25, 140 25 C200 25, 250 95, 250 185 L30 185 Z';

const BACK_Y = 90;
const FRONT_Y = 145;

const SENSOR_POSITIONS = [
  { x: 110, y: BACK_Y, kind: 'palate' },   // 0: back-left  (trapezoid wide)
  { x: 170, y: BACK_Y, kind: 'palate' },   // 1: back-right (trapezoid wide)
  { x: 120, y: FRONT_Y, kind: 'palate' },  // 2: front-left  (trapezoid narrow)
  { x: 160, y: FRONT_Y, kind: 'palate' },  // 3: front-right (trapezoid narrow)
  { x: 55,  y: BACK_Y, kind: 'clench' },   // 4: molar clench-left
  { x: 225, y: BACK_Y, kind: 'clench' },   // 5: molar clench-right
];

const SENSOR_RADIUS = 11;

export default function PalateHeroCard({ packet, isStreaming }) {
  const palate =
    Array.isArray(packet?.palate) && packet.palate.length === 16
      ? packet.palate
      : fallbackPalate();

  // Pull 6 representative cells from the legacy 16-cell array (4x4 grid).
  // Palate sensors map to interior cells; molar/clench sensors map to outer
  // edge cells of the 4x4 (cols 0 and 3) since those approximate molar regions.
  // Demo data layer stays 16-value; we'll redo natively for BLE later.
  const sixValues = [
    palate[1],   // 0: palate back-left   (row 0, col 1)
    palate[2],   // 1: palate back-right  (row 0, col 2)
    palate[9],   // 2: palate front-left  (row 2, col 1)
    palate[10],  // 3: palate front-right (row 2, col 2)
    palate[4],   // 4: molar clench-left  (row 1, col 0 — outer edge)
    palate[7],   // 5: molar clench-right (row 1, col 3 — outer edge)
  ];

  // Connector path that traces the trapezoid through the 4 palate sensors —
  // a subtle hint that those 4 form a coordinated array.
  const trapezoidPath = `M${SENSOR_POSITIONS[0].x} ${SENSOR_POSITIONS[0].y} L${SENSOR_POSITIONS[1].x} ${SENSOR_POSITIONS[1].y} L${SENSOR_POSITIONS[3].x} ${SENSOR_POSITIONS[3].y} L${SENSOR_POSITIONS[2].x} ${SENSOR_POSITIONS[2].y} Z`;

  const pulse = useSharedValue(0.6);

  useEffect(() => {
    if (!isStreaming) {
      pulse.value = withTiming(0.6, { duration: 180 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 720, easing: Easing.out(Easing.quad) }),
        withTiming(0.45, { duration: 720, easing: Easing.in(Easing.quad) })
      ),
      -1,
      false
    );
  }, [isStreaming, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.9 + pulse.value * 0.28 }],
  }));

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.eyebrow}>PALATAL PRESSURE</Text>
          <Text style={styles.title}>Live palate map</Text>
        </View>
        <View style={styles.liveWrap}>
          <Animated.View style={[styles.liveDot, pulseStyle]} />
          <Text style={styles.liveText}>{isStreaming ? 'Live' : 'Idle'}</Text>
        </View>
      </View>

      <View style={styles.heroBody}>
        <View style={styles.svgWrap}>
          <Svg width="100%" height="100%" viewBox="0 0 280 200">
            {/* Subtle navy backing inside the dome */}
            <Path d={DOME_PATH} fill={colors.navy} opacity="0.6" />

            {/* Faint trapezoid connector hinting the palate sensor array */}
            <Path
              d={trapezoidPath}
              fill="none"
              stroke={colors.white}
              strokeOpacity="0.08"
              strokeWidth="1"
              strokeDasharray="3 4"
            />

            {/* 6 FSR sensors: 4 palate trapezoid + 2 molar clench */}
            {SENSOR_POSITIONS.map((pos, index) => (
              <PalateDot
                key={`sensor-${index}`}
                cx={pos.x}
                cy={pos.y}
                r={SENSOR_RADIUS}
                value={sixValues[index]}
                kind={pos.kind}
              />
            ))}

            {/* Outer outline — 1px, very low opacity */}
            <Path
              d={DOME_PATH}
              fill="none"
              stroke={colors.white}
              strokeOpacity="0.22"
              strokeWidth="1"
            />
          </Svg>
        </View>
        <ColorScaleLegend />
      </View>
    </View>
  );
}

function PalateDot({ cx, cy, r, value, kind = 'palate' }) {
  const normalized = useSharedValue(normalizePressure(value));

  useEffect(() => {
    normalized.value = withTiming(normalizePressure(value), {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, normalized]);

  const animatedProps = useAnimatedProps(() => ({
    fill: interpolateColor(
      normalized.value,
      [0, 0.5, 1],
      [colors.teal, colors.amber, colors.violet]
    ),
  }));

  // Clench sensors get a subtle outer ring to visually distinguish them as a
  // different sensor type (molar pressure) from the palate FSRs.
  return (
    <>
      {kind === 'clench' && (
        <Circle
          cx={cx}
          cy={cy}
          r={r + 4}
          fill="none"
          stroke={colors.white}
          strokeOpacity={0.18}
          strokeWidth={1}
        />
      )}
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={r}
        stroke={colors.navy}
        strokeOpacity={0.6}
        strokeWidth={1}
        animatedProps={animatedProps}
      />
    </>
  );
}

function normalizePressure(newtons) {
  const safeValue = typeof newtons === 'number' ? newtons : 0.55;
  return Math.max(0, Math.min(1, safeValue));
}

// Legacy 16-value fallback; only 6 indices are read by the new layout.
// Kept 16-wide so DemoStreamer and other consumers stay untouched.
function fallbackPalate() {
  return [
    0.58, 0.6, 0.56, 0.62, 0.55, 0.64, 0.52, 0.59, 0.5, 0.57, 0.48, 0.54, 0.46,
    0.51, 0.44, 0.49,
  ];
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.2,
  },
  title: {
    color: colors.white,
    fontSize: typography.sizes.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: typography.weights.bold,
    marginTop: spacing.xs,
  },
  liveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.navy,
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 9,
    backgroundColor: colors.teal,
    marginRight: spacing.xs,
  },
  liveText: {
    color: colors.white,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
  },
  heroBody: {
    minHeight: 240,
    flexDirection: 'row',
    alignItems: 'center',
  },
  svgWrap: {
    flex: 1,
    height: 240,
  },
});
