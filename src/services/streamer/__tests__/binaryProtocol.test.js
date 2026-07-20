import {
  ADC_MAX,
  AMBIENT_FLOOR,
  LIVE_GAIN,
  ACCEL_G_PER_LSB,
  BIN_MAGIC,
  BIN_VERSION_V1,
  BIN_VERSION_V2,
  DEVICE_NAME_FILTER,
  NUS_SERVICE_UUID,
  NUS_TX_CHAR_UUID,
  NUS_RX_CHAR_UUID,
  BLE_COMMANDS,
  detectWireFormat,
  parseAsciiLine,
  BinaryFrameParser,
  FrameShaper,
} from '../binaryProtocol';

// Helper: replicate the streamer normalization (gain + clamp).
function gainNorm(raw) {
  return Math.min(1, Math.max(0, (raw / ADC_MAX) * LIVE_GAIN));
}

function xorChecksum(bytes, len) {
  let x = 0;
  for (let i = 0; i < len; i++) x ^= bytes[i];
  return x;
}

function buildV2Packet({ ts = 1000, fsr = [0, 0, 0, 0], accel = [0, 0, 0] }) {
  const size = 1 + 1 + 4 + 1 + 8 + 6 + 1; // 22
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  let off = 0;
  buf[off++] = BIN_MAGIC;
  buf[off++] = BIN_VERSION_V2;
  dv.setUint32(off, ts, true);
  off += 4;
  buf[off++] = 7;
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

// Shape a stream of ASCII lines and collect the emitted packets, using a
// single FrameShaper so the mirror/clench state carries across lines exactly
// like the live streamer.
function shapeLines(lines) {
  const shaper = new FrameShaper({ source: 'ble-web' });
  return lines.map((line) => {
    const parsed = parseAsciiLine(line);
    return shaper.shape(parsed.firmwareMs, parsed.rawValues, null).packet;
  });
}

describe('binaryProtocol constants + UUIDs', () => {
  test('exposes the verified NUS UUIDs and device name from the firmware', () => {
    expect(NUS_SERVICE_UUID).toBe('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
    expect(NUS_TX_CHAR_UUID).toBe('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
    expect(NUS_RX_CHAR_UUID).toBe('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
    // Verified from Bluefruit.setName("MorphoGenixSOD") in the .ino.
    expect(DEVICE_NAME_FILTER).toBe('MorphoGenixSOD');
  });

  test('exposes the three firmware RX commands', () => {
    expect(BLE_COMMANDS.REZERO).toBe('z');
    expect(BLE_COMMANDS.REPORT).toBe('r');
    expect(BLE_COMMANDS.IMU_DIAG).toBe('i');
  });

  test('detectWireFormat sniffs binary vs ascii from the first byte', () => {
    expect(detectWireFormat(BIN_MAGIC)).toBe('binary');
    expect(detectWireFormat('1'.charCodeAt(0))).toBe('ascii');
    expect(detectWireFormat(0x30)).toBe('ascii');
  });
});

describe('parseAsciiLine', () => {
  test('parses a well-formed 5-field line', () => {
    expect(parseAsciiLine('1234,1000,2000,3000,4000')).toEqual({
      firmwareMs: 1234,
      rawValues: [1000, 2000, 3000, 4000],
    });
  });

  test('returns null for too-few fields', () => {
    expect(parseAsciiLine('1234,1000,2000')).toBeNull();
  });

  test('returns null for non-numeric fields', () => {
    expect(parseAsciiLine('1234,abc,2000,3000,4000')).toBeNull();
  });
});

describe('FrameShaper (ASCII path)', () => {
  let randomSpy;
  beforeEach(() => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => randomSpy.mockRestore());

  test('parses a 4-channel line into the contracted 16-zone packet', () => {
    const [packet] = shapeLines(['1234,1000,2000,3000,4000']);
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

  test('front fake sensors mirror the back palate from ~150ms earlier', () => {
    const packets = shapeLines(['0,0,0,410,819', '100,0,0,3276,2867', '150,0,0,2048,2048']);
    const lagged = packets[2];
    expect(lagged.palate[1]).toBeCloseTo(gainNorm(2048));
    expect(lagged.palate[2]).toBeCloseTo(gainNorm(2048));
    expect(lagged.palate[9]).toBeCloseTo(gainNorm(410));
    expect(lagged.palate[10]).toBeCloseTo(gainNorm(819));
  });

  test('clench is edge-triggered and re-arms only after both molars drop', () => {
    const packets = shapeLines([
      '0,3000,3000,0,0',
      '50,3000,3000,0,0',
      '100,3000,3000,0,0',
      '150,3000,3000,0,0',
      '250,3000,200,0,0',
      '300,200,200,0,0',
      '400,3000,3000,0,0',
      '500,3000,3000,0,0',
    ]);
    expect(packets.map((p) => p.clenchEvent)).toEqual([
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

  test('normalizes 12-bit ADC and clamps out-of-range inputs', () => {
    const [packet] = shapeLines(['0,4095,0,2047,5000']);
    expect(packet.palateRaw).toEqual([4095, 0, 2047, 4095]);
    expect(packet.palate[4]).toBe(1);
    expect(packet.palate[7]).toBe(0);
    expect(packet.palate[1]).toBeCloseTo(gainNorm(2047));
    expect(packet.palate[2]).toBe(1);
    expect(packet.palateNormalized).toBeCloseTo((1 + 0 + gainNorm(2047) + 1) / 4);
  });
});

describe('BinaryFrameParser + FrameShaper (binary v2: 4 FSR + 3 accel)', () => {
  let randomSpy;
  beforeEach(() => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => randomSpy.mockRestore());

  function parseAndShape(bytesList) {
    const parser = new BinaryFrameParser();
    const shaper = new FrameShaper({ source: 'ble-web' });
    const packets = [];
    for (const bytes of bytesList) {
      const frames = parser.push(bytes);
      for (const f of frames) {
        packets.push(shaper.shape(f.timestampMs, f.fsr, f.accel).packet);
      }
    }
    return packets;
  }

  test('parses a v2 packet, mapping FSR to the ASCII zones', () => {
    const packets = parseAndShape([
      buildV2Packet({ ts: 1234, fsr: [1000, 2000, 3000, 4000], accel: [0, 0, 16384] }),
    ]);
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
    expect(packet.clenchEvent).toBe(false);
  });

  test('populates accel (raw int16) and accelG (g-units)', () => {
    const packets = parseAndShape([
      buildV2Packet({ ts: 5000, fsr: [10, 20, 30, 40], accel: [0, -16384, 16384] }),
    ]);
    const packet = packets[0];
    expect(packet.accel).toEqual({ x: 0, y: -16384, z: 16384 });
    expect(packet.accelG.x).toBeCloseTo(0, 5);
    expect(packet.accelG.y).toBeCloseTo(-1, 4);
    expect(packet.accelG.z).toBeCloseTo(1, 4);
    expect(packet.accelG.z).toBeCloseTo(16384 * ACCEL_G_PER_LSB, 6);
  });

  test('decodes negative accel values (signed int16 LE)', () => {
    const packets = parseAndShape([
      buildV2Packet({ ts: 9000, fsr: [0, 0, 0, 0], accel: [-32768, 32767, -1] }),
    ]);
    expect(packets[0].accel).toEqual({ x: -32768, y: 32767, z: -1 });
  });

  test('drops a v2 packet whose XOR checksum is corrupted', () => {
    const buf = buildV2Packet({ ts: 1, fsr: [1, 2, 3, 4], accel: [5, 6, 7] });
    buf[buf.length - 1] ^= 0xff;
    const parser = new BinaryFrameParser();
    let err = null;
    parser.onParseError = (m) => (err = m);
    const frames = parser.push(buf);
    expect(frames).toHaveLength(0);
    expect(err).toMatch(/checksum/);
  });

  test('reassembles a v2 packet delivered across two notifications', () => {
    const buf = buildV2Packet({ ts: 42, fsr: [100, 200, 300, 400], accel: [0, 0, 16384] });
    const parser = new BinaryFrameParser();
    expect(parser.push(buf.slice(0, 10))).toHaveLength(0);
    const frames = parser.push(buf.slice(10));
    expect(frames).toHaveLength(1);
    expect(frames[0].fsr).toEqual([100, 200, 300, 400]);
    expect(frames[0].accel.z).toBe(16384);
  });

  test('parses two back-to-back packets in a single notification', () => {
    const a = buildV2Packet({ ts: 1, fsr: [1, 2, 3, 4], accel: [0, 0, 0] });
    const b = buildV2Packet({ ts: 2, fsr: [5, 6, 7, 8], accel: [0, 0, 0] });
    const merged = new Uint8Array(a.length + b.length);
    merged.set(a, 0);
    merged.set(b, a.length);
    const frames = new BinaryFrameParser().push(merged);
    expect(frames).toHaveLength(2);
    expect(frames[0].timestampMs).toBe(1);
    expect(frames[1].timestampMs).toBe(2);
  });

  test('resyncs past leading garbage before the magic byte', () => {
    const good = buildV2Packet({ ts: 7, fsr: [9, 9, 9, 9], accel: [0, 0, 0] });
    const merged = new Uint8Array(3 + good.length);
    merged.set([0x00, 0x11, 0x22], 0);
    merged.set(good, 3);
    const frames = new BinaryFrameParser().push(merged);
    expect(frames).toHaveLength(1);
    expect(frames[0].timestampMs).toBe(7);
  });

  test('legacy v1 packet fills FSR slots and leaves accel null', () => {
    const parser = new BinaryFrameParser();
    const shaper = new FrameShaper({ source: 'ble-web' });
    const frames = parser.push(
      buildV1Packet({ ts: 1, adc: [1000, 2000, 3000, 4000, 1234, 5678] })
    );
    expect(frames).toHaveLength(1);
    expect(frames[0].accel).toBeNull();
    const { packet } = shaper.shape(frames[0].timestampMs, frames[0].fsr, frames[0].accel);
    expect(packet.palateRaw).toEqual([1000, 2000, 3000, 4000]);
    expect(packet.palate[4]).toBeCloseTo(gainNorm(1000));
    expect(packet.accel).toBeUndefined();
    expect(packet.accelG).toBeUndefined();
  });
});
