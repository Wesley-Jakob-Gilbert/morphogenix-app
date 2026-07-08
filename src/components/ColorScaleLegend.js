import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

// Round 3 #11: default Inter face via AppText wrapper (see App.js note).
import Text from './AppText';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import useSettingsStore from '../store/settingsStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function ColorScaleLegend() {
  const colorScaleMode = useSettingsStore((state) => state.colorScaleMode);
  const toggleColorScaleMode = useSettingsStore((state) => state.toggleColorScaleMode);
  const isNewtons = colorScaleMode === 'newtons';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Toggle pressure color scale units"
      onPress={toggleColorScaleMode}
      style={styles.container}
    >
      <Text style={styles.label}>{isNewtons ? '1N' : '100'}</Text>
      <View style={styles.barWrap}>
        <Svg width="16" height="136" viewBox="0 0 16 136">
          <Defs>
            <LinearGradient id="pressureGradient" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor={colors.teal} />
              <Stop offset="0.62" stopColor={colors.amber} />
              <Stop offset="1" stopColor={colors.violet} />
            </LinearGradient>
          </Defs>
          <Rect x="2" y="0" width="12" height="136" rx="6" fill="url(#pressureGradient)" />
        </Svg>
      </View>
      <Text style={styles.label}>{isNewtons ? '0N' : '0'}</Text>
      <Text style={styles.unit}>{isNewtons ? 'N' : '0–100'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    paddingLeft: spacing.sm,
  },
  barWrap: {
    marginVertical: spacing.xs,
    borderRadius: 10,
    backgroundColor: colors.navy,
    padding: 2,
  },
  label: {
    color: colors.white,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
  },
  unit: {
    color: colors.muted,
    fontSize: typography.sizes.tiny,
    marginTop: spacing.xs,
  },
});
