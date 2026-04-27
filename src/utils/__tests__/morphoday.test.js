import {
  aggregateMorphoday,
  bucketPacketsByMorphoday,
  getMorphodayBounds,
} from '../morphoday';

function localDate(year, monthIndex, day, hour = 0, minute = 0, second = 0, millisecond = 0) {
  return new Date(year, monthIndex, day, hour, minute, second, millisecond);
}

function expectLocalParts(date, { year, month, day, hour, minute = 0 }) {
  expect(date.getFullYear()).toBe(year);
  expect(date.getMonth()).toBe(month);
  expect(date.getDate()).toBe(day);
  expect(date.getHours()).toBe(hour);
  expect(date.getMinutes()).toBe(minute);
  expect(date.getSeconds()).toBe(0);
  expect(date.getMilliseconds()).toBe(0);
}

describe('getMorphodayBounds', () => {
  test('returns a 24h window with default startHour=12', () => {
    const bounds = getMorphodayBounds(localDate(2025, 0, 15, 15, 45));

    expectLocalParts(bounds.start, { year: 2025, month: 0, day: 15, hour: 12 });
    expectLocalParts(bounds.end, { year: 2025, month: 0, day: 16, hour: 12 });
    expect(bounds.endMs - bounds.startMs).toBe(24 * 60 * 60 * 1000);
  });

  test('before noon starts the window at noon yesterday', () => {
    const bounds = getMorphodayBounds(localDate(2025, 0, 15, 9, 30));

    expectLocalParts(bounds.start, { year: 2025, month: 0, day: 14, hour: 12 });
    expectLocalParts(bounds.end, { year: 2025, month: 0, day: 15, hour: 12 });
    expect(bounds.endMs - bounds.startMs).toBe(24 * 60 * 60 * 1000);
  });

  test('after noon starts the window at noon today', () => {
    const bounds = getMorphodayBounds(localDate(2025, 0, 15, 18, 5));

    expectLocalParts(bounds.start, { year: 2025, month: 0, day: 15, hour: 12 });
    expectLocalParts(bounds.end, { year: 2025, month: 0, day: 16, hour: 12 });
    expect(bounds.endMs - bounds.startMs).toBe(24 * 60 * 60 * 1000);
  });

  test.each([
    { startHour: 6, inputHour: 5, expectedStartDay: 14, expectedStartHour: 6 },
    { startHour: 0, inputHour: 0, expectedStartDay: 15, expectedStartHour: 0 },
    { startHour: 18, inputHour: 20, expectedStartDay: 15, expectedStartHour: 18 },
  ])(
    'supports configurable startHour=$startHour',
    ({ startHour, inputHour, expectedStartDay, expectedStartHour }) => {
      const bounds = getMorphodayBounds(localDate(2025, 0, 15, inputHour, 30), startHour);

      expectLocalParts(bounds.start, {
        year: 2025,
        month: 0,
        day: expectedStartDay,
        hour: expectedStartHour,
      });
      expectLocalParts(bounds.end, {
        year: 2025,
        month: 0,
        day: expectedStartDay + 1,
        hour: expectedStartHour,
      });
      expect(bounds.endMs - bounds.startMs).toBe(24 * 60 * 60 * 1000);
    }
  );

  test('handles the America/Denver DST spring-forward morphoday', () => {
    const bounds = getMorphodayBounds(localDate(2025, 2, 9, 10, 0));

    expectLocalParts(bounds.start, { year: 2025, month: 2, day: 8, hour: 12 });
    expectLocalParts(bounds.end, { year: 2025, month: 2, day: 9, hour: 12 });
    expect(bounds.start.getTimezoneOffset()).toBe(420);
    expect(bounds.end.getTimezoneOffset()).toBe(360);
    expect(bounds.endMs - bounds.startMs).toBe(23 * 60 * 60 * 1000);
  });

  test('handles the America/Denver DST fall-back morphoday', () => {
    const bounds = getMorphodayBounds(localDate(2025, 10, 2, 10, 0));

    expectLocalParts(bounds.start, { year: 2025, month: 10, day: 1, hour: 12 });
    expectLocalParts(bounds.end, { year: 2025, month: 10, day: 2, hour: 12 });
    expect(bounds.start.getTimezoneOffset()).toBe(360);
    expect(bounds.end.getTimezoneOffset()).toBe(420);
    expect(bounds.endMs - bounds.startMs).toBe(25 * 60 * 60 * 1000);
  });
});

