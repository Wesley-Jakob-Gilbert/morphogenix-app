/**
 * headPosition.js — head/sleep-position classifier for the Phase 3 IMU stream.
 *
 * Pure functional module (no React component code, only a small hook helper at
 * the bottom). The firmware (phase3_palate_4ch_imu_binary.ino) streams raw
 * accelerometer values which BleStreamer.js converts to g-units and attaches to
 * each packet as `packet.accelG = { x, y, z }`. This module turns those g-units
 * into a discrete head-position label and keeps a debounced event log.
 *
 * Math (mirrors the firmware's `i` diagnostic command so bench and app agree):
 *   pitch = atan2(-x, sqrt(y^2 + z^2)) * 180/PI   // nodding / head-down/up
 *   roll  = atan2( y, z)               * 180/PI   // tilt to shoulder
 *
 * Position buckets (after optional calibration-offset subtraction):
 *   |pitch| > 60deg                  -> 'upright'   (sitting / standing)
 *   else, by roll:
 *     roll in [-30, 30]              -> 'supine'    (on back, face up)
 *     |roll| > 150                   -> 'prone'     (face down)
 *     roll in (30, 150]              -> 'left'      (rolled to one side)
 *     roll in [-150, -30)            -> 'right'     (rolled to other side)
 *     anything else                  -> 'transitional'
 *
 * Side naming convention: with the device's Y axis pointing toward the user's
 * left, a positive roll (head tilted so +Y rotates down toward gravity) reads
 * as 'left'. Real-device calibration will confirm/flip this; documented here so
 * a sign flip is a one-line change.
 */

const RAD2DEG = 180 / Math.PI;

export const DEFAULT_CALIBRATION = Object.freeze({ pitch: 0, roll: 0 });

// Tunables for the rolling-average / debounce hook. Exported so tests and UI
// can reference them rather than hardcoding magic numbers.
export const ROLLING_WINDOW_MS = 2000; // 2-second rolling average of accel
export const DEBOUNCE_HOLD_MS = 5000;  // a position must hold >=5s to log
export const MAX_LOG_ENTRIES = 200;    // FIFO eviction cap

/**
 * Compute pitch & roll (in degrees) from a g-unit accel vector. Calibration
 * offsets (if provided) are subtracted from the raw angles.
 * @param {{x:number,y:number,z:number}} accelG
 * @param {{pitch:number,roll:number}} [calibration]
 * @returns {{pitch:number, roll:number}}
 */
export function computePitchRoll(accelG, calibration = DEFAULT_CALIBRATION) {
  const x = accelG?.x ?? 0;
  const y = accelG?.y ?? 0;
  const z = accelG?.z ?? 0;

  const pitch = Math.atan2(-x, Math.sqrt(y * y + z * z)) * RAD2DEG;
  const roll = Math.atan2(y, z) * RAD2DEG;

  const cal = calibration || DEFAULT_CALIBRATION;
  return {
    pitch: pitch - (cal.pitch || 0),
    roll: roll - (cal.roll || 0),
  };
}

/**
 * Classify a g-unit accelerometer vector into a head position.
 * @param {{x:number,y:number,z:number}} accelG — raw * 2 / 32768 g-units
 * @param {{pitch:number,roll:number}} [calibration] — offsets to subtract
 * @returns {'supine'|'prone'|'left'|'right'|'upright'|'transitional'}
 */
export function classifyPosition(accelG, calibration = DEFAULT_CALIBRATION) {
  if (
    !accelG ||
    typeof accelG.x !== 'number' ||
    typeof accelG.y !== 'number' ||
    typeof accelG.z !== 'number'
  ) {
    return 'transitional';
  }

  const { pitch, roll } = computePitchRoll(accelG, calibration);

  // Head clearly pitched forward/back -> upright (sitting/standing), regardless
  // of roll. Sleep classification only makes sense when roughly horizontal.
  if (Math.abs(pitch) > 60) return 'upright';

  const absRoll = Math.abs(roll);
  if (absRoll <= 30) return 'supine';
  if (absRoll > 150) return 'prone';
  if (roll > 30 && roll <= 150) return 'left';
  if (roll < -30 && roll >= -150) return 'right';

  return 'transitional';
}

// =========================================================================
// In-memory calibration store (no persistence yet — future task).
// AccountScreen's "Calibrate Supine" button writes here; the position hook
// reads it as the default calibration when no explicit calibration is passed.
// =========================================================================
let _calibration = { ...DEFAULT_CALIBRATION };
let _calibratedAt = null; // epoch ms of last calibration, or null

