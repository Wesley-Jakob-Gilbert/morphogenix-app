import React, { useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import useStream from '../hooks/useStream';
import { calibrateSupine, getCalibratedAt } from '../services/headPosition';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import { elevatedCard } from '../theme/surfaces';
import typography from '../theme/typography';

function formatCalibratedAt(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.toLocaleDateString()} ${hh}:${mm}`;
}

export default function AccountScreen() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [postureTarget, setPostureTarget] = useState(80);

  // Phase 3 (IMU): in-memory supine calibration. Reads the latest accelG from
  // the live stream and stores the offset in the headPosition module store.
  // No persistence yet (future task) — local state just drives the UI label.
  const { packet } = useStream();
  const [calibratedAt, setCalibratedAt] = useState(getCalibratedAt());

  const onCalibrateSupine = () => {
    const accelG = packet?.accelG;
    if (!accelG || typeof accelG.x !== 'number') {
      // No IMU data available (e.g. demo mode or phase2 firmware). Be quiet —
      // the label below stays as-is so the user can see nothing changed.
      return;
    }
    const result = calibrateSupine(accelG);
    setCalibratedAt(result.calibratedAt);
  };

  const calibratedLabel = formatCalibratedAt(calibratedAt);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>ACCOUNT</Text>
        <Text style={styles.title}>You</Text>

        {/* Profile */}
        <Section title="Profile">
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>WG</Text>
            </View>
            <View style={styles.profileMeta}>
              <Text style={styles.name}>Wes Gilbert</Text>
              <Text style={styles.email}>wes@morphogenix.ai</Text>
            </View>
          </View>

          <View style={styles.goalRow}>
            <View>
              <Text style={styles.goalLabel}>Posture target</Text>
              <Text style={styles.goalValue}>{postureTarget}/100</Text>
            </View>
            <View style={styles.adjuster}>
              <Pressable
                onPress={() => setPostureTarget((v) => Math.max(50, v - 5))}
                style={styles.adjustBtn}
              >
                <Text style={styles.adjustBtnText}>−</Text>
              </Pressable>
              <Pressable
                onPress={() => setPostureTarget((v) => Math.min(100, v + 5))}
                style={styles.adjustBtn}
              >
                <Text style={styles.adjustBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        </Section>

        {/* Device */}
        <Section title="Device">
          <Row label="Status" value="Demo mode (no device connected)" valueAccent={colors.amber} />
          <Row label="Last sync" value="—" />
          <Row label="Battery" value="—" />
        </Section>

        {/* Head Position (Phase 3 IMU) */}
        <Section title="Head Position">
          <View style={styles.calibrateRow}>
            <Pressable
              onPress={onCalibrateSupine}
              style={({ pressed }) => [styles.calibrateBtn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel="Calibrate supine head position"
            >
              <Text style={styles.calibrateBtnText}>Calibrate Supine</Text>
            </Pressable>
            <Text style={styles.calibrateMeta}>
              {calibratedLabel
                ? `Last calibrated: ${calibratedLabel}`
                : 'Not yet calibrated'}
            </Text>
          </View>
        </Section>

        {/* Preferences */}
        <Section title="Preferences">
          <Row label="Morphoday start hour" value="12:00 PM" />
          <Row label="Color scale" value="0–100 normalized" />
          <Row label="Demo Mode" value={Platform.OS === 'web' ? 'ON (locked on web)' : 'ON'} valueAccent={colors.teal} />
          <Row label="Notifications" value="Off" />
        </Section>

        {/* About Us */}
        <Section title="About">
          <PushRow label="About MorphoGenix" onPress={() => setAboutOpen(true)} />
          <Row label="Version" value="0.1.0 (web demo)" />
          <PushRow
            label="morphogenix.ai"
            onPress={() => Linking.openURL('https://morphogenix.ai')}
          />
        </Section>

        {/* Legal */}
        <Section title="Legal">
          <PushRow label="Privacy Policy" onPress={() => {}} />
          <PushRow label="Terms of Service" onPress={() => {}} />
        </Section>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <Modal
        visible={aboutOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAboutOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalKicker}>ABOUT MORPHOGENIX</Text>
            <Text style={styles.modalTitle}>Oral biometrics, mainstream.</Text>
            <Text style={styles.modalBody}>
              MorphoGenix is building the first wearable that turns the roof of your mouth into a daily
              health signal. We map palatal pressure, posture, clenching, and nasal breathing — quietly,
              continuously — so you can see how your body actually feels through the day.
            </Text>
            <Text style={styles.modalBody}>
              Our mission is to make oral biometrics as routine as steps and heart rate, and to put that
              data in your hands without a clinic visit.
            </Text>

            <Text style={styles.modalSection}>Team</Text>
            <Text style={styles.modalLine}>Wes Gilbert · Founder</Text>

            <Text style={styles.modalSection}>Version</Text>
            <Text style={styles.modalLine}>0.1.0 (web demo)</Text>

            <Pressable
              onPress={() => Linking.openURL('https://morphogenix.ai')}
              style={styles.modalLink}
            >
              <Text style={styles.modalLinkText}>morphogenix.ai →</Text>
            </Pressable>

            <Pressable onPress={() => setAboutOpen(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value, valueAccent }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueAccent ? { color: valueAccent } : null]}>{value}</Text>
    </View>
  );
}

function PushRow({ label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.navy },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    // Clear the floating frosted tab bar (#3): content scrolls UNDER it.
    paddingBottom: 90,
  },
  kicker: {
    color: colors.teal,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.4,
  },
  title: {
    color: colors.white,
    fontSize: typography.sizes.hero,
    lineHeight: typography.lineHeights.hero,
    fontFamily: typography.family.bold,
    fontWeight: typography.weights.bold,
    marginTop: spacing.xs,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    color: colors.teal,
    opacity: 0.7,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionBody: {
    // Round 3 #3: was flat `colors.surface` + rgba hairline. Unify on the
    // elevated card material so Account settings groups match Home.
    ...elevatedCard,
    borderRadius: 18,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  profileMeta: { flex: 1 },
  name: {
    color: colors.white,
    fontSize: typography.sizes.callout,
    fontWeight: typography.weights.bold,
  },
  email: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    marginTop: 2,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  goalLabel: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
  },
  goalValue: {
    color: colors.white,
    fontSize: typography.sizes.callout,
    fontWeight: typography.weights.bold,
    marginTop: 2,
  },
  adjuster: {
    flexDirection: 'row',
  },
  adjustBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  adjustBtnText: {
    color: colors.teal,
    fontSize: 22,
    fontWeight: typography.weights.bold,
    lineHeight: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  calibrateRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  calibrateBtn: {
    backgroundColor: colors.teal,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  calibrateBtnText: {
    color: colors.navy,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.3,
  },
  calibrateMeta: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    marginTop: spacing.sm,
  },
  rowLabel: {
    color: colors.white,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
  },
  rowValue: {
    color: colors.muted,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
  },
  chevron: {
    color: colors.muted,
    fontSize: 22,
    fontWeight: typography.weights.medium,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,18,32,0.85)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    // Round 3 #3: unify the About modal on the elevated card material. Drop the
    // one-off teal-tinted border in favor of the standard ink hairline so it
    // reads as the same surface language as every other card.
    ...elevatedCard,
    borderRadius: 24,
    padding: spacing.xl,
  },
  modalKicker: {
    color: colors.teal,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.4,
  },
  modalTitle: {
    color: colors.white,
    fontSize: typography.sizes.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: typography.weights.bold,
    marginTop: spacing.xs,
  },
  modalBody: {
    color: colors.muted,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    marginTop: spacing.md,
  },
  modalSection: {
    color: colors.teal,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.4,
    marginTop: spacing.lg,
  },
  modalLine: {
    color: colors.white,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    marginTop: 4,
  },
  modalLink: {
    marginTop: spacing.lg,
  },
  modalLinkText: {
    color: colors.teal,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
  },
  modalClose: {
    marginTop: spacing.xl,
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.navy,
  },
  modalCloseText: {
    color: colors.white,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.caption,
  },
});
