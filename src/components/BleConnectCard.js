/**
 * BleConnectCard — device connection UI for the MorphoGenix live BLE stream.
 *
 * TWO render paths, one component:
 *
 *   • Web (bench build): renders ONLY when `?live=ble` is in the URL, exactly
 *     as before, so production morphogenix.ai stays visually identical. Uses
 *     the Web Bluetooth chooser; copy is unchanged.
 *
 *   • Native (iOS/Android dev-client): always renders. Drives the real
 *     react-native-ble-plx scan flow through StreamerContext.bleStatus:
 *       idle          → "Connect device"
 *       scanning      → spinner + "Scanning…"
 *       connecting    → spinner + "Connecting to <name>…"
 *       connected     → device name + RSSI/live raw + "Disconnect"
 *       reconnecting  → spinner + "Reconnecting…"
 *       disconnected  → "Reconnect"
 *       silent        → "Connected, no data" + "Disconnect"
 *       error:
 *         no_device_found     → "No device found" + retry
 *         permission_denied   → "Bluetooth permission required" + Open Settings
 *         bluetooth_off       → "Turn on Bluetooth"
 *         unsupported         → "Bluetooth unavailable"
 *         (other)             → message + "Try again"
 *
 * Haptics: success feedback on 'connected', warning feedback on error/silent/
 * disconnected transitions (via the existing haptics wrapper — no-op on web).
 */

import React, { useContext, useEffect, useRef } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import Text from './AppText';

import useIsClient from '../hooks/useIsClient';
import useLiveModeFlag from '../hooks/useLiveModeFlag';
import { StreamerContext } from '../services/streamer/StreamerProvider';
import haptics from '../utils/haptics';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { elevatedCard } from '../theme/surfaces';
import typography from '../theme/typography';

const IS_WEB = Platform.OS === 'web';

// Native error reasons (from nativeBleAdapter / blePermissions) mapped to copy.
function describeNativeError(detail) {
  switch (detail) {
    case 'no_device_found':
    case 'scan_timeout':
      return {
        title: 'No device found',
        body: 'Make sure your MorphoGenix device is powered on and nearby, then try again.',
        action: 'retry',
      };
    case 'permission_denied':
      return {
        title: 'Bluetooth permission required',
        body: 'MorphoGenix needs Bluetooth access to connect to your device. Enable it in Settings.',
        action: 'settings',
      };
    case 'bluetooth_off':
      return {
        title: 'Turn on Bluetooth',
        body: 'Bluetooth is off. Turn it on in Control Center or Settings, then try again.',
        action: 'retry',
      };
    case 'unsupported':
      return {
        title: 'Bluetooth unavailable',
        body: "This device can't use Bluetooth Low Energy.",
        action: null,
      };
    default:
      return {
        title: 'Connection error',
        body: detail || 'Something went wrong. Try again.',
        action: 'retry',
      };
  }
}

export default function BleConnectCard() {
  const isClient = useIsClient();
  const { ble: liveBle, video: videoMode } = useLiveModeFlag();
  const { bleStatus, connect, disconnect, sendCommand, isBleSupported, packet } =
    useContext(StreamerContext);

  const state = bleStatus?.state || 'idle';
  const detail = bleStatus?.detail;

  // Fire haptics on meaningful state transitions (no-op on web).
  const prevState = useRef(state);
  useEffect(() => {
    if (prevState.current !== state) {
      if (state === 'connected') haptics.success();
      else if (state === 'error' || state === 'silent' || state === 'disconnected') {
        haptics.warning();
      }
      prevState.current = state;
    }
  }, [state]);

  // ----- gating -----
  // Web: unchanged two-stage gate (client + ?live=ble). Native: always render.
  if (IS_WEB) {
    if (!isClient) return null;
    if (videoMode) return null;
    if (!liveBle) return null;
  }

  const onConnect = async () => {
    try {
      await connect();
    } catch (err) {
      // Status already reflects the error; log for debugging.
      // eslint-disable-next-line no-console
      console.warn('[MorphoGenix] BLE connect failed', err);
    }
  };

  const onOpenSettings = () => {
    if (typeof Linking.openSettings === 'function') {
      Linking.openSettings().catch(() => {});
    }
  };

  // Web-only: capability guard for browsers without Web Bluetooth.
  if (IS_WEB && !isBleSupported) {
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

  // Compose title / body / primary action / spinner by state.
  let title;
  let body;
  let primary = null;
  let showSpinner = false;

  switch (state) {
    case 'scanning':
      title = 'Scanning…';
      body = IS_WEB
        ? 'Choose “MorphoGenixSOD” in the browser dialog.'
        : 'Looking for your MorphoGenix device…';
      showSpinner = true;
      break;
    case 'connecting':
      title = 'Connecting…';
      body = detail ? `Pairing with ${detail}` : 'Pairing…';
      showSpinner = true;
      break;
    case 'reconnecting':
      title = 'Reconnecting…';
      body = detail ? `Link dropped — ${detail}` : 'Link dropped — retrying…';
      showSpinner = true;
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
    case 'error': {
      if (IS_WEB) {
        title = 'Connection error';
        body = detail || 'Something went wrong.';
        primary = { label: 'Try again', onPress: onConnect, kind: 'primary' };
      } else {
        const e = describeNativeError(detail);
        title = e.title;
        body = e.body;
        if (e.action === 'settings') {
          primary = { label: 'Open Settings', onPress: onOpenSettings, kind: 'primary' };
        } else if (e.action === 'retry') {
          primary = { label: 'Try again', onPress: onConnect, kind: 'primary' };
        }
      }
      break;
    }
    case 'idle':
    default:
      title = 'Live BLE mode';
      body = IS_WEB
        ? 'Stream raw palate FSR readings from your XIAO nRF52840.'
        : 'Connect to your MorphoGenix device to stream live palate + head-position data.';
      primary = { label: 'Connect device', onPress: onConnect, kind: 'primary' };
      break;
  }

  // When connected, show a tiny live raw value so we know data is flowing.
  const liveRaw =
    state === 'connected' && packet && Array.isArray(packet.palateRaw)
      ? packet.palateRaw.join(', ')
      : state === 'connected' && packet && typeof packet.palateRaw === 'number'
        ? packet.palateRaw
        : null;

  const dotColor =
    state === 'connected'
      ? colors.teal
      : state === 'silent' || state === 'error' || state === 'disconnected'
        ? colors.amber
        : colors.muted;

  // Native-only diagnostic buttons when connected (rezero / imu-diag).
  const showDiagnostics = !IS_WEB && state === 'connected';
  const onRezero = () => {
    haptics.selection();
    Promise.resolve(sendCommand && sendCommand('z')).catch(() => {});
  };
  const onImuDiag = () => {
    haptics.selection();
    Promise.resolve(sendCommand && sendCommand('i')).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.title}>{title}</Text>
        {showSpinner ? (
          <ActivityIndicator size="small" color={colors.emerald} style={styles.spinner} />
        ) : null}
      </View>
      <Text style={styles.body}>{body}</Text>

      {liveRaw != null ? <Text style={styles.raw}>raw: {liveRaw}</Text> : null}

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

      {showDiagnostics ? (
        <View style={styles.diagRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onRezero}
            style={({ pressed }) => [styles.diagButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.diagLabel}>Rezero</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onImuDiag}
            style={({ pressed }) => [styles.diagButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.diagLabel}>IMU diag</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...elevatedCard,
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: 18,
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
  spinner: {
    marginLeft: spacing.sm,
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
  diagRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  diagButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.muted,
    marginRight: spacing.sm,
  },
  diagLabel: {
    color: colors.white,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
  },
});
