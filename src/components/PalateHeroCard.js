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

// 6 FSR sensors arranged 2 columns x 3 rows, matching the actual hardware
// prototype. Each sensor is ~fingernail-sized, so the circles are small
// relative to the half-dome shell.
//
// viewBox: 0 0 280 200. Dome bounding box: x in [30..250] (W=220),
// y in [25..185] (H=160). Dome center x = 140.
//
// Canonical sensor index mapping (top of dome = posterior/back,
// bottom = anterior/front near teeth):
//   0: back-left      1: back-right     (row 0, y ~ 75)
//   2: middle-left    3: middle-right   (row 1, y ~ 110)
//   4: front-left     5: front-right    (row 2, y ~ 145)
const DOME_PATH =
  'M30 185 C30 95, 80 25, 140 25 C200 25, 250 95, 250 185 L30 185 Z';

const SENSOR_POSITIONS = [
  { x: 115, y: 75 },   // 0: back-left
  { x: 165, y: 75 },   // 1: back-right
  { x: 115, y: 110 },  // 2: middle-left
  { x: 165, y: 110 },  // 3: middle-right
  { x: 115, y: 145 },  // 4: front-left
  { x: 165, y: 145 },  // 5: front-right
];

const SENSOR_RADIUS = 11;

export default function PalateHeroCard({ packet, isStreaming }) {
  const palate =
    Array.isArray(packet?.palate) && packet.palate.length === 16
      ? packet.palate
      : fallbackPalate();

  // Pull 6 representative cells from the legacy 16-cell array (4x4 grid).
  // We index into rows 0/1/2 cols 1/2 to roughly mirror the new 2x3 layout.
  // The demo data layer stays 16-value; we'll redo natively for BLE later.
  const sixValues = [
    palate[1],   // back-left   (row 0, col 1)
    palate[2],   // back-right  (row 0, col 2)
    palate[5],   // mid-left    (row 1, col 1)
    palate[6],   // mid-right   (row 1, col 2)
    palate[9],   // front-left  (row 2, col 1)
    palate[10],  // front-right (row 2, col 2)
  ];

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

            {/* 6 FSR sensors: 2 cols x 3 rows, clustered in back-middle */}
            {SENSOR_POSITIONS.map((pos, index) => (
              <PalateDot
                key={`sensor-${index}`}
                cx={pos.x}
                cy={pos.y}
                r={SENSOR_RADIUS}
                value={sixValues[index]}
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

function PalateDot({ cx, cy, r, value }) {
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

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={r}
      stroke={colors.navy}
      strokeOpacity={0.6}
      strokeWidth={1}
      animatedProps={animatedProps}
    />
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
