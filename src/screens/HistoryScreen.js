import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { elevatedCard } from '../theme/surfaces';
import typography from '../theme/typography';
import { haptics } from '../utils/haptics';

// 14 days of plausible composite wellness scores (0..1)
const HEATMAP = [
  0.62, 0.7, 0.66, 0.74, 0.72, 0.78, 0.76,
  0.81, 0.79, 0.84, 0.82, 0.86, 0.88, 0.91,
];

// Newest first
const MORPHODAYS = [
  {
    id: 'today',
    label: 'Today',
    sub: 'Mon Apr 28',
    posture: 87,
    pressure: '0.61 N',
    clench: 3,
    nasal: 94,
    wear: '11h 04m',
  },
  {
    id: 'yesterday',
    label: 'Yesterday',
    sub: 'Sun Apr 27',
    posture: 84,
    pressure: '0.65 N',
    clench: 4,
    nasal: 92,
    wear: '10h 38m',
  },
  {
    id: 'd-2',
    label: 'Sat Apr 26',
    sub: 'Weekend',
    posture: 82,
    pressure: '0.63 N',
    clench: 5,
    nasal: 91,
    wear: '9h 52m',
  },
  {
    id: 'd-3',
    label: 'Fri Apr 25',
    sub: '',
    posture: 86,
    pressure: '0.64 N',
    clench: 4,
    nasal: 95,
    wear: '11h 22m',
  },
  {
    id: 'd-4',
    label: 'Thu Apr 24',
    sub: '',
    posture: 79,
    pressure: '0.71 N',
    clench: 6,
    nasal: 88,
    wear: '10h 14m',
  },
  {
    id: 'd-5',
    label: 'Wed Apr 23',
    sub: '',
    posture: 89,
    pressure: '0.58 N',
    clench: 3,
    nasal: 96,
    wear: '12h 03m',
  },
  {
    id: 'd-6',
    label: 'Tue Apr 22',
    sub: '',
    posture: 81,
    pressure: '0.69 N',
    clench: 5,
    nasal: 90,
    wear: '10h 47m',
  },
  {
    id: 'd-7',
    label: 'Mon Apr 21',
    sub: '',
    posture: 78,
    pressure: '0.72 N',
    clench: 6,
    nasal: 87,
    wear: '9h 30m',
  },
];

export default function HistoryScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>HISTORY</Text>
        <Text style={styles.title}>Morphodays</Text>
        <Text style={styles.subtitle}>Last 14 days · composite wellness</Text>

        <View style={styles.heatmapWrap}>
          <Heatmap values={HEATMAP} />
          <View style={styles.heatmapLegend}>
            <Text style={styles.heatmapLegendText}>14d ago</Text>
            <Text style={styles.heatmapLegendText}>Today</Text>
          </View>
        </View>

        <Text style={styles.listHeader}>Recent</Text>

        {MORPHODAYS.map((day) => (
          <DayRow key={day.id} day={day} />
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Heatmap({ values }) {
  const cellSize = 22;
  const gap = 4;
  const width = values.length * cellSize + (values.length - 1) * gap;
  const height = cellSize;

  return (
    <Svg width="100%" height={cellSize} viewBox={`0 0 ${width} ${height}`}>
      {values.map((v, i) => {
        const x = i * (cellSize + gap);
        // Map 0..1 to teal->amber->violet color stops
        const color = compositeColor(v);
        return (
          <Rect
            key={i}
            x={x}
            y={0}
            width={cellSize}
            height={cellSize}
            rx={5}
            fill={color}
            opacity={0.4 + v * 0.55}
          />
        );
      })}
    </Svg>
  );
}

function compositeColor(v) {
  if (v >= 0.85) return colors.teal;
  if (v >= 0.7) return colors.amber;
  return colors.violet;
}

function DayRow({ day }) {
  // Round 3 #4 + Wes decision #3: the row press was dead (depressed, went
  // nowhere). A day-detail screen is deferred, so for now fire a selection
  // tick on press-in and keep the visual press feedback — the gesture no
  // longer feels broken.
  return (
    <Pressable
      accessibilityRole="button"
      onPressIn={() => haptics.selection()}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowHead}>
        <View>
          <Text style={styles.dayLabel}>{day.label}</Text>
          {day.sub ? <Text style={styles.daySub}>{day.sub}</Text> : null}
        </View>
        <Text style={styles.wear}>Worn {day.wear}</Text>
      </View>

      <View style={styles.chipRow}>
        <Chip label={`Posture ${day.posture}`} accent={colors.teal} />
        <Chip label={`Pressure ${day.pressure}`} accent={colors.amber} />
        <Chip label={`Clench ${day.clench}`} accent={colors.violet} />
        <Chip label={`Nasal ${day.nasal}%`} accent={colors.teal} />
      </View>
    </Pressable>
  );
}

function Chip({ label, accent }) {
  return (
    <View style={[styles.chip, { borderColor: accent + '55' }]}>
      <View style={[styles.chipDot, { backgroundColor: accent }]} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.navy },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    // Clear the floating frosted tab bar (#3): content scrolls UNDER it.
    paddingBottom: 90,
  },
  kicker: {
    color: colors.teal,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.4,
  },
  title: {
    color: colors.white,
    fontSize: typography.sizes.hero,
    lineHeight: typography.lineHeights.hero,
    // Named Inter family carries the weight (Round 3 #8).
    fontFamily: typography.family.bold,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    marginTop: spacing.xs,
  },
  heatmapWrap: {
    // Round 3 #3: unify the heatmap strip container on the elevated material.
    ...elevatedCard,
    marginTop: spacing.lg,
    borderRadius: 18,
    padding: spacing.md,
  },
  heatmapLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  heatmapLegendText: {
    color: colors.muted,
    fontSize: typography.sizes.tiny,
  },
  listHeader: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.2,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  row: {
    // Round 3 #3: was flat `colors.surface` + rgba hairline. Unify on the
    // elevated card material so History rows read like Home cards, not a
    // to-do list.
    ...elevatedCard,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowPressed: {
    opacity: 0.78,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dayLabel: {
    color: colors.white,
    fontSize: typography.sizes.callout,
    fontWeight: typography.weights.bold,
  },
  daySub: {
    color: colors.muted,
    fontSize: typography.sizes.tiny,
    marginTop: spacing.xxs,
  },
  wear: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 6,
    marginTop: 6,
    backgroundColor: colors.navy,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 6,
    marginRight: 6,
  },
  chipText: {
    color: colors.white,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
  },
});
