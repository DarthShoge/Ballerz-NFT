// Transfer journals written before loan approvals already contain permanent bindings.
export function clubWallets(db) {
  db.exec('CREATE TABLE IF NOT EXISTS sporting_wallets (wallet TEXT PRIMARY KEY, club TEXT NOT NULL)');
  const conflict = db.prepare(`SELECT 1 FROM sporting_wallets WHERE wallet=? AND club<>?
    UNION ALL SELECT 1 FROM sporting_sales WHERE
      (json_extract(terms,'$.listing.seller')=? AND seller<>?) OR
      (json_extract(terms,'$.buyer')=? AND buyer<>?) LIMIT 1`);
  function matches(wallet,club) {
    return !conflict.get(wallet,club,wallet,club,wallet,club);
  }
  return {matches, bind(wallet,club) {
    if (!matches(wallet,club)) throw new Error('An existing wallet cannot change its club mapping.');
    db.prepare('INSERT OR IGNORE INTO sporting_wallets(wallet,club) VALUES(?,?)').run(wallet,club);
  }};
}