describe('bucketPacketsByMorphoday', () => {
  test('empty array returns an empty bucket object', () => {
    expect(bucketPacketsByMorphoday([])).toEqual({});
  });

  test('packets straddling noon split into two buckets', () => {
    const beforeNoon = { t: localDate(2025, 0, 15, 11, 59).getTime(), posture: 0.7 };
    const atNoon = { t: localDate(2025, 0, 15, 12, 0).getTime(), posture: 0.8 };

    const buckets = bucketPacketsByMorphoday([beforeNoon, atNoon]);
    const keys = Object.keys(buckets).sort();

    expect(keys).toHaveLength(2);
    expect(keys).toEqual([
      getMorphodayBounds(localDate(2025, 0, 15, 11, 59)).start.toISOString(),
      getMorphodayBounds(localDate(2025, 0, 15, 12, 0)).start.toISOString(),
    ]);
    expect(buckets[keys[0]]).toEqual([beforeNoon]);
    expect(buckets[keys[1]]).toEqual([atNoon]);
  });

  test('all packets in the same morphoday produce one bucket', () => {
    const packets = [
      { t: localDate(2025, 0, 15, 12, 0).getTime(), posture: 0.4 },
      { t: localDate(2025, 0, 15, 23, 30).getTime(), posture: 0.6 },
      { t: localDate(2025, 0, 16, 11, 59).getTime(), posture: 0.8 },
    ];

    const buckets = bucketPacketsByMorphoday(packets);
    const keys = Object.keys(buckets);

    expect(keys).toHaveLength(1);
    expect(buckets[keys[0]]).toEqual(packets);
  });
});

describe('aggregateMorphoday', () => {
  test('empty packets return zeroed aggregates', () => {
    expect(aggregateMorphoday([], 12, localDate(2025, 0, 15, 14))).toEqual({
      packetCount: 0,
      postureScore: 0,
      pressureAvg: 0,
      pressurePeak: 0,
      clenchEvents: 0,
      clenchPerHour: 0,
      nasalPercent: 0,
      wearTimeMs: 0,
    });
  });

  test('canned packet sample produces expected posture, pressure, clench, and nasal aggregates', () => {
    const packets = [
      {
        t: localDate(2025, 0, 15, 12, 0, 0, 0).getTime(),
        posture: 0.5,
        palate: [1, 3],
        clenchEvent: true,
        nasal: true,
      },
      {
        t: localDate(2025, 0, 15, 12, 0, 0, 100).getTime(),
        posture: 0.75,
        palate: [2, 4],
        clenchEvent: false,
        nasal: false,
      },
      {
        t: localDate(2025, 0, 15, 12, 0, 0, 200).getTime(),
        posture: 1,
        palate: [3, 5],
        clenchEvent: true,
        nasal: true,
      },
      {
        t: localDate(2025, 0, 15, 12, 0, 0, 300).getTime(),
        posture: 0.75,
        palate: [],
        clenchEvent: false,
        nasal: false,
      },
    ];

    expect(aggregateMorphoday(packets, 12, localDate(2025, 0, 15, 13))).toMatchObject({
      packetCount: 4,
      postureScore: 75,
      pressureAvg: 2.25,
      pressurePeak: 5,
      clenchEvents: 2,
      nasalPercent: 50,
    });
  });

  test('calculates wear-time and clench rate from the inferred packet interval', () => {
    const packets = [
      { t: localDate(2025, 0, 15, 12, 0, 0).getTime(), posture: 0, palate: [], clenchEvent: true },
      { t: localDate(2025, 0, 15, 12, 0, 5).getTime(), posture: 0, palate: [], clenchEvent: true },
      { t: localDate(2025, 0, 15, 12, 0, 10).getTime(), posture: 0, palate: [], clenchEvent: false },
      { t: localDate(2025, 0, 15, 12, 0, 15).getTime(), posture: 0, palate: [], clenchEvent: false },
    ];

    expect(aggregateMorphoday(packets, 12, localDate(2025, 0, 15, 13))).toMatchObject({
      packetCount: 4,
      clenchEvents: 2,
      clenchPerHour: 360,
      wearTimeMs: 20 * 1000,
    });
  });

  test('excludes packets outside the requested morphoday window', () => {
    const outsideBefore = {
      t: localDate(2025, 0, 15, 11, 59, 59, 999).getTime(),
      posture: 1,
      palate: [100],
      clenchEvent: true,
      nasal: true,
    };
    const inside = {
      t: localDate(2025, 0, 15, 12, 0).getTime(),
      posture: 0.5,
      palate: [2],
      clenchEvent: false,
      nasal: false,
    };
    const outsideAfter = {
      t: localDate(2025, 0, 16, 12, 0).getTime(),
      posture: 1,
      palate: [100],
      clenchEvent: true,
      nasal: true,
    };

    expect(
      aggregateMorphoday([outsideBefore, inside, outsideAfter], 12, localDate(2025, 0, 15, 13))
    ).toMatchObject({
      packetCount: 1,
      postureScore: 50,
      pressureAvg: 2,
      pressurePeak: 2,
      clenchEvents: 0,
      nasalPercent: 0,
      wearTimeMs: 100,
    });
  });
});
