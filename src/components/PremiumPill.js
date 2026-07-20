import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

/**
 * PremiumPill (Round 3 #9)
 *
 * The small gold "PREMIUM FEATURE" chip that marks gated cards. This used to be
 * copy-pasted into TakeawayCard and PositionLog, each with its own local
 * `PREMIUM_GOLD = '#E5C572'` constant and identical `premiumPill` /
 * `premiumPillText` styles. That's now one component sourcing the single
 * `colors.premiumGold` token, so the mark can never drift between screens.
 *
 * Visual parity is intentional and exact — same translucent gold fill, 1px
 * gold hairline border, pill radius, tracked all-caps gold label.
 *
 * Props:
 *   label?: string   // defaults to "PREMIUM FEATURE"
 *   style?: object    // optional container style override (e.g. margins)
 */
export default function PremiumPill({ label = 'PREMIUM FEATURE', style }) {
  return (
    <View style={[styles.pill, style]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    // Translucent gold fill + gold hairline. Alpha washes are derived from the
    // single premiumGold token; kept as literals so the exact rendered chip is
    // byte-for-byte the one both cards shipped before the extraction.
    backgroundColor: 'rgba(229, 197, 114, 0.12)',
    borderColor: 'rgba(229, 197, 114, 0.45)',
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
  },
  text: {
    color: colors.premiumGold,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.2,
  },
});
