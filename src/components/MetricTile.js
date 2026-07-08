import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Polyline, RadialGradient, Rect, Stop } from 'react-native-svg';

import colors from '../theme/colors';
import { getMetricColor } from '../theme/metricState';
import spacing from '../theme/spacing';
import { elevatedCard } from '../theme/surfaces';
import typography from '../theme/typography';
import { haptics } from '../utils/haptics';

// Round 3 #1: SVG element `id`s must be safe across renderers. Titles like
// "Palatal Pressure" previously produced ids with spaces (`sheen-Palatal
// Pressure`), which is fragile. Slugify to lowercase alphanumerics + dashes and
// guarantee a non-empty fallback so `url(#...)` always resolves.
export function slugify(str) {
  const slug = String(str == null ? '' : str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'tile';
}

// Round 3 #5: `sparkline` is now OPTIONAL. A tile only draws a sparkline when it
// has a real underlying time-series (>= 2 samples); tiles without real data omit
// the prop entirely rather than showing a fake, frozen chart. No default array.
// Round 3 #6: color is now STATE, not decoration. When `title` names a known
// metric (Posture / Pressure / Clench / Nasal), the tile's accent is derived
// from the value via the locked thresholds (teal/amber/stateRed). The `accent`
// prop is only a fallback for unknown metrics; `stateColorEnabled={false}` opts
// a tile out and keeps the passed accent (used by tests / non-metric tiles).
export default function MetricTile({
  title,
  value,
  unit,
  accent = colors.teal,
  onPress,
  sparkline,
  stateColorEnabled = true,
}) {
  const stateColor = stateColorEnabled ? getMetricColor(title, value) : null;
  const resolvedAccent = stateColor || accent;
  const hasSparkline = Array.isArray(sparkline) && sparkline.length >= 2;
  const sheenId = `sheen-${slugify(title)}`;
  // Round 3 #4: the tile is the primary gesture on Home and was silent. Fire a
  // selection tick on press-in (not on release) so the feedback lands the
  // instant the finger touches, matching Apple/Oura tactile timing.
  const onPressIn = () => {
    haptics.selection();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title} analytics`}
      onPress={onPress}
      onPressIn={onPressIn}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      {/* Faint radial sheen tinted by the tile accent — gives the flat surface
          a subtle Oura-style depth without changing the locked palette. Sits
          behind the content and ignores touches. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id={sheenId} cx="18%" cy="0%" r="90%">
              <Stop offset="0" stopColor={resolvedAccent} stopOpacity="0.10" />
              <Stop offset="1" stopColor={resolvedAccent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx="22" fill={`url(#${sheenId})`} />
        </Svg>
      </View>

      <View style={styles.topRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.accentDot, { backgroundColor: resolvedAccent }]} />
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {hasSparkline ? <Sparkline values={sparkline} color={resolvedAccent} /> : null}
    </Pressable>
  );
}

function Sparkline({ values, color }) {
  const width = 112;
  const height = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const range = max - min || 1;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Svg width="100%" height="30" viewBox={`0 0 ${width} ${height}`} style={styles.sparkline}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  tile: {
    // Round 3 #3: this is the canonical elevated material (surfaceElevated +
    // ink hairline + soft multi-layer shadow), now sourced from the shared
    // helper so all card surfaces stay in lockstep.
    ...elevatedCard,
    flex: 1,
    minHeight: 126,
    borderRadius: 22,
    padding: spacing.lg,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  value: {
    color: colors.white,
    fontSize: 28,
    lineHeight: 32,
    // Big numeral → Inter Black display face (Roadmap V2 #1). The display face
    // carries the weight; numeric fontWeight dropped (Round 3 #8).
    fontFamily: typography.familyDisplay,
    letterSpacing: -0.5,
  },
  unit: {
    color: colors.muted,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    marginLeft: spacing.xs,
    marginBottom: spacing.xxs,
  },
  sparkline: {
    marginTop: spacing.md,
  },
});
