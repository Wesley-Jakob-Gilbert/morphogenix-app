/**
 * mockBleAdapter.js — hardware-free BLE adapter.
 *
 * Emits synthetic, protocol-shaped frames at the real 10 Hz cadence without
 * any radio. Two uses:
 *   1. Running the native dev-client in the iOS Simulator / Android emulator,
 *      which have no BLE stack, so a `connect()` there still produces a live
 *      stream to exercise the UI.
 *   2. Deterministic unit/smoke tests of the streamer router.
 *
 * It reuses the SAME binaryProtocol.FrameShaper as the real adapters, so the
 * packet shape is identical to what live hardware produces. It fabricates raw
 * FSR + accel samples (a slow palate sweep plus gentle head-tilt), builds them
 * into the exact v2 binary layout, and runs them through BinaryFrameParser so
 * the mock exercises the real parse path too — not just the shaper.
 *
 * Adapter contract matches native/web:
 *   new MockBleAdapter({ onFrame, onStatus })
 *   connect() / disconnect() / sendCommand(char)
 */

import {
  BIN_MAGIC,
  BIN_VERSION_V2,
  BLE_COMMANDS,
  BinaryFrameParser,
  FrameShaper,
} from './binaryProtocol';

const STREAM_HZ = 10;
const STREAM_INTERVAL_MS = 1000 / STREAM_HZ;
const MOCK_DEVICE_NAME = 'MorphoGenixSOD (mock)';
const CONNECT_DELAY_MS = 400;

const VALID_COMMANDS = new Set([BLE_COMMANDS.REZERO, BLE_COMMANDS.REPORT, BLE_COMMANDS.IMU_DIAG]);

function xorChecksum(bytes, len) {
  let x = 0;
  for (let i = 0; i < len; i++) x ^= bytes[i];
  return x;
}

// Build a real v2 binary packet so the mock drives the true parse path.
function buildV2Packet(ts, fsr, accel) {
  const buf = new Uint8Array(22);
  const dv = new DataView(buf.buffer);
  let off = 0;
  buf[off++] = BIN_MAGIC;
  buf[off++] = BIN_VERSION_V2;
  dv.setUint32(off, ts, true);
  off += 4;
  buf[off++] = 7;
  for (let i = 0; i < 4; i++) {
    dv.setUint16(off, Math.max(0, Math.min(4095, Math.round(fsr[i]))), true);
    off += 2;
  }
  for (let i = 0; i < 3; i++) {
    dv.setInt16(off, Math.max(-32768, Math.min(32767, Math.round(accel[i]))), true);
    off += 2;
  }
  buf[off] = xorChecksum(buf, off);
  return buf;
}

export default class MockBleAdapter {
  constructor({ onFrame, onStatus } = {}) {
    this.onFrame = onFrame || (() => {});
    this.onStatus = onStatus || (() => {});
    this.parser = new BinaryFrameParser();
    this.shaper = new FrameShaper({ source: 'ble-mock' });
    this.interval = null;
    this.connectTimer = null;
    this.tick = 0;
  }

  emitStatus(state, detail) {
    this.onStatus(state, detail == null ? null : detail);
  }

  async connect() {
    this.emitStatus('scanning', null);
    // Simulate scan + connect latency, then start streaming.
    await new Promise((resolve) => {
      this.connectTimer = setTimeout(resolve, CONNECT_DELAY_MS);
    });
    this.emitStatus('connected', MOCK_DEVICE_NAME);
    this.tick = 0;
    this.interval = setInterval(() => this.emitFrame(), STREAM_INTERVAL_MS);
  }

  disconnect() {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.parser.reset();
    this.shaper.reset();
    this.emitStatus('idle', null);
  }

  async sendCommand(char) {
    if (!VALID_COMMANDS.has(char)) {
      throw new Error(`Unsupported BLE command: ${char}`);
    }
    // Mock: rezero simply resets the synthetic phase.
    if (char === BLE_COMMANDS.REZERO) this.tick = 0;
  }

  emitFrame() {
    const t = this.tick * STREAM_INTERVAL_MS;
    const phase = this.tick / STREAM_HZ; // seconds
    // Slow palate sweep + occasional molar clench spike.
    const sweep = (Math.sin(phase * 0.8) + 1) / 2; // 0..1
    const clenchPulse = this.tick % 60 < 5 ? 3600 : 200; // brief clench every 6s
    const fsr = [
      clenchPulse, // Molar_L
      clenchPulse, // Molar_R
      600 + sweep * 1400, // Palate_L
      600 + (1 - sweep) * 1400, // Palate_R
    ];
    // Gentle head tilt: Z near +1g, small X/Y wobble.
    const accel = [
      Math.sin(phase * 0.5) * 2000,
      Math.cos(phase * 0.5) * 2000,
      16384,
    ];

    const frames = this.parser.push(buildV2Packet(t, fsr, accel));
    for (const f of frames) {
      const { packet } = this.shaper.shape(f.timestampMs, f.fsr, f.accel);
      this.onFrame(packet);
    }
    this.tick += 1;
  }
}
