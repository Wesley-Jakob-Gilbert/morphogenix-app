/**
 * webBleAdapter.js — Web Bluetooth transport for the bench build.
 *
 * This is the extracted GATT transport that used to live inline in
 * BleStreamer.js. It only runs when the app is served on the web
 * (`expo start --web` in Chrome/Edge desktop, or Chrome on Android) with
 * `?live=ble` in the URL. Native builds use nativeBleAdapter.js instead.
 *
 * Adapter contract (shared by native / web / mock):
 *   new Adapter({ onFrame, onStatus })
 *   connect()        -> Promise<void>   opens GATT, subscribes to TX notify
 *   disconnect()     -> void            tears down cleanly, safe to repeat
 *   sendCommand(ch)  -> Promise<void>   writes an ASCII command byte to RX
 *
 * onFrame(packet)  is called with a fully shaped IStreamer packet.
 * onStatus(state, detail) is called with lifecycle transitions:
 *   'idle' | 'scanning' | 'connecting' | 'connected' | 'silent'
 *   | 'disconnected' | 'error'
 */

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

// Watchdog: firmware sends 10 packets/sec, so >2s of silence is suspicious.
const NOTIFY_WATCHDOG_MS = 2000;

const VALID_COMMANDS = new Set([BLE_COMMANDS.REZERO, BLE_COMMANDS.REPORT, BLE_COMMANDS.IMU_DIAG]);

export function isWebBluetoothAvailable() {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.bluetooth !== 'undefined' &&
    typeof navigator.bluetooth.requestDevice === 'function'
  );
}

/**
 * Map a Web Bluetooth error to a short, plain-English message. The chooser is
 * the most common source of cryptic errors — NotFoundError can mean either
 * "user cancelled" OR "no Bluetooth radio", and the message string is the only
 * way to tell them apart on Chrome.
 */
export function friendlyBleError(err) {
  if (!err) return 'Unknown error.';
  const name = err.name || '';
  const msg = (err.message || String(err)).toLowerCase();

  if (msg.includes('bluetooth adapter not available')) {
    return "This computer doesn't have a Bluetooth adapter, or Chrome can't see one. Plug in a USB BLE dongle, or try this page on a phone or laptop with built-in Bluetooth.";
  }
  if (msg.includes('bluetooth adapter is off') || msg.includes('radio is off')) {
    return 'Bluetooth is turned off. Enable it in your system settings and try again.';
  }
  if (msg.includes('bluetooth radio is not authorized') || msg.includes('permission')) {
    return "The browser isn't authorized to use Bluetooth. Check Site Settings → Bluetooth in chrome://settings.";
  }
  if (msg.includes('user denied') || msg.includes('chooser cancelled')) {
    return 'Cancelled. Tap Connect again when ready.';
  }
  if (name === 'NotSupportedError') {
    return "This browser supports Web Bluetooth but the request isn't supported here. Try Chrome on desktop.";
  }
  if (name === 'SecurityError') {
    return 'Web Bluetooth blocked by the page security context. The site must be served over HTTPS.';
  }
  if (name === 'NetworkError') {
    return 'Lost the GATT link. Move closer to the device and try again.';
  }
  return err.message || String(err);
}

function debugLog(msg) {
  if (typeof window === 'undefined') return;
  if (!Array.isArray(window.__morphogenix_bleLog)) {
    window.__morphogenix_bleLog = [];
  }
  window.__morphogenix_bleLog.push(msg);
  // eslint-disable-next-line no-console
  if (typeof console !== 'undefined' && console.log) console.log('[BLE]', msg);
}

export default class WebBleAdapter {
  constructor({ onFrame, onStatus, deviceNameFilter = DEVICE_NAME_FILTER } = {}) {
    this.onFrame = onFrame || (() => {});
    this.onStatus = onStatus || (() => {});
    this.deviceNameFilter = deviceNameFilter;

    this.device = null;
    this.server = null;
    this.txCharacteristic = null;
    this.rxCharacteristic = null;

    this.lineBuffer = '';
    this.textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

    this.binParser = new BinaryFrameParser();
    this.shaper = new FrameShaper({ source: 'ble-web' });
    this.wireFormat = null;

    this.loggedFirstChunk = false;
    this.loggedParseFail = false;
    this.watchdogTimer = null;

    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleNotification = this.handleNotification.bind(this);

    this.binParser.onParseError = (m) => {
      if (!this.loggedParseFail) {
        this.loggedParseFail = true;
        debugLog(`parse FAIL (${m})`);
      }
    };
  }

  emitStatus(state, detail) {
    this.onStatus(state, detail == null ? null : detail);
  }

