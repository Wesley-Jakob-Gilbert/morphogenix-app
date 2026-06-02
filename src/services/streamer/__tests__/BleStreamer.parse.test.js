import BleStreamer, { ADC_MAX, AMBIENT_FLOOR } from '../BleStreamer';

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
    expect(packet.palate[4]).toBeCloseTo(1000 / ADC_MAX);
    expect(packet.palate[7]).toBeCloseTo(2000 / ADC_MAX);
    expect(packet.palate[1]).toBeCloseTo(3000 / ADC_MAX);
    expect(packet.palate[2]).toBeCloseTo(4000 / ADC_MAX);
    expect(packet.palate[9]).toBeCloseTo(3000 / ADC_MAX);
    expect(packet.palate[10]).toBeCloseTo(4000 / ADC_MAX);
    expect(packet.palate[0]).toBe(AMBIENT_FLOOR);
    expect(packet.palateNormalized).toBeCloseTo((1000 + 2000 + 3000 + 4000) / ADC_MAX / 4);
    expect(packet.clenchEvent).toBe(false);
  });

  test('front fake sensors mirror the back palate values from about 150ms earlier', () => {
    const streamer = new BleStreamer();
    const packets = collectPackets(streamer);

    streamer.emitPacketFromLine('0,0,0,410,819');
    streamer.emitPacketFromLine('100,0,0,3276,2867');
    streamer.emitPacketFromLine('150,0,0,2048,2048');

    const laggedPacket = packets[2];
    expect(laggedPacket.palate[1]).toBeCloseTo(2048 / ADC_MAX);
    expect(laggedPacket.palate[2]).toBeCloseTo(2048 / ADC_MAX);
    expect(laggedPacket.palate[9]).toBeCloseTo(410 / ADC_MAX);
    expect(laggedPacket.palate[10]).toBeCloseTo(819 / ADC_MAX);
  });

  test('clench event is edge-triggered and re-arms only after both molars drop below hysteresis', () => {
    const streamer = new BleStreamer();
    const packets = collectPackets(streamer);

    streamer.emitPacketFromLine('0,3000,3000,0,0');
    streamer.emitPacketFromLine('50,3000,3000,0,0');
    streamer.emitPacketFromLine('100,3000,3000,0,0');
    streamer.emitPacketFromLine('150,3000,3000,0,0');
    streamer.emitPacketFromLine('250,3000,1000,0,0');
    streamer.emitPacketFromLine('300,1000,1000,0,0');
    streamer.emitPacketFromLine('400,3000,3000,0,0');
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
    expect(packet.palate[4]).toBe(1);
    expect(packet.palate[7]).toBe(0);
    expect(packet.palate[1]).toBeCloseTo(2047 / ADC_MAX);
    expect(packet.palate[2]).toBe(1);
    expect(packet.palateNormalized).toBeCloseTo((1 + 0 + 2047 / ADC_MAX + 1) / 4);
  });
});
