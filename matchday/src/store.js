// SQLite and D1 share the fixture queries and the same optimistic locking rule.
export const sql = {
  create: 'INSERT INTO fixtures (id, version, state) VALUES (?, 0, ?)',
  read: 'SELECT version, state FROM fixtures WHERE id = ?',
  update: 'UPDATE fixtures SET version = version + 1, state = ? WHERE id = ? AND version = ?',
  due: `SELECT id, version, state FROM fixtures
    WHERE json_extract(state, '$.result') IS NULL AND json_extract(state, '$.schedule.kickoffAt') <= ?
      AND json_extract(state, '$.live.nextAt') IS NULL
    ORDER BY json_extract(state, '$.schedule.kickoffAt'), id LIMIT 50`,
  liveDue: `SELECT id, version, state FROM fixtures
    WHERE json_extract(state, '$.live.nextAt') <= ?
    ORDER BY json_extract(state, '$.live.nextAt'), id LIMIT 50`
};

export function d1Store(db) {
  return {
    create: (id, state) => db.prepare(sql.create).bind(id, JSON.stringify(state)).run(),
    read: id => db.prepare(sql.read).bind(id).first(),
    async due(time) {
      return (await db.prepare(sql.due).bind(time).all()).results;
    },
    async liveDue(time) {
      return (await db.prepare(sql.liveDue).bind(time).all()).results;
    },
    async update(id, version, state) {
      const result = await db.prepare(sql.update).bind(JSON.stringify(state), id, version).run();
      return result.meta.changes === 1;
    }
  };
}
