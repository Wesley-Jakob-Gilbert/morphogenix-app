/**
 * nativeBleAdapter.js — react-native-ble-plx transport for the native
 * dev-client build (iOS + Android).
 *
 * Talks to Wes's XIAO nRF52840 Sense running the Nordic UART Service (NUS).
 * Scans (filtered by the NUS service UUID), connects, discovers services,
 * subscribes to the TX characteristic (notify), decodes base64 payloads into
 * bytes, runs them through the shared binaryProtocol parser + shaper, and
 * exposes the same adapter contract as the web and mock adapters:
 *
 *   new NativeBleAdapter({ onFrame, onStatus })
 *   connect()        -> Promise<void>
 *   disconnect()     -> void
 *   sendCommand(ch)  -> Promise<void>   write-with-response to RX
 *
 * Behaviour:
 *   - scanForDevice(): filters by service UUID 6E400001-..., 15s timeout.
 *   - On unexpected disconnect it auto-reconnects up to 3 times with backoff.
 *   - Runtime permissions are handled by BleStreamer via blePermissions.js
 *     BEFORE this adapter's connect() runs; here we assume the radio is ready.
 *
 * NOTE: this module imports `react-native-ble-plx`, which is a native module.
 * It is only ever required on iOS/Android by the BleStreamer router (never on
 * web or in the default Jest env). A module-init smoke test lives in
 * __tests__/nativeBleAdapter.smoke.test.js.
 */

import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

import {
  NUS_SERVICE_UUID,
  NUS_TX_CHAR_UUID,
  NUS_RX_CHAR_UUID,
  DEVICE_NAME_FILTER,
  BLE_COMMANDS,
  detectWireFormat,
  parseAsciiLine,
  BinaryFrameParser,
  FrameShaper,
} from './binaryProtocol';

const SCAN_TIMEOUT_MS = 15000;
const NOTIFY_WATCHDOG_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 750;

const VALID_COMMANDS = new Set([BLE_COMMANDS.REZERO, BLE_COMMANDS.REPORT, BLE_COMMANDS.IMU_DIAG]);

// One BleManager per JS runtime. Creating multiple instances is unsupported
// by ble-plx and leaks native listeners.
let sharedManager = null;
function getManager() {
  if (!sharedManager) sharedManager = new BleManager();
  return sharedManager;
}

export default class NativeBleAdapter {
  constructor({ onFrame, onStatus, deviceNameFilter = DEVICE_NAME_FILTER } = {}) {
    this.onFrame = onFrame || (() => {});
    this.onStatus = onStatus || (() => {});
    this.deviceNameFilter = deviceNameFilter;

    this.manager = getManager();
    this.device = null;
    this.notifySubscription = null;
    this.disconnectSubscription = null;

    this.binParser = new BinaryFrameParser();
    this.shaper = new FrameShaper({ source: 'ble-native' });
    this.wireFormat = null;
    this.textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
    this.lineBuffer = '';

    this.watchdogTimer = null;
    this.reconnectAttempts = 0;
    this.userInitiatedDisconnect = false;
    this.loggedFirstChunk = false;
  }

  emitStatus(state, detail) {
    this.onStatus(state, detail == null ? null : detail);
  }

  // -------- public contract --------

  async connect() {
    this.userInitiatedDisconnect = false;
    this.reconnectAttempts = 0;
    await this.scanConnectAndSubscribe();
  }

  disconnect() {
    this.userInitiatedDisconnect = true;
    this.clearWatchdog();
    this.teardownSubscriptions();
    this.manager.stopDeviceScan();

    if (this.device) {
      const id = this.device.id;
      this.manager.cancelDeviceConnection(id).catch(() => {});
      this.device = null;
    }

    this.binParser.reset();
    this.shaper.reset();
    this.lineBuffer = '';
    this.wireFormat = null;
    this.loggedFirstChunk = false;

    this.emitStatus('idle', null);
  }

  async sendCommand(char) {
    if (!VALID_COMMANDS.has(char)) {
      throw new Error(`Unsupported BLE command: ${char}`);
    }
    if (!this.device) {
      throw new Error('Cannot send BLE command before a device is connected.');
    }
    const payloadB64 = Buffer.from([char.charCodeAt(0)]).toString('base64');
    await this.device.writeCharacteristicWithResponseForService(
      NUS_SERVICE_UUID,
      NUS_RX_CHAR_UUID,
      payloadB64
    );
  }

  // -------- scan + connect flow --------

