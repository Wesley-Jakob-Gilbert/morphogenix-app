import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function MetricTile({ title, value, unit, accent = colors.teal, onPress, sparkline = [10, 18, 13, 24, 20, 30] }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title} analytics`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.accentDot, { backgroundColor: accent }]} />
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      <Sparkline values={sparkline} color={accent} />
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
    flex: 1,
    minHeight: 126,
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    justifyContent: 'space-between',
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
    fontSize: 27,
    lineHeight: 32,
    fontWeight: typography.weights.bold,
  },
  unit: {
    color: colors.muted,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    marginLeft: spacing.xs,
    marginBottom: 3,
  },
  sparkline: {
    marginTop: spacing.md,
  },
});
