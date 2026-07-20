/**
 * binaryProtocol.js — pure, transport-agnostic MorphoGenix wire protocol.
 *
 * This module is the single source of truth for:
 *   - The Nordic UART Service (NUS) UUIDs and advertised device name.
 *   - The binary packet format (v1 legacy, v2 = 4 FSR + 3 accel).
 *   - The ASCII line format (legacy calibrated firmware).
 *   - The FSR normalization + palate-zone mapping + lagged-mirror + clench
 *     edge-detection logic that shapes a raw sample into the IStreamer packet.
 *
 * It contains NO transport code (no Web Bluetooth, no ble-plx). Both the
 * native adapter (react-native-ble-plx) and the web adapter (Web Bluetooth)
 * import from here so the parsing/shaping stays bit-for-bit identical across
 * platforms. This is the module that owns the unit tests.
 *
 * Firmware reference: firmware/phase3_palate_4ch_imu_binary/phase3_palate_4ch_imu_binary.ino
 *   - Bluefruit.setName("MorphoGenixSOD")   -> DEVICE_NAME_FILTER below
 *   - BLEUart uses Nordic's standard NUS UUIDs
 *   - Binary v2: magic 0xA7 | ver 0x02 | ts(u32 LE) | count=7 |
 *                4*u16 LE fsr | 3*i16 LE accel | xor   = 22 bytes @ 10 Hz
 *   - Commands over RX: 'z' (rezero), 'r' (report), 'i' (IMU diagnostic)
 */

// =========================================================================
// Nordic UART Service UUIDs — MUST match the firmware (Bluefruit BLEUart).
// =========================================================================
export const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NUS_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // device -> phone (notify)
export const NUS_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // phone -> device (write)

// Firmware advertises this exact name (verified from the .ino setName call).
export const DEVICE_NAME_FILTER = 'MorphoGenixSOD';

// Commands the firmware understands over the RX characteristic.
export const BLE_COMMANDS = Object.freeze({
  REZERO: 'z', // rezero FSR baselines
  REPORT: 'r', // report current baselines
  IMU_DIAG: 'i', // one-shot IMU diagnostic
});

// FSR ADC range on the nRF52840 in 12-bit mode. Normalizes 0..4095 -> 0..1.
export const ADC_MAX = 4095;

// Visual gain applied AFTER ADC normalization. The firmware sends
// baseline-subtracted values that rarely exceed ~900 of 4095 full-scale, so a
// gain of 5 pushes a typical chew up to ~1.0 while hard bites clamp at 1.0.
export const LIVE_GAIN = 5;

// =========================================================================
// CHANNEL MAP — MUST match firmware wire order.
// =========================================================================
//   adc[0] Molar_L  (A0)  adc[1] Molar_R (A1)  adc[2] Palate_L (A2)  adc[3] Palate_R (A3)
export const CHANNEL_MAP = Object.freeze([
  { name: 'Molar_L', region: 'clench.left', pin: 'A0' },
  { name: 'Molar_R', region: 'clench.right', pin: 'A1' },
  { name: 'Palate_L', region: 'palate.back.left', pin: 'A2' },
  { name: 'Palate_R', region: 'palate.back.right', pin: 'A3' },
]);

// =========================================================================
// BINARY WIRE FORMAT
// =========================================================================
export const BIN_MAGIC = 0xa7;
export const BIN_VERSION_V1 = 0x01;
export const BIN_VERSION_V2 = 0x02;
export const BIN_HEADER_BYTES = 7; // magic + ver + ts(4) + count
export const BIN_TRAILER_BYTES = 1; // xor checksum
export const V2_FSR_COUNT = 4;
export const V2_ACCEL_COUNT = 3;
// +/-2g full-scale conversion: raw int16 -> g. raw * 2 / 32768.
export const ACCEL_G_PER_LSB = 2 / 32768;

// Palate-shaping constants.
export const PALATE_ZONE_COUNT = 16;
export const AMBIENT_FLOOR = 0.05;
export const MIRROR_LAG_MS = 150;
export const MIRROR_BUFFER_MS = 200;
export const CLENCH_ON_THRESHOLD = 0.6;
export const CLENCH_OFF_THRESHOLD = 0.4;
export const CLENCH_HOLD_MS = 100;

/**
 * Sniff the wire format from the first byte of a notification. The ASCII
 * firmware starts with a digit (0x30..0x39); the binary firmware starts with
 * 0xA7, which sits outside the ASCII printable range so the test is
 * unambiguous.
 */
