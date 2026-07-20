/**
 * blePermissions.js — cross-platform BLE readiness gate.
 *
 * Called at the start of BleStreamer.connect(). Returns a small result object:
 *   { ok: true }
 *   { ok: false, reason: 'permission_denied' | 'bluetooth_off' | 'unsupported' }
 *
 * Platform behaviour:
 *   - Android: requests the runtime permissions BLE scanning needs. On API 31+
 *     (Android 12) that is BLUETOOTH_SCAN + BLUETOOTH_CONNECT; older devices
 *     still gate scanning behind ACCESS_FINE_LOCATION. We request whichever of
 *     these constants exist on the running OS.
 *   - iOS: no runtime permission prompt is needed to *start* using CoreBluetooth
 *     (the NSBluetoothAlwaysUsageDescription string handles the system prompt),
 *     but we DO wait for the radio to report 'PoweredOn' so a powered-off radio
 *     surfaces as 'bluetooth_off' rather than a silent scan that never finds
 *     anything.
 *   - web: Web Bluetooth has its own in-chooser permission model; there is no
 *     pre-flight to run, so we report ok:true and let the chooser handle it.
 *
 * The BleManager instance is imported lazily (native only) so this module is
 * safe to import on web and under Jest.
 */

import { Platform, PermissionsAndroid } from 'react-native';

const BT_STATE_TIMEOUT_MS = 4000;

/**
 * Request the Android runtime permissions required for BLE scan + connect.
 * Returns { ok } or { ok:false, reason:'permission_denied' }.
 */
export async function requestAndroidBlePermissions() {
  if (Platform.OS !== 'android') return { ok: true };
  if (!PermissionsAndroid || typeof PermissionsAndroid.requestMultiple !== 'function') {
    return { ok: true };
  }

  const P = PermissionsAndroid.PERMISSIONS || {};
  // Only request permissions the running OS actually defines. On API < 31 the
  // BLUETOOTH_SCAN/CONNECT constants are undefined and FINE_LOCATION is what
  // gates scanning.
  const wanted = [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT, P.ACCESS_FINE_LOCATION].filter(Boolean);
  if (wanted.length === 0) return { ok: true };

  let granted;
  try {
    granted = await PermissionsAndroid.requestMultiple(wanted);
  } catch (_) {
    return { ok: false, reason: 'permission_denied' };
  }

  const GRANTED = (PermissionsAndroid.RESULTS && PermissionsAndroid.RESULTS.GRANTED) || 'granted';
  const allGranted = wanted.every((perm) => granted[perm] === GRANTED);
  return allGranted ? { ok: true } : { ok: false, reason: 'permission_denied' };
}

/**
 * On native, resolve once the radio reports 'PoweredOn', or reject/report
 * 'bluetooth_off' if it is off. `managerOverride` lets tests inject a fake
 * BleManager so this stays unit-testable without the native module.
 */
export async function waitForPoweredOn(managerOverride) {
  let manager = managerOverride;
  if (!manager) {
    // eslint-disable-next-line global-require
    const { getManager } = require('./streamer/nativeBleAdapter');
    manager = getManager();
  }

  let current;
  try {
    current = await manager.state();
  } catch (_) {
    return { ok: false, reason: 'unsupported' };
  }

  if (current === 'PoweredOn') return { ok: true };
  if (current === 'Unsupported') return { ok: false, reason: 'unsupported' };
  if (current === 'PoweredOff') return { ok: false, reason: 'bluetooth_off' };

  // 'Resetting' / 'Unknown' / 'Unauthorized' — wait briefly for a transition.
  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      if (subscription && typeof subscription.remove === 'function') subscription.remove();
      clearTimeout(timer);
      resolve(result);
    };

    const subscription = manager.onStateChange((state) => {
      if (state === 'PoweredOn') finish({ ok: true });
      else if (state === 'PoweredOff') finish({ ok: false, reason: 'bluetooth_off' });
      else if (state === 'Unsupported') finish({ ok: false, reason: 'unsupported' });
      else if (state === 'Unauthorized') finish({ ok: false, reason: 'permission_denied' });
    }, true);

    const timer = setTimeout(() => finish({ ok: false, reason: 'bluetooth_off' }), BT_STATE_TIMEOUT_MS);
  });
}

/**
 * Top-level readiness check used by BleStreamer.connect().
 *
 * @param {object}  [opts]
 * @param {string}  [opts.platform]  'native' | 'web' | 'mock' | Platform.OS
 * @param {object}  [opts.manager]   inject a fake BleManager (tests)
 * @returns {Promise<{ok:true}|{ok:false, reason:string}>}
 */
export async function ensureBleReady(opts = {}) {
  const platform = opts.platform || Platform.OS;

  // Mock adapter needs nothing.
  if (platform === 'mock') return { ok: true };

  // Web Bluetooth handles permission inside the chooser.
  if (platform === 'web' || Platform.OS === 'web') return { ok: true };

  if (Platform.OS === 'android') {
    const perm = await requestAndroidBlePermissions();
    if (!perm.ok) return perm;
  }

  // iOS + Android both need the radio powered on before scanning.
  return waitForPoweredOn(opts.manager);
}

export default { ensureBleReady, requestAndroidBlePermissions, waitForPoweredOn };
