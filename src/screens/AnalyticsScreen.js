import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Rect, Circle } from 'react-native-svg';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

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
  { id: 'posture', title: 'Posture', accent: colors.teal },
  { id: 'pressure', title: 'Pressure', accent: colors.amber },
  { id: 'clench', title: 'Clench', accent: colors.violet },
  { id: 'nasal', title: 'Nasal', accent: colors.teal },
];

export default function AnalyticsScreen({ route }) {
  const anchor = route?.params?.anchor;
  const [period, setPeriod] = useState('today');
  const scrollRef = useRef(null);
  const sectionOffsets = useRef({});

  const data = DATA[period];

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
                onPress={() => setPeriod(p.id)}
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
          <BarChart values={data.spark} color={meta.accent} />
        ) : (
          <LineChart values={data.spark} color={meta.accent} />
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

function LineChart({ values, color }) {
  const width = 320;
  const height = 80;
  const padX = 6;
  const padY = 8;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = (width - padX * 2) / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = padX + i * stepX;
      const y = height - padY - ((v - min) / range) * (height - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastY =
    height - padY - ((values[values.length - 1] - min) / range) * (height - padY * 2);
  const lastX = padX + (values.length - 1) * stepX;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <Circle cx={lastX} cy={lastY} r="3.5" fill={color} />
    </Svg>
  );
}

function BarChart({ values, color }) {
  const width = 320;
  const height = 80;
  const padX = 6;
  const padY = 8;
  const max = Math.max(...values);
  const barGap = 4;
  const barWidth = (width - padX * 2 - (values.length - 1) * barGap) / values.length;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {values.map((v, i) => {
        const h = ((v / max) * (height - padY * 2)) || 2;
        const x = padX + i * (barWidth + barGap);
        const y = height - padY - h;
        return (
          <Rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx={2}
            fill={color}
            opacity={0.85}
          />
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.navy },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
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
    fontWeight: typography.weights.bold,
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
    backgroundColor: colors.surface,
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
    fontSize: 38,
    lineHeight: 44,
    fontWeight: typography.weights.bold,
    marginTop: spacing.sm,
  },
  delta: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    marginTop: 4,
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
    color: colors.muted,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    fontStyle: 'italic',
    marginTop: spacing.md,
  },
});