export function detectWireFormat(firstByte) {
  if (firstByte === BIN_MAGIC) return 'binary';
  return 'ascii';
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function jitterClamp(value) {
  return clamp(value * (1 + (Math.random() - 0.5) * 0.2), 0, 1);
}

/**
 * FrameShaper — stateful shaper that turns a raw 4-tuple FSR sample (in
 * firmware order: Molar_L, Molar_R, Palate_L, Palate_R) plus an optional raw
 * accel triple into the IStreamer packet.
 *
 * State it carries between frames:
 *   - a short ring buffer for the ~150ms lagged front-palate mirror
 *   - clench edge-detection / re-arm state
 *
 * `source` is stamped on every emitted packet ('ble-web', 'ble-native', …).
 * Keeping this a class (rather than free functions) preserves the exact
 * per-connection statefulness the streamer relied on before the extraction.
 */
export class FrameShaper {
  constructor({ source = 'ble' } = {}) {
    this.source = source;
    this.reset();
  }

  reset() {
    this.palateMirrorBuffer = [];
    this.clenchAboveSince = null;
    this.clenchArmed = true;
  }

  /**
   * Shape one sample into a packet.
   * @param {number} firmwareMs   firmware millis timestamp
   * @param {number[]} rawValues  4 raw ADC values, firmware order
   * @param {{x,y,z}|null} accelRaw  raw int16 accel triple, or null
   * @returns {{packet: object, normalized: number[], clampedRaw: number[]}}
   */
  shape(firmwareMs, rawValues, accelRaw) {
    const clampedRaw = rawValues.map((value) => clamp(value, 0, ADC_MAX));
    const [molarL, molarR, palateL, palateR] = clampedRaw.map((value) =>
      clamp((value / ADC_MAX) * LIVE_GAIN, 0, 1)
    );

    let accel = null;
    let accelG = null;
    if (accelRaw && typeof accelRaw.x === 'number') {
      accel = { x: accelRaw.x, y: accelRaw.y, z: accelRaw.z };
      accelG = {
        x: accelRaw.x * ACCEL_G_PER_LSB,
        y: accelRaw.y * ACCEL_G_PER_LSB,
        z: accelRaw.z * ACCEL_G_PER_LSB,
      };
    }

    const { frontL, frontR } = this.computeLaggedMirrors(firmwareMs, palateL, palateR);
    const clenchEvent = this.updateClenchState(firmwareMs, molarL, molarR);

    const palateZones = new Array(PALATE_ZONE_COUNT).fill(AMBIENT_FLOOR);
    palateZones[1] = palateL; // back-left (Palate_L / adc[2])
    palateZones[2] = palateR; // back-right (Palate_R / adc[3])
    palateZones[9] = frontL; // front-left fake mirror
    palateZones[10] = frontR; // front-right fake mirror
    palateZones[4] = molarL; // clench-left (Molar_L / adc[0])
    palateZones[7] = molarR; // clench-right (Molar_R / adc[1])

    const realMean = (molarL + molarR + palateL + palateR) / 4;
    const packet = {
      t: Date.now(),
      posture: 0,
      palate: palateZones,
      clenchEvent,
      nasal: false,
      palateRaw: clampedRaw,
      palateNormalized: realMean,
      source: this.source,
    };

    if (accel) {
      packet.accel = accel;
      packet.accelG = accelG;
    }

    return { packet, normalized: [molarL, molarR, palateL, palateR], clampedRaw };
  }

  computeLaggedMirrors(t, p_l, p_r) {
    this.palateMirrorBuffer.push({ t, p_l, p_r });
    this.palateMirrorBuffer = this.palateMirrorBuffer.filter(
      (sample) => t - sample.t <= MIRROR_BUFFER_MS
    );

    const targetT = t - MIRROR_LAG_MS;
    let lagged = null;
    for (let i = this.palateMirrorBuffer.length - 1; i >= 0; i -= 1) {
      if (this.palateMirrorBuffer[i].t <= targetT) {
        lagged = this.palateMirrorBuffer[i];
        break;
      }
    }

    const sourceL = lagged ? lagged.p_l : p_l;
    const sourceR = lagged ? lagged.p_r : p_r;
    return {
      frontL: jitterClamp(sourceL),
      frontR: jitterClamp(sourceR),
    };
  }

  updateClenchState(t, molarL, molarR) {
    const bothHigh = molarL > CLENCH_ON_THRESHOLD && molarR > CLENCH_ON_THRESHOLD;
    const bothLow = molarL < CLENCH_OFF_THRESHOLD && molarR < CLENCH_OFF_THRESHOLD;

    if (bothLow) {
      this.clenchAboveSince = null;
      this.clenchArmed = true;
      return false;
    }
    if (!bothHigh) {
      this.clenchAboveSince = null;
      return false;
    }
    if (this.clenchAboveSince == null) {
      this.clenchAboveSince = t;
      return false;
    }
    if (this.clenchArmed && t - this.clenchAboveSince >= CLENCH_HOLD_MS) {
      this.clenchArmed = false;
      return true;
    }
    return false;
  }
}

/**
 * Parse a single ASCII line "<ms>,<a0>,<a1>,<a2>,<a3>" into
 * { firmwareMs, rawValues } or null if malformed.
 */
export function parseAsciiLine(line) {
  const parts = String(line).split(',');
  if (parts.length < 5) return null;
  const firmwareMs = Number.parseInt(parts[0], 10);
  const rawValues = parts.slice(1, 5).map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(firmwareMs) || rawValues.some((v) => !Number.isFinite(v))) {
    return null;
  }
  return { firmwareMs, rawValues };
}

