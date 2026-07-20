/**
 * Tests for sessionStore — expo-sqlite mocked with an in-memory fake DB.
 */

// In-memory fake that records the SQL/params it receives and simulates the
// two tables we care about (sessions, frames) well enough to assert batching,
// counts, and lifecycle.
const state = {
  execCalls: [],
  sessions: [],
  frames: [],
  nextSessionId: 1,
  nextFrameId: 1,
};

function makeFakeDb() {
  return {
    execAsync: jest.fn(async (sql) => {
      state.execCalls.push(sql);
    }),
    runAsync: jest.fn(async (sql, ...params) => {
      const s = sql.trim().toUpperCase();
      if (s.startsWith('INSERT INTO SESSIONS')) {
        const id = state.nextSessionId++;
        state.sessions.push({
          id,
          source: params[0],
          started_at: params[1],
          ended_at: null,
          frame_count: 0,
        });
        return { lastInsertRowId: id, changes: 1 };
      }
      if (s.startsWith('INSERT INTO FRAMES')) {
        state.frames.push({
          id: state.nextFrameId++,
          session_id: params[0],
          t: params[1],
          payload: params[2],
        });
        return { lastInsertRowId: state.nextFrameId - 1, changes: 1 };
      }
      if (s.startsWith('UPDATE SESSIONS SET FRAME_COUNT')) {
        const delta = params[0];
        const id = params[1];
        const sess = state.sessions.find((x) => x.id === id);
        if (sess) sess.frame_count += delta;
        return { changes: 1 };
      }
      if (s.startsWith('UPDATE SESSIONS SET ENDED_AT')) {
        const endedAt = params[0];
        const id = params[1];
        const sess = state.sessions.find((x) => x.id === id);
        if (sess) sess.ended_at = endedAt;
        return { changes: 1 };
      }
      return { changes: 0 };
    }),
    getAllAsync: jest.fn(async () => {
      return [...state.sessions].sort((a, b) => b.started_at - a.started_at);
    }),
    withTransactionAsync: jest.fn(async (fn) => {
      await fn();
    }),
  };
}

let mockDb;
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}));

import sessionStore, {
  startSession,
  recordFrame,
  endSession,
  getRecentSessions,
  __resetForTests,
} from '../sessionStore';

beforeEach(() => {
  state.execCalls = [];
  state.sessions = [];
  state.frames = [];
  state.nextSessionId = 1;
  state.nextFrameId = 1;
  mockDb = makeFakeDb();
  __resetForTests();
});

describe('sessionStore lifecycle', () => {
  test('startSession creates a row and returns its id', async () => {
    const id = await startSession({ source: 'ble-native' });
    expect(id).toBe(1);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].source).toBe('ble-native');
    expect(state.sessions[0].ended_at).toBeNull();
  });

  test('creates the schema on first open', async () => {
    await startSession({ source: 'ble' });
    const joined = state.execCalls.join('\n');
    expect(joined).toMatch(/CREATE TABLE IF NOT EXISTS sessions/);
    expect(joined).toMatch(/CREATE TABLE IF NOT EXISTS frames/);
  });

  test('recordFrame buffers and does NOT write before the flush threshold', async () => {
    const id = await startSession({ source: 'ble' });
    for (let i = 0; i < 10; i++) {
      await recordFrame(id, { t: 1000 + i, palateRaw: [i, i, i, i] });
    }
    // Under 100 frames and under 5s: nothing flushed yet.
    expect(state.frames).toHaveLength(0);
    expect(state.sessions[0].frame_count).toBe(0);
  });

  test('flushes automatically at 100 buffered frames', async () => {
    const id = await startSession({ source: 'ble' });
    for (let i = 0; i < 100; i++) {
      await recordFrame(id, { t: i, palateRaw: [1, 2, 3, 4] });
    }
    expect(state.frames).toHaveLength(100);
    expect(state.sessions[0].frame_count).toBe(100);
    // Payload is JSON-encoded.
    expect(JSON.parse(state.frames[0].payload).palateRaw).toEqual([1, 2, 3, 4]);
  });

  test('endSession flushes the remainder and stamps ended_at', async () => {
    const id = await startSession({ source: 'ble' });
    for (let i = 0; i < 7; i++) {
      await recordFrame(id, { t: i, palateRaw: [0, 0, 0, 0] });
    }
    expect(state.frames).toHaveLength(0); // still buffered
    await endSession(id);
    expect(state.frames).toHaveLength(7); // flushed on end
    expect(state.sessions[0].frame_count).toBe(7);
    expect(typeof state.sessions[0].ended_at).toBe('number');
  });

  test('uses frame.t when present, else falls back to now', async () => {
    const id = await startSession({ source: 'ble' });
    await recordFrame(id, { t: 424242, palateRaw: [1, 1, 1, 1] });
    await recordFrame(id, { palateRaw: [2, 2, 2, 2] }); // no t
    await endSession(id);
    expect(state.frames[0].t).toBe(424242);
    expect(typeof state.frames[1].t).toBe('number');
  });

  test('getRecentSessions returns sessions newest-first', async () => {
    const a = await startSession({ source: 'a' });
    state.sessions.find((x) => x.id === a).started_at = 1000;
    const b = await startSession({ source: 'b' });
    state.sessions.find((x) => x.id === b).started_at = 2000;
    const rows = await getRecentSessions(10);
    expect(rows.map((r) => r.source)).toEqual(['b', 'a']);
  });

  test('default export exposes the same functions', () => {
    expect(typeof sessionStore.startSession).toBe('function');
    expect(typeof sessionStore.recordFrame).toBe('function');
    expect(typeof sessionStore.endSession).toBe('function');
    expect(typeof sessionStore.getRecentSessions).toBe('function');
  });
});
