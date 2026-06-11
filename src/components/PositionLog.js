import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';

// Subtle gold for the PREMIUM pill. Copied from TakeawayCard rather than
// refactored into a shared component on purpose (premature abstraction) —
// keep this value in sync with TakeawayCard's PREMIUM_GOLD if it ever changes.
const PREMIUM_GOLD = '#E5C572';

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
        <View style={styles.premiumPill}>
          <Text style={styles.premiumPillText}>PREMIUM FEATURE</Text>
        </View>
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
    // Match TakeawayCard's elevated depth language exactly.
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
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
    fontWeight: typography.weights.display,
    lineHeight: typography.lineHeights.callout,
    letterSpacing: -0.2,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
  // Pill styling copied from TakeawayCard (intentional duplication).
  premiumPill: {
    backgroundColor: 'rgba(229, 197, 114, 0.12)',
    borderColor: 'rgba(229, 197, 114, 0.45)',
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
  },
  premiumPillText: {
    color: PREMIUM_GOLD,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.2,
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
    borderRadius: 4,
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
    color: colors.muted,
    fontSize: typography.sizes.body,
    fontStyle: 'italic',
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
