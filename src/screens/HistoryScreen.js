import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>HISTORY</Text>
      <Text style={styles.title}>History</Text>
      <Text style={styles.body}>Morphoday timeline stub for Phase D.</Text>
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
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