  scanForDevice() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.manager.stopDeviceScan();
        reject(new Error('scan_timeout'));
      }, SCAN_TIMEOUT_MS);

      this.emitStatus('scanning', null);
      this.manager.startDeviceScan(
        [NUS_SERVICE_UUID],
        { allowDuplicates: false },
        (error, scannedDevice) => {
          if (settled) return;
          if (error) {
            settled = true;
            clearTimeout(timeout);
            this.manager.stopDeviceScan();
            reject(error);
            return;
          }
          if (!scannedDevice) return;
          // Belt-and-suspenders: also match the advertised name when present.
          const name = scannedDevice.name || scannedDevice.localName;
          const nameMatches = !name || name === this.deviceNameFilter;
          if (nameMatches) {
            settled = true;
            clearTimeout(timeout);
            this.manager.stopDeviceScan();
            resolve(scannedDevice);
          }
        }
      );
    });
  }

  async scanConnectAndSubscribe() {
    let scanned;
    try {
      scanned = await this.scanForDevice();
    } catch (err) {
      if (err && err.message === 'scan_timeout') {
        this.emitStatus('error', 'no_device_found');
      } else {
        this.emitStatus('error', (err && err.message) || 'scan_failed');
      }
      throw err;
    }

    try {
      this.emitStatus('connecting', scanned.name || this.deviceNameFilter);
      const device = await this.manager.connectToDevice(scanned.id, { requestMTU: 185 });
      await device.discoverAllServicesAndCharacteristics();
      this.device = device;

      this.attachDisconnectListener(device);
      this.subscribeToTx(device);

      this.reconnectAttempts = 0;
      this.emitStatus('connected', device.name || this.deviceNameFilter);
      this.armWatchdog();
    } catch (err) {
      this.emitStatus('error', (err && err.message) || 'connect_failed');
      this.teardownSubscriptions();
      if (this.device) {
        this.manager.cancelDeviceConnection(this.device.id).catch(() => {});
        this.device = null;
      }
      throw err;
    }
  }

  subscribeToTx(device) {
    this.notifySubscription = device.monitorCharacteristicForService(
      NUS_SERVICE_UUID,
      NUS_TX_CHAR_UUID,
      (error, characteristic) => {
        if (error) {
          // Cancellation during teardown surfaces here; ignore if intentional.
          if (this.userInitiatedDisconnect) return;
          return;
        }
        if (!characteristic || !characteristic.value) return;
        const bytes = new Uint8Array(Buffer.from(characteristic.value, 'base64'));
        this.handleBytes(bytes);
      }
    );
  }

  attachDisconnectListener(device) {
    this.disconnectSubscription = device.onDisconnected(() => {
      this.clearWatchdog();
      this.teardownSubscriptions();
      if (this.userInitiatedDisconnect) return;
      this.handleUnexpectedDisconnect();
    });
  }

  async handleUnexpectedDisconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.device = null;
      this.emitStatus('disconnected', null);
      return;
    }
    this.reconnectAttempts += 1;
    const delay = RECONNECT_BASE_DELAY_MS * this.reconnectAttempts;
    this.emitStatus('reconnecting', `attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
    this.device = null;
    await new Promise((r) => setTimeout(r, delay));
    if (this.userInitiatedDisconnect) return;
    try {
      await this.scanConnectAndSubscribe();
    } catch (_) {
      // scanConnectAndSubscribe already emitted an error; retry loop handled
      // by the next onDisconnected or leaves the UI on 'error'.
      if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.handleUnexpectedDisconnect();
      }
    }
  }

  // -------- byte handling (shared with web/mock via binaryProtocol) --------

  handleBytes(bytes) {
    if (!bytes || bytes.length === 0) return;
    if (!this.loggedFirstChunk) {
      this.loggedFirstChunk = true;
      this.wireFormat = detectWireFormat(bytes[0]);
    }

    if (this.wireFormat === 'binary') {
      const frames = this.binParser.push(bytes);
      for (const f of frames) {
        const { packet } = this.shaper.shape(f.timestampMs, f.fsr, f.accel);
        this.onFrame(packet);
      }
    } else {
      this.handleAsciiBytes(bytes);
    }
    this.armWatchdog();
  }

  handleAsciiBytes(bytes) {
    const chunk = this.textDecoder
      ? this.textDecoder.decode(bytes)
      : Buffer.from(bytes).toString('utf8');
    this.lineBuffer += chunk;
    let idx;
    while ((idx = this.lineBuffer.indexOf('\n')) !== -1) {
      const line = this.lineBuffer.slice(0, idx).trim();
      this.lineBuffer = this.lineBuffer.slice(idx + 1);
      if (line.length === 0) continue;
      const parsed = parseAsciiLine(line);
      if (!parsed) continue;
      const { packet } = this.shaper.shape(parsed.firmwareMs, parsed.rawValues, null);
      this.onFrame(packet);
    }
  }

  teardownSubscriptions() {
    if (this.notifySubscription) {
      try {
        this.notifySubscription.remove();
      } catch (_) {
        // ignore
      }
      this.notifySubscription = null;
    }
    if (this.disconnectSubscription) {
      try {
        this.disconnectSubscription.remove();
      } catch (_) {
        // ignore
      }
      this.disconnectSubscription = null;
    }
  }

  armWatchdog() {
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      this.emitStatus('silent', `No data received in ${NOTIFY_WATCHDOG_MS}ms`);
    }, NOTIFY_WATCHDOG_MS);
  }

  clearWatchdog() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }
}

// Exposed for a module-init smoke test and for callers that want to await the
// radio state before scanning.
export { getManager };
