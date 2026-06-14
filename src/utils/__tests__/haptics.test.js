/**
 * Haptics wrapper contract tests (Roadmap V2 item #6).
 *
 * We verify the public method surface exists and is callable. The default
 * jest-expo environment reports `Platform.OS === 'ios'`, so the native branch
 * is exercised here; expo-haptics is auto-mocked by jest-expo so the calls
 * resolve without touching a real device.
 */
import { haptics } from '../haptics';

describe('haptics wrapper', () => {
  const methods = ['selection', 'light', 'medium', 'heavy', 'success', 'warning', 'error'];

  it('exposes the full intent-named method surface', () => {
    methods.forEach((m) => {
      expect(typeof haptics[m]).toBe('function');
    });
  });

  it('invokes each method without throwing', () => {
    methods.forEach((m) => {
      expect(() => haptics[m]()).not.toThrow();
    });
  });
});
