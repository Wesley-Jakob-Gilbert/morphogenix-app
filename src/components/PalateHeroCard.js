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
  Ellipse,
  G,
  Path,
} from 'react-native-svg';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import ColorScaleLegend from './ColorScaleLegend';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// 16-zone layout mapped onto a half-oval dome.
// viewBox 0 0 280 200. Dome is centered at (140, 30..190).
// Zones flow row-by-row from front (top of dome) to back (bottom opening).
// We render them as large overlapping blurred circles so colors blend smoothly.
const ZONE_POSITIONS = [
  // Row 1 (front edge, narrow)
  { cx: 110, cy: 60, r: 36 },
  { cx: 170, cy: 60, r: 36 },
  // Row 2
  { cx: 90, cy: 95, r: 42 },
  { cx: 140, cy: 92, r: 42 },
  { cx: 190, cy: 95, r: 42 },
  // Row 3 (widest)
  { cx: 80, cy: 130, r: 46 },
  { cx: 125, cy: 128, r: 44 },
  { cx: 155, cy: 128, r: 44 },
  { cx: 200, cy: 130, r: 46 },
  // Row 4
  { cx: 85, cy: 160, r: 42 },
  { cx: 130, cy: 158, r: 40 },
  { cx: 150, cy: 158, r: 40 },
  { cx: 195, cy: 160, r: 42 },
  // Row 5 (back, opening)
  { cx: 100, cy: 180, r: 36 },
  { cx: 140, cy: 180, r: 36 },
  { cx: 180, cy: 180, r: 36 },
];

// Half-oval dome path: wider than tall, gently rounded at top, opening at bottom.
// Width ~ 240, Height ~ 170 inside viewBox 280x200.
const DOME_PATH =
  'M30 185 C30 95, 80 25, 140 25 C200 25, 250 95, 250 185 L30 185 Z';

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
              {/* Soft blur to merge zones into a continuous color field */}
              <ClipPath id="palate-clip">
                <Path d={DOME_PATH} />
              </ClipPath>
            </Defs>

            {/* Soft inner navy backing inside the dome (subtle base) */}
            <Path
              d={DOME_PATH}
              fill={colors.navy}
              opacity="0.4"
            />

            {/* Blurred color zones, clipped to dome */}
            <G clipPath="url(#palate-clip)">
              {ZONE_POSITIONS.map((pos, index) => (
                <PalateZoneBlob
                  key={`zone-${index}`}
                  cx={pos.cx}
                  cy={pos.cy}
                  r={pos.r}
                  value={palate[index]}
                />
              ))}
              {/* Soft highlight ellipse to give a gentle "dome" look */}
              <Ellipse
                cx="140"
                cy="55"
                rx="90"
                ry="22"
                fill={colors.white}
                opacity="0.05"
              />
            </G>

            {/* Outer outline only — 1px, very low opacity */}
            <Path
              d={DOME_PATH}
              fill="none"
              stroke={colors.white}
              strokeOpacity="0.2"
              strokeWidth="1"
            />
          </Svg>
        </View>
        <ColorScaleLegend />
      </View>
    </View>
  );
}

function PalateZoneBlob({ cx, cy, r, value }) {
  const normalized = useSharedValue(normalizePressure(value));

  useEffect(() => {
    normalized.value = withTiming(normalizePressure(value), {
      duration: 320,
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
      animatedProps={animatedProps}
      opacity="0.55"
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
