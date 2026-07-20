/**
 * BleStreamer — platform router for the MorphoGenix live BLE stream.
 *
 * Public API (UNCHANGED from the pre-migration streamer — every existing
 * consumer, incl. StreamerProvider / BleConnectCard, keeps working):
 *
 *   start()             — lightweight init; emits an 'idle' status.
 *   stop()              — disconnect + clear.
 *   subscribe(cb)       — register a listener; returns an unsubscribe fn.
 *                         The channel is MULTIPLEXED: real packets are plain
 *                         IStreamer objects; lifecycle updates are
 *                         { type:'status', state, detail, t }.
 *   connect()           — begin the platform scan/connect flow.
 *   disconnect()        — tear down the link.
 *   sendCommand(char)   — 'z' rezero | 'r' report | 'i' imu-diag.
 *   getSource()         — 'ble-native' | 'ble-web' | 'ble-mock'.
 *   getState()          — convenience snapshot of the last status state.
 *
 * Routing:
 *   - iOS / Android  -> nativeBleAdapter (react-native-ble-plx)
 *   - web            -> webBleAdapter (Web Bluetooth)
 *   - (fallback/sim) -> mockBleAdapter (synthetic 10 Hz stream)
 *   The native adapter is imported LAZILY so the react-native-ble-plx native
 *   module is never pulled into the web bundle or the default Jest env.
 *
 * Session persistence:
 *   On 'connected' a session is started; every parsed frame is recorded; on
 *   'disconnected' / 'idle' / 'error' the session is ended. This is fire-and-
 *   forget — persistence failures never break the live stream.
 *
 * Permissions:
 *   connect() first runs blePermissions.ensureBleReady(); if it returns
 *   { ok:false, reason }, we surface an 'error' status carrying that reason
 *   (permission_denied | bluetooth_off | unsupported) and abort.
 */

import { Platform } from 'react-native';

import {
  NUS_SERVICE_UUID,
  NUS_TX_CHAR_UUID,
  NUS_RX_CHAR_UUID,
  DEVICE_NAME_FILTER,
  ADC_MAX,
  LIVE_GAIN,
  PALATE_ZONE_COUNT,
  AMBIENT_FLOOR,
  MIRROR_LAG_MS,
  MIRROR_BUFFER_MS,
  CLENCH_HOLD_MS,
  BIN_MAGIC,
  BIN_VERSION_V1,
  BIN_VERSION_V2,
  ACCEL_G_PER_LSB,
  BLE_COMMANDS,
  detectWireFormat,
} from './binaryProtocol';
import { isWebBluetoothAvailable, friendlyBleError } from './webBleAdapter';
import { ensureBleReady } from '../blePermissions';
import sessionStore from '../sessionStore';

function selectPlatform() {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return 'native';
  if (Platform.OS === 'web') return 'web';
  return 'mock';
}

export default class BleStreamer {
  constructor({ deviceNameFilter = DEVICE_NAME_FILTER, platform } = {}) {
    this.deviceNameFilter = deviceNameFilter;
    this.platform = platform || selectPlatform();
    this.subscribers = new Set();
    this.isRunning = false;

    this.adapter = null;
    this.lastState = 'idle';
    this.sessionId = null;

    this.handleFrame = this.handleFrame.bind(this);
    this.handleStatus = this.handleStatus.bind(this);
  }

  // -------- IStreamer contract --------

  start() {
    this.isRunning = true;
    this.emitStatus('idle', null);
  }

