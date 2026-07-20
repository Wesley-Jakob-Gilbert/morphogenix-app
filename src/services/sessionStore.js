/**
 * sessionStore.js — lightweight session + frame persistence on expo-sqlite.
 *
 * Records live BLE streaming sessions so a future History screen can replay
 * them. This round only writes data; the History UI hookup is NOT part of this
 * migration (see brief §7).
 *
 * Public API:
 *   startSession({ source }) -> Promise<sessionId>
 *   recordFrame(sessionId, frame)  — buffered; flushed every 100 frames OR 5s
 *   endSession(sessionId)    -> Promise<void>   flushes + stamps ended_at
 *   getRecentSessions(limit=10) -> Promise<Session[]>
 *
 * Schema:
 *   sessions(id INTEGER PK, source TEXT, started_at INTEGER,
 *            ended_at INTEGER, frame_count INTEGER)
 *   frames(id INTEGER PK, session_id INTEGER, t INTEGER, payload TEXT)
 *
 * Design notes:
 *   - Everything is fire-and-forget from the streamer's perspective; a failed
 *     write must never break the live stream, so callers wrap in Promise
 *     resolution and swallow errors. This module still surfaces rejections so
 *     tests can assert behaviour.
 *   - The DB handle is opened lazily and memoized. Under Jest, expo-sqlite is
 *     mocked (see src/services/__mocks__ or the test's jest.mock), so this file
 *     never touches a real native DB in unit tests.
 *   - Batching: frames arrive at 10 Hz. Writing each one individually is
 *     wasteful, so we buffer per-session and flush on a size (100) or time
 *     (5000ms) threshold, whichever comes first.
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'morphogenix.db';
const FLUSH_EVERY_FRAMES = 100;
const FLUSH_EVERY_MS = 5000;

let dbPromise = null;
// Per-session in-memory frame buffers awaiting flush.
const buffers = new Map(); // sessionId -> { rows: [], timer, count }

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY NOT NULL,
          source TEXT,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          frame_count INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS frames (
          id INTEGER PRIMARY KEY NOT NULL,
          session_id INTEGER NOT NULL,
          t INTEGER NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_frames_session ON frames(session_id);
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function startSession({ source = 'ble' } = {}) {
  const db = await getDb();
  const startedAt = Date.now();
  const result = await db.runAsync(
    'INSERT INTO sessions (source, started_at, frame_count) VALUES (?, ?, 0)',
    source,
    startedAt
  );
  const sessionId = result.lastInsertRowId;
  buffers.set(sessionId, { rows: [], timer: null, count: 0 });
  return sessionId;
}

/**
 * Buffer a frame for a session. Returns a promise that resolves once the frame
 * is at least buffered (and, if a threshold trips, after the flush completes).
 */
export function recordFrame(sessionId, frame) {
  let buf = buffers.get(sessionId);
  if (!buf) {
    // Session not started (or already ended); create a transient buffer so we
    // don't drop frames that race the startSession promise.
    buf = { rows: [], timer: null, count: 0 };
    buffers.set(sessionId, buf);
  }

  const t = frame && typeof frame.t === 'number' ? frame.t : Date.now();
  buf.rows.push({ t, payload: safeStringify(frame) });
  buf.count += 1;

  if (buf.rows.length >= FLUSH_EVERY_FRAMES) {
    return flush(sessionId);
  }
  if (!buf.timer) {
    buf.timer = setTimeout(() => {
      flush(sessionId).catch(() => {});
    }, FLUSH_EVERY_MS);
  }
  return Promise.resolve();
}

async function flush(sessionId) {
  const buf = buffers.get(sessionId);
  if (!buf || buf.rows.length === 0) return;

  const rows = buf.rows;
  buf.rows = [];
  if (buf.timer) {
    clearTimeout(buf.timer);
    buf.timer = null;
  }

  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      await db.runAsync(
        'INSERT INTO frames (session_id, t, payload) VALUES (?, ?, ?)',
        sessionId,
        row.t,
        row.payload
      );
    }
    await db.runAsync(
      'UPDATE sessions SET frame_count = frame_count + ? WHERE id = ?',
      rows.length,
      sessionId
    );
  });
}

export async function endSession(sessionId) {
  await flush(sessionId);
  const buf = buffers.get(sessionId);
  if (buf && buf.timer) {
    clearTimeout(buf.timer);
    buf.timer = null;
  }
  buffers.delete(sessionId);

  const db = await getDb();
  await db.runAsync('UPDATE sessions SET ended_at = ? WHERE id = ?', Date.now(), sessionId);
}

export async function getRecentSessions(limit = 10) {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT id, source, started_at, ended_at, frame_count FROM sessions ORDER BY started_at DESC LIMIT ?',
    limit
  );
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (_) {
    return '{}';
  }
}

// Test-only reset hook to clear the memoized handle + buffers between suites.
export function __resetForTests() {
  dbPromise = null;
  for (const buf of buffers.values()) {
    if (buf.timer) clearTimeout(buf.timer);
  }
  buffers.clear();
}

export default {
  startSession,
  recordFrame,
  endSession,
  getRecentSessions,
  __resetForTests,
};
