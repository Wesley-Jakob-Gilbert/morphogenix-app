/**
 * BleStreamer router tests — confirm the PUBLIC API is unchanged and that the
 * router wires permissions + session persistence around the adapter without
 * touching real hardware. Uses the 'mock' platform so no native module loads.
 */

// Permissions: default to ready; individual tests override.
jest.mock('../../blePermissions', () => ({
  ensureBleReady: jest.fn(async () => ({ ok: true })),
}));

// Session store: spy on lifecycle.
jest.mock('../../sessionStore', () => ({
  __esModule: true,
  default: {
    startSession: jest.fn(async () => 99),
    recordFrame: jest.fn(),
    endSession: jest.fn(async () => {}),
    getRecentSessions: jest.fn(async () => []),
  },
}));

import BleStreamer, { isWebBluetoothAvailable } from '../BleStreamer';
import { ensureBleReady } from '../../blePermissions';
import sessionStore from '../../sessionStore';

function makeStreamer() {
  // Force the mock platform so the synthetic adapter is used.
  return new BleStreamer({ platform: 'mock' });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('public API surface (unchanged contract)', () => {
  test('exposes start/stop/subscribe/connect/disconnect/sendCommand/getSource/getState', () => {
    const s = makeStreamer();
    for (const m of [
      'start',
      'stop',
      'subscribe',
      'connect',
      'disconnect',
      'sendCommand',
      'getSource',
      'getState',
    ]) {
      expect(typeof s[m]).toBe('function');
    }
  });

  test('re-exports isWebBluetoothAvailable for StreamerProvider', () => {
    expect(typeof isWebBluetoothAvailable).toBe('function');
  });

  test('start() emits an idle status on the multiplexed channel', () => {
    const s = makeStreamer();
    const events = [];
    s.subscribe((e) => events.push(e));
    s.start();
    expect(events).toEqual([
      expect.objectContaining({ type: 'status', state: 'idle', detail: null }),
    ]);
  });

  test('getSource reflects the routed platform', () => {
    expect(new BleStreamer({ platform: 'native' }).getSource()).toBe('ble-native');
    expect(new BleStreamer({ platform: 'web' }).getSource()).toBe('ble-web');
    expect(new BleStreamer({ platform: 'mock' }).getSource()).toBe('ble-mock');
  });
});

describe('permission gating', () => {
  test('aborts with an error status when readiness is not ok', async () => {
    ensureBleReady.mockResolvedValueOnce({ ok: false, reason: 'bluetooth_off' });
    const s = makeStreamer();
    const events = [];
    s.subscribe((e) => events.push(e));
    await s.connect();
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'status', state: 'error', detail: 'bluetooth_off' })
    );
    expect(sessionStore.startSession).not.toHaveBeenCalled();
  });
});

describe('session + streaming wiring via the mock adapter', () => {
  test('connects, starts a session, records frames, and ends on disconnect', async () => {
    const s = makeStreamer();
    const packets = [];
    const statuses = [];
    s.subscribe((e) => {
      if (e && e.type === 'status') statuses.push(e.state);
      else packets.push(e);
    });

    const connectPromise = s.connect();
    // Mock adapter waits CONNECT_DELAY_MS before 'connected'.
    await jest.advanceTimersByTimeAsync(500);
    await connectPromise;

    expect(statuses).toContain('connected');
    expect(sessionStore.startSession).toHaveBeenCalledTimes(1);

    // Let a few 10 Hz frames flow.
    await jest.advanceTimersByTimeAsync(300);
    expect(packets.length).toBeGreaterThan(0);
    expect(sessionStore.recordFrame).toHaveBeenCalled();
    // recordFrame is called with the active session id (resolved to 99).
    expect(sessionStore.recordFrame.mock.calls[0][0]).toBe(99);

    s.disconnect();
    await jest.advanceTimersByTimeAsync(1);
    expect(statuses).toContain('idle');
    expect(sessionStore.endSession).toHaveBeenCalledWith(99);
  });

  test('sendCommand rejects an invalid command via the adapter', async () => {
    const s = makeStreamer();
    const connectPromise = s.connect();
    await jest.advanceTimersByTimeAsync(500);
    await connectPromise;
    await expect(s.sendCommand('q')).rejects.toThrow(/Unsupported BLE command/);
    s.disconnect();
  });

  test('sendCommand before connect throws', async () => {
    const s = makeStreamer();
    await expect(s.sendCommand('z')).rejects.toThrow(/before connecting/);
  });
});