  stop() {
    this.isRunning = false;
    this.disconnect();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getSource() {
    if (this.platform === 'native') return 'ble-native';
    if (this.platform === 'web') return 'ble-web';
    return 'ble-mock';
  }

  getState() {
    return this.lastState;
  }

  // -------- connection control --------

  async connect() {
    // 1. Ensure the radio + runtime permissions are ready.
    let readiness;
    try {
      readiness = await ensureBleReady({ platform: this.platform });
    } catch (err) {
      this.emitStatus('error', (err && err.message) || 'ble_not_ready');
      throw err;
    }
    if (!readiness.ok) {
      this.emitStatus('error', readiness.reason || 'ble_not_ready');
      return;
    }

    // 2. Lazily build the adapter for this platform.
    const adapter = this.ensureAdapter();
    if (!adapter) {
      this.emitStatus('error', 'unsupported');
      return;
    }

    // 3. Delegate to the adapter; it drives status transitions from here.
    await adapter.connect();
  }

  disconnect() {
    if (this.adapter && typeof this.adapter.disconnect === 'function') {
      this.adapter.disconnect();
    } else {
      // No adapter yet — still make sure the UI resets and any session ends.
      this.endSession();
      this.emitStatus('idle', null);
    }
  }

  async sendCommand(char) {
    if (!this.adapter || typeof this.adapter.sendCommand !== 'function') {
      throw new Error('Cannot send BLE command before connecting.');
    }
    await this.adapter.sendCommand(char);
  }

  // -------- adapter wiring --------

  ensureAdapter() {
    if (this.adapter) return this.adapter;
    const opts = {
      onFrame: this.handleFrame,
      onStatus: this.handleStatus,
      deviceNameFilter: this.deviceNameFilter,
    };

    if (this.platform === 'native') {
      // Lazy require keeps the native module out of the web/Jest bundle.
      // eslint-disable-next-line global-require
      const NativeBleAdapter = require('./nativeBleAdapter').default;
      this.adapter = new NativeBleAdapter(opts);
    } else if (this.platform === 'web') {
      // eslint-disable-next-line global-require
      const WebBleAdapter = require('./webBleAdapter').default;
      this.adapter = new WebBleAdapter(opts);
    } else {
      // eslint-disable-next-line global-require
      const MockBleAdapter = require('./mockBleAdapter').default;
      this.adapter = new MockBleAdapter(opts);
    }
    return this.adapter;
  }

  handleFrame(packet) {
    // Persist first (fire-and-forget), then fan out to UI subscribers.
    if (this.sessionId != null) {
      sessionStore.recordFrame(this.sessionId, packet);
    }
    this.subscribers.forEach((cb) => cb(packet));
  }

  handleStatus(state, detail) {
    this.lastState = state;

    // Session lifecycle keyed off connection state.
    if (state === 'connected') {
      this.startSession();
    } else if (state === 'idle' || state === 'disconnected' || state === 'error') {
      this.endSession();
    }

    this.emitStatus(state, detail);
  }

  emitStatus(state, detail) {
    this.lastState = state;
    const status = { type: 'status', state, detail: detail == null ? null : detail, t: Date.now() };
    this.subscribers.forEach((cb) => cb(status));
  }

  // -------- session persistence (fire-and-forget) --------

  startSession() {
    if (this.sessionId != null) return;
    Promise.resolve(sessionStore.startSession({ source: this.getSource() }))
      .then((id) => {
        this.sessionId = id;
      })
      .catch(() => {
        this.sessionId = null;
      });
  }

  endSession() {
    const id = this.sessionId;
    this.sessionId = null;
    if (id == null) return;
    Promise.resolve(sessionStore.endSession(id)).catch(() => {});
  }
}

// Re-export the web capability probe + error helper for existing consumers
// (StreamerProvider imports isWebBluetoothAvailable from here) and re-export
// the protocol constants that older callers/tests referenced from this module.
export {
  isWebBluetoothAvailable,
  friendlyBleError,
  NUS_SERVICE_UUID,
  NUS_TX_CHAR_UUID,
  NUS_RX_CHAR_UUID,
  DEVICE_NAME_FILTER,
  ADC_MAX,
  LIVE_GAIN,
  PALATE_ZONE_COUNT,
  AMBIENT_FLOOR,
  MIRROR_LAG_MS,
  MIRROR_BUFFER_MS,
  CLENCH_HOLD_MS,
  BIN_MAGIC,
  BIN_VERSION_V1,
  BIN_VERSION_V2,
  ACCEL_G_PER_LSB,
  BLE_COMMANDS,
  detectWireFormat,
};
