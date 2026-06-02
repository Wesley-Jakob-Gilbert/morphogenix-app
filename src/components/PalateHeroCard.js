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
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
} from 'react-native-svg';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import ColorScaleLegend from './ColorScaleLegend';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Discrete 4x4 grid mirroring the 16 FSR sensors on the device.
// Cells are clipped to a half-oval dome so the corner cells get cropped naturally.
//
// viewBox: 0 0 280 200. Dome bounding box: x in [30..250] (W=220), y in [25..185] (H=160).
const DOME_PATH =
  'M30 185 C30 95, 80 25, 140 25 C200 25, 250 95, 250 185 L30 185 Z';

const BACK_Y = 118;
const FRONT_Y = 76;
const SENSOR_PACKET_INDICES = [1, 2, 9, 10, 4, 7];
const SENSOR_POSITIONS = [
  { x: 110, y: BACK_Y, kind: 'palate' }, // 0: back-left  (REAL: Palate_L / adc[2])
  { x: 170, y: BACK_Y, kind: 'palate' }, // 1: back-right (REAL: Palate_R / adc[3])
  { x: 120, y: FRONT_Y, kind: 'palate' }, // 2: front-left (FAKE: mirror Palate_L)
  { x: 160, y: FRONT_Y, kind: 'palate' }, // 3: front-right(FAKE: mirror Palate_R)
  { x: 55, y: BACK_Y, kind: 'clench' }, // 4: clench-left  (REAL: Molar_L / adc[0])
  { x: 225, y: BACK_Y, kind: 'clench' }, // 5: clench-right (REAL: Molar_R / adc[1])
];

export default function PalateHeroCard({ packet, isStreaming }) {
  const palate =
    Array.isArray(packet?.palate) && packet.palate.length === 16
      ? packet.palate
      : fallbackPalate();
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
            <Defs>
              <ClipPath id="palate-clip">
                <Path d={DOME_PATH} />
              </ClipPath>
            </Defs>

            {/* Subtle navy backing inside the dome — shows through the 1px gaps */}
            <Path d={DOME_PATH} fill={colors.navy} opacity="0.6" />

            {/* Six live sensor dots: four real FSRs plus two lagged front-palate mirrors. */}
            <G clipPath="url(#palate-clip)">
              {SENSOR_POSITIONS.map((sensor, index) => {
                const value = palate[SENSOR_PACKET_INDICES[index]];
                return (
                  <SensorDot
                    key={`sensor-${index}`}
                    x={sensor.x}
                    y={sensor.y}
                    kind={sensor.kind}
                    value={value}
                  />
                );
              })}
            </G>

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

function SensorDot({ x, y, kind, value }) {
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
      cx={x}
      cy={y}
      r={kind === 'clench' ? 18 : 20}
      animatedProps={animatedProps}
    />
  );
}

function normalizePressure(newtons) {
  const safeValue = typeof newtons === 'number' ? newtons : 0.55;
  return Math.max(0, Math.min(1, safeValue));
}

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
