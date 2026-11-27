import { fixtureClubs, validatePlan } from './football.js';
import { computerPlan } from './computer-manager.js';

// Only the local settlement worker writes this register. Matchday managers
// read public references and choose their XI through the existing fixture API.
export function sportingRegister(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS sporting_players (
      player TEXT PRIMARY KEY, mint TEXT UNIQUE NOT NULL, genesis TEXT NOT NULL, bb TEXT NOT NULL, sponsor TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sporting_sales (
      reference TEXT PRIMARY KEY, player TEXT NOT NULL, seller TEXT NOT NULL, buyer TEXT NOT NULL,
      terms TEXT NOT NULL,status TEXT NOT NULL, slot INTEGER, position INTEGER, effectiveAt INTEGER, observedAt INTEGER);
    CREATE INDEX IF NOT EXISTS sporting_order ON sporting_sales(player,slot,position);`);
  function atomic(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result=fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function checkPilot(genesis,bb,sponsor) {
    if (db.prepare('SELECT 1 FROM sporting_players WHERE genesis<>? OR bb<>? OR sponsor<>? LIMIT 1').get(genesis,bb,sponsor))
      throw new Error('Fixture database belongs to a different registration network, currency or sponsor.');
  }
  const conflictingWallet=db.prepare(`SELECT 1 FROM sporting_sales
    WHERE (json_extract(terms,'$.listing.seller')=? AND seller<>?)
       OR (json_extract(terms,'$.buyer')=? AND buyer<>?) LIMIT 1`);
  function project(state) {
    if (!state.schedule) return false;
    const rows=db.prepare(`SELECT player,buyer,reference FROM (
      SELECT *,row_number() OVER (PARTITION BY player ORDER BY slot DESC,position DESC) AS ord
      FROM sporting_sales WHERE status='finalized' AND effectiveAt < ? AND observedAt < ?)
      WHERE ord=1 ORDER BY player`).all(state.schedule.deadlineAt,state.schedule.deadlineAt);
    if (!rows.length) return false;
    const assignments=Object.fromEntries(rows.map(r=>[r.player,{club:r.buyer,reference:r.reference}]));
    if (JSON.stringify(assignments)===JSON.stringify(state.registrations)) return false;
    state.registrations=assignments;
    const rosters=fixtureClubs(assignments);
    for (const [side,plan] of state.plans.entries()) {
      if ((plan && validatePlan(rosters[side],plan,rosters[1-side])) || (!plan && side===1 && state.computerAway)) {
        state.plans[side]=side===1 && state.computerAway ? computerPlan(rosters[side]) : null;
      }
    }
    return true;
  }
  return {
    create(fn,state) { return atomic(()=>{project(state); return fn();}); },
    observe({player,mint,genesis,bb,sponsor,reference,seller,buyer,terms}) {
      return atomic(()=>{
        checkPilot(genesis,bb,sponsor);
        for (const [wallet,club] of [[terms.listing?.seller,seller],[terms.buyer,buyer]]) {
          if (wallet && conflictingWallet.get(String(wallet),club,String(wallet),club))
            throw new Error('An existing wallet cannot change its club mapping.');
        }
        db.prepare('INSERT OR IGNORE INTO sporting_players VALUES(?,?,?,?,?)').run(player,mint,genesis,bb,sponsor);
        if (!db.prepare('SELECT 1 FROM sporting_players WHERE player=? AND mint=? AND genesis=? AND bb=? AND sponsor=?')
          .get(player,mint,genesis,bb,sponsor)) throw new Error('Conflicting pilot player or network binding.');
        db.prepare("INSERT OR IGNORE INTO sporting_sales(reference,player,seller,buyer,terms,status) VALUES(?,?,?,?,?,'pending')")
          .run(reference,player,seller,buyer,JSON.stringify(terms));
        const row=db.prepare('SELECT status FROM sporting_sales WHERE reference=? AND player=? AND seller=? AND buyer=?')
          .get(reference,player,seller,buyer);
        if (!row) throw new Error('Club mapping changed for an existing transfer reference.');
        return row.status;
      });
    },
    unresolved({genesis,bbMint,sponsor}) {
      checkPilot(genesis,bbMint,sponsor);
      return db.prepare(`SELECT reference,terms,status FROM sporting_sales JOIN sporting_players USING(player)
        WHERE genesis=? AND status IN ('pending','expired') ORDER BY sporting_sales.rowid`).all(genesis);
    },
    mark(reference,status) {
      if (!['failed','expired'].includes(status)) throw new Error('Invalid transfer status.');
      db.prepare("UPDATE sporting_sales SET status=? WHERE reference=? AND status IN ('pending','expired')").run(status,reference);
    },
    finalize(reference,{slot,position,effectiveAt},clock=Date.now) {
      return atomic(()=>{
        const observedAt=clock();
        const changed=db.prepare(`UPDATE sporting_sales SET status='finalized',slot=?,position=?,effectiveAt=?,observedAt=?
          WHERE reference=? AND status IN ('pending','expired')`).run(slot,position,effectiveAt,observedAt,reference);
        if (!changed.changes) return;
        // The registration and all still-editable squads change in the same
        // write transaction. An in-flight sheet then retries its version check.
        const open=db.prepare(`SELECT id,state FROM fixtures WHERE json_extract(state,'$.schedule.deadlineAt')>?
          AND json_extract(state,'$.result') IS NULL AND json_extract(state,'$.live') IS NULL`).all(observedAt);
        for (const row of open) {
          const state=JSON.parse(row.state);
          if (project(state)) db.prepare('UPDATE fixtures SET state=?,version=version+1 WHERE id=?').run(JSON.stringify(state),row.id);
        }
      });
    },
    status() {
      return db.prepare(`SELECT s.reference,s.player,s.seller,s.buyer,s.status,s.effectiveAt,
        (SELECT f.id FROM fixtures f, json_each(f.state,'$.registrations') r
          WHERE r.key=s.player AND json_extract(r.value,'$.reference')=s.reference
          ORDER BY json_extract(f.state,'$.schedule.deadlineAt'),f.id LIMIT 1) AS firstFixture
        FROM sporting_sales s ORDER BY s.rowid DESC`).all();
    }
  };
}