  async connect() {
    debugLog('connect() called (web)');
    if (!isWebBluetoothAvailable()) {
      const reason =
        'Web Bluetooth is not available in this browser. Use Chrome or Edge on desktop, or Chrome on Android.';
      this.emitStatus('error', reason);
      throw new Error(reason);
    }

    let chooserDevice = null;
    try {
      // requestDevice() MUST be the first thing (user-activation token).
      chooserDevice = await navigator.bluetooth.requestDevice({
        filters: [{ name: this.deviceNameFilter }],
        optionalServices: [NUS_SERVICE_UUID],
      });
      debugLog(`chooser returned device name="${chooserDevice && chooserDevice.name}"`);
    } catch (err) {
      const rawMsg = (err && err.message) || '';
      const userCancelled =
        (err && err.name === 'AbortError') ||
        (err && err.name === 'NotFoundError' && /user/i.test(rawMsg));
      if (userCancelled) {
        this.emitStatus('idle', null);
        return;
      }
      this.emitStatus('error', friendlyBleError(err));
      throw err;
    }

    try {
      this.device = chooserDevice;
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect);
      this.emitStatus('connecting', this.device.name || this.deviceNameFilter);

      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService(NUS_SERVICE_UUID);
      this.txCharacteristic = await service.getCharacteristic(NUS_TX_CHAR_UUID);
      this.rxCharacteristic = await service.getCharacteristic(NUS_RX_CHAR_UUID);

      await this.txCharacteristic.startNotifications();
      this.txCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotification);
      debugLog('notifications started — waiting for data');

      this.emitStatus('connected', this.device.name || this.deviceNameFilter);
      this.armWatchdog();
    } catch (err) {
      this.emitStatus('error', friendlyBleError(err));
      this.disconnect();
      throw err;
    }
  }

  disconnect() {
    this.clearWatchdog();

    if (this.txCharacteristic) {
      try {
        this.txCharacteristic.removeEventListener(
          'characteristicvaluechanged',
          this.handleNotification
        );
        this.txCharacteristic.stopNotifications().catch(() => {});
      } catch (_) {
        // ignore
      }
      this.txCharacteristic = null;
    }
    this.rxCharacteristic = null;

    if (this.device) {
      try {
        this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
        if (this.device.gatt && this.device.gatt.connected) {
          this.device.gatt.disconnect();
        }
      } catch (_) {
        // ignore
      }
    }

    this.server = null;
    this.device = null;
    this.lineBuffer = '';
    this.wireFormat = null;
    this.binParser.reset();
    this.shaper.reset();
    this.loggedFirstChunk = false;
    this.loggedParseFail = false;

    this.emitStatus('idle', null);
  }

  async sendCommand(char) {
    if (!VALID_COMMANDS.has(char)) {
      throw new Error(`Unsupported BLE command: ${char}`);
    }
    if (!this.rxCharacteristic) {
      throw new Error('Cannot send BLE command before RX characteristic is connected.');
    }
    const payload = new Uint8Array([char.charCodeAt(0)]);
    if (typeof this.rxCharacteristic.writeValueWithoutResponse === 'function') {
      await this.rxCharacteristic.writeValueWithoutResponse(payload);
    } else {
      await this.rxCharacteristic.writeValue(payload);
    }
    debugLog(`sent command "${char}"`);
  }

  // -------- internal --------

  handleDisconnect() {
    this.emitStatus('disconnected', null);
    this.disconnect();
  }

  handleNotification(event) {
    const value = event.target && event.target.value; // DataView
    if (!value || value.byteLength === 0) return;
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

    if (!this.loggedFirstChunk) {
      this.loggedFirstChunk = true;
      this.wireFormat = detectWireFormat(bytes[0]);
      debugLog(`first chunk: ${value.byteLength}B  format=${this.wireFormat}`);
    }

    if (this.wireFormat === 'binary') {
      const frames = this.binParser.push(bytes);
      for (const f of frames) {
        const { packet } = this.shaper.shape(f.timestampMs, f.fsr, f.accel);
        this.onFrame(packet);
      }
    } else {
      this.handleAsciiChunk(value);
    }

    this.armWatchdog();
  }

  handleAsciiChunk(value) {
    if (!this.textDecoder) return;
    this.lineBuffer += this.textDecoder.decode(value);
    let idx;
    while ((idx = this.lineBuffer.indexOf('\n')) !== -1) {
      const line = this.lineBuffer.slice(0, idx).trim();
      this.lineBuffer = this.lineBuffer.slice(idx + 1);
      if (line.length === 0) continue;
      const parsed = parseAsciiLine(line);
      if (!parsed) {
        if (!this.loggedParseFail) {
          this.loggedParseFail = true;
          debugLog(`parse FAIL (ascii) line="${line.slice(0, 60)}"`);
        }
        continue;
      }
      const { packet } = this.shaper.shape(parsed.firmwareMs, parsed.rawValues, null);
      this.onFrame(packet);
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
