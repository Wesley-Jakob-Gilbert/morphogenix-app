const fs = require('fs');
const path = require('path');

const PACKETS = 10 * 60 * 10;
const ZONES = 16;
const START_T = 1767225600000;
const CLENCH_INDICES = new Set([1500, 3300, 5100]);
let seed = 424242;

function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const packets = Array.from({ length: PACKETS }, (_, i) => {
  const phase = i / PACKETS;
  const posture = round(0.87 + Math.sin(phase * Math.PI * 8) * 0.035 + (rand() - 0.5) * 0.018, 3);
  const clenchEvent = CLENCH_INDICES.has(i);
  const nasal = rand() < 0.94;

  const palate = Array.from({ length: ZONES }, (_, zone) => {
    const lateral = zone % 2 === 0 ? -0.015 : 0.015;
    const anteriorBoost = zone < 4 ? 0.035 : 0;
    const wave = Math.sin(phase * Math.PI * 12 + zone * 0.55) * 0.055;
    const noise = (rand() - 0.5) * 0.08;
    const clenchBoost = clenchEvent ? 0.28 + (zone % 4) * 0.025 : 0;
    return round(Math.max(0.08, Math.min(1, 0.55 + anteriorBoost + lateral + wave + noise + clenchBoost)), 3);
  });

  return {
    t: START_T + i * 100,
    posture: Math.max(0, Math.min(1, posture)),
    palate,
    clenchEvent,
    nasal,
  };
});

const output = path.join(__dirname, '..', 'assets', 'demo-stream.json');
fs.writeFileSync(output, `${JSON.stringify(packets)}\n`);
console.log(`Wrote ${packets.length} packets to ${output}`);
