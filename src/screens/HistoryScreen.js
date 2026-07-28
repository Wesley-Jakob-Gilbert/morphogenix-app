import React from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import GlassCard from '../components/GlassCard';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import { haptics } from '../utils/haptics';
// Round 3 #11: default Inter face via AppText wrapper (see App.js note).
import Text from '../components/AppText';

// 14 days of plausible composite wellness scores (0..1)
const HEATMAP = [
  0.62, 0.7, 0.66, 0.74, 0.72, 0.78, 0.76,
  0.81, 0.79, 0.84, 0.82, 0.86, 0.88, 0.91,
];

// Newest first.
// Round 3 #10 (Wes decision on daySub): the label pattern is now uniform.
// The most-recent day carries `isToday` and shows "Today"; every other row
// shows its calendar date (`date`) as the single primary label with no
// sub-line. No mixed "Yesterday" / "Weekend" strings.
const MORPHODAYS = [
  {
    id: 'today',
    isToday: true,
    date: 'Mon Apr 28',
    posture: 87,
    pressure: '0.61 N',
    clench: 3,
    nasal: 94,
    wear: '11h 04m',
  },
  {
    id: 'yesterday',
    date: 'Sun Apr 27',
    posture: 84,
    pressure: '0.65 N',
    clench: 4,
    nasal: 92,
    wear: '10h 38m',
  },
  {
    id: 'd-2',
    date: 'Sat Apr 26',
    posture: 82,
    pressure: '0.63 N',
    clench: 5,
    nasal: 91,
    wear: '9h 52m',
  },
  {
    id: 'd-3',
    date: 'Fri Apr 25',
    posture: 86,
    pressure: '0.64 N',
    clench: 4,
    nasal: 95,
    wear: '11h 22m',
  },
  {
    id: 'd-4',
    date: 'Thu Apr 24',
    posture: 79,
    pressure: '0.71 N',
    clench: 6,
    nasal: 88,
    wear: '10h 14m',
  },
  {
    id: 'd-5',
    date: 'Wed Apr 23',
    posture: 89,
    pressure: '0.58 N',
    clench: 3,
    nasal: 96,
    wear: '12h 03m',
  },
  {
    id: 'd-6',
    date: 'Tue Apr 22',
    posture: 81,
    pressure: '0.69 N',
    clench: 5,
    nasal: 90,
    wear: '10h 47m',
  },
  {
    id: 'd-7',
    date: 'Mon Apr 21',
    posture: 78,
    pressure: '0.72 N',
    clench: 6,
    nasal: 87,
    wear: '9h 30m',
  },
];

// Round 3 #10 — the single composite (0..100) shown per row, and its 0..1 form
// used for the heatmap color/opacity. It blends the four metrics onto a common
// "higher is better" 0..1 scale, then averages:
//   posture / nasal : already 0..100, higher better -> /100
//   clench          : events/hr, lower better -> 1 at 0, 0 at ~15/hr
//   pressure        : comfort band centered on ~1.0 N; distance from the band
//                     center penalizes the score
// Kept pure + exported so the mapping is unit-testable.
export function dayCompositeFraction(day) {
  if (!day) return 0;
  const posture = clamp01((Number(day.posture) || 0) / 100);
  const nasal = clamp01((Number(day.nasal) || 0) / 100);
  const clenchN = clamp01(1 - (Number(day.clench) || 0) / 15);
  const pN = parsePressureN(day.pressure);
  // Comfort center ~1.0 N; full credit inside +-0.5, decaying to 0 by +-1.5.
  const pressure = clamp01(1 - Math.max(0, Math.abs(pN - 1.0) - 0.5) / 1.0);
  return (posture + nasal + clenchN + pressure) / 4;
}

export function dayCompositeScore(day) {
  return Math.round(dayCompositeFraction(day) * 100);
}

