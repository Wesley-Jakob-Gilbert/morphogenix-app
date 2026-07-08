import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { elevatedCard } from '../theme/surfaces';
import typography from '../theme/typography';
import { haptics } from '../utils/haptics';

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
];

// Plausible numbers per period — varied so it feels like real data
const DATA = {
  today: {
    posture: {
      hero: '87/100',
      delta: '↑ 3 vs yesterday',
      deltaPositive: true,
      spark: [78, 82, 80, 84, 86, 85, 88, 87, 89, 87, 90, 87],
      stats: [
        ['Time below 70', '22m'],
        ['Best hour', '9–10am'],
        ['Avg slouch depth', '12°'],
      ],
      meaning: 'Your posture is trending up — strong morning, slight afternoon dip.',
    },
    pressure: {
      hero: '0.61 N',
      delta: '↓ 0.04 N vs yesterday',
      deltaPositive: true,
      spark: [62, 70, 65, 58, 55, 60, 64, 61, 59, 63, 60, 61],
      stats: [
        ['Peak load', '1.42 N at 2:14pm'],
        ['Time above 1.0 N', '11m'],
        ['Quietest zone', 'Anterior right'],
      ],
      meaning: 'Pressure is well within your comfort band — fewer high-load spikes than yesterday.',
    },
    clench: {
      hero: '3 / hr',
      delta: '↓ 1 vs yesterday',
      deltaPositive: true,
      spark: [4, 5, 3, 6, 4, 3, 2, 3, 4, 3, 3, 3],
      stats: [
        ['Total events', '34 today'],
        ['Longest event', '4.2 s'],
        ['Stress window', '3:00–4:00 pm'],
      ],
      meaning: 'Clenching frequency is down — keep an eye on the late-afternoon window.',
    },
    nasal: {
      hero: '94 %',
      delta: '↑ 2 % vs yesterday',
      deltaPositive: true,
      spark: [88, 90, 92, 91, 93, 94, 95, 94, 96, 95, 94, 94],
      stats: [
        ['Mouth-breath minutes', '38m'],
        ['Best block', '11pm–6am'],
        ['Recovery score', '8.4 / 10'],
      ],
      meaning: 'Strong nasal dominance overnight — recovery indicators are healthy.',
    },
  },
  '7d': {
    posture: {
      hero: '83/100',
      delta: '↑ 5 vs prior 7d',
      deltaPositive: true,
      spark: [76, 79, 81, 80, 84, 82, 85, 83, 86, 84, 87, 83],
      stats: [
        ['Days above target', '5 of 7'],
        ['Best day', 'Wed (89)'],
        ['Avg slouch depth', '14°'],
      ],
      meaning: 'You hit your 80/100 posture target on 5 of 7 days this week.',
    },
    pressure: {
      hero: '0.66 N',
      delta: '↓ 0.03 N vs prior 7d',
      deltaPositive: true,
      spark: [70, 68, 72, 65, 67, 64, 66, 68, 65, 63, 66, 66],
      stats: [
        ['Avg peak/day', '1.38 N'],
        ['Highest day', 'Mon'],
        ['Quietest day', 'Sat'],
      ],
      meaning: 'Weekly pressure load is easing — weekends are notably lighter.',
    },
    clench: {
      hero: '4 / hr',
      delta: '↓ 0.5 vs prior 7d',
      deltaPositive: true,
      spark: [5, 6, 4, 5, 3, 4, 4, 5, 4, 3, 4, 4],
      stats: [
        ['Total events', '296 this week'],
        ['Worst day', 'Tue'],
        ['Calmest day', 'Sun'],
      ],
      meaning: 'Trending down — your weekday peaks are softening.',
    },
    nasal: {
      hero: '91 %',
      delta: '↑ 3 % vs prior 7d',
      deltaPositive: true,
      spark: [85, 87, 88, 90, 92, 91, 93, 91, 92, 90, 91, 91],
      stats: [
        ['Avg overnight', '96 %'],
        ['Best night', 'Fri'],
        ['Recovery streak', '4 nights'],
      ],
      meaning: 'Nasal breathing is improving — your sleep recovery streak is at 4 nights.',
    },
  },
  '30d': {
    posture: {
      hero: '81/100',
      delta: '↑ 7 vs prior 30d',
      deltaPositive: true,
      spark: [70, 72, 75, 74, 76, 78, 80, 82, 81, 83, 82, 81],
      stats: [
        ['Days above target', '19 of 30'],
        ['Trend', 'Improving'],
        ['Avg slouch depth', '15°'],
      ],
      meaning: 'Clear month-over-month improvement — keep the morning routine.',
    },
    pressure: {
      hero: '0.69 N',
      delta: '↓ 0.06 N vs prior 30d',
      deltaPositive: true,
      spark: [78, 76, 74, 72, 70, 71, 69, 68, 70, 67, 69, 69],
      stats: [
        ['Days above 1.0 N peak', '11'],
        ['Quietest week', 'Week 3'],
        ['Trend', 'Decreasing'],
      ],
      meaning: 'Average load is down 8% over the month — sustained progress.',
    },
    clench: {
      hero: '5 / hr',
      delta: '↓ 1.2 vs prior 30d',
      deltaPositive: true,
      spark: [7, 6, 6, 5, 5, 6, 4, 5, 5, 4, 5, 5],
      stats: [
        ['Total events', '1,284'],
        ['Stress days', '6 of 30'],
        ['Trend', 'Decreasing'],
      ],
      meaning: 'Stress clenching days are dropping — fewer than 1 in 5 days now.',
    },
    nasal: {
      hero: '89 %',
      delta: '↑ 5 % vs prior 30d',
      deltaPositive: true,
      spark: [80, 82, 84, 85, 87, 88, 89, 90, 89, 91, 90, 89],
      stats: [
        ['Days above 90 %', '18'],
        ['Recovery avg', '8.1 / 10'],
        ['Trend', 'Improving'],
      ],
      meaning: 'Nasal-dominant breathing is now your norm — strong overnight pattern.',
    },
  },
};

