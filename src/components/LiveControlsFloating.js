import React, { useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

// Round 3 #11: default Inter face via AppText wrapper (see App.js note).
import Text from './AppText';

import useIsClient from '../hooks/useIsClient';
import useLiveModeFlag from '../hooks/useLiveModeFlag';
import { StreamerContext } from '../services/streamer/StreamerProvider';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function LiveControlsFloating() {
  const isClient = useIsClient();
  const { video } = useLiveModeFlag();
  const { bleStatus, connect, disconnect, sendCommand, isBleSupported } = useContext(StreamerContext);

  if (!isClient || !video) return null;

  const state = bleStatus?.state || 'idle';
  const connected = state === 'connected' || state === 'silent';
  const busy = state === 'scanning' || state === 'connecting';
  const dotColor = connected ? colors.teal : state === 'error' || state === 'silent' ? colors.amber : colors.muted;

  const onConnect = async () => {
    try {
      await connect();
    } catch (err) {
      // BleStreamer owns the user-visible status; keep the floating control quiet.
      // eslint-disable-next-line no-console
      console.warn('[MorphoGenix] BLE connect failed', err);
    }
  };

  const onZero = async () => {
    try {
      await sendCommand('z');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[MorphoGenix] BLE zero command failed', err);
    }
  };

  if (!isBleSupported) {
    return (
      <View style={styles.cluster}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: colors.amber }]} />
          <Text style={styles.status}>Chrome BLE unavailable</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cluster}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.status}>{connected ? 'Connected' : busy ? 'Connecting' : 'Live BLE'}</Text>
      </View>
      <View style={styles.actions}>
        <FloatingButton label={connected ? 'Disconnect' : 'Connect'} onPress={connected ? disconnect : onConnect} disabled={busy} primary={!connected} />
        <FloatingButton label="Re-zero" onPress={onZero} disabled={!connected} />
      </View>
    </View>
  );
}

function FloatingButton({ label, onPress, disabled, primary }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary, disabled && styles.buttonTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cluster: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    zIndex: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    backgroundColor: 'rgba(20,27,45,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginRight: spacing.xs,
  },
  status: {
    color: colors.muted,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    marginRight: spacing.xs,
  },
  buttonPrimary: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  buttonDisabled: {
    opacity: 0.38,
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
  },
  buttonTextPrimary: {
    color: colors.navy,
  },
  buttonTextDisabled: {
    color: colors.muted,
  },
});