/**
 * Capture the current accel reading as the supine reference. Stores the pitch
 * and roll it produces (against zero offset) as the offsets to subtract going
 * forward, so "supine" reads as ~0/0 afterward.
 * @param {{x:number,y:number,z:number}} accelG
 * @returns {{pitch:number, roll:number, calibratedAt:number}}
 */
export function calibrateSupine(accelG) {
  const { pitch, roll } = computePitchRoll(accelG, DEFAULT_CALIBRATION);
  _calibration = { pitch, roll };
  _calibratedAt = Date.now();
  return { ..._calibration, calibratedAt: _calibratedAt };
}

export function getCalibration() {
  return { ..._calibration };
}

export function getCalibratedAt() {
  return _calibratedAt;
}

export function resetCalibration() {
  _calibration = { ...DEFAULT_CALIBRATION };
  _calibratedAt = null;
}

// =========================================================================
// React hook: useHeadPositionLog
// =========================================================================
// Imported lazily-safe: this module is also consumed by pure tests that don't
// touch React. The `require` keeps the hook colocated without forcing a React
// import on the pure-function consumers above.
const React = require('react');

/**
 * useHeadPositionLog — buffers accel readings, computes a rolling 2-second
 * average, classifies it, and maintains a debounced event log.
 *
 * A new log entry is appended only when the classified position CHANGES and
 * the new position has been continuously held for >= DEBOUNCE_HOLD_MS. The log
 * is capped at MAX_LOG_ENTRIES with FIFO eviction. In-memory only for now.
 *
 * @param {object} packet — latest stream packet; reads packet.accelG
 * @param {object} [options]
 * @param {{pitch:number,roll:number}} [options.calibration] — override store
 * @returns {{ currentPosition: string, log: Array<{timestamp:number, position:string, durationSec:number}> }}
 */
export function useHeadPositionLog(packet, options = {}) {
  const { useState, useRef, useEffect } = React;

  const [currentPosition, setCurrentPosition] = useState('transitional');
  const [log, setLog] = useState([]);

  // Rolling buffer of { t, x, y, z } accel samples (last ROLLING_WINDOW_MS).
  const bufferRef = useRef([]);
  // Debounce bookkeeping: the position we're waiting to confirm + when it
  // first appeared, and the position currently committed to the log.
  const pendingRef = useRef({ position: null, since: 0 });
  const committedRef = useRef({ position: null, since: 0 });

  const calibration = options.calibration || getCalibration();

  const accelG = packet?.accelG;
  // Stable scalar dependency so the effect runs once per distinct reading.
  const accelKey =
    accelG && typeof accelG.x === 'number'
      ? `${accelG.x},${accelG.y},${accelG.z}`
      : null;

  useEffect(() => {
    if (!accelG || typeof accelG.x !== 'number') return;

    const now = typeof packet?.t === 'number' ? packet.t : Date.now();
    const buffer = bufferRef.current;
    buffer.push({ t: now, x: accelG.x, y: accelG.y, z: accelG.z });

    // Drop samples older than the rolling window.
    const cutoff = now - ROLLING_WINDOW_MS;
    while (buffer.length && buffer[0].t < cutoff) buffer.shift();

    // Rolling 2-second average.
    const n = buffer.length;
    const avg = buffer.reduce(
      (acc, s) => {
        acc.x += s.x;
        acc.y += s.y;
        acc.z += s.z;
        return acc;
      },
      { x: 0, y: 0, z: 0 }
    );
    const avgG = { x: avg.x / n, y: avg.y / n, z: avg.z / n };

    const position = classifyPosition(avgG, calibration);
    setCurrentPosition(position);

    // ---- Debounce: only log a change that holds >= DEBOUNCE_HOLD_MS ----
    const pending = pendingRef.current;
    const committed = committedRef.current;

    if (position !== pending.position) {
      // New candidate position; start its hold timer.
      pendingRef.current = { position, since: now };
      return;
    }

    // Same candidate as before — has it held long enough AND is it actually a
    // change from what's committed?
    const heldLongEnough = now - pending.since >= DEBOUNCE_HOLD_MS;
    if (heldLongEnough && position !== committed.position) {
      const prevSince = committed.since || pending.since;
      const durationSec = Math.max(0, Math.round((now - prevSince) / 1000));
      committedRef.current = { position, since: now };

      setLog((prev) => {
        const next = prev.concat({
          timestamp: now,
          position,
          durationSec,
        });
        // FIFO eviction beyond the cap.
        if (next.length > MAX_LOG_ENTRIES) {
          return next.slice(next.length - MAX_LOG_ENTRIES);
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accelKey]);

  return { currentPosition, log };
}

export default classifyPosition;
