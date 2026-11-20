import { DatabaseSync } from 'node:sqlite';
import { sql } from './store.js';

export function openStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS fixtures (id TEXT PRIMARY KEY NOT NULL, version INTEGER NOT NULL, state TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS pending_kickoffs ON fixtures (json_extract(state, '$.schedule.kickoffAt'), id)
      WHERE json_extract(state, '$.result') IS NULL;
    CREATE INDEX IF NOT EXISTS live_tick ON fixtures (json_extract(state, '$.live.nextAt'), id);
    CREATE TABLE IF NOT EXISTS world_clock (id INTEGER PRIMARY KEY CHECK (id = 1), start_at INTEGER NOT NULL);
  `);
  const create = db.prepare(sql.create), read = db.prepare(sql.read), update = db.prepare(sql.update);
  const due = db.prepare(sql.due), liveDue = db.prepare(sql.liveDue);
  return {
    create: (id, state) => create.run(id, JSON.stringify(state)),
    read: id => read.get(id),
    due: time => due.all(time),
    liveDue: time => liveDue.all(time),
    worldStart(configuredStart = null) {
      if (configuredStart !== null) {
        db.prepare('INSERT INTO world_clock (id, start_at) VALUES (1, ?) ON CONFLICT DO NOTHING').run(configuredStart);
      }
      const existing = db.prepare('SELECT start_at FROM world_clock WHERE id = 1').get()?.start_at ?? null;
      if (configuredStart !== null && configuredStart !== existing) {
        throw new Error('WORLD_START_UTC differs from the start already saved in this database.');
      }
      return existing;
    },
    update: (id, version, state) => update.run(JSON.stringify(state), id, version).changes === 1,
    close: () => db.close()
  };
}
