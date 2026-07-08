import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Centralized haptics wrapper (Roadmap V2 item #6).
 *
 * A tiny façade over `expo-haptics` so callers fire intent-named feedback
 * (`haptics.selection()`, `haptics.success()`, …) without repeating the
 * `Haptics.*` plumbing or platform guards at every call site.
 *
 * On web, `expo-haptics` has no native backend and the calls reject / warn,
 * so every method is a no-op there. The method surface is identical across
 * platforms so callers never need their own `Platform.OS` checks.
 *
 * Scope note (updated Round 3): the wrapper is now wired across the primary
 * interactions per Round 3 #4 — MetricTile press, Analytics period pills,
 * History row press, Account +/- adjuster + PushRow, and Calibrate Supine
 * (success/warning). The earlier "do NOT wire this into tiles/pills/rows yet"
 * hold has been lifted by Wes.
 */

const noop = () => {};

export const haptics = Platform.OS === 'web'
  ? {
      selection: noop,
      light: noop,
      medium: noop,
      heavy: noop,
      success: noop,
      warning: noop,
      error: noop,
    }
  : {
      selection: () => Haptics.selectionAsync(),
      light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
      medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
      heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
      success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
      error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    };

export default haptics;
