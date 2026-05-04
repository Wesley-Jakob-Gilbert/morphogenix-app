/**
 * useIsClient \u2014 returns false on the very first render (server AND first
 * client render), then flips to true after hydration completes.
 *
 * Use this to gate any subtree whose markup, state, or behavior depends on
 * browser-only globals (window, navigator, URL params, localStorage, time,
 * random, etc). The first client render stays byte-identical to the server's
 * empty/Suspense-fallback HTML, so React 19 hydration cannot mismatch on it.
 *
 * The wrapped subtree mounts one frame later \u2014 visually identical, but
 * structurally hydration-safe. This is the same pattern Next.js's
 * `dynamic({ ssr: false })` and Remix's `<ClientOnly>` use under the hood.
 */

import { useEffect, useState } from 'react';

export default function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}
