/**
 * Smoke test for nativeBleAdapter.
 *
 * The native BLE transport is impractical to fully unit-test (it needs the
 * ble-plx native module + a real radio + a real device). Per the brief we just
 * confirm the module *initializes* without throwing: it imports react-native-
 * ble-plx (mocked here), constructs a BleManager, and instantiates the adapter
 * with the standard onFrame/onStatus contract. We also verify the exported
 * getManager() returns a singleton.
 */

jest.mock('react-native-ble-plx', () => {
  class FakeBleManager {
    constructor() {
      FakeBleManager.instances += 1;
    }
    state() {
      return Promise.resolve('PoweredOn');
    }
    startDeviceScan() {}
    stopDeviceScan() {}
    connectToDevice() {
      return Promise.resolve({});
    }
    cancelDeviceConnection() {
      return Promise.resolve();
    }
    onStateChange() {
      return { remove: () => {} };
    }
  }
  FakeBleManager.instances = 0;
  return { BleManager: FakeBleManager };
});

describe('nativeBleAdapter module init', () => {
  test('imports and constructs without throwing', () => {
    // eslint-disable-next-line global-require
    const mod = require('../nativeBleAdapter');
    const NativeBleAdapter = mod.default;
    expect(typeof NativeBleAdapter).toBe('function');

    let adapter;
    expect(() => {
      adapter = new NativeBleAdapter({ onFrame: () => {}, onStatus: () => {} });
    }).not.toThrow();

    // Contract methods exist.
    expect(typeof adapter.connect).toBe('function');
    expect(typeof adapter.disconnect).toBe('function');
    expect(typeof adapter.sendCommand).toBe('function');
  });

  test('getManager() returns a singleton BleManager', () => {
    // eslint-disable-next-line global-require
    const { getManager } = require('../nativeBleAdapter');
    const a = getManager();
    const b = getManager();
    expect(a).toBe(b);
  });

  test('rejects unsupported commands before any radio call', async () => {
    // eslint-disable-next-line global-require
    const NativeBleAdapter = require('../nativeBleAdapter').default;
    const adapter = new NativeBleAdapter({ onFrame: () => {}, onStatus: () => {} });
    await expect(adapter.sendCommand('x')).rejects.toThrow(/Unsupported BLE command/);
  });
});
