// SQLite and D1 share these three statements and the same optimistic locking rule.
export const sql = {
  create: 'INSERT INTO fixtures (id, version, state) VALUES (?, 0, ?)',
  read: 'SELECT version, state FROM fixtures WHERE id = ?',
  update: 'UPDATE fixtures SET version = version + 1, state = ? WHERE id = ? AND version = ?'
};

export function d1Store(db) {
  return {
    create: (id, state) => db.prepare(sql.create).bind(id, JSON.stringify(state)).run(),
    read: id => db.prepare(sql.read).bind(id).first(),
    async update(id, version, state) {
      const result = await db.prepare(sql.update).bind(JSON.stringify(state), id, version).run();
      return result.meta.changes === 1;
    }
  };
}
