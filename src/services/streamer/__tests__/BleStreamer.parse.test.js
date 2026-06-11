import BleStreamer, {
  ADC_MAX,
  AMBIENT_FLOOR,
  LIVE_GAIN,
  ACCEL_G_PER_LSB,
  BIN_MAGIC,
  BIN_VERSION_V1,
  BIN_VERSION_V2,
} from '../BleStreamer';

// Helper: apply the same normalization the streamer applies (gain + clamp).
function gainNorm(raw) {
  return Math.min(1, Math.max(0, (raw / ADC_MAX) * LIVE_GAIN));
}

// ---- Binary packet construction helpers (mirror the firmware byte layout) --

function xorChecksum(bytes, len) {
  let x = 0;
  for (let i = 0; i < len; i++) x ^= bytes[i];
  return x;
}

// Build a binary v2 packet: magic | ver=2 | ts(u32 LE) | count=7 |
// 4*u16 LE fsr | 3*i16 LE accel | xor.
function buildV2Packet({ ts = 1000, fsr = [0, 0, 0, 0], accel = [0, 0, 0] }) {
  const size = 1 + 1 + 4 + 1 + 8 + 6 + 1; // 22
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  let off = 0;
  buf[off++] = BIN_MAGIC;
  buf[off++] = BIN_VERSION_V2;
  dv.setUint32(off, ts, true);
  off += 4;
  buf[off++] = 7; // sensor count
  for (let i = 0; i < 4; i++) {
    dv.setUint16(off, fsr[i], true);
    off += 2;
  }
  for (let i = 0; i < 3; i++) {
    dv.setInt16(off, accel[i], true);
    off += 2;
  }
  buf[off] = xorChecksum(buf, off);
  return buf;
}

// Build a binary v1 packet: magic | ver=1 | ts(u32 LE) | count | count*u16 LE | xor.
function buildV1Packet({ ts = 1000, adc = [0, 0, 0, 0, 0, 0] }) {
  const count = adc.length;
  const size = 1 + 1 + 4 + 1 + 2 * count + 1;
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  let off = 0;
  buf[off++] = BIN_MAGIC;
  buf[off++] = BIN_VERSION_V1;
  dv.setUint32(off, ts, true);
  off += 4;
  buf[off++] = count;
  for (let i = 0; i < count; i++) {
    dv.setUint16(off, adc[i], true);
    off += 2;
  }
  buf[off] = xorChecksum(buf, off);
  return buf;
}

// Feed a Uint8Array through the real notification path as a DataView event.
function feedBinary(streamer, bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  streamer.handleNotification({ target: { value: dv } });
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

describe('BleStreamer binary v2 parser (4 FSR + 3 accel)', () => {
  let randomSpy;

  beforeEach(() => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  test('parses a v2 packet, mapping FSR to the same zones as ASCII', () => {
    const streamer = new BleStreamer();
    const packets = collectPackets(streamer);

    // FSR firmware order: Molar_L, Molar_R, Palate_L, Palate_R.
    feedBinary(
      streamer,
      buildV2Packet({ ts: 1234, fsr: [1000, 2000, 3000, 4000], accel: [0, 0, 16384] })
    );

    expect(packets).toHaveLength(1);
    const packet = packets[0];
    expect(packet.source).toBe('ble-web');
    expect(packet.palate).toHaveLength(16);
    // FSR fields identical to the ASCII path for the same raw values.
    expect(packet.palateRaw).toEqual([1000, 2000, 3000, 4000]);
    expect(packet.palate[4]).toBeCloseTo(gainNorm(1000));
    expect(packet.palate[7]).toBeCloseTo(gainNorm(2000));
    expect(packet.palate[1]).toBeCloseTo(gainNorm(3000));
    expect(packet.palate[2]).toBeCloseTo(gainNorm(4000));
    expect(packet.palate[9]).toBeCloseTo(gainNorm(3000));
    expect(packet.palate[10]).toBeCloseTo(gainNorm(4000));
    expect(packet.palate[0]).toBe(AMBIENT_FLOOR);
    expect(packet.clenchEvent).toBe(false);
  });

  test('populates accel (raw int16) and accelG (g-units) fields', () => {
    const streamer = new BleStreamer();
    const packets = collectPackets(streamer);

    // +16384 on Z is +1g at +/-2g full scale; -16384 on Y is -1g.
    feedBinary(
      streamer,
      buildV2Packet({ ts: 5000, fsr: [10, 20, 30, 40], accel: [0, -16384, 16384] })
    );

    const packet = packets[0];
    expect(packet.accel).toEqual({ x: 0, y: -16384, z: 16384 });
    expect(packet.accelG.x).toBeCloseTo(0, 5);
    expect(packet.accelG.y).toBeCloseTo(-1, 4);
    expect(packet.accelG.z).toBeCloseTo(1, 4);
    // Sanity-check the conversion constant itself.
    expect(packet.accelG.z).toBeCloseTo(16384 * ACCEL_G_PER_LSB, 6);
  });

  test('decodes negative accel values correctly (signed int16 LE)', () => {
    const streamer = new BleStreamer();
    const packets = collectPackets(streamer);

    feedBinary(
      streamer,
      buildV2Packet({ ts: 9000, fsr: [0, 0, 0, 0], accel: [-32768, 32767, -1] })
    );

    const packet = packets[0];
    expect(packet.accel).toEqual({ x: -32768, y: 32767, z: -1 });
  });

  test('drops a v2 packet whose XOR checksum is corrupted', () => {
    const streamer = new BleStreamer();
    const packets = collectPackets(streamer);

    const buf = buildV2Packet({ ts: 1, fsr: [1, 2, 3, 4], accel: [5, 6, 7] });
    buf[buf.length - 1] ^= 0xff; // corrupt the checksum
    feedBinary(streamer, buf);

    expect(packets).toHaveLength(0);
  });

  test('reassembles a v2 packet delivered across two notifications', () => {
    const streamer = new BleStreamer();
    const packets = collectPackets(streamer);

    const buf = buildV2Packet({ ts: 42, fsr: [100, 200, 300, 400], accel: [0, 0, 16384] });
    feedBinary(streamer, buf.slice(0, 10));
    expect(packets).toHaveLength(0); // incomplete
    feedBinary(streamer, buf.slice(10));
    expect(packets).toHaveLength(1);
    expect(packets[0].palateRaw).toEqual([100, 200, 300, 400]);
    expect(packets[0].accelG.z).toBeCloseTo(1, 4);
  });

  test('legacy v1 packet fills FSR slots and leaves accel undefined', () => {
    const streamer = new BleStreamer();
    const packets = collectPackets(streamer);

    // v1 6-channel; first 4 map to FSR slots, extra channels ignored.
    feedBinary(
      streamer,
      buildV1Packet({ ts: 1, adc: [1000, 2000, 3000, 4000, 1234, 5678] })
    );

    const packet = packets[0];
    expect(packet.palateRaw).toEqual([1000, 2000, 3000, 4000]);
    expect(packet.palate[4]).toBeCloseTo(gainNorm(1000));
    expect(packet.accel).toBeUndefined();
    expect(packet.accelG).toBeUndefined();
  });
});
