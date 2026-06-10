import { useEffect, useRef, useState } from 'react';

/**
 * useLiveDemoMetrics
 *
 * Derives the four Home-screen tile values from the live 4-FSR stream for the
 * `?live=video` demo recording. Decoupled from `useMorphoday` aggregation so
 * the demo can show snappy, visibly-changing numbers without waiting for the
 * morphoday rolling buffer to fill.
 *
 *   Palatal Pressure: PRESSURE_GAIN * (avg of 4 real sensors) * 100
 *                     -> integer 0..100ish. The "real sensors" here are the
 *                     four 0..1 normalized values living at palate[1, 2, 9, 10].
 *                     palate[9] and palate[10] are firmware-faked mirrors of
 *                     the back row, so this avg behaves like a single chew/
 *                     swallow signal multiplied by ~2 (back row counted twice).
 *                     PRESSURE_GAIN of 1.6 gives a comfortable 0..95 spread
 *                     during a typical chew without saturating.
 *
 *   Clench Events:    Integer counter. +1 each time the palatal pressure
 *                     score crosses ABOVE 80 (rising edge). Hysteresis: must
 *                     fall back below 60 before another count can fire.
 *                     Reset to 0 at hook mount.
 *
 *   Posture Score:    Random walk in [70, 95], drifting by [-2, +2] every
 *                     RANDOM_WALK_INTERVAL_MS. Initial value 87 (matches the
 *                     existing fallback in HomeScreen).
 *
 *   Nasal Breathing:  Random walk in [85, 99], drifting by [-1, +1] every
 *                     RANDOM_WALK_INTERVAL_MS. Initial value 94.
 *
 * The hook is intentionally stateless w.r.t. morphoday — it does not write
 * into the aggregate store. That keeps `?live=video` purely cosmetic.
 */

const PRESSURE_GAIN = 1.6;
const CLENCH_RISE_THRESHOLD = 80;
const CLENCH_FALL_THRESHOLD = 60;
const RANDOM_WALK_INTERVAL_MS = 2000;

// Rolling window for the displayed pressure score. At ~10 Hz packet rate,
// 25 samples ~= 2.5s of smoothing. Big enough that the tile stops jittering
// between every packet, small enough that a real chew shows up within a beat.
// Clench detection still uses the RAW per-packet score (not smoothed) so a
// quick hard bite still registers as an event without being averaged out.
const PRESSURE_SMOOTH_WINDOW = 25;
const PRESSURE_EMIT_THROTTLE_MS = 250;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drift(prev, step, min, max) {
  const delta = (Math.random() * 2 - 1) * step;
  return clamp(Math.round(prev + delta), min, max);
}

export default function useLiveDemoMetrics(packet, enabled = true) {
  const [posture, setPosture] = useState(87);
  const [nasal, setNasal] = useState(94);
  const [clenchCount, setClenchCount] = useState(0);
  const [pressureScore, setPressureScore] = useState(0);

  // Track whether we're "armed" for the next rising-edge clench detection.
  // We arm on first mount and after the signal falls below CLENCH_FALL_THRESHOLD.
  const armedRef = useRef(true);

  // Rolling buffer + throttle for the displayed pressure value.
  const bufferRef = useRef([]);
  const lastEmitRef = useRef(0);

  // Random walks for posture + nasal. Independent of packet rate so they
  // animate even when the device is idle.
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => {
      setPosture((prev) => drift(prev, 2, 70, 95));
      setNasal((prev) => drift(prev, 1, 85, 99));
    }, RANDOM_WALK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled]);

  // Live pressure + clench counter, driven by every BLE packet.
  useEffect(() => {
    if (!enabled) return;
    if (!packet || !Array.isArray(packet.palate)) return;

    // Read the four real normalized values from their canonical slots.
    // (BleStreamer writes back-L/back-R/front-L/front-R into [1,2,9,10].)
    const realSlots = [packet.palate[1], packet.palate[2], packet.palate[9], packet.palate[10]];
    const validSlots = realSlots.filter((value) => typeof value === 'number');
    if (validSlots.length === 0) return;

    const meanNormalized = validSlots.reduce((sum, value) => sum + value, 0) / validSlots.length;
    const rawScore = clamp(Math.round(PRESSURE_GAIN * meanNormalized * 100), 0, 100);

    // Edge-triggered clench counter uses the RAW per-packet score so quick
    // bites still register without being averaged out.
    if (armedRef.current && rawScore >= CLENCH_RISE_THRESHOLD) {
      armedRef.current = false;
      setClenchCount((prev) => prev + 1);
    } else if (!armedRef.current && rawScore <= CLENCH_FALL_THRESHOLD) {
      armedRef.current = true;
    }

    // Smooth the displayed pressure with a rolling window + throttle so the
    // tile reads as a stable number instead of flickering every 100ms.
    const buffer = bufferRef.current;
    buffer.push(rawScore);
    if (buffer.length > PRESSURE_SMOOTH_WINDOW) {
      buffer.splice(0, buffer.length - PRESSURE_SMOOTH_WINDOW);
    }
    const now = Date.now();
    if (now - lastEmitRef.current >= PRESSURE_EMIT_THROTTLE_MS) {
      lastEmitRef.current = now;
      const avg = buffer.reduce((sum, value) => sum + value, 0) / buffer.length;
      setPressureScore(Math.round(avg));
    }
  }, [packet, enabled]);

  return {
    pressureScore,
    clenchCount,
    posture,
    nasal,
  };
}
