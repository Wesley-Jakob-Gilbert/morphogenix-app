/**
 * BleStreamer — real Web Bluetooth implementation for the MorphoGenix prototype.
 *
 * Talks to the XIAO nRF52840 firmware running the Nordic UART Service (NUS).
 * Firmware sends one ASCII line every ~100 ms over the NUS TX characteristic:
 *
 *     "<millis>,<molar_L>,<molar_R>,<palate_L>,<palate_R>\n"
 *
 * where each ADC value is a 12-bit reading (0..4095), baseline-subtracted
 * and clamped by the firmware.
 *
 * Phase 2 mapping:
 *   - Firmware sends four real channels in this order: Molar_L, Molar_R,
 *     Palate_L, Palate_R.
 *   - The hero visual expects six visible sensor positions in a 16-zone
 *     packet.palate[] array. We place the four real values into their
 *     contracted zones and synthesize two front palate values by mirroring the
 *     back palate readings with a ~150 ms lag and ±10% jitter.
 *
 * Why Web Bluetooth (not react-native-ble-plx) for this file:
 *   This streamer is loaded only on the web bench build (Chrome/Edge desktop,
 *   Chrome on Android). The native iOS/Android app will get a sibling file
 *   `BleStreamerNative.js` that implements the same shape using ble-plx.
 *   Keeping them separate avoids pulling RN-native deps into the web bundle.
 *
 * Lifecycle:
 *   start()      — kept lightweight; just clears state. Connection requires a
 *                  user gesture (browser security), so the actual connect()
 *                  call is exposed separately and triggered by a "Connect
 *                  device" button.
 *   stop()       — disconnect GATT and clear subscribers' "isStreaming" state.
 *   subscribe()  — register a packet listener; returns an unsubscribe fn.
 *   getSource()  — returns 'ble-web' so the Home screen "Source:" label
 *                  reflects reality.
 *
 * Status reporting:
 *   The provider also wants to know connection status (idle / scanning /
 *   connected / error) for UI affordances. We expose that via the same
 *   subscribe channel as a special status object: { type: 'status', ... }.
 *   Packet listeners can ignore it; the Connect button reads it.
 */

// Nordic UART Service UUIDs — these MUST match the firmware (BLEUart in
// the bluefruit Arduino library uses Nordic's standard UUIDs).
const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // device -> phone (notify)
const NUS_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // phone -> device (write)

// Firmware advertises this name; we filter the device picker by it.
const DEVICE_NAME_FILTER = 'MorphoGenixSOD';

// FSR ADC range on the nRF52840 in 12-bit mode. Used to normalize 0..4095 -> 0..1.
const ADC_MAX = 4095;

// Visual gain applied AFTER ADC normalization. The firmware sends
// baseline-subtracted ADC values, so even a firm chew typically only spans
// ~200..900 of the 4095 full-scale range. Without gain, normalized values
// stay in [0..0.2] and the hero/heatmap colors barely move. A gain of 5
// pushes a typical chew up to ~1.0, fully exercising the color scale while
// hard bites still clamp gracefully at 1.0. Applied uniformly to all 4
// channels so relative magnitudes are preserved.
const LIVE_GAIN = 5;

// =========================================================================
// CHANNEL MAP — MUST match firmware/phase2_palate_4ch_calibrated/phase2_palate_4ch_calibrated.ino
// =========================================================================
//
// The firmware sends ASCII lines of the form:
//     "<millisSinceBoot>,<adc[0]>,<adc[1]>,<adc[2]>,<adc[3]>\n"
//
// Wire index | Logical channel | Anatomical region        | XIAO pin
// -----------+-----------------+--------------------------+---------
//   adc[0]   | Molar_L         | Left molar / clench      | A0
//   adc[1]   | Molar_R         | Right molar / clench     | A1
//   adc[2]   | Palate_L        | Back palate, left side   | A2
//   adc[3]   | Palate_R        | Back palate, right side  | A3
//
// IMPORTANT: This order is a CONTRACT with the firmware. If you reorder the
// physical wiring, update BOTH this comment AND the matching CHANNEL MAP in
// the firmware in the SAME commit.
export const CHANNEL_MAP = Object.freeze([
  { name: 'Molar_L', region: 'clench.left', pin: 'A0' },
  { name: 'Molar_R', region: 'clench.right', pin: 'A1' },
  { name: 'Palate_L', region: 'palate.back.left', pin: 'A2' },
  { name: 'Palate_R', region: 'palate.back.right', pin: 'A3' },
]);
// =========================================================================

