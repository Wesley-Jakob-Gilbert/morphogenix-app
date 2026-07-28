import React, { useState } from 'react';
import {
  ImageBackground,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
// Round 3 #11: default Inter face via AppText wrapper (see App.js note).
import Text from '../components/AppText';
import GlassCard from '../components/GlassCard';
import { SafeAreaView } from 'react-native-safe-area-context';

import useStream from '../hooks/useStream';
import { calibrateSupine, getCalibratedAt } from '../services/headPosition';
import colors from '../theme/colors';
import spacing from '../theme/spacing';
import typography from '../theme/typography';
import { haptics } from '../utils/haptics';

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
  // Round 3 #4: inline error surfaced when calibration has no sensor data.
  const [calibrateError, setCalibrateError] = useState(null);

  const onCalibrateSupine = () => {
    const accelG = packet?.accelG;
    if (!accelG || typeof accelG.x !== 'number') {
      // Round 3 #4: failure used to be invisible — tapping the teal button did
      // nothing (a trust killer). Now fire a warning haptic and show an inline
      // error so the user understands why nothing changed.
      haptics.warning();
      setCalibrateError('No sensor data — connect a device.');
      return;
    }
    const result = calibrateSupine(accelG);
    setCalibratedAt(result.calibratedAt);
    setCalibrateError(null);
    // The one moment a success notification really lands (§5 highest-value
    // haptic in the app).
    haptics.success();
  };

  // Round 3 #4: selection tick + clamp for the posture-target adjuster.
  const adjustPostureTarget = (delta) => {
    haptics.selection();
    setPostureTarget((v) => Math.max(50, Math.min(100, v + delta)));
  };

  const calibratedLabel = formatCalibratedAt(calibratedAt);

  return (
    <ImageBackground
      source={require('../../assets/backgrounds/mountains-soft.jpg')}
      resizeMode="cover"
      style={styles.background}
    >
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
                  onPress={() => adjustPostureTarget(-5)}
                  style={styles.adjustBtn}
                >
                  <Text style={styles.adjustBtnText}>−</Text>
                </Pressable>
                <Pressable
                  onPress={() => adjustPostureTarget(5)}
                  style={styles.adjustBtn}
                >
                  <Text style={styles.adjustBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          </Section>

          {/* Device */}
          <Section title="Device">
            <Row label="Status" value="Demo mode (no device connected)" valueAccent={colors.sky} />
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
              {calibrateError ? (
                <Text style={styles.calibrateError}>{calibrateError}</Text>
              ) : null}
            </View>
          </Section>

          {/* Preferences */}
          <Section title="Preferences">
            <Row label="Morphoday start hour" value="12:00 PM" />
            <Row label="Color scale" value="0–100 normalized" />
            <Row label="Demo Mode" value={Platform.OS === 'web' ? 'ON (locked on web)' : 'ON'} valueAccent={colors.emerald} />
            <Row label="Notifications" value="Off" />
          </Section>

          {/* About Us */}
          <Section title="About">
            <PushRow label="About MorphoGenix" onPress={() => setAboutOpen(true)} />
            <Row label="Version" value="0.1.0 (web demo)" valueAccent={colors.snow} />
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
            <GlassCard variant="dark" style={styles.modalCard} borderRadius={24}>
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
            </GlassCard>
          </View>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>
      <GlassCard variant="dark" style={styles.sectionBody}>{children}</GlassCard>
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
  // Round 3 #4: settings taps were silent. Selection tick on press-in, then
  // run the row's action on release.
  return (
    <Pressable
      onPressIn={() => haptics.selection()}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    // Clear the floating frosted tab bar (#3): content scrolls UNDER it.
    paddingBottom: 90,
  },
  kicker: {
    color: colors.emeraldDeep,
    fontSize: typography.sizes.tiny,
    fontFamily: typography.family.bold,
    letterSpacing: 1.4,
  },
  title: {
    color: colors.stoneDark,
    fontSize: typography.sizes.display,
    lineHeight: typography.lineHeights.display,
    fontFamily: typography.familyDisplay,
    letterSpacing: -0.5,
    marginTop: spacing.xs,
    textShadowColor: 'rgba(255, 255, 255, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    // Section labels are all-caps micro text on a light blurred mountain.
    // Small dark text turned muddy; white + stronger navy shadow reads cleaner.
    // Bumped from tiny (11) to caption (12) + Inter Black for extra weight.
    color: colors.snow,
    fontSize: typography.sizes.caption,
    fontFamily: typography.familyDisplay,
    letterSpacing: 1.6,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    textShadowColor: 'rgba(11, 18, 32, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sectionBody: {
    borderRadius: 20,
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
    backgroundColor: colors.emerald,
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
    color: colors.snow,
    fontSize: typography.sizes.callout,
    fontWeight: typography.weights.bold,
  },
  email: {
    color: colors.snowSoft,
    fontSize: typography.sizes.caption,
    marginTop: spacing.xxs,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  goalLabel: {
    color: colors.stone,
    fontSize: typography.sizes.caption,
  },
  goalValue: {
    color: colors.snow,
    fontSize: typography.sizes.callout,
    fontWeight: typography.weights.bold,
    marginTop: spacing.xxs,
  },
  adjuster: {
    flexDirection: 'row',
  },
  adjustBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(11,18,32,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  adjustBtnText: {
    color: colors.emerald,
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
    backgroundColor: colors.emerald,
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
    color: colors.snowSoft,
    fontSize: typography.sizes.caption,
    marginTop: spacing.sm,
  },
  calibrateError: {
    // Amber = attention/warning (pairs with the warning haptic). NOT stateRed,
    // which is reserved exclusively for the "improve" metric threshold.
    color: colors.amber,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
  },
  rowLabel: {
    color: colors.snow,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
  },
  rowValue: {
    color: colors.snowSoft,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
  },
  chevron: {
    color: colors.stone,
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
    padding: spacing.xl,
  },
  modalKicker: {
    color: colors.emerald,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.4,
  },
  modalTitle: {
    color: colors.snow,
    fontSize: typography.sizes.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: typography.weights.bold,
    marginTop: spacing.xs,
  },
  modalBody: {
    color: colors.snowSoft,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    marginTop: spacing.md,
  },
  modalSection: {
    color: colors.stone,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.4,
    marginTop: spacing.lg,
  },
  modalLine: {
    color: colors.snow,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    marginTop: 4,
  },
  modalLink: {
    marginTop: spacing.lg,
  },
  modalLinkText: {
    color: colors.emerald,
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
    color: colors.snow,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.caption,
  },
});
