import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ImageBackground,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

// Round 3 #11: default Inter face via AppText wrapper (see App.js note).
import Text from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import BleConnectCard from '../components/BleConnectCard';
import BleDebugConsole from '../components/BleDebugConsole';
import DemoBannerPill from '../components/DemoBannerPill';
import GlassCard from '../components/GlassCard';
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

  // Round 3 #5: real Palatal Pressure sparkline series.
  //
  // Palatal Pressure is the ONE Home tile backed by a real streamed signal
  // (the FSR-derived pressure). We keep a rolling buffer of the last ~30
  // smoothed pressure samples so the sparkline reflects the same series that
  // feeds the tile value — not a hard-coded, frozen array. Posture / Clench /
  // Nasal have no real time-series in demo mode, so their tiles omit the
  // sparkline entirely (below) rather than show a fake one.
  const pressureSeriesRef = useRef([]);
  const [pressureSeries, setPressureSeries] = useState([]);
  useEffect(() => {
    if (typeof smoothedPressure !== 'number' || Number.isNaN(smoothedPressure)) return;
    const buf = pressureSeriesRef.current;
    buf.push(smoothedPressure);
    if (buf.length > 30) buf.splice(0, buf.length - 30);
    setPressureSeries([...buf]);
  }, [smoothedPressure]);

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
    <ImageBackground
      source={require('../../assets/backgrounds/mountains.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <BackgroundGradient />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.emerald}
            />
          }
        >
          <GlassCard variant="dark" style={styles.header}>
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
          </GlassCard>

          {!videoMode ? <DemoBannerPill /> : null}
          {!videoMode ? (
            <GlassCard variant="dark" style={styles.cardGlass} borderRadius={20}>
              <View style={styles.cardMarginReset}>
                <BleConnectCard />
              </View>
            </GlassCard>
          ) : null}
          {!videoMode ? <BleDebugConsole /> : null}
          <GlassCard variant="dark" style={styles.heroGlass} borderRadius={28}>
            <View style={styles.cardMarginReset}>
              <PalateHeroCard packet={packet} isStreaming={isStreaming} />
            </View>
          </GlassCard>
          <WearTimeCaption label={wearTime.label} />

          <GlassCard variant="dark" style={styles.cardGlass} borderRadius={22}>
            <View style={styles.cardMarginReset}>
              <TakeawayCard takeaway={demoTakeaway} />
            </View>
          </GlassCard>

          {videoMode ? (
            <GlassCard variant="dark" style={styles.cardGlass} borderRadius={22}>
              <View style={styles.cardMarginReset}>
                <PositionLog log={positionLog} currentPosition={currentPosition} />
              </View>
            </GlassCard>
          ) : null}

          <View style={styles.grid}>
            <View style={styles.gridRow}>
              <GlassCard variant="dark" style={styles.metricGlass} borderRadius={22}>
                <MetricTile
                  title="Posture Score"
                  value={metrics.posture}
                  accent={colors.emerald}
                  onPress={() => openAnalytics('posture')}
                  /* #5: no real posture time-series in demo mode — omit sparkline */
                />
              </GlassCard>
              <View style={styles.gridGap} />
              <GlassCard variant="dark" style={styles.metricGlass} borderRadius={22}>
                <MetricTile
                  title="Palatal Pressure"
                  value={metrics.pressure}
                  unit={videoMode ? '/100' : 'N'}
                  accent={colors.sky}
                  onPress={() => openAnalytics('pressure')}
                  /* #5: real rolling series from the smoothed FSR pressure signal */
                  sparkline={pressureSeries}
                />
              </GlassCard>
            </View>
            <View style={styles.gridRow}>
              <GlassCard variant="dark" style={styles.metricGlass} borderRadius={22}>
                <MetricTile
                  title="Clench Events"
                  value={metrics.clench}
                  unit={videoMode ? '' : '/hr'}
                  accent={colors.skyDeep}
                  onPress={() => openAnalytics('clench')}
                  /* #5: no real clench time-series in demo mode — omit sparkline */
                />
              </GlassCard>
              <View style={styles.gridGap} />
              <GlassCard variant="dark" style={styles.metricGlass} borderRadius={22}>
                <MetricTile
                  title="Nasal Breathing"
                  value={metrics.nasal}
                  unit="%"
                  accent={colors.emerald}
                  onPress={() => openAnalytics('nasal')}
                  /* #5: no real nasal time-series in demo mode — omit sparkline */
                />
              </GlassCard>
            </View>
          </View>
        </ScrollView>
        {videoMode ? <LiveControlsFloating /> : null}
      </SafeAreaView>
    </ImageBackground>
  );
}

function BackgroundGradient() {
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <Defs>
        <SvgLinearGradient
          id="homeBackgroundShade"
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <Stop offset="0" stopColor="#000000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0.35" />
        </SvgLinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#homeBackgroundShade)" />
    </Svg>
  );
}

function MountainLogo() {
  return (
    <View style={styles.logoWrap}>
      <Svg width="46" height="30" viewBox="0 0 46 30">
        <Path d="M2 27 L15 10 L22 18 L30 5 L44 27" fill="none" stroke={colors.emerald} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M15 10 L19 14 L22 18" fill="none" stroke={colors.snow} strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round" />
      </Svg>
    </View>
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
    // Clear the floating frosted tab bar (#3): content scrolls UNDER it.
    paddingBottom: 90,
  },
  header: {
    marginTop: spacing.md,
    padding: spacing.lg,
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
    backgroundColor: 'rgba(11, 18, 32, 0.42)',
    marginRight: spacing.md,
  },
  brandCopy: {
    flex: 1,
  },
  brand: {
    color: colors.snow,
    fontSize: typography.sizes.callout,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.2,
  },
  window: {
    color: colors.stone,
    fontSize: typography.sizes.caption,
    marginTop: spacing.xxs,
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
    color: colors.snow,
    fontSize: typography.sizes.hero,
    lineHeight: typography.lineHeights.hero,
    // Named Inter family carries the weight (Round 3 #8).
    fontFamily: typography.family.bold,
  },
  source: {
    color: colors.snowSoft,
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
  cardGlass: {
    marginTop: spacing.lg,
  },
  heroGlass: {
    marginTop: spacing.lg,
  },
  cardMarginReset: {
    marginTop: -spacing.lg,
  },
  metricGlass: {
    flex: 1,
  },
});