const PALATE_ZONE_COUNT = 16;
const AMBIENT_FLOOR = 0.05;
const MIRROR_LAG_MS = 150;
const MIRROR_BUFFER_MS = 200;
const CLENCH_ON_THRESHOLD = 0.6;
const CLENCH_OFF_THRESHOLD = 0.4;
const CLENCH_HOLD_MS = 100;

// Watchdog: if no notifications arrive for this many ms after connect, surface
// a warning. Firmware should send 10 packets/sec, so >1.5s of silence is bad.
const NOTIFY_WATCHDOG_MS = 2000;

// Tiny on-screen-log helper. The bench BleDebugConsole component drains this
// buffer ~4x/sec so the user can see what's happening without DevTools open.
// Safe to call on the server (no-op when window is undefined).
/**
 * Map a Web Bluetooth (or platform) error to a short, plain-English message
 * that's actually useful to a non-technical user. The chooser is the most
 * common source of cryptic errors — NotFoundError can mean either "user
 * cancelled" OR "no Bluetooth radio installed," and the message string is the
 * only way to tell them apart on Chrome.
 */
export function friendlyBleError(err) {
  if (!err) return 'Unknown error.';
  const name = err.name || '';
  const msg = (err.message || String(err)).toLowerCase();

  // No physical adapter / OS-level absence.
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
  // Fallback: surface the raw message but keep it readable.
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function jitterClamp(value) {
  return clamp(value * (1 + (Math.random() - 0.5) * 0.2), 0, 1);
}

export default class BleStreamer {
  constructor({ deviceNameFilter = DEVICE_NAME_FILTER } = {}) {
    this.deviceNameFilter = deviceNameFilter;
    this.subscribers = new Set();
    this.isRunning = false;

    // Web Bluetooth handles
    this.device = null;
    this.server = null;
    this.txCharacteristic = null;
    this.rxCharacteristic = null;

    // For ASCII-line reassembly across notifications. Notifications are
    // 20-byte chunks by default and a "<ms>,<adc>\n" line is usually <16
    // chars, but we still buffer in case a packet arrives across boundaries.
    this.lineBuffer = '';
    this.textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

    // Watchdog timer for "connected but silent" states.
    this.watchdogTimer = null;

    // State for four-channel packet post-processing.
    this.palateMirrorBuffer = [];
    this.clenchAboveSince = null;
    this.clenchArmed = true;

    // Bound handlers so we can remove them on disconnect.
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleNotification = this.handleNotification.bind(this);
  }

  // -------- IStreamer contract --------

  start() {
    // Web Bluetooth requires a user gesture for requestDevice(). We don't
    // auto-scan on mount; that will happen when the user taps "Connect device".
    // Just mark ourselves as initialized and emit an idle status so the UI
    // can render the "Connect device" affordance.
    this.isRunning = true;
    this.emitStatus('idle', null);
  }

  stop() {
    this.isRunning = false;
    this.clearWatchdog();
    this.disconnect();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getSource() {
    return 'ble-web';
  }

  // -------- Connection control (called by the UI button) --------

  /**
   * Prompt the user to pick a MorphoGenixSOD device, then connect and start
   * receiving notifications. Must be called from a user gesture handler
   * (e.g. button onPress) due to browser security constraints.
   */
  async connect() {
    debugLog('connect() called');
    if (!isWebBluetoothAvailable()) {
      const reason =
        'Web Bluetooth is not available in this browser. Use Chrome or Edge on desktop, or Chrome on Android.';
      debugLog(`abort: ${reason}`);
      this.emitStatus('error', reason);
      throw new Error(reason);
    }

    let chooserDevice = null;
    try {
      debugLog(`requestDevice filter=name:"${this.deviceNameFilter}"`);
      // CRITICAL: requestDevice() MUST be the very first thing we do, with
      // ZERO awaits or setState calls in front of it. Browsers consume the
      // user-activation token after the first microtask boundary, and React
      // setState during a click handler can schedule synchronous flushes that
      // burn the token before requestDevice() ever runs. Symptom: the chooser
      // never appears even though the click registers and the screen flickers.
      //
      // Filter by both name and service UUID. Listing the service UUID in
      // optionalServices is also required so we can access it after pairing.
      chooserDevice = await navigator.bluetooth.requestDevice({
        filters: [{ name: this.deviceNameFilter }],
        optionalServices: [NUS_SERVICE_UUID],
      });
      debugLog(`chooser returned device name="${chooserDevice && chooserDevice.name}"`);
    } catch (err) {
      // Most common: user cancelled the chooser (NotFoundError). Treat as
      // a benign return to idle, not a hard error.
      const errLabel = `${(err && err.name) || 'Error'}: ${(err && err.message) || String(err)}`;
      const rawMsg = (err && err.message) || '';
      // True user cancel = AbortError, OR NotFoundError with a 'user' phrase.
      // NotFoundError WITHOUT 'user' usually means "no adapter / off / blocked"
      // and we want to surface that as a real, actionable error instead of
      // silently snapping back to idle.
      const userCancelled =
        (err && err.name === 'AbortError') ||
        (err && err.name === 'NotFoundError' && /user/i.test(rawMsg));
      if (userCancelled) {
        debugLog(`chooser cancelled by user (${errLabel})`);
        this.emitStatus('idle', null);
        return;
      }
      debugLog(`chooser FAILED ${errLabel}`);
      this.emitStatus('error', friendlyBleError(err));
      throw err;
    }

    // From here on out, we have a paired device but still need to connect to
    // its GATT server and subscribe to the TX characteristic. Status updates
    // and setStates are now safe — the user-gesture window is no longer
    // relevant once requestDevice() has resolved.
    try {
      this.device = chooserDevice;

      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect);

      this.emitStatus('connecting', this.device.name || this.deviceNameFilter);

      this.server = await this.device.gatt.connect();
      debugLog('GATT connected');
      const service = await this.server.getPrimaryService(NUS_SERVICE_UUID);
      debugLog('NUS service acquired');
      this.txCharacteristic = await service.getCharacteristic(NUS_TX_CHAR_UUID);
      debugLog('TX characteristic acquired');
      this.rxCharacteristic = await service.getCharacteristic(NUS_RX_CHAR_UUID);
      debugLog('RX characteristic acquired');

      await this.txCharacteristic.startNotifications();
      this.txCharacteristic.addEventListener(
        'characteristicvaluechanged',
        this.handleNotification
      );
      debugLog('notifications started — waiting for data');

      this.emitStatus('connected', this.device.name || this.deviceNameFilter);
      this.armWatchdog();
    } catch (err) {
      const errLabel = `${(err && err.name) || 'Error'}: ${(err && err.message) || String(err)}`;
      debugLog(`GATT/notify FAILED ${errLabel}`);
      this.emitStatus('error', friendlyBleError(err));
      this.disconnect();
      throw err;
    }
  }

  /**
   * Cleanly tear down the GATT connection. Safe to call repeatedly.
   */
  disconnect() {
    this.clearWatchdog();

    if (this.txCharacteristic) {
      try {
        this.txCharacteristic.removeEventListener(
          'characteristicvaluechanged',
          this.handleNotification
        );
        // Best-effort stopNotifications; ignore errors during teardown.
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
    this.palateMirrorBuffer = [];
    this.clenchAboveSince = null;
    this.clenchArmed = true;

    // Reset the one-shot diagnostic flags so the next connect attempt logs
    // first-chunk / first-packet / parse-fail again.
    this.loggedFirstChunk = false;
    this.loggedFirstPacket = false;
    this.loggedParseFail = false;

    this.emitStatus('idle', null);
  }

  async sendCommand(char) {
    if (char !== 'z' && char !== 'r') {
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

  // -------- Internal handlers --------

  handleDisconnect() {
    // Firmware reset, out-of-range, OS dropped link, etc. Surface and tear
    // down so a re-tap of "Connect device" gets a fresh handshake.
    this.emitStatus('disconnected', null);
    this.disconnect();
  }

  handleNotification(event) {
    const value = event.target && event.target.value; // DataView
    if (!value || !this.textDecoder) return;

    // Each notification is a few bytes of UTF-8. Append to the line buffer
    // and emit a packet for every complete '\n'-terminated line we see.
    const chunk = this.textDecoder.decode(value);

    // First-byte diagnostic: log exactly once per connection so we can tell
    // "firmware silent" from "firmware sending garbage" from "all good." The
    // hex dump is capped at 32 bytes so we don't spam the on-screen log.
    if (!this.loggedFirstChunk) {
      this.loggedFirstChunk = true;
      const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      const hex = Array.from(bytes.slice(0, 32))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      const ascii = chunk.replace(/[^\x20-\x7e]/g, '.').slice(0, 40);
      debugLog(`first chunk: ${value.byteLength}B  hex[${hex}]  ascii["${ascii}"]`);
    }

    this.lineBuffer += chunk;

    let newlineIdx;
    while ((newlineIdx = this.lineBuffer.indexOf('\n')) !== -1) {
      const line = this.lineBuffer.slice(0, newlineIdx).trim();
      this.lineBuffer = this.lineBuffer.slice(newlineIdx + 1);
      if (line.length > 0) {
        this.emitPacketFromLine(line);
      }
    }

    // Keep the watchdog quiet while data is flowing.
    this.armWatchdog();
  }

  emitPacketFromLine(line) {
    // Expected format: "<millisSinceBoot>,<molar_L>,<molar_R>,<palate_L>,<palate_R>"
    // Tolerant parsing: skip lines that don't match.
    const parts = line.split(',');
    if (parts.length < 5) {
      if (!this.loggedParseFail) {
        this.loggedParseFail = true;
        debugLog(`parse FAIL (expected 5 fields) line="${line.slice(0, 60)}"`);
      }
      return;
    }

    const firmwareMs = Number.parseInt(parts[0], 10);
    const rawValues = parts.slice(1, 5).map((part) => Number.parseInt(part, 10));
    if (!Number.isFinite(firmwareMs) || rawValues.some((value) => !Number.isFinite(value))) {
      if (!this.loggedParseFail) {
        this.loggedParseFail = true;
        debugLog(`parse FAIL (non-numeric field) line="${line.slice(0, 60)}"`);
      }
      return;
    }

    const clampedRaw = rawValues.map((value) => clamp(value, 0, ADC_MAX));
    const [molarL, molarR, palateL, palateR] = clampedRaw.map((value) =>
      clamp((value / ADC_MAX) * LIVE_GAIN, 0, 1)
    );

    // First-packet diagnostic: log the first successful parse so the user
    // sees positive confirmation that data is flowing through the pipeline.
    if (!this.loggedFirstPacket) {
      this.loggedFirstPacket = true;
      debugLog(
        `first packet OK  adc=[${clampedRaw.join(',')}]  norm=[${[molarL, molarR, palateL, palateR]
          .map((value) => value.toFixed(3))
          .join(',')}]`
      );
    }

    const { frontL, frontR } = this.computeLaggedMirrors(firmwareMs, palateL, palateR);
    const clenchEvent = this.updateClenchState(firmwareMs, molarL, molarR);

    // Build a packet that matches the existing IStreamer contract, plus a
    // couple of bench-only fields the Home screen can opt into.
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
      posture: 0, // unused in Phase 2
      palate: palateZones,
      clenchEvent,
      nasal: false,
      // Bench-only extras (ignored by code that only reads the contract):
      palateRaw: clampedRaw, // 4-tuple in firmware order: Molar_L, Molar_R, Palate_L, Palate_R
      palateNormalized: realMean, // mean of the four real normalized channels
      source: 'ble-web',
    };

    this.subscribers.forEach((cb) => cb(packet));
  }

  computeLaggedMirrors(t, p_l, p_r) {
    this.palateMirrorBuffer.push({ t, p_l, p_r });
    this.palateMirrorBuffer = this.palateMirrorBuffer.filter((sample) => t - sample.t <= MIRROR_BUFFER_MS);

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

  emitStatus(state, detail) {
    const status = { type: 'status', state, detail, t: Date.now() };
    this.subscribers.forEach((cb) => cb(status));
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

/**
 * Capability check — used by both BleStreamer and the Connect button so the UI
 * can degrade gracefully (e.g. "BLE not supported on iOS Safari").
 */
export function isWebBluetoothAvailable() {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.bluetooth !== 'undefined' &&
    typeof navigator.bluetooth.requestDevice === 'function'
  );
}

export {
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
};
