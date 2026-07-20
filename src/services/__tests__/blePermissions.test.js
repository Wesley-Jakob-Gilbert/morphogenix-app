/**
 * Tests for blePermissions — mocked platform + mocked BleManager.state().
 */

// Mock react-native's Platform + PermissionsAndroid so we can drive each path.
jest.mock('react-native', () => {
  const RESULTS = { GRANTED: 'granted', DENIED: 'denied' };
  const PERMISSIONS = {
    BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
    BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
    ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
  };
  return {
    Platform: { OS: 'ios' },
    PermissionsAndroid: {
      RESULTS,
      PERMISSIONS,
      requestMultiple: jest.fn(),
    },
  };
});

import { Platform, PermissionsAndroid } from 'react-native';
import {
  ensureBleReady,
  requestAndroidBlePermissions,
  waitForPoweredOn,
} from '../blePermissions';

function fakeManager(stateValue, { onStateChangeImpl } = {}) {
  return {
    state: jest.fn().mockResolvedValue(stateValue),
    onStateChange: jest.fn((cb, emitCurrent) => {
      if (onStateChangeImpl) onStateChangeImpl(cb, emitCurrent);
      return { remove: jest.fn() };
    }),
  };
}

describe('ensureBleReady — platform routing', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
    jest.clearAllMocks();
  });

  test('web platform is always ok (chooser handles permission)', async () => {
    const res = await ensureBleReady({ platform: 'web' });
    expect(res).toEqual({ ok: true });
  });

  test('mock platform is always ok', async () => {
    const res = await ensureBleReady({ platform: 'mock' });
    expect(res).toEqual({ ok: true });
  });

  test('iOS returns ok when radio is PoweredOn', async () => {
    Platform.OS = 'ios';
    const manager = fakeManager('PoweredOn');
    const res = await ensureBleReady({ platform: 'native', manager });
    expect(res).toEqual({ ok: true });
    expect(manager.state).toHaveBeenCalled();
  });

  test('iOS returns bluetooth_off when radio is PoweredOff', async () => {
    Platform.OS = 'ios';
    const manager = fakeManager('PoweredOff');
    const res = await ensureBleReady({ platform: 'native', manager });
    expect(res).toEqual({ ok: false, reason: 'bluetooth_off' });
  });

  test('returns unsupported when radio state is Unsupported', async () => {
    Platform.OS = 'ios';
    const manager = fakeManager('Unsupported');
    const res = await ensureBleReady({ platform: 'native', manager });
    expect(res).toEqual({ ok: false, reason: 'unsupported' });
  });
});

describe('requestAndroidBlePermissions', () => {
  beforeEach(() => {
    Platform.OS = 'android';
    jest.clearAllMocks();
  });

  test('grants when all requested permissions are granted', async () => {
    PermissionsAndroid.requestMultiple.mockResolvedValue({
      'android.permission.BLUETOOTH_SCAN': 'granted',
      'android.permission.BLUETOOTH_CONNECT': 'granted',
      'android.permission.ACCESS_FINE_LOCATION': 'granted',
    });
    const res = await requestAndroidBlePermissions();
    expect(res).toEqual({ ok: true });
    expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledTimes(1);
  });

  test('denies when any permission is denied', async () => {
    PermissionsAndroid.requestMultiple.mockResolvedValue({
      'android.permission.BLUETOOTH_SCAN': 'granted',
      'android.permission.BLUETOOTH_CONNECT': 'denied',
      'android.permission.ACCESS_FINE_LOCATION': 'granted',
    });
    const res = await requestAndroidBlePermissions();
    expect(res).toEqual({ ok: false, reason: 'permission_denied' });
  });

  test('non-android platform is a no-op ok', async () => {
    Platform.OS = 'ios';
    const res = await requestAndroidBlePermissions();
    expect(res).toEqual({ ok: true });
  });
});

describe('ensureBleReady — Android combines permission + radio checks', () => {
  beforeEach(() => {
    Platform.OS = 'android';
    jest.clearAllMocks();
  });

  test('permission denied short-circuits before radio check', async () => {
    PermissionsAndroid.requestMultiple.mockResolvedValue({
      'android.permission.BLUETOOTH_SCAN': 'denied',
      'android.permission.BLUETOOTH_CONNECT': 'denied',
      'android.permission.ACCESS_FINE_LOCATION': 'denied',
    });
    const manager = fakeManager('PoweredOn');
    const res = await ensureBleReady({ platform: 'native', manager });
    expect(res).toEqual({ ok: false, reason: 'permission_denied' });
    expect(manager.state).not.toHaveBeenCalled();
  });

  test('permission granted then radio powered on -> ok', async () => {
    PermissionsAndroid.requestMultiple.mockResolvedValue({
      'android.permission.BLUETOOTH_SCAN': 'granted',
      'android.permission.BLUETOOTH_CONNECT': 'granted',
      'android.permission.ACCESS_FINE_LOCATION': 'granted',
    });
    const manager = fakeManager('PoweredOn');
    const res = await ensureBleReady({ platform: 'native', manager });
    expect(res).toEqual({ ok: true });
  });
});

describe('waitForPoweredOn — transition handling', () => {
  test('resolves ok once state changes to PoweredOn', async () => {
    const manager = fakeManager('Unknown', {
      onStateChangeImpl: (cb) => {
        setTimeout(() => cb('PoweredOn'), 0);
      },
    });
    const res = await waitForPoweredOn(manager);
    expect(res).toEqual({ ok: true });
  });

  test('resolves bluetooth_off if it transitions to PoweredOff', async () => {
    const manager = fakeManager('Resetting', {
      onStateChangeImpl: (cb) => {
        setTimeout(() => cb('PoweredOff'), 0);
      },
    });
    const res = await waitForPoweredOn(manager);
    expect(res).toEqual({ ok: false, reason: 'bluetooth_off' });
  });
});
