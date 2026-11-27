import { DatabaseSync } from 'node:sqlite';
import { sql } from './store.js';
import { sportingRegister } from './sporting-register.js';

export function openStore(filename,clock=Date.now) {
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
  const create = db.prepare(sql.create), read = db.prepare(sql.read);
  const due = db.prepare(sql.due), liveDue = db.prepare(sql.liveDue);
  const registration = sportingRegister(db,clock);
  // A request received before lock can finish after a different process has
  // recorded a return. Its old XI must never change the recorded commitment.
  const update = db.prepare(sql.update+` AND (
    json_extract(state,'$.plans')=? OR NOT EXISTS (
      SELECT 1 FROM json_each(state,'$.registrations') r JOIN sporting_loans l
      ON l.agreement=json_extract(r.value,'$.loan') WHERE l.returned=1))`);
  return {
    registration,
    create: (id, state, now=clock()) => registration.create(()=>create.run(id, JSON.stringify(state)),state,now),
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
    update(id,version,state,now=clock()) {
      const data=JSON.stringify(state);
      const write=()=>update.run(data,id,version,JSON.stringify(state.plans) ?? null).changes===1;
      return state.schedule && state.result ? registration.finish(id,state,now,write) : write();
    },
    close: () => db.close()
  };
}
