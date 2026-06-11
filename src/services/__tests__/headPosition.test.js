import {
  classifyPosition,
  computePitchRoll,
  DEFAULT_CALIBRATION,
} from '../headPosition';

describe('classifyPosition — canonical orientation vectors', () => {
  test('supine: gravity straight down on +Z -> supine', () => {
    expect(classifyPosition({ x: 0, y: 0, z: 1 })).toBe('supine');
  });

  test('prone: gravity on -Z (face down) -> prone', () => {
    expect(classifyPosition({ x: 0, y: 0, z: -1 })).toBe('prone');
  });

  test('left side: gravity on +Y -> left', () => {
    expect(classifyPosition({ x: 0, y: 1, z: 0 })).toBe('left');
  });

  test('right side: gravity on -Y -> right', () => {
    expect(classifyPosition({ x: 0, y: -1, z: 0 })).toBe('right');
  });

  test('upright: gravity on +X (head pitched) -> upright', () => {
    expect(classifyPosition({ x: 1, y: 0, z: 0 })).toBe('upright');
  });

  test('upright also triggers for negative pitch (gravity on -X)', () => {
    expect(classifyPosition({ x: -1, y: 0, z: 0 })).toBe('upright');
  });
});

describe('computePitchRoll math', () => {
  test('supine vector yields ~0 pitch and ~0 roll', () => {
    const { pitch, roll } = computePitchRoll({ x: 0, y: 0, z: 1 });
    expect(pitch).toBeCloseTo(0, 5);
    expect(roll).toBeCloseTo(0, 5);
  });

  test('left-side vector yields ~90 roll', () => {
    const { roll } = computePitchRoll({ x: 0, y: 1, z: 0 });
    expect(roll).toBeCloseTo(90, 5);
  });

  test('upright vector yields ~-90 pitch', () => {
    const { pitch } = computePitchRoll({ x: 1, y: 0, z: 0 });
    expect(pitch).toBeCloseTo(-90, 5);
  });

  test('default calibration is a no-op offset', () => {
    expect(DEFAULT_CALIBRATION).toEqual({ pitch: 0, roll: 0 });
    const a = computePitchRoll({ x: 0, y: 0.5, z: 0.87 });
    const b = computePitchRoll({ x: 0, y: 0.5, z: 0.87 }, DEFAULT_CALIBRATION);
    expect(a).toEqual(b);
  });
});

describe('calibration offset subtraction', () => {
  test('subtracting a roll offset re-centers a tilted reading to supine', () => {
    // A reading tilted ~45deg in roll (y and z equal) reads as roll ~45 ->
    // 'left' uncalibrated...
    const tilted = { x: 0, y: Math.SQRT1_2, z: Math.SQRT1_2 };
    expect(classifyPosition(tilted)).toBe('left');

    // ...but with the user's neutral-supine offset captured at roll=45, the
    // same reading should re-center to roll ~0 -> 'supine'.
    const calibration = { pitch: 0, roll: 45 };
    expect(classifyPosition(tilted, calibration)).toBe('supine');
  });

  test('pitch offset is subtracted before the upright bucket check', () => {
    // x = sin(70deg) puts pitch near -70 -> upright uncalibrated.
    const pitched = { x: Math.sin((70 * Math.PI) / 180), y: 0, z: Math.cos((70 * Math.PI) / 180) };
    expect(classifyPosition(pitched)).toBe('upright');

    // With a -70 pitch offset, the corrected pitch is ~0 -> falls through to
    // roll buckets; roll here is ~0 -> supine.
    const calibration = { pitch: -70, roll: 0 };
    expect(classifyPosition(pitched, calibration)).toBe('supine');
  });
});

describe('classifyPosition — edge / transitional zones', () => {
  test('a roll right at the 30deg supine boundary stays supine', () => {
    // roll exactly 30 -> absRoll <= 30 -> supine.
    const r = (30 * Math.PI) / 180;
    const v = { x: 0, y: Math.sin(r), z: Math.cos(r) };
    expect(classifyPosition(v)).toBe('supine');
  });

  test('a roll just past 30deg becomes a side position', () => {
    const r = (45 * Math.PI) / 180;
    const v = { x: 0, y: Math.sin(r), z: Math.cos(r) };
    expect(classifyPosition(v)).toBe('left');
  });

  test('a roll near 160deg is prone', () => {
    const r = (160 * Math.PI) / 180;
    const v = { x: 0, y: Math.sin(r), z: Math.cos(r) };
    expect(classifyPosition(v)).toBe('prone');
  });

  test('malformed / missing vector -> transitional', () => {
    expect(classifyPosition(null)).toBe('transitional');
    expect(classifyPosition({})).toBe('transitional');
    expect(classifyPosition({ x: 1, y: 2 })).toBe('transitional');
  });
});
