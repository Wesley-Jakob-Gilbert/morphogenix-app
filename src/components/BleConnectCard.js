/**
 * BleConnectCard — bench-only UI for connecting to a MorphoGenix device.
 *
 * Renders ONLY when the user has opted into live BLE mode via `?live=ble`
 * in the URL. On the production demo URL this component is never mounted,
 * so production behavior is bit-for-bit unchanged.
 *
 * States (driven by StreamerContext.bleStatus):
 *   idle          - "Connect device" button
 *   scanning      - "Pick a device…" (browser chooser is open)
 *   connecting    - "Connecting to <name>…"
 *   connected     - shows device name + small green dot + "Disconnect"
 *   silent        - connected but no notifications (firmware sleeping?) +
 *                   "Disconnect"
 *   disconnected  - "Reconnect" affordance
 *   error         - error message + "Try again"
 *
 * Also surfaces a clear capability message if Web Bluetooth is unavailable
 * (e.g. iOS Safari) so the user isn't left wondering why the button does
 * nothing.
 */

import React, { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import useIsClient from '../hooks/useIsClient';
import useLiveBleFlag from '../hooks/useLiveBleFlag';
import { StreamerContext } from '../services/streamer/StreamerProvider';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function BleConnectCard() {
  // Two-stage gate, both required:
  //   1. useIsClient() returns false on first commit so the entire card stays
  //      out of the hydration-comparison tree. This guarantees React 19 never
  //      tears down the parent on a hydration mismatch from anything inside
  //      this card (capability checks, URL flag, status state, etc).
  //   2. useLiveBleFlag() then gates by ?live=ble so production morphogenix.ai
  //      remains visually identical (the card never appears off the bench).
  const isClient = useIsClient();
  const liveBle = useLiveBleFlag();
  const { bleStatus, connect, disconnect, isBleSupported, packet } = useContext(StreamerContext);

  if (!isClient) return null;
  if (!liveBle) return null;

  const state = bleStatus?.state || 'idle';
  const detail = bleStatus?.detail;

  const onConnect = async () => {
    try {
      await connect();
    } catch (err) {
      // BleStreamer already pushes the error into bleStatus; nothing to do.
      // Logging here helps when poking at it in DevTools.
      // eslint-disable-next-line no-console
      console.warn('[MorphoGenix] BLE connect failed', err);
    }
  };

  if (!isBleSupported) {
    return (
      <View style={[styles.card, styles.cardWarn]}>
        <Text style={styles.title}>Web Bluetooth unavailable</Text>
        <Text style={styles.body}>
          Open this page in Chrome or Edge on desktop, or Chrome on Android. iOS Safari does not
          support Web Bluetooth.
        </Text>
      </View>
    );
  }

  // Compose the body copy and primary action by state.
  let title;
  let body;
  let primary;

  switch (state) {
    case 'scanning':
      title = 'Pick a device';
      body = 'Choose “MorphoGenixSOD” in the browser dialog.';
      primary = null;
      break;
    case 'connecting':
      title = 'Connecting…';
      body = detail ? `Pairing with ${detail}` : 'Pairing…';
      primary = null;
      break;
    case 'connected':
      title = 'Connected';
      body = `${detail || 'MorphoGenixSOD'} · live FSR stream`;
      primary = { label: 'Disconnect', onPress: disconnect, kind: 'secondary' };
      break;
    case 'silent':
      title = 'Connected, no data';
      body = 'Link is up but the device is silent. Check power and firmware.';
      primary = { label: 'Disconnect', onPress: disconnect, kind: 'secondary' };
      break;
    case 'disconnected':
      title = 'Disconnected';
      body = 'The device dropped off. Tap to reconnect.';
      primary = { label: 'Reconnect', onPress: onConnect, kind: 'primary' };
      break;
    case 'error':
      title = 'Connection error';
      body = detail || 'Something went wrong.';
      primary = { label: 'Try again', onPress: onConnect, kind: 'primary' };
      break;
    case 'idle':
    default:
      title = 'Live BLE mode';
      body = 'Stream raw palate FSR readings from your XIAO nRF52840.';
      primary = { label: 'Connect device', onPress: onConnect, kind: 'primary' };
      break;
  }

  // When connected, show a tiny live raw value so we know data is flowing.
  const liveRaw =
    state === 'connected' && packet && typeof packet.palateRaw === 'number'
      ? packet.palateRaw
      : null;

  const dotColor =
    state === 'connected'
      ? colors.teal
      : state === 'silent' || state === 'error' || state === 'disconnected'
        ? colors.amber
        : colors.muted;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>

      {liveRaw != null ? (
        <Text style={styles.raw}>raw: {liveRaw}</Text>
      ) : null}

      {primary ? (
        <Pressable
          accessibilityRole="button"
          onPress={primary.onPress}
          style={({ pressed }) => [
            styles.button,
            primary.kind === 'secondary' && styles.buttonSecondary,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text
            style={[
              styles.buttonLabel,
              primary.kind === 'secondary' && styles.buttonLabelSecondary,
            ]}
          >
            {primary.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardWarn: {
    borderColor: colors.amber,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: spacing.sm,
  },
  title: {
    color: colors.white,
    fontSize: typography.sizes.callout,
    fontWeight: typography.weights.bold,
  },
  body: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    marginBottom: spacing.md,
  },
  raw: {
    color: colors.teal,
    fontSize: typography.sizes.caption,
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    marginBottom: spacing.md,
  },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    backgroundColor: colors.teal,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.muted,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonLabel: {
    color: colors.navy,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
  },
  buttonLabelSecondary: {
    color: colors.white,
  },
});
