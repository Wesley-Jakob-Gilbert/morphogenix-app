/**
 * BleDebugConsole \u2014 bench-only on-screen log so we can debug the BLE flow
 * without opening browser DevTools (which the user often doesn't have open).
 *
 * Renders only when ?live=ble is present. Captures:
 *   - Web Bluetooth capability snapshot at mount
 *   - Every bleStatus transition
 *   - Every emitted log line from the BleStreamer (if it pushes to the global
 *     window.__morphogenix_bleLog buffer \u2014 see BleStreamer for details)
 *
 * Goal: when the user clicks "Connect device", they can see in plain text
 * whether requestDevice() was even reached, what error came back, etc.
 */

import React, { useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

// Round 3 #11: default Inter face via AppText wrapper (see App.js note).
import Text from './AppText';

import useIsClient from '../hooks/useIsClient';
import useLiveModeFlag from '../hooks/useLiveModeFlag';
import { StreamerContext } from '../services/streamer/StreamerProvider';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

const MAX_LINES = 40;

function ts() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
    2,
    '0'
  )}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export default function BleDebugConsole() {
  const isClient = useIsClient();
  const { ble: liveBle, video: videoMode } = useLiveModeFlag();
  const { bleStatus, isBleSupported, source } = useContext(StreamerContext);
  const [lines, setLines] = useState([]);

  // Append helper that caps line count.
  const append = (msg) => {
    setLines((prev) => {
      const next = [...prev, `${ts()}  ${msg}`];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  };

  // Snapshot capability + URL state at mount.
  useEffect(() => {
    if (!liveBle) return;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '(no nav)';
    const hasBT =
      typeof navigator !== 'undefined' &&
      typeof navigator.bluetooth !== 'undefined' &&
      typeof navigator.bluetooth.requestDevice === 'function';
    append(`mount  liveBle=${liveBle}  isBleSupported=${isBleSupported}  hasBT=${hasBT}`);
    append(`UA  ${ua.slice(0, 120)}`);
  }, [liveBle]);

  // Track source separately so we can see the moment the provider swaps from
  // DemoStreamer to BleStreamer (which happens one tick after mount because
  // useLiveBleFlag is a hydration-safe deferred read).
  useEffect(() => {
    if (!liveBle) return;
    append(`source -> ${source}`);
  }, [liveBle, source]);

  // Log every status transition.
  useEffect(() => {
    if (!liveBle) return;
    if (!bleStatus) return;
    append(`status  ${bleStatus.state}${bleStatus.detail ? `  ${bleStatus.detail}` : ''}`);
  }, [liveBle, bleStatus?.state, bleStatus?.detail]);

  // Bridge: BleStreamer pushes ad-hoc log lines to window.__morphogenix_bleLog.
  // We poll it 4x/sec and drain into our state. This avoids tight coupling
  // between the streamer module and the React tree.
  useEffect(() => {
    if (!liveBle) return undefined;
    if (typeof window === 'undefined') return undefined;
    if (!Array.isArray(window.__morphogenix_bleLog)) {
      window.__morphogenix_bleLog = [];
    }
    const id = setInterval(() => {
      const buf = window.__morphogenix_bleLog;
      if (!buf || buf.length === 0) return;
      const drained = buf.splice(0, buf.length);
      setLines((prev) => {
        const next = [...prev, ...drained.map((m) => `${ts()}  ${m}`)];
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [liveBle]);

  if (!isClient) return null;
  if (videoMode) return null;
  if (!liveBle) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>BLE debug log</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {lines.length === 0 ? (
          <Text style={styles.empty}>(waiting for activity\u2026)</Text>
        ) : (
          lines.map((l, i) => (
            <Text key={`${i}-${l}`} style={styles.line}>
              {l}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: '#0a0f14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  scroll: {
    maxHeight: 220,
  },
  scrollContent: {
    paddingBottom: spacing.xs,
  },
  empty: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  line: {
    color: '#9fdcc8',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
});
