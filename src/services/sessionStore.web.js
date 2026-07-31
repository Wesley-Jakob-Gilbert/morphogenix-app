/**
 * sessionStore.web.js — no-op web stub of sessionStore.
 *
 * Metro auto-selects `.web.js` when bundling for web (expo export -p web),
 * so this replaces the native expo-sqlite-backed sessionStore. The website
 * demo doesn't have live BLE hardware, so there is nothing to persist —
 * every operation is a no-op that returns sensible defaults.
 *
 * Keeping this stub avoids pulling `expo-sqlite` (and its wa-sqlite.wasm
 * asset) into the web bundle, which currently breaks Metro's web bundler.
 */

export async function startSession({ source = 'ble' } = {}) {
  return -1; // sentinel; caller treats this as opaque
}

export function recordFrame(_sessionId, _frame) {
  // no-op
}

export async function endSession(_sessionId) {
  // no-op
}

export async function getRecentSessions(_limit = 10) {
  return [];
}

export function __resetForTests() {
  // no-op
}

export default {
  startSession,
  recordFrame,
  endSession,
  getRecentSessions,
  __resetForTests,
};
