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
import Svg, { G, Path } from 'react-native-svg';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import ColorScaleLegend from './ColorScaleLegend';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const ZONES = [
  'M68 82 C74 54 91 33 117 24 L117 86 L68 86 Z',
  'M123 24 C149 33 166 54 172 82 L123 86 Z',
  'M48 122 C51 102 57 89 68 82 L117 86 L117 127 Z',
  'M123 86 L172 82 C183 89 189 102 192 122 L123 127 Z',
  'M38 163 C38 145 41 132 48 122 L117 127 L117 168 Z',
  'M123 127 L192 122 C199 132 202 145 202 163 L123 168 Z',
  'M45 207 C40 192 38 178 38 163 L117 168 L117 212 Z',
  'M123 168 L202 163 C202 178 200 192 195 207 L123 212 Z',
  'M60 245 C54 232 49 220 45 207 L117 212 L117 250 Z',
  'M123 212 L195 207 C191 220 186 232 180 245 L123 250 Z',
  'M82 274 C73 265 66 255 60 245 L117 250 L117 280 Z',
  'M123 250 L180 245 C174 255 167 265 158 274 L123 280 Z',
  'M96 294 C91 289 86 283 82 274 L117 280 L117 304 Z',
  'M123 280 L158 274 C154 283 149 289 144 294 L123 304 Z',
  'M107 312 C102 308 99 302 96 294 L117 304 L117 320 Z',
  'M123 304 L144 294 C141 302 138 308 133 312 L123 320 Z',
];

export default function PalateHeroCard({ packet, isStreaming }) {
  const palate = Array.isArray(packet?.palate) && packet.palate.length === 16 ? packet.palate : fallbackPalate();
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
          <Svg width="100%" height="100%" viewBox="0 0 240 340">
            <Path
              d="M34 210 C31 135 43 77 78 44 C101 22 139 22 162 44 C197 77 209 135 206 210 C204 267 165 320 120 326 C75 320 36 267 34 210 Z"
              fill={colors.navy}
              stroke={colors.white}
              strokeOpacity="0.18"
              strokeWidth="3"
            />
            <Path d="M120 29 L120 320" stroke={colors.white} strokeOpacity="0.16" strokeWidth="2" />
            <G stroke={colors.navy} strokeWidth="3" strokeLinejoin="round">
              {ZONES.map((path, index) => (
                <PalateZone key={path} path={path} value={palate[index]} />
              ))}
            </G>
            <Path
              d="M63 218 C64 170 75 132 95 106"
              stroke={colors.white}
              strokeOpacity="0.38"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d="M177 218 C176 170 165 132 145 106"
              stroke={colors.white}
              strokeOpacity="0.38"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </View>
        <ColorScaleLegend />
      </View>
    </View>
  );
}

function PalateZone({ path, value }) {
  const normalized = useSharedValue(normalizePressure(value));

  useEffect(() => {
    normalized.value = withTiming(normalizePressure(value), {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, normalized]);

  const animatedProps = useAnimatedProps(() => ({
    fill: interpolateColor(
      normalized.value,
      [0, 0.64, 1],
      [colors.teal, colors.amber, colors.violet]
    ),
  }));

  return <AnimatedPath d={path} animatedProps={animatedProps} opacity="0.94" />;
}

function normalizePressure(newtons) {
  const safeValue = typeof newtons === 'number' ? newtons : 0.55;
  return Math.max(0, Math.min(1, safeValue));
}

function fallbackPalate() {
  return [0.58, 0.6, 0.56, 0.62, 0.55, 0.64, 0.52, 0.59, 0.5, 0.57, 0.48, 0.54, 0.46, 0.51, 0.44, 0.49];
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
    minHeight: 320,
    flexDirection: 'row',
    alignItems: 'center',
  },
  svgWrap: {
    flex: 1,
    height: 320,
  },
});
