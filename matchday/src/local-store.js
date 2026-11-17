import { DatabaseSync } from 'node:sqlite';
import { sql } from './store.js';

export function openStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS fixtures (id TEXT PRIMARY KEY NOT NULL, version INTEGER NOT NULL, state TEXT NOT NULL)');
  const create = db.prepare(sql.create), read = db.prepare(sql.read), update = db.prepare(sql.update);
  return {
    create: (id, state) => create.run(id, JSON.stringify(state)),
    read: id => read.get(id),
    update: (id, version, state) => update.run(JSON.stringify(state), id, version).changes === 1,
    close: () => db.close()
  };
}
