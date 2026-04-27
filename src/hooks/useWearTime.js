import { useMemo } from 'react';

import useSettingsStore from '../store/settingsStore';
import { getMorphodayBounds } from '../utils/morphoday';

const DEMO_BASE_WEAR_MS = (3 * 60 + 12) * 60 * 1000;
const DEMO_SLEEP_MS = (6 * 60 + 4) * 60 * 1000;
const PACKET_INTERVAL_MS = 100;

export default function useWearTime(packets = []) {
  const demoMode = useSettingsStore((state) => state.demoMode);
  const morphodayStartHour = useSettingsStore((state) => state.morphodayStartHour);

  return useMemo(() => {
    const bounds = getMorphodayBounds(new Date(), morphodayStartHour);
    const currentMorphodayPackets = packets.filter(
      (packet) => packet && packet.t >= bounds.startMs && packet.t < bounds.endMs
    );

    const liveWearMs = currentMorphodayPackets.length * PACKET_INTERVAL_MS;
    const wearTimeMs = (demoMode ? DEMO_BASE_WEAR_MS : 0) + liveWearMs;
    const sleepCoverageMs = demoMode ? DEMO_SLEEP_MS : 0;

    return {
      wearTimeMs,
      sleepCoverageMs,
      label: `Worn ${formatDuration(wearTimeMs)} today · Sleep coverage ${formatDuration(sleepCoverageMs)}`,
    };
  }, [packets, morphodayStartHour, demoMode]);
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}
