import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function AccountScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>ACCOUNT</Text>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.body}>Profile and settings stub. About Us nests here in the next pass.</Text>
      {Platform.OS === 'web' ? (
        <Text style={styles.demoLock}>Demo Mode is always on for the web preview because browser sessions do not connect to MorphoGenix hardware.</Text>
      ) : null}
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
  demoLock: {
    color: colors.teal,
    fontSize: typography.sizes.caption,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
