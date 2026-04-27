import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function AnalyticsScreen({ route }) {
  const anchor = route?.params?.anchor || 'overview';

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>ANALYTICS</Text>
      <Text style={styles.title}>Analytics</Text>
      <Text style={styles.body}>Phase E will stack sections at #posture, #pressure, #clench, and #nasal.</Text>
      <Text style={styles.anchor}>Requested anchor: #{anchor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.navy,
  },
  kicker: {
    color: colors.teal,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  title: {
    color: colors.white,
    fontSize: typography.sizes.hero,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  body: {
    color: colors.muted,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  anchor: {
    color: colors.amber,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
