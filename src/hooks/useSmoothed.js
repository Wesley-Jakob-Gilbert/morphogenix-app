import { useEffect, useRef, useState } from 'react';

/**
 * Maintains a rolling window of recent values and returns the average.
 * Defaults to 30 samples (10Hz x 3s = 3-second rolling average).
 * Updates the displayed value at most every `throttleMs` so the tile feels stable.
 */
export default function useSmoothed(value, { windowSize = 30, throttleMs = 300 } = {}) {
  const bufferRef = useRef([]);
  const lastEmitRef = useRef(0);
  const [smoothed, setSmoothed] = useState(typeof value === 'number' ? value : 0);

  useEffect(() => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return;
    }
    const buffer = bufferRef.current;
    buffer.push(value);
    if (buffer.length > windowSize) {
      buffer.splice(0, buffer.length - windowSize);
    }

    const now = Date.now();
    if (now - lastEmitRef.current < throttleMs) {
      return;
    }
    lastEmitRef.current = now;

    const sum = buffer.reduce((acc, v) => acc + v, 0);
    setSmoothed(sum / buffer.length);
  }, [value, windowSize, throttleMs]);

  return smoothed;
}
