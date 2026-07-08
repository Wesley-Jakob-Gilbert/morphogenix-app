/**
 * BleStreamer — real Web Bluetooth implementation for the MorphoGenix prototype.
 *
 * Talks to the XIAO nRF52840 firmware running the Nordic UART Service (NUS).
 * Firmware sends one ASCII line every ~100 ms over the NUS TX characteristic:
 *
 *     "<millis>,<adcValue>\n"
 *
 * where adcValue is a 12-bit reading (0..4095) from the palate FSR.
 *
 * Phase 2 mapping:
 *   - We receive ONE channel (palate_L). The IStreamer contract expects a
 *     16-element palate[] array of normalized 0..1 values. To keep the rest
 *     of the app (PalateHeroCard, MetricTile averaging, etc.) working with
 *     zero changes, we splat the same normalized value across all 16 zones.
 *   - We additionally attach `palateRaw` and `palateAdc` so the Home screen
 *     can show the raw 12-bit number alongside the normalized average — useful
 *     for bench calibration.
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
// const NUS_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // phone -> device (write); unused in Phase 2

// Firmware advertises this name; we filter the device picker by it.
const DEVICE_NAME_FILTER = 'MorphoGenixSOD';

// FSR ADC range on the nRF52840 in 12-bit mode. Used to normalize 0..4095 -> 0..1.
const ADC_MAX = 4095;

// =========================================================================
// CHANNEL MAP — MUST match firmware/phase2_palate_1ch/phase2_palate_1ch.ino
// =========================================================================
//
// The firmware sends ASCII lines of the form:
//     "<millisSinceBoot>,<adc[0]>[,<adc[1]>,<adc[2]>...]\n"
//
// Wire index | Logical channel    | Anatomical region        | XIAO pin
// -----------+--------------------+--------------------------+---------
//   adc[0]   | FSR_PALATE_CENTER  | Hard palate, midline     | A0
//
// Future channels (reserved positions — firmware will append in this order):
//   adc[1]   | FSR_PALATE_LEFT    | Hard palate, left side   | A1
//   adc[2]   | FSR_PALATE_RIGHT   | Hard palate, right side  | A2
//
// IMPORTANT: This order is a CONTRACT with the firmware. If you reorder the
// physical wiring, update BOTH this comment AND the matching CHANNEL MAP at
// the top of phase2_palate_1ch.ino in the SAME commit. Otherwise the bench
// will silently render the wrong zones, which is the single hardest class
// of multi-channel bug to track down.
//
// Logical channel names — use these in code, never the bare index. When we
// add channels 1 and 2, the parser will read them as CHANNEL_MAP[i].
export const CHANNEL_MAP = Object.freeze([
  { name: 'FSR_PALATE_CENTER', region: 'palate.center', pin: 'A0' },
  // { name: 'FSR_PALATE_LEFT',   region: 'palate.left',   pin: 'A1' },
  // { name: 'FSR_PALATE_RIGHT',  region: 'palate.right',  pin: 'A2' },
]);
// =========================================================================

// =========================================================================
// BINARY WIRE FORMAT — mirrored in firmware/phase2_palate_binary.ino
// =========================================================================
//
//   Offset  Size  Field           Value / Meaning
//   ------  ----  --------------  ----------------------------------------
//   0       1     magic           0xA7
//   1       1     version         0x01
//   2       4     timestamp_ms    uint32 LE
//   6       1     channel_count   uint8
//   7       2*N   adc_values      uint16 LE per channel, 0..4095
//   7+2*N   1     checksum        XOR of all preceding bytes
//
// Total = 8 + 2N bytes. N=1 → 10 bytes. N=3 → 14 bytes. Both fit in one
// default-MTU BLE notification (20-byte payload).
const BIN_MAGIC = 0xa7;
const BIN_VERSION = 0x01;
const BIN_HEADER_BYTES = 7;   // magic + ver + ts(4) + count
const BIN_TRAILER_BYTES = 1;  // checksum

// Auto-detect: the ASCII firmware sends '\n'-terminated text starting with
// an ASCII digit (0x30..0x39). The binary firmware starts with 0xA7. The
// magic byte was chosen specifically to be outside the ASCII printable
// range so this sniff is unambiguous.
function detectWireFormat(firstByte) {
  if (firstByte === BIN_MAGIC) return 'binary';
  return 'ascii';
}
// =========================================================================

// How many zones the rest of the app expects in packet.palate. Phase 2 uses 1 FSR
// but the UI averages across the array, so splatting works perfectly.
const PALATE_ZONE_COUNT = 16;

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

export default class BleStreamer {
  constructor({ deviceNameFilter = DEVICE_NAME_FILTER } = {}) {
    this.deviceNameFilter = deviceNameFilter;
    this.subscribers = new Set();
    this.isRunning = false;

    // Web Bluetooth handles
    this.device = null;
    this.server = null;
    this.txCharacteristic = null;

    // For ASCII-line reassembly across notifications. Notifications are
    // 20-byte chunks by default and a "<ms>,<adc>\n" line is usually <16
    // chars, but we still buffer in case a packet arrives across boundaries.
    this.lineBuffer = '';
    this.textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

    // Binary-path reassembly state. Initialized here so handleNotification
    // can never see undefined — disconnect() also resets these on every
    // teardown so a stale buffer can't leak across reconnects.
    this.binBuffer = null;
    this.wireFormat = null;

    // One-shot diagnostic flags. See disconnect() for the reset.
    this.loggedFirstChunk = false;
    this.loggedFirstPacket = false;
    this.loggedParseFail = false;

    // Watchdog timer for "connected but silent" states.
    this.watchdogTimer = null;

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
    this.binBuffer = null;
    this.wireFormat = null;

    // Reset the one-shot diagnostic flags so the next connect attempt logs
    // first-chunk / first-packet / parse-fail again.
    this.loggedFirstChunk = false;
    this.loggedFirstPacket = false;
    this.loggedParseFail = false;

    this.emitStatus('idle', null);
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
    if (!value || value.byteLength === 0) return;

    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

    // First-byte diagnostic + format auto-detect. Fires exactly once per
    // connection so we can tell "firmware silent" from "firmware sending
    // garbage" from "all good." The detected format is cached for the rest
    // of the session so we don't re-sniff every notification.
    if (!this.loggedFirstChunk) {
      this.loggedFirstChunk = true;
      this.wireFormat = detectWireFormat(bytes[0]);
      const hex = Array.from(bytes.slice(0, 32))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      const asciiPreview =
        this.textDecoder
          ?.decode(value)
          .replace(/[^\x20-\x7e]/g, '.')
          .slice(0, 40) || '';
      debugLog(
        `first chunk: ${value.byteLength}B  format=${this.wireFormat}  hex[${hex}]  ascii["${asciiPreview}"]`
      );
    }

    if (this.wireFormat === 'binary') {
      this.handleBinaryChunk(bytes);
    } else {
      this.handleAsciiChunk(value);
    }

    // Keep the watchdog quiet while data is flowing.
    this.armWatchdog();
  }

  // ---- ASCII path: legacy phase2_palate_1ch.ino sketch -------------
  handleAsciiChunk(value) {
    if (!this.textDecoder) return;
    const chunk = this.textDecoder.decode(value);
    this.lineBuffer += chunk;

    let newlineIdx;
    while ((newlineIdx = this.lineBuffer.indexOf('\n')) !== -1) {
      const line = this.lineBuffer.slice(0, newlineIdx).trim();
      this.lineBuffer = this.lineBuffer.slice(newlineIdx + 1);
      if (line.length > 0) {
        this.emitPacketFromLine(line);
      }
    }
  }

  // ---- Binary path: phase2_palate_binary.ino sketch ----------------
  //
  // Notifications can in principle arrive fragmented (BLE doesn't guarantee
  // one notification = one application packet, even though at our MTU and
  // packet size they almost always coincide). We accumulate into a byte
  // buffer and pull complete packets off the front. Anything that doesn't
  // start with the magic byte is treated as resync garbage and we scan
  // forward to the next magic.
  handleBinaryChunk(bytes) {
    if (!this.binBuffer) this.binBuffer = new Uint8Array(0);

    // Append incoming bytes to the accumulator.
    const merged = new Uint8Array(this.binBuffer.length + bytes.length);
    merged.set(this.binBuffer, 0);
    merged.set(bytes, this.binBuffer.length);
    this.binBuffer = merged;

    let pos = 0;
    while (pos < this.binBuffer.length) {
      // Resync: skip bytes until we find a magic. This protects us from a
      // mid-stream radio glitch or a partial packet left over from a prior
      // connection.
      if (this.binBuffer[pos] !== BIN_MAGIC) {
        pos++;
        continue;
      }

      // Need at least header + 1 channel + checksum before we can read
      // channel_count and decide how long this packet is.
      if (this.binBuffer.length - pos < BIN_HEADER_BYTES + 2 + BIN_TRAILER_BYTES) {
        break;
      }

      const version = this.binBuffer[pos + 1];
      if (version !== BIN_VERSION) {
        if (!this.loggedParseFail) {
          this.loggedParseFail = true;
          debugLog(`parse FAIL (binary version=${version}, expected ${BIN_VERSION})`);
        }
        pos++; // skip this magic, try to resync
        continue;
      }

      const channelCount = this.binBuffer[pos + 6];
      const pktSize = BIN_HEADER_BYTES + 2 * channelCount + BIN_TRAILER_BYTES;

      // Wait for the rest of the packet to arrive.
      if (this.binBuffer.length - pos < pktSize) break;

      // Verify checksum (XOR of every byte except the checksum itself).
      let xorSum = 0;
      for (let i = 0; i < pktSize - 1; i++) xorSum ^= this.binBuffer[pos + i];
      const sentChecksum = this.binBuffer[pos + pktSize - 1];
      if (xorSum !== sentChecksum) {
        if (!this.loggedParseFail) {
          this.loggedParseFail = true;
          debugLog(
            `parse FAIL (checksum: got 0x${sentChecksum.toString(16)}, expected 0x${xorSum.toString(16)})`
          );
        }
        pos++; // skip this magic, try to resync
        continue;
      }

      // Read fields. DataView is the right tool for guaranteed LE reads.
      const dv = new DataView(
        this.binBuffer.buffer,
        this.binBuffer.byteOffset + pos,
        pktSize
      );
      const timestampMs = dv.getUint32(2, /*littleEndian=*/ true);
      const adcValues = new Array(channelCount);
      for (let i = 0; i < channelCount; i++) {
        adcValues[i] = dv.getUint16(BIN_HEADER_BYTES + 2 * i, true);
      }

      this.emitPacketFromBinary(timestampMs, adcValues);
      pos += pktSize;
    }

    // Keep only the unconsumed tail for the next notification.
    this.binBuffer = this.binBuffer.slice(pos);
  }

  emitPacketFromLine(line) {
    // Expected format: "<millisSinceBoot>,<adcValue>"
    // Tolerant parsing: skip lines that don't match.
    const parts = line.split(',');
    if (parts.length < 2) {
      if (!this.loggedParseFail) {
        this.loggedParseFail = true;
        debugLog(`parse FAIL (no comma) line="${line.slice(0, 60)}"`);
      }
      return;
    }

    const adcValue = Number.parseInt(parts[1], 10);
    if (!Number.isFinite(adcValue)) {
      if (!this.loggedParseFail) {
        this.loggedParseFail = true;
        debugLog(`parse FAIL (non-numeric adc) line="${line.slice(0, 60)}"`);
      }
      return;
    }

    // Phase 2: single channel. When we add channels 1 and 2, the ASCII
    // sketch will append more comma-separated ints in the same order as
    // CHANNEL_MAP, and we'll loop here. For now we hand off as [adcValue].
    this.emitPacketFromAdcArray([adcValue], /*formatLabel=*/ 'ascii');
  }

  emitPacketFromBinary(timestampMs, adcValues) {
    // timestampMs is from the XIAO's millis() clock; not Date.now() but a
    // monotonic millisecond count since the device booted. Useful for
    // sample-rate diagnostics but the rest of the app expects t=Date.now(),
    // so we don't propagate it here — yet. Reserved for when we add a
    // "sample interval" debug overlay.
    void timestampMs;
    this.emitPacketFromAdcArray(adcValues, /*formatLabel=*/ 'binary');
  }

  // ---- Shared packet-shaping for both wire formats ----------------
  // Maps a parsed adc[] array to the IStreamer packet contract the rest of
  // the app consumes. Phase 2 has 1 channel today and reserves 2 more; the
  // mapping rule for now is "splat channel 0 across all zones" because the
  // UI averages the zones array. When we add channels 1 and 2 with real
  // anatomical zoning, the splat becomes a proper zone-by-zone mapping.
  emitPacketFromAdcArray(adcValues, formatLabel) {
    if (!adcValues || adcValues.length === 0) return;

    if (!this.loggedFirstPacket) {
      this.loggedFirstPacket = true;
      const adc0 = adcValues[0];
      debugLog(
        `first packet OK (${formatLabel})  adc[0]=${adc0}  norm=${(adc0 / ADC_MAX).toFixed(3)}`
      );
    }

    // Clamp each channel to the 12-bit range so out-of-spec firmware can't
    // push the UI into ugly states.
    const clamped = adcValues.map((v) => Math.max(0, Math.min(ADC_MAX, v)));
    const normalized = clamped.map((v) => v / ADC_MAX);

    // Phase 2 mapping: splat channel 0 across all zones. See CHANNEL_MAP.
    const palateZones = new Array(PALATE_ZONE_COUNT).fill(normalized[0]);

    const packet = {
      t: Date.now(),
      posture: 0, // unused in Phase 2
      palate: palateZones,
      clenchEvent: false,
      nasal: false,
      // Bench-only extras (ignored by code that only reads the contract):
      palateRaw: clamped[0],         // 0..4095 for the "raw: 2847" callout
      palateNormalized: normalized[0], // 0..1 for direct gauge use
      adcChannels: clamped,          // full array for future multi-channel UI
      source: 'ble-web',
    };

    this.subscribers.forEach((cb) => cb(packet));
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
  DEVICE_NAME_FILTER,
  ADC_MAX,
  PALATE_ZONE_COUNT,
};