function clamp01(x) {
  if (!isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function parsePressureN(value) {
  if (typeof value === 'number') return value;
  const m = String(value == null ? '' : value).match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 1.0;
}

export default function HistoryScreen() {
  return (
    <ImageBackground
      source={require('../../assets/backgrounds/mountains-soft.jpg')}
      resizeMode="cover"
      style={styles.background}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>HISTORY</Text>
          <Text style={styles.title}>Morphodays</Text>
          <Text style={styles.subtitle}>Last 14 days · composite wellness</Text>

          <GlassCard variant="dark" style={styles.heatmapWrap}>
            <Heatmap values={HEATMAP} />
            <View style={styles.heatmapLegend}>
              <Text style={styles.heatmapLegendText}>14d ago</Text>
              <Text style={styles.heatmapLegendText}>Today</Text>
            </View>

            {/* Round 3 #10: a legend so the color/opacity ramp MEANS something.
                A low->high gradient bar + one sentence. */}
            <View style={styles.legendBarRow}>
              <LegendBar />
            </View>
            <View style={styles.legendScale}>
              <Text style={styles.heatmapLegendText}>Lower</Text>
              <Text style={styles.heatmapLegendText}>Higher</Text>
            </View>
            <Text style={styles.legendCaption}>
              Each square is a day's composite wellness score. Brighter, more
              emerald = a stronger day; dimmer, violet = a day to improve.
            </Text>
          </GlassCard>

          <Text style={styles.listHeader}>RECENT</Text>

          {MORPHODAYS.map((day) => (
            <DayRow key={day.id} day={day} />
          ))}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
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

// A tiny three-stop bar (violet -> amber -> emerald) that visually keys the
// heatmap's color meaning for the legend (Round 3 #10).
function LegendBar() {
  return (
    <Svg width="100%" height={8} viewBox="0 0 100 8">
      <Defs>
        <LinearGradient id="historyLegend" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.violet} />
          <Stop offset="0.5" stopColor={colors.amber} />
          <Stop offset="1" stopColor={colors.emerald} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="8" rx="4" fill="url(#historyLegend)" />
    </Svg>
  );
}

// Round 3 #10 — the composite-score -> color mapping, now documented. The score
// is a 0..1 daily wellness composite (see dayCompositeFraction). Color is a
// three-band signal, NOT a decorative ramp:
//   >= 0.85  emerald — a strong day (in range across metrics)
//   >= 0.70  amber   — a middling day, worth a look
//   <  0.70  violet  — a low day to improve
// (This screen predates the stateRed threshold work in #6 and keeps the
// emerald/amber/violet composite ramp deliberately; stateRed stays reserved for
// the live per-metric "improve" state on Home/tiles.)
export function compositeColor(v) {
  if (v >= 0.85) return colors.emerald;
  if (v >= 0.7) return colors.amber;
  return colors.violet;
}

function DayRow({ day }) {
  // Round 3 #4 + Wes decision #3: the row press was dead (depressed, went
  // nowhere). A day-detail screen is deferred, so for now fire a selection
  // tick on press-in and keep the visual press feedback — the gesture no
  // longer feels broken.
  // Round 3 #10: rows used to show four metric chips each, which was noisy and
  // implied tappable drill-down that doesn't exist. Collapse to ONE composite
  // score + a single color dot per row (per Wes decision #3, we are NOT
  // building the day-detail view this round). The uniform label pattern:
  // "Today" for the latest day, otherwise the calendar date — no sub-line.
  const fraction = dayCompositeFraction(day);
  const score = dayCompositeScore(day);
  const dotColor = compositeColor(fraction);
  const primaryLabel = day.isToday ? 'Today' : day.date;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${primaryLabel}, composite score ${score}, worn ${day.wear}`}
      onPressIn={() => haptics.selection()}
      style={({ pressed }) => [styles.rowPressable, pressed && styles.rowPressed]}
    >
      <GlassCard variant="dark" borderRadius={14} style={styles.row}>
        <View style={styles.rowHead}>
          <Text style={styles.dayLabel}>{primaryLabel}</Text>
          <Text style={styles.wear}>Worn {day.wear}</Text>
        </View>

        <View style={styles.compositeRow}>
          <View style={[styles.compositeDot, { backgroundColor: dotColor }]} />
          <Text style={styles.compositeScore}>{score}</Text>
          <Text style={styles.compositeUnit}>/ 100</Text>
          <Text style={styles.compositeLabel}>composite</Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    // Clear the floating frosted tab bar (#3): content scrolls UNDER it.
    paddingBottom: 90,
  },
  kicker: {
    color: colors.emeraldDeep,
    fontSize: typography.sizes.tiny,
    fontFamily: typography.family.bold,
    letterSpacing: 1.4,
  },
  title: {
    color: colors.stoneDark,
    fontSize: typography.sizes.display,
    lineHeight: typography.lineHeights.display,
    fontFamily: typography.familyDisplay,
    letterSpacing: -0.5,
    marginTop: spacing.xs,
    textShadowColor: 'rgba(255, 255, 255, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitle: {
    color: colors.stoneDark,
    fontSize: typography.sizes.caption,
    fontFamily: typography.family.semibold,
    marginTop: spacing.xs,
  },
  heatmapWrap: {
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
    color: colors.stone,
    fontSize: typography.sizes.tiny,
  },
  // Round 3 #10 heatmap legend.
  legendBarRow: {
    marginTop: spacing.md,
  },
  legendScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  legendCaption: {
    color: colors.snowSoft,
    fontSize: typography.sizes.tiny,
    lineHeight: typography.lineHeights.caption,
    marginTop: spacing.sm,
  },
  listHeader: {
    // Matched to AccountScreen sectionHeader spec for cross-screen consistency.
    color: colors.snow,
    fontSize: typography.sizes.caption,
    fontFamily: typography.familyDisplay,
    letterSpacing: 1.6,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    textShadowColor: 'rgba(11, 18, 32, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  rowPressable: {
    marginBottom: spacing.sm,
  },
  rowPressed: {
    opacity: 0.78,
  },
  row: {
    padding: spacing.md,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dayLabel: {
    color: colors.snow,
    fontSize: typography.sizes.callout,
    fontWeight: typography.weights.bold,
  },
  wear: {
    color: colors.snowSoft,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
  },
  // Round 3 #10: single composite indicator replacing the 4 metric chips.
  compositeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.sm,
  },
  compositeDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    marginRight: spacing.sm,
    alignSelf: 'center',
  },
  compositeScore: {
    color: colors.snow,
    fontSize: typography.sizes.title,
    fontFamily: typography.familyDisplay,
    letterSpacing: -0.5,
  },
  compositeUnit: {
    color: colors.stone,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    marginLeft: spacing.xs,
  },
  compositeLabel: {
    color: colors.stone,
    fontSize: typography.sizes.tiny,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginLeft: spacing.sm,
  },
});
