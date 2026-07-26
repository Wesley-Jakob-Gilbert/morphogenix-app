import React from 'react';
import { Alert, Platform, Pressable, StyleSheet } from 'react-native';

// Round 3 #11: default Inter face via AppText wrapper (see App.js note).
import Text from './AppText';
import * as Haptics from 'expo-haptics';

import useSettingsStore from '../store/settingsStore';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function DemoBannerPill() {
  const demoMode = useSettingsStore((state) => state.demoMode);
  const setDemoMode = useSettingsStore((state) => state.setDemoMode);
  const isWeb = Platform.OS === 'web';

  if (!demoMode) return null;

  const confirmDisable = () => {
    if (isWeb) return;

    Haptics.selectionAsync();
    Alert.alert('Turn off Demo Mode?', 'Without hardware connected, live palate updates will pause.', [
      { text: 'Keep Demo', style: 'cancel' },
      { text: 'Turn Off', style: 'destructive', onPress: () => setDemoMode(false) },
    ]);
  };

  return (
    <Pressable
      accessibilityRole={isWeb ? 'text' : 'button'}
      disabled={isWeb}
      onPress={confirmDisable}
      style={({ pressed }) => [styles.pill, pressed && !isWeb && styles.pressed]}
    >
      <Text style={styles.text}>
        {isWeb ? 'Demo Mode · Web stream locked on' : 'Demo Mode · 10 Hz canned stream · Tap to turn off'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
    borderRadius: 999,
    backgroundColor: colors.emerald,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.82,
  },
  text: {
    color: colors.navy,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
  },
});
