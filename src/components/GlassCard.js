import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { glassBorder, glassDark, glassLight } from '../theme/surfaces';

const ANDROID_NATIVE_BLUR_API_LEVEL = 31;

export function defaultIntensityForPlatform() {
  return Platform.select({
    ios: 40,
    android: 60,
    default: 40,
  });
}

export function usesAndroidFallback(platform, version) {
  return platform === 'android' && Number(version) < ANDROID_NATIVE_BLUR_API_LEVEL;
}

export default function GlassCard({
  variant = 'dark',
  intensity = defaultIntensityForPlatform(Platform.OS),
  style,
  children,
  borderRadius = 20,
}) {
  const isLight = variant === 'light';
  const materialStyle = {
    backgroundColor: isLight ? glassLight : glassDark,
    borderRadius,
  };
  const combinedStyle = [styles.card, materialStyle, style];

  if (usesAndroidFallback(Platform.OS, Platform.Version)) {
    return <View style={combinedStyle}>{children}</View>;
  }

  return (
    <BlurView
      tint={isLight ? 'light' : 'dark'}
      intensity={intensity}
      experimentalBlurMethod={
        Platform.OS === 'android' ? 'dimezisBlurView' : undefined
      }
      style={combinedStyle}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: glassBorder,
    overflow: 'hidden',
  },
});
