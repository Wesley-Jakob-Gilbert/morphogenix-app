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
 * Scope note: for this round the wrapper is only consumed by the animated
 * ScoreRing settle (#2) and the tab-bar tab change (#3). The broader rollout
 * across every primary interaction is a separate P1 item — do NOT wire this
 * into tiles, pills, rows, etc. yet.
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
