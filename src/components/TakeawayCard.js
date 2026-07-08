import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { elevatedCard } from '../theme/surfaces';
import typography from '../theme/typography';
import PremiumPill from './PremiumPill';

/**
 * TakeawayCard
 *
 * Renders the daily AI-generated myofunctional recommendation. In the live demo
 * we hand-fed a realistic morphoday into Perplexity Sonar and cached the
 * response at `src/data/demoTakeaway.json`; the production version of this
 * component will subscribe to a "latestTakeaway" stream from the user's
 * morphoday aggregation pipeline. Either way the visual contract is the same.
 *
 * Props:
 *   takeaway: { title, body, citation, supportingCitation?, disclaimer, generatedAt }
 *   onRefresh?: () => void           // optional; shows refresh affordance when provided
 */
export default function TakeawayCard({ takeaway, onRefresh }) {
  if (!takeaway) return null;

  const openCitation = (url) => {
    if (!url) return;
    // RN's Linking.openURL works on web (opens new tab) and native. No await —
    // we want the gesture to feel immediate even if the OS prompt is slow.
    Linking.openURL(url).catch(() => {
      // Silently swallow; we don't want a broken link to take the card down.
    });
  };

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel="Daily takeaway">
      <View style={styles.header}>
        <Text style={styles.title}>{takeaway.title}</Text>
        <PremiumPill />
      </View>

      <Text style={styles.body}>{takeaway.body}</Text>

      {/* Primary citation. Always present. */}
      {takeaway.citation ? (
        <Pressable
          onPress={() => openCitation(takeaway.citation.url)}
          accessibilityRole="link"
          accessibilityLabel={`Open citation: ${takeaway.citation.label}`}
          hitSlop={6}
        >
          <Text style={styles.citation}>
            <Text style={styles.citationDot}>● </Text>
            <Text style={styles.citationLabel}>{takeaway.citation.short}</Text>
            <Text style={styles.citationLink}>  open study</Text>
          </Text>
        </Pressable>
      ) : null}

      {/* Optional secondary citation, rendered smaller. */}
      {takeaway.supportingCitation ? (
        <Pressable
          onPress={() => openCitation(takeaway.supportingCitation.url)}
          accessibilityRole="link"
          accessibilityLabel={`Open supporting citation: ${takeaway.supportingCitation.label}`}
          hitSlop={6}
        >
          <Text style={styles.supportingCitation}>
            also: {takeaway.supportingCitation.short}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerMeta}>
          Generated from yesterday's morphoday · Sonar
        </Text>
        {onRefresh ? (
          <Pressable
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel="Refresh takeaway"
            hitSlop={8}
          >
            <Text style={styles.refresh}>↻ Refresh</Text>
          </Pressable>
        ) : null}
      </View>

      {takeaway.disclaimer ? (
        <Text style={styles.disclaimer}>{takeaway.disclaimer}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // Round 3 #3: canonical elevated card material via the shared helper.
    // Premium signal still lives entirely in the gold pill in the header.
    ...elevatedCard,
    borderRadius: 22,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.white,
    fontSize: typography.sizes.callout,
    // Heavy title (not a big numeral) → Inter Bold preserves the existing
    // heavy hierarchy without the over-weight Black display cut (V2 #1). Named
    // family carries the weight; numeric fontWeight dropped (Round 3 #8).
    fontFamily: typography.family.bold,
    lineHeight: typography.lineHeights.callout,
    letterSpacing: -0.2,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
  body: {
    color: colors.white,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.md,
  },
  citation: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    marginTop: spacing.sm,
  },
  citationDot: {
    color: colors.teal,
  },
  citationLabel: {
    color: colors.white,
    fontWeight: typography.weights.medium,
  },
  citationLink: {
    color: colors.teal,
    fontWeight: typography.weights.medium,
  },
  supportingCitation: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    marginTop: spacing.xs,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(139, 147, 167, 0.4)',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.inkSoft,
  },
  footerMeta: {
    color: colors.muted,
    fontSize: typography.sizes.tiny,
    letterSpacing: 0.3,
  },
  refresh: {
    color: colors.teal,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
  },
  disclaimer: {
    // Round 3 #8: dropped `fontStyle: 'italic'` — the bundled Inter face has no
    // italic cut, so it slanted via faux-italic (or not at all). Lower opacity
    // already sets it apart as fine print.
    color: colors.muted,
    fontSize: typography.sizes.tiny,
    lineHeight: 15,
    marginTop: spacing.md,
    opacity: 0.7,
  },
});
