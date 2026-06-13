import React, { useEffect, useMemo, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import BleConnectCard from '../components/BleConnectCard';
import BleDebugConsole from '../components/BleDebugConsole';
import DemoBannerPill from '../components/DemoBannerPill';
import LiveControlsFloating from '../components/LiveControlsFloating';
import MetricTile from '../components/MetricTile';
import PalateHeroCard from '../components/PalateHeroCard';
import PositionLog from '../components/PositionLog';
import ScoreRing from '../components/ScoreRing';
import TakeawayCard from '../components/TakeawayCard';
import WearTimeCaption from '../components/WearTimeCaption';
import demoTakeaway from '../data/demoTakeaway.json';
import useLiveDemoMetrics from '../hooks/useLiveDemoMetrics';
import useLiveModeFlag from '../hooks/useLiveModeFlag';
import useMorphoday from '../hooks/useMorphoday';
import useSmoothed from '../hooks/useSmoothed';
import useStream from '../hooks/useStream';
import useWearTime from '../hooks/useWearTime';
import { useHeadPositionLog } from '../services/headPosition';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function HomeScreen({ navigation }) {
  const { packet, isStreaming, source } = useStream();
  const { video: videoMode } = useLiveModeFlag();
  const { aggregate, packets, morphodayWindow, refresh } = useMorphoday(packet);
  const liveDemo = useLiveDemoMetrics(packet, videoMode);
  const wearTime = useWearTime(packets);

  // Phase 3 (IMU): debounced head-position log derived from packet.accelG.
  // Only meaningful with the phase3 binary-v2 firmware; gated to video/dev mode
  // in the UI below until real-device validation lands.
  const { currentPosition, log: positionLog } = useHeadPositionLog(packet);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (__DEV__ && packet) {
      console.log('[MorphoGenix] live packet', packet);
    }
  }, [packet]);

  // Raw values from the latest packet
  const rawPosture = typeof packet?.posture === 'number' ? packet.posture : 0.87;
  const rawPressure = packet?.palate?.length
    ? packet.palate.reduce((sum, value) => sum + value, 0) / packet.palate.length
    : 0.62;

  // Rolling 3-second average (10Hz x 3s = 30 samples) so displayed tile values are steady
  const smoothedPosture = useSmoothed(rawPosture, { windowSize: 30, throttleMs: 300 });
  const smoothedPressure = useSmoothed(rawPressure, { windowSize: 30, throttleMs: 300 });

  const metrics = useMemo(() => {
    if (videoMode) {
      // Demo-recording mode: pressure + clench are live-derived from the
      // 4 real FSRs; posture + nasal are independent random walks. See
      // useLiveDemoMetrics for the exact math.
      return {
        posture: `${liveDemo.posture}/100`,
        pressure: String(liveDemo.pressureScore),
        clench: String(liveDemo.clenchCount),
        nasal: String(liveDemo.nasal),
      };
    }
    const postureScore = Math.round((smoothedPosture || 0.87) * 100);
    const pressureValue = smoothedPressure || aggregate.pressureAvg || 0.62;
    const clenchRate = aggregate.clenchEvents > 0 ? aggregate.clenchPerHour : 3;
    const nasalPercent = aggregate.packetCount > 20 ? aggregate.nasalPercent : 94;

    return {
      posture: `${postureScore}/100`,
      pressure: pressureValue.toFixed(2),
      clench: String(Math.round(clenchRate)),
      nasal: String(nasalPercent),
    };
  }, [videoMode, liveDemo, smoothedPosture, smoothedPressure, aggregate]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    refresh();
    setTimeout(() => setRefreshing(false), 350);
  };

  const openAnalytics = (anchor) => {
    navigation.navigate('Analytics', { anchor });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <MountainLogo />
            <View style={styles.brandCopy}>
              <Text style={styles.brand}>MorphoGenix</Text>
              <Text style={styles.window}>{morphodayWindow}</Text>
            </View>
          </View>
          <View style={styles.welcomeBlock}>
            <View style={styles.welcomeCopy}>
              <Text style={styles.greeting}>Good morning, Wes</Text>
              {!videoMode ? <Text style={styles.source}>Source: {source}</Text> : null}
            </View>
            <ScoreRing
              value={metrics.posture}
              max={100}
              label="Posture"
              size={104}
              strokeWidth={9}
            />
          </View>
        </View>

        {!videoMode ? <DemoBannerPill /> : null}
        {!videoMode ? <BleConnectCard /> : null}
        {!videoMode ? <BleDebugConsole /> : null}
        <PalateHeroCard packet={packet} isStreaming={isStreaming} />
        <WearTimeCaption label={wearTime.label} />

        <TakeawayCard takeaway={demoTakeaway} />

        {videoMode ? (
          <PositionLog log={positionLog} currentPosition={currentPosition} />
        ) : null}

        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <MetricTile
              title="Posture Score"
              value={metrics.posture}
              accent={colors.teal}
              onPress={() => openAnalytics('posture')}
              sparkline={[20, 24, 26, 25, 29, 31]}
            />
            <View style={styles.gridGap} />
            <MetricTile
              title="Palatal Pressure"
              value={metrics.pressure}
              unit={videoMode ? '/100' : 'N'}
              accent={colors.amber}
              onPress={() => openAnalytics('pressure')}
              sparkline={[12, 16, 14, 18, 22, 19]}
            />
          </View>
          <View style={styles.gridRow}>
            <MetricTile
              title="Clench Events"
              value={metrics.clench}
              unit={videoMode ? '' : '/hr'}
              accent={colors.violet}
              onPress={() => openAnalytics('clench')}
              sparkline={[4, 5, 4, 8, 5, 6]}
            />
            <View style={styles.gridGap} />
            <MetricTile
              title="Nasal Breathing"
              value={metrics.nasal}
              unit="%"
              accent={colors.teal}
              onPress={() => openAnalytics('nasal')}
              sparkline={[18, 19, 21, 20, 23, 24]}
            />
          </View>
        </View>
      </ScrollView>
      {videoMode ? <LiveControlsFloating /> : null}
    </SafeAreaView>
  );
}

function MountainLogo() {
  return (
    <View style={styles.logoWrap}>
      <Svg width="46" height="30" viewBox="0 0 46 30">
        <Path d="M2 27 L15 10 L22 18 L30 5 L44 27" fill="none" stroke={colors.teal} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M15 10 L19 14 L22 18" fill="none" stroke={colors.white} strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    paddingHorizontal: spacing.lg,
    // Clear the floating frosted tab bar (#3): content scrolls UNDER it.
    paddingBottom: 90,
  },
  header: {
    paddingTop: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrap: {
    width: 56,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginRight: spacing.md,
  },
  brandCopy: {
    flex: 1,
  },
  brand: {
    color: colors.white,
    fontSize: typography.sizes.callout,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.2,
  },
  window: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    marginTop: 2,
  },
  welcomeBlock: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeCopy: {
    flex: 1,
    paddingRight: spacing.lg,
  },
  greeting: {
    color: colors.white,
    fontSize: typography.sizes.hero,
    lineHeight: typography.lineHeights.hero,
    fontFamily: typography.family.bold,
    fontWeight: typography.weights.bold,
  },
  source: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    marginTop: spacing.xs,
    fontWeight: typography.weights.medium,
  },
  grid: {
    marginTop: spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  gridGap: {
    width: spacing.md,
  },
});
