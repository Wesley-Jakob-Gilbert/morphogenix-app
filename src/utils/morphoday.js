export function getMorphodayBounds(dateInput = new Date(), startHour = 12) {
  const date = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput);
  const start = new Date(date);
  start.setMinutes(0, 0, 0);

  if (date.getHours() >= startHour) {
    start.setHours(startHour);
  } else {
    start.setDate(start.getDate() - 1);
    start.setHours(startHour);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start,
    end,
    startMs: start.getTime(),
    endMs: end.getTime(),
    label: `${formatShortWindowTime(start)}–${formatShortWindowTime(end)}`,
  };
}

export function bucketPacketsByMorphoday(packets = [], startHour = 12) {
  return packets.reduce((buckets, packet) => {
    if (!packet || typeof packet.t !== 'number') return buckets;
    const { start } = getMorphodayBounds(new Date(packet.t), startHour);
    const key = start.toISOString();
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(packet);
    return buckets;
  }, {});
}

export function aggregateMorphoday(packets = [], startHour = 12, now = new Date()) {
  const { startMs, endMs } = getMorphodayBounds(now, startHour);
  const scoped = packets.filter((packet) => {
    const t = packet && typeof packet.t === 'number' ? packet.t : 0;
    return t >= startMs && t < endMs;
  });

  if (!scoped.length) {
    return {
      packetCount: 0,
      postureScore: 0,
      pressureAvg: 0,
      pressurePeak: 0,
      clenchEvents: 0,
      clenchPerHour: 0,
      nasalPercent: 0,
      wearTimeMs: 0,
    };
  }

  const totals = scoped.reduce(
    (acc, packet) => {
      const palate = Array.isArray(packet.palate) ? packet.palate : [];
      const pressureAvg = palate.length ? average(palate) : 0;

      acc.posture += typeof packet.posture === 'number' ? packet.posture : 0;
      acc.pressure += pressureAvg;
      acc.pressurePeak = Math.max(acc.pressurePeak, ...palate, 0);
      acc.clenchEvents += packet.clenchEvent ? 1 : 0;
      acc.nasalTrue += packet.nasal ? 1 : 0;
      return acc;
    },
    { posture: 0, pressure: 0, pressurePeak: 0, clenchEvents: 0, nasalTrue: 0 }
  );

  const firstT = scoped[0].t;
  const lastT = scoped[scoped.length - 1].t;
  const inferredInterval = inferPacketIntervalMs(scoped);
  const durationMs = Math.max(inferredInterval, lastT - firstT + inferredInterval);
  const hours = durationMs / 3600000;

  return {
    packetCount: scoped.length,
    postureScore: Math.round((totals.posture / scoped.length) * 100),
    pressureAvg: roundTo(totals.pressure / scoped.length, 2),
    pressurePeak: roundTo(totals.pressurePeak, 2),
    clenchEvents: totals.clenchEvents,
    clenchPerHour: hours ? roundTo(totals.clenchEvents / hours, 1) : 0,
    nasalPercent: Math.round((totals.nasalTrue / scoped.length) * 100),
    wearTimeMs: durationMs,
  };
}

export function formatMorphodayWindow(dateInput = new Date(), startHour = 12) {
  const { start, end } = getMorphodayBounds(dateInput, startHour);
  return `${formatShortDate(start)} ${formatShortWindowTime(start)} → ${formatShortWindowTime(end)}`;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function inferPacketIntervalMs(packets) {
  if (packets.length < 2) return 100;
  const delta = packets[1].t - packets[0].t;
  return delta > 0 && delta < 10000 ? delta : 100;
}

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatShortDate(date) {
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatShortWindowTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
