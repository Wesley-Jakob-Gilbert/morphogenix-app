/**
 * useLiveBleFlag — returns true on the bench build when the user has opted
 * into live BLE mode via `?live=ble` in the URL.
 *
 * Hydration safety:
 *   Expo Router uses static rendering — every page is prerendered on the
 *   server (Node, no window) and then hydrated on the client. If this hook
 *   returned `true` on first client render but `false` during server render,
 *   the React trees would diverge and React 18 would throw "hydration
 *   mismatch" (minified error #418), tearing the entire tree down. That
 *   manifested as a click-but-no-chooser bug because the unmounted button
 *   stopped responding to events.
 *
 *   Fix: ALWAYS return false on the very first render (server AND client),
 *   then flip to the real value inside useEffect, which only runs after the
 *   first commit. This makes the first client render byte-identical to the
 *   server output. The Connect card appears one frame later — visually
 *   indistinguishable, structurally hydration-safe.
 *
 * Why this hook exists separately from settingsStore.demoMode:
 *   The settings store hard-codes `demoMode = true` on web (see
 *   store/settingsStore.js). That's intentional so morphogenix.ai/demo can
 *   never be flipped into a half-broken "live" state by a curious visitor.
 *   We don't want to weaken that invariant. The bench build instead exposes
 *   an explicit, opt-in URL flag:
 *
 *     https://morphogenix-app.fly.dev/demo/?live=ble
 *
 * On native (iOS/Android) this returns false; the native app uses
 * settingsStore.demoMode as before, since BLE there will eventually go
 * through react-native-ble-plx, not Web Bluetooth.
 */

import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

function readFlagFromLocation() {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined' || !window.location) return false;

  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('live') === 'ble';
  } catch (_) {
    return false;
  }
}

export default function useLiveBleFlag() {
  // CRITICAL: initial value MUST match server prerender (which has no
  // window). Always start at `false`, regardless of URL, then upgrade in
  // useEffect after hydration is complete.
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Runs only on the client, after first commit. Safe to read window.
    setEnabled(readFlagFromLocation());

    if (Platform.OS !== 'web') return undefined;
    if (typeof window === 'undefined') return undefined;

    // Recompute on back/forward navigation so the flag is reactive.
    const onPopState = () => setEnabled(readFlagFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return enabled;
}