/**
 * BinaryFrameParser — accumulates raw notification bytes and pulls complete,
 * checksum-verified packets off the front. BLE does not guarantee one
 * notification == one application packet, so partial packets are buffered and
 * resync scans forward to the next magic byte.
 *
 * Call `push(bytes)` with a Uint8Array; it returns an array of parsed frames:
 *   { version, timestampMs, fsr: number[4], accel: {x,y,z}|null }
 */
export class BinaryFrameParser {
  constructor() {
    this.buffer = new Uint8Array(0);
    this.onParseError = null; // optional (message) => void
  }

  reset() {
    this.buffer = new Uint8Array(0);
  }

  emitError(message) {
    if (typeof this.onParseError === 'function') this.onParseError(message);
  }

  push(bytes) {
    const merged = new Uint8Array(this.buffer.length + bytes.length);
    merged.set(this.buffer, 0);
    merged.set(bytes, this.buffer.length);
    this.buffer = merged;

    const frames = [];
    let pos = 0;
    while (pos < this.buffer.length) {
      if (this.buffer[pos] !== BIN_MAGIC) {
        pos++;
        continue;
      }
      if (this.buffer.length - pos < BIN_HEADER_BYTES + 2 + BIN_TRAILER_BYTES) {
        break;
      }

      const version = this.buffer[pos + 1];
      const sensorCount = this.buffer[pos + 6];

      let payloadBytes;
      if (version === BIN_VERSION_V2) {
        payloadBytes = 2 * V2_FSR_COUNT + 2 * V2_ACCEL_COUNT; // 14
      } else if (version === BIN_VERSION_V1) {
        payloadBytes = 2 * sensorCount;
      } else {
        this.emitError(`binary version=${version}, expected 1 or 2`);
        pos++;
        continue;
      }

      const pktSize = BIN_HEADER_BYTES + payloadBytes + BIN_TRAILER_BYTES;
      if (this.buffer.length - pos < pktSize) break;

      let xorSum = 0;
      for (let i = 0; i < pktSize - 1; i++) xorSum ^= this.buffer[pos + i];
      const sentChecksum = this.buffer[pos + pktSize - 1];
      if (xorSum !== sentChecksum) {
        this.emitError(
          `checksum: got 0x${sentChecksum.toString(16)}, expected 0x${xorSum.toString(16)}`
        );
        pos++;
        continue;
      }

      const dv = new DataView(this.buffer.buffer, this.buffer.byteOffset + pos, pktSize);
      const timestampMs = dv.getUint32(2, true);

      if (version === BIN_VERSION_V2) {
        const fsr = new Array(V2_FSR_COUNT);
        for (let i = 0; i < V2_FSR_COUNT; i++) {
          fsr[i] = dv.getUint16(BIN_HEADER_BYTES + 2 * i, true);
        }
        const accelOff = BIN_HEADER_BYTES + 2 * V2_FSR_COUNT;
        const accel = {
          x: dv.getInt16(accelOff, true),
          y: dv.getInt16(accelOff + 2, true),
          z: dv.getInt16(accelOff + 4, true),
        };
        frames.push({ version, timestampMs, fsr, accel });
      } else {
        // v1: read `sensorCount` uint16 FSR channels; first 4 map to slots.
        const adc = new Array(sensorCount);
        for (let i = 0; i < sensorCount; i++) {
          adc[i] = dv.getUint16(BIN_HEADER_BYTES + 2 * i, true);
        }
        const fsr = [adc[0] ?? 0, adc[1] ?? 0, adc[2] ?? 0, adc[3] ?? 0];
        frames.push({ version, timestampMs, fsr, accel: null });
      }

      pos += pktSize;
    }

    this.buffer = this.buffer.slice(pos);
    return frames;
  }
}
