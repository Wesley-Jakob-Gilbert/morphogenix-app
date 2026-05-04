/**
 * useLiveBleFlag — returns true on the bench build when the user has opted
 * into live BLE mode via `?live=ble` in the URL.
 *
 * Why this exists separately from settingsStore.demoMode:
 *   The settings store hard-codes `demoMode = true` on web (see
 *   store/settingsStore.js — every setter has `isWeb ? true : ...`). That's
 *   intentional so morphogenix.ai/demo can never be flipped into a half-broken
 *   "live" state by a curious visitor. We don't want to weaken that invariant.
 *
 *   Instead, the bench build exposes an explicit, opt-in URL flag:
 *
 *     https://morphogenix-app.fly.dev/demo/?live=ble
 *
 *   Production (morphogenix.ai/demo) ignores the flag because the public
 *   landing page deliberately doesn't ship the BleStreamer code path on the
 *   "go-live" branch (we control that with a build-time gate later).
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
  // Initialize from the current URL. SSR/prerender returns false safely.
  const [enabled, setEnabled] = useState(readFlagFromLocation);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    if (typeof window === 'undefined') return undefined;

    // Recompute on back/forward navigation so the flag is reactive.
    const onPopState = () => setEnabled(readFlagFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return enabled;
}
