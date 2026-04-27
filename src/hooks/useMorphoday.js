import { useCallback, useEffect, useMemo, useState } from 'react';

import useSettingsStore from '../store/settingsStore';
import { aggregateMorphoday, formatMorphodayWindow, getMorphodayBounds } from '../utils/morphoday';

const MAX_LIVE_PACKETS = 6000;

export default function useMorphoday(packet) {
  const morphodayStartHour = useSettingsStore((state) => state.morphodayStartHour);
  const [packets, setPackets] = useState([]);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!packet || typeof packet.t !== 'number') return;
    const bounds = getMorphodayBounds(new Date(), morphodayStartHour);
    if (packet.t < bounds.startMs || packet.t >= bounds.endMs) return;

    setPackets((existing) => {
      const next = [...existing, packet];
      return next.length > MAX_LIVE_PACKETS ? next.slice(next.length - MAX_LIVE_PACKETS) : next;
    });
  }, [packet, morphodayStartHour]);

  const refresh = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  const aggregate = useMemo(
    () => aggregateMorphoday(packets, morphodayStartHour, new Date()),
    [packets, morphodayStartHour, refreshToken]
  );

  const morphodayWindow = useMemo(
    () => formatMorphodayWindow(new Date(), morphodayStartHour),
    [morphodayStartHour, refreshToken]
  );

  return {
    aggregate,
    packets,
    morphodayWindow,
    refresh,
  };
}
