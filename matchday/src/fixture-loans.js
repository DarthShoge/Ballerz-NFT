import { clubs } from './football.js';

// A projection of confirmed agreements contains just the facts needed to field a player.
// The agreement link and its signatures stay out of fixture responses.
export function fixtureLoans(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS sporting_loans (
    agreement TEXT PRIMARY KEY, player TEXT NOT NULL, borrower TEXT NOT NULL,
    startAt INTEGER NOT NULL, endAt INTEGER NOT NULL, returned INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS sporting_returns ON sporting_loans(endAt) WHERE returned=0;
    CREATE TABLE IF NOT EXISTS sporting_loan_holds (
      agreement TEXT NOT NULL, fixture TEXT NOT NULL, PRIMARY KEY(agreement,fixture));
    CREATE INDEX IF NOT EXISTS held_loan_fixture ON sporting_loan_holds(fixture);
    CREATE TABLE IF NOT EXISTS sporting_loan_minutes (
      agreement TEXT NOT NULL, fixture TEXT NOT NULL, minutes INTEGER NOT NULL CHECK(minutes>=0),
      PRIMARY KEY(agreement,fixture));`);
  const due = db.prepare('SELECT * FROM sporting_loans WHERE returned=0 AND endAt<=? ORDER BY endAt,agreement');
  const active = db.prepare('SELECT * FROM sporting_loans WHERE startAt<? AND endAt>=? ORDER BY player');
  const held = db.prepare(`SELECT DISTINCT l.player,l.borrower,l.endAt FROM sporting_loan_holds h
    JOIN sporting_loans l USING(agreement) WHERE l.endAt<? ORDER BY l.endAt`);
  function apply(assignments,deadline) {
    // The sheet closes at the deadline. Changes effective at that instant belong to the next sheet.
    for (const loan of active.all(deadline,deadline)) {
      const registration=assignments[loan.player];
      if (registration) Object.assign(registration,{club:loan.borrower,loan:loan.agreement});
    }
    for (const hold of held.all(deadline)) {
      const registration=assignments[hold.player];
      if (registration && registration.club!==hold.borrower) Object.assign(registration,{returnPending:true});
    }
  }
  function processReturns(now,refreshOpen,assignmentsAt) {
    for (const loan of due.all(now)) {
      const side=clubs.findIndex(club=>club.id===loan.borrower);
      const next=assignmentsAt(loan.endAt+1)[loan.player];
      const continuing=next?.club===loan.borrower && !next.returnPending;
      const locked=db.prepare(`SELECT f.id,f.state FROM fixtures f, json_each(f.state,'$.registrations') r
        WHERE r.key=? AND json_extract(r.value,'$.loan')=? AND json_extract(f.state,'$.result') IS NULL
        AND json_extract(f.state,'$.schedule.deadlineAt')<=?`).all(loan.player,loan.agreement,loan.endAt);
      let held=false;
      for (const row of locked) {
        const state=JSON.parse(row.state);
        const team=state.live?.checkpoint.teams[side];
        if (state.plans[side]?.xi.includes(loan.player) || team?.players.some(p=>p.id===loan.player)) {
          if (state.appearanceApproval && !state.computerAway) {
            db.prepare('INSERT OR IGNORE INTO sporting_loan_holds VALUES(?,?)').run(loan.agreement,row.id);
            held=true;
          }
        } else if (!continuing) {
          (state.withdrawnLoanReserves ??= []).push(loan.player);
          if (team) {
            team.bench=team.bench.filter(p=>p.id!==loan.player);
            if (team.pendingSubstitution?.incomingId===loan.player) team.pendingSubstitution=null;
          }
          db.prepare('UPDATE fixtures SET state=?,version=version+1 WHERE id=?').run(JSON.stringify(state),row.id);
        }
      }
      db.prepare('UPDATE sporting_loans SET returned=1 WHERE agreement=?').run(loan.agreement);
      if (held) refreshOpen(loan.endAt);
    }
  }
  function recordMinutes(fixture,state) {
    if (!state.appearanceApproval || state.computerAway || !state.result?.engineVersion) return;
    for (const [player,registration] of Object.entries(state.registrations ?? {})) {
      if (!registration.loan || registration.returnPending) continue;
      const side=clubs.findIndex(club=>club.id===registration.club);
      const performance=state.result.performances?.[side]?.find(p=>p.playerId===player);
      if (performance && Number.isSafeInteger(performance.minutes) && performance.minutes>0)
        db.prepare('INSERT OR IGNORE INTO sporting_loan_minutes VALUES(?,?,?)')
          .run(registration.loan,fixture,performance.minutes);
    }
  }
  function importConfirmed(now,refreshOpen,assignmentsAt) {
    if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='loan_agreements'").get()) return;
    const added=db.prepare(`INSERT OR IGNORE INTO sporting_loans(agreement,player,borrower,startAt,endAt)
      SELECT id,json_extract(terms,'$.player'),json_extract(terms,'$.borrower'),startAt,endAt
      FROM loan_agreements WHERE confirmedAt IS NOT NULL`).run();
    if (added.changes) refreshOpen(now);
    processReturns(now,refreshOpen,assignmentsAt);
  }
  return {apply,processReturns,importConfirmed,recordMinutes,
    hasDue:now=>!!due.get(now),
    release(fixture) { return db.prepare('DELETE FROM sporting_loan_holds WHERE fixture=?').run(fixture).changes>0; },
    hasPeriods:()=>!!db.prepare('SELECT 1 FROM sporting_loans LIMIT 1').get(),
    players:()=>db.prepare('SELECT DISTINCT player FROM sporting_loans').all()
  };
}