const SECTION_META = [
  // `target` (in the same 0..100-ish units as `spark`) draws a faint 1px guide
  // line where a meaningful goal exists (Round 3 #7). Posture goal is 80;
  // nasal ~90. Pressure/Clench have no single "target" line so it's omitted.
  { id: 'posture', title: 'Posture', accent: colors.teal, target: 80 },
  { id: 'pressure', title: 'Pressure', accent: colors.amber },
  { id: 'clench', title: 'Clench', accent: colors.violet },
  { id: 'nasal', title: 'Nasal', accent: colors.teal, target: 90 },
];

// Draw-on timing (Round 3 #7). Restrained per Wes decision #5 — chart draw-on
// is the ONLY chart motion. ~600ms, eased out.
export const CHART_DRAW_MS = 600;

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export default function AnalyticsScreen({ route }) {
  const anchor = route?.params?.anchor;
  const [period, setPeriod] = useState('today');
  const scrollRef = useRef(null);
  const sectionOffsets = useRef({});

  const data = DATA[period];

  // Round 3 #4: period-pill changes were silent. Fire a selection tick on an
  // actual change (no tick when tapping the already-active pill).
  const onSelectPeriod = (id) => {
    if (id === period) return;
    haptics.selection();
    setPeriod(id);
  };

  useEffect(() => {
    if (!anchor) return;
    const t = setTimeout(() => {
      const y = sectionOffsets.current[anchor];
      if (typeof y === 'number' && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [anchor]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>ANALYTICS</Text>
        <Text style={styles.title}>Your trends</Text>

        <View style={styles.pillRow}>
          {PERIODS.map((p) => {
            const active = p.id === period;
            return (
              <Pressable
                key={p.id}
                onPress={() => onSelectPeriod(p.id)}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {SECTION_META.map((meta) => (
          <View
            key={meta.id}
            onLayout={(e) => {
              sectionOffsets.current[meta.id] = e.nativeEvent.layout.y;
            }}
          >
            <AnalyticsSection
              meta={meta}
              data={data[meta.id]}
              chartKind={meta.id === 'clench' ? 'bar' : 'line'}
            />
          </View>
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function AnalyticsSection({ meta, data, chartKind }) {
  return (
    <View style={[styles.section, { borderLeftColor: meta.accent }]}> 
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionEyebrow, { color: meta.accent }]}>{meta.title.toUpperCase()}</Text>
        <View style={[styles.accentDot, { backgroundColor: meta.accent }]} />
      </View>

      <Text style={styles.heroNumber}>{data.hero}</Text>
      <Text style={[styles.delta, { color: data.deltaPositive ? colors.teal : colors.amber }]}>
        {data.delta}
      </Text>

      <View style={styles.chartWrap}>
        {chartKind === 'bar' ? (
          <BarChart values={data.spark} color={meta.accent} slug={meta.id} />
        ) : (
          <LineChart
            values={data.spark}
            color={meta.accent}
            slug={meta.id}
            target={meta.target}
          />
        )}
      </View>

      <View style={styles.statList}>
        {data.stats.map(([label, value]) => (
          <View key={label} style={styles.statRow}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.meaning}>{data.meaning}</Text>
    </View>
  );
}

// --- Pure chart geometry (Round 3 #7) --------------------------------------
// Kept as exported pure functions so the layout math is unit-testable without
// rendering SVG or reanimated.

const CHART_W = 320;
const CHART_H = 80;
const CHART_PAD_X = 6;
const CHART_PAD_Y = 8;

// Map a data series into { points:[{x,y}], min, max } in chart space.
export function chartPoints(values, width = CHART_W, height = CHART_H, padX = CHART_PAD_X, padY = CHART_PAD_Y) {
  const arr = Array.isArray(values) && values.length ? values : [0];
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  const range = max - min || 1;
  const denom = arr.length > 1 ? arr.length - 1 : 1;
  const stepX = (width - padX * 2) / denom;
  const pts = arr.map((v, i) => ({
    x: padX + i * stepX,
    y: height - padY - ((v - min) / range) * (height - padY * 2),
  }));
  return { points: pts, min, max, range };
}

// Points -> "x,y x,y ..." polyline string.
export function polylineString(points) {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

// Closed area path (line -> down to baseline -> back) for the gradient fill.
export function areaPathString(points, height = CHART_H, padY = CHART_PAD_Y) {
  if (!points.length) return '';
  const baseY = height - padY;
  const head = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  const line = points.slice(1).map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const close = `L ${last.x.toFixed(1)} ${baseY} L ${points[0].x.toFixed(1)} ${baseY} Z`;
  return `${head} ${line} ${close}`;
}

// The y (chart space) for a `target` value given the series min/max window.
export function targetY(target, min, max, height = CHART_H, padY = CHART_PAD_Y) {
  if (typeof target !== 'number') return null;
  const range = max - min || 1;
  const y = height - padY - ((target - min) / range) * (height - padY * 2);
  // Only show it if it lands inside the plotted band (clamp guard).
  if (y < padY || y > height - padY) return null;
  return y;
}

// Total polyline length estimate (sum of segment lengths) — used to size the
// draw-on strokeDasharray reveal.
export function polylineLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

function LineChart({ values, color, slug = 'line', target }) {
  const { points, min, max } = chartPoints(values);
  const pointsStr = polylineString(points);
  const areaStr = areaPathString(points);
  const totalLen = Math.max(1, polylineLength(points));
  const last = points[points.length - 1];
  const baseY = CHART_H - CHART_PAD_Y;
  const tY = targetY(target, min, max);

  const fillId = `area-${slug}`;
  const haloId = `halo-${slug}`;

  // Draw-on reveal (Round 3 #7 / Wes decision #5 — restrained, chart-only).
  // progress 0..1 drives a strokeDashoffset from full length -> 0. Reduce-motion
  // snaps to fully drawn.
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.value = 1;
      return undefined;
    }
    cancelAnimation(progress);
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: CHART_DRAW_MS,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(progress);
    // Redraw when the plotted series changes.
  }, [reduceMotion, progress, pointsStr]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: totalLen * (1 - progress.value),
  }), [totalLen]);

  return (
    <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      <Defs>
        {/* teal/accent -> transparent vertical area fill */}
        <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.28" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
        {/* soft halo behind the end dot */}
        <RadialGradient id={haloId} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity="0.45" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Area fill under the line */}
      <Path d={areaStr} fill={`url(#${fillId})`} stroke="none" />

      {/* Faint baseline at the series min */}
      <Line
        x1={CHART_PAD_X}
        y1={baseY}
        x2={CHART_W - CHART_PAD_X}
        y2={baseY}
        stroke={colors.white}
        strokeWidth="1"
        opacity="0.08"
      />

      {/* 1px target guide where relevant (e.g. posture 80) */}
      {tY != null ? (
        <Line
          x1={CHART_PAD_X}
          y1={tY}
          x2={CHART_W - CHART_PAD_X}
          y2={tY}
          stroke={colors.white}
          strokeWidth="1"
          strokeDasharray="3 4"
          opacity="0.22"
        />
      ) : null}

      {/* The trend line, revealed left-to-right */}
      <AnimatedPolyline
        points={pointsStr}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={totalLen}
        animatedProps={lineProps}
      />

      {/* End dot + halo */}
      <Circle cx={last.x} cy={last.y} r="7" fill={`url(#${haloId})`} />
      <Circle cx={last.x} cy={last.y} r="3" fill={color} />
    </Svg>
  );
}

function BarChart({ values, color, slug = 'bar' }) {
  const arr = Array.isArray(values) && values.length ? values : [0];
  const max = Math.max(...arr);
  const barGap = 4;
  const barWidth = (CHART_W - CHART_PAD_X * 2 - (arr.length - 1) * barGap) / arr.length;
  const baseY = CHART_H - CHART_PAD_Y;
  const fillId = `bararea-${slug}`;

  // Draw-on: bars grow up from the baseline together. Reduce-motion snaps full.
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.value = 1;
      return undefined;
    }
    cancelAnimation(progress);
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: CHART_DRAW_MS,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(progress);
  }, [reduceMotion, progress, arr.length, max]);

  return (
    <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      <Defs>
        <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.95" />
          <Stop offset="1" stopColor={color} stopOpacity="0.45" />
        </LinearGradient>
      </Defs>

      {/* Faint baseline */}
      <Line
        x1={CHART_PAD_X}
        y1={baseY}
        x2={CHART_W - CHART_PAD_X}
        y2={baseY}
        stroke={colors.white}
        strokeWidth="1"
        opacity="0.08"
      />

      {arr.map((v, i) => {
        const fullH = ((v / (max || 1)) * (CHART_H - CHART_PAD_Y * 2)) || 2;
        const x = CHART_PAD_X + i * (barWidth + barGap);
        return (
          <AnimatedBar
            key={i}
            x={x}
            baseY={baseY}
            width={barWidth}
            fullHeight={fullH}
            fill={`url(#${fillId})`}
            progress={progress}
          />
        );
      })}
    </Svg>
  );
}

// A single bar that grows from the baseline as `progress` 0..1 advances.
function AnimatedBar({ x, baseY, width, fullHeight, fill, progress }) {
  const barProps = useAnimatedProps(() => {
    const h = fullHeight * progress.value;
    return { y: baseY - h, height: h };
  }, [fullHeight, baseY]);
  return (
    <AnimatedRect
      x={x}
      width={width}
      rx={2}
      fill={fill}
      animatedProps={barProps}
    />
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
    // Named Inter family carries the weight (Round 3 #8 — dropped no-op
    // numeric fontWeight).
    fontFamily: typography.family.bold,
    marginTop: spacing.xs,
  },
  pillRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 999,
    padding: 4,
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
  },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: colors.navy,
  },
  pillText: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
  },
  pillTextActive: {
    color: colors.teal,
  },
  section: {
    // Round 3 #3: was flat `colors.surface` (the "before" material). Unify on
    // the elevated card so it matches Home. KEEP the 3px accent left border
    // (it's the section's identity) — elevatedCard sets a full 1px ink border,
    // then we override the left edge to the accent color + width below.
    ...elevatedCard,
    borderRadius: 22,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderLeftWidth: 3,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.4,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  heroNumber: {
    color: colors.white,
    // Round 3 #2: the biggest number on this screen was falling back to Inter
    // Regular at a bold weight (no `fontFamily`) instead of the Inter Black
    // display cut used by the ScoreRing / MetricTile heroes. Route it through
    // the display face so hero numerals are consistent across tabs. Size/line
    // land on the new heroNumber scale token (#8) instead of magic 38/44.
    fontFamily: typography.familyDisplay,
    fontSize: typography.sizes.heroNumber,
    lineHeight: typography.lineHeights.heroNumber,
    letterSpacing: -0.5,
    marginTop: spacing.sm,
  },
  delta: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    marginTop: spacing.xs,
  },
  chartWrap: {
    marginTop: spacing.md,
  },
  statList: {
    marginTop: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
  },
  statValue: {
    color: colors.white,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
  },
  meaning: {
    // Round 3 #8: dropped `fontStyle: 'italic'` (the bundled Inter face has no
    // italic cut, so it rendered as a faux/again-regular slant). Read as calm
    // muted body copy with a touch more line-height instead.
    color: colors.muted,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.body,
    marginTop: spacing.md,
  },
});
