import React from 'react';
import { StyleSheet, View } from 'react-native';

// Round 3 #11: default Inter face via AppText wrapper (see App.js note).
import Text from './AppText';
import { Ionicons } from '@expo/vector-icons';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

export default function WearTimeCaption({ label }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="time-outline" color={colors.teal} size={16} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  text: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    marginLeft: spacing.xs,
  },
});
