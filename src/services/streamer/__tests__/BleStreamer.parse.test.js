import BleStreamer, { ADC_MAX, AMBIENT_FLOOR, LIVE_GAIN } from '../BleStreamer';

// Helper: apply the same normalization the streamer applies (gain + clamp).
function gainNorm(raw) {
  return Math.min(1, Math.max(0, (raw / ADC_MAX) * LIVE_GAIN));
}

function collectPackets(streamer) {
  const packets = [];
  streamer.subscribe((packet) => {
    if (!packet?.type) packets.push(packet);
  });
  return packets;
}

describe('BleStreamer 4-channel parser', () => {
  let randomSpy;

  beforeEach(() => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  test('parses a 4-channel CSV line into the contracted 16-zone packet', () => {
    const streamer = new BleStreamer();
    const packets = collectPackets(streamer);

    streamer.emitPacketFromLine('1234,1000,2000,3000,4000');

    expect(packets).toHaveLength(1);
    const packet = packets[0];
    expect(packet.source).toBe('ble-web');
    expect(packet.palate).toHaveLength(16);
    expect(packet.palateRaw).toEqual([1000, 2000, 3000, 4000]);
    expect(packet.palate[4]).toBeCloseTo(gainNorm(1000));
    expect(packet.palate[7]).toBeCloseTo(gainNorm(2000));
    expect(packet.palate[1]).toBeCloseTo(gainNorm(3000));
    expect(packet.palate[2]).toBeCloseTo(gainNorm(4000));
    expect(packet.palate[9]).toBeCloseTo(gainNorm(3000));
    expect(packet.palate[10]).toBeCloseTo(gainNorm(4000));
    expect(packet.palate[0]).toBe(AMBIENT_FLOOR);
    expect(packet.palateNormalized).toBeCloseTo(
      (gainNorm(1000) + gainNorm(2000) + gainNorm(3000) + gainNorm(4000)) / 4
    );
    expect(packet.clenchEvent).toBe(false);
  });

  test('front fake sensors mirror the back palate values from about 150ms earlier', () => {
    const streamer = new BleStreamer();
    const packets = collectPackets(streamer);

    streamer.emitPacketFromLine('0,0,0,410,819');
    streamer.emitPacketFromLine('100,0,0,3276,2867');
    streamer.emitPacketFromLine('150,0,0,2048,2048');

    const laggedPacket = packets[2];
    expect(laggedPacket.palate[1]).toBeCloseTo(gainNorm(2048));
    expect(laggedPacket.palate[2]).toBeCloseTo(gainNorm(2048));
    expect(laggedPacket.palate[9]).toBeCloseTo(gainNorm(410));
    expect(laggedPacket.palate[10]).toBeCloseTo(gainNorm(819));
  });

  test('clench event is edge-triggered and re-arms only after both molars drop below hysteresis', () => {
    const streamer = new BleStreamer();
    const packets = collectPackets(streamer);

    // After LIVE_GAIN=5, raw=3000 maps to normalized 1.0 (above 0.6 ON threshold).
    // To drop below the 0.4 OFF threshold we need raw <= ~327.
    streamer.emitPacketFromLine('0,3000,3000,0,0');   // both high -> first clench fires
    streamer.emitPacketFromLine('50,3000,3000,0,0');  // still high, no re-fire
    streamer.emitPacketFromLine('100,3000,3000,0,0');
    streamer.emitPacketFromLine('150,3000,3000,0,0');
    streamer.emitPacketFromLine('250,3000,200,0,0');  // R drops below OFF, L still high
    streamer.emitPacketFromLine('300,200,200,0,0');   // both below OFF -> re-armed
    streamer.emitPacketFromLine('400,3000,3000,0,0'); // both high -> second clench fires
    streamer.emitPacketFromLine('500,3000,3000,0,0');

    expect(packets.map((packet) => packet.clenchEvent)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  test('normalizes 12-bit ADC values to 0..1 and clamps out-of-range inputs', () => {
    const streamer = new BleStreamer();
    const packets = collectPackets(streamer);

    streamer.emitPacketFromLine('0,4095,0,2047,5000');

    const packet = packets[0];
    expect(packet.palateRaw).toEqual([4095, 0, 2047, 4095]);
    expect(packet.palate[4]).toBe(1); // 4095 * gain clamps to 1
    expect(packet.palate[7]).toBe(0); // 0 stays 0
    expect(packet.palate[1]).toBeCloseTo(gainNorm(2047)); // 2047 * 5 / 4095 > 1, clamps to 1
    expect(packet.palate[2]).toBe(1);
    expect(packet.palateNormalized).toBeCloseTo((1 + 0 + gainNorm(2047) + 1) / 4);
  });
});
