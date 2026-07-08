import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { elevatedCard } from '../theme/surfaces';
import typography from '../theme/typography';
import PremiumPill from './PremiumPill';

/**
 * PositionLog
 *
 * Phase 3 (IMU) head-position event log. Renders a scrollable card matching the
 * Oura-polished TakeawayCard surface language: elevated surface, hairline inner
 * border, soft shadow, gold "PREMIUM FEATURE" pill in the header.
 *
 * Each log entry is one debounced head-position change from
 * useHeadPositionLog():
 *   { timestamp: epochMs, position: string, durationSec: number }
 *
 * Color dots use the LOCKED palette tokens (teal/amber/violet) plus neutral
 * grays — no hardcoded hex beyond the gold pill that matches TakeawayCard.
 *
 * Props:
 *   log: Array<{ timestamp, position, durationSec }>   // from useHeadPositionLog
 *   currentPosition?: string                            // optional live label
 */

// Maps each position to its dot color + display label. Side positions (left/
// right) share amber per the spec ("side = amber").
const POSITION_META = {
  supine: { color: colors.teal, label: 'Supine' },
  left: { color: colors.amber, label: 'Left side' },
  right: { color: colors.amber, label: 'Right side' },
  prone: { color: colors.violet, label: 'Prone' },
  upright: { color: colors.muted, label: 'Upright' },
  transitional: { color: 'rgba(139, 147, 167, 0.5)', label: 'Transitional' },
};

function metaFor(position) {
  return POSITION_META[position] || POSITION_META.transitional;
}

// Format epoch ms -> "HH:MM" (24h, zero-padded). Local time.
function formatClock(timestamp) {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Format seconds -> "Xm Ys" (drops minutes when zero -> "Ys").
function formatDuration(durationSec) {
  const total = Math.max(0, Math.round(durationSec || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export default function PositionLog({ log = [], currentPosition }) {
  // Newest entries first.
  const entries = Array.isArray(log) ? [...log].reverse() : [];

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel="Head position log"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Head Position</Text>
        <PremiumPill />
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Waiting for overnight data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {entries.map((entry, idx) => {
            const meta = metaFor(entry.position);
            return (
              <View
                key={`${entry.timestamp}-${idx}`}
                style={styles.row}
                accessibilityLabel={`${formatClock(entry.timestamp)} ${meta.label} ${formatDuration(
                  entry.durationSec
                )}`}
              >
                <Text style={styles.clock}>{formatClock(entry.timestamp)}</Text>
                <View style={styles.positionCell}>
                  <View style={[styles.dot, { backgroundColor: meta.color }]} />
                  <Text style={styles.positionLabel}>{meta.label}</Text>
                </View>
                <Text style={styles.duration}>{formatDuration(entry.durationSec)}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {currentPosition ? (
        <View style={styles.footer}>
          <Text style={styles.footerMeta}>
            Now: {metaFor(currentPosition).label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // Round 3 #3: canonical elevated card material via the shared helper
    // (matches TakeawayCard exactly).
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
  list: {
    maxHeight: 220,
  },
  listContent: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.inkSoft,
  },
  clock: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    width: 52,
  },
  positionCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    // Round 3 #1: was `borderRadius: 4` on an 8x8 box — a rounded square, not a
    // circle. Every other status dot in the app uses radius >= size. Use 999
    // (Wes decision) so it is unambiguously round at any size.
    borderRadius: 999,
    marginRight: spacing.sm,
  },
  positionLabel: {
    color: colors.white,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
  },
  duration: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    width: 64,
    textAlign: 'right',
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    // Round 3 #8: dropped `fontStyle: 'italic'` (no bundled Inter italic cut).
    color: colors.muted,
    fontSize: typography.sizes.body,
    opacity: 0.8,
  },
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.inkSoft,
  },
  footerMeta: {
    color: colors.muted,
    fontSize: typography.sizes.tiny,
    letterSpacing: 0.3,
  },
});
