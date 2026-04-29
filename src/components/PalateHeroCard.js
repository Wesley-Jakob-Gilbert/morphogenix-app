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
  ClipPath,
  Defs,
  G,
  Path,
  Rect,
} from 'react-native-svg';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import ColorScaleLegend from './ColorScaleLegend';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// Discrete 4x4 grid mirroring the 16 FSR sensors on the device.
// Cells are clipped to a half-oval dome so the corner cells get cropped naturally.
//
// viewBox: 0 0 280 200. Dome bounding box: x in [30..250] (W=220), y in [25..185] (H=160).
const DOME_PATH =
  'M30 185 C30 95, 80 25, 140 25 C200 25, 250 95, 250 185 L30 185 Z';

const GRID_X = 30;
const GRID_Y = 25;
const GRID_W = 220;
const GRID_H = 160;
const COLS = 4;
const ROWS = 4;
const GAP = 4;
const CELL_W = (GRID_W - GAP * (COLS + 1)) / COLS;
const CELL_H = (GRID_H - GAP * (ROWS + 1)) / ROWS;

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

            {/* Discrete 4x4 sensor grid, clipped to the dome */}
            <G clipPath="url(#palate-clip)">
              {palate.map((value, index) => {
                const col = index % COLS;
                const row = Math.floor(index / COLS);
                const x = GRID_X + GAP + col * (CELL_W + GAP);
                const y = GRID_Y + GAP + row * (CELL_H + GAP);
                return (
                  <PalateCell
                    key={`cell-${index}`}
                    x={x}
                    y={y}
                    width={CELL_W}
                    height={CELL_H}
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

function PalateCell({ x, y, width, height, value }) {
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
    <AnimatedRect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={3}
      ry={3}
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
