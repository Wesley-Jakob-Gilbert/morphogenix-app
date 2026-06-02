/**
 * useLiveModeFlag — hydration-safe live URL flag parser.
 *
 * ?live=ble   -> { ble: true,  video: false }
 * ?live=video -> { ble: true,  video: true  }
 * otherwise   -> { ble: false, video: false }
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const OFF = Object.freeze({ ble: false, video: false });

function readModeFromLocation() {
  if (Platform.OS !== 'web') return OFF;
  if (typeof window === 'undefined' || !window.location) return OFF;

  try {
    const params = new URLSearchParams(window.location.search);
    const live = params.get('live');
    if (live === 'video') return { ble: true, video: true };
    if (live === 'ble') return { ble: true, video: false };
    return OFF;
  } catch (_) {
    return OFF;
  }
}

export default function useLiveModeFlag() {
  // Match server prerender and first client render exactly; upgrade after hydration.
  const [mode, setMode] = useState(OFF);

  useEffect(() => {
    setMode(readModeFromLocation());

    if (Platform.OS !== 'web') return undefined;
    if (typeof window === 'undefined') return undefined;

    const onPopState = () => setMode(readModeFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return mode;
}
