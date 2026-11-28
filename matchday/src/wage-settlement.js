import { PublicKey, Transaction } from '@solana/web3.js';
import { GAME_YEAR_MS } from './world-clock.js';
import { clubs } from './football.js';
import { finalizedWagePayment, payrollTerms, wagePaymentInstructions } from './wage-payment.js';
import { clubReserves } from './wage-reserves.js';
import { wageCollector } from './wage-collector.js';

export function wageSettlement(db, rpc, config, statement, clock = Date.now) {
  db.exec(`CREATE TABLE IF NOT EXISTS wage_market (id INTEGER PRIMARY KEY CHECK(id=1), binding TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS wage_receipts (signature TEXT PRIMARY KEY, club TEXT NOT NULL, slot INTEGER NOT NULL,
      amount TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS wage_closings (club TEXT NOT NULL, year INTEGER NOT NULL, due TEXT NOT NULL,
      paid TEXT NOT NULL, arrears TEXT NOT NULL, carry TEXT NOT NULL, slot INTEGER NOT NULL, checkedAt INTEGER NOT NULL,
      PRIMARY KEY(club,year)) STRICT;
    CREATE TABLE IF NOT EXISTS wage_credit (club TEXT PRIMARY KEY, available TEXT NOT NULL, slot INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS wage_reserve_applied (club TEXT NOT NULL, year INTEGER NOT NULL, amount TEXT NOT NULL,
      PRIMARY KEY(club,year)) STRICT;
    CREATE TABLE IF NOT EXISTS wage_collection_pending (club TEXT PRIMARY KEY, signature TEXT UNIQUE NOT NULL,
      details TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS wage_manual_intents (message TEXT PRIMARY KEY, club TEXT NOT NULL,
      firstSlot INTEGER NOT NULL, lastHeight INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS wage_collection_costs (signature TEXT PRIMARY KEY, signer TEXT NOT NULL, lamports INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS wage_collections (signature TEXT PRIMARY KEY, club TEXT NOT NULL, sale TEXT NOT NULL,
      income TEXT NOT NULL, year INTEGER NOT NULL, amount TEXT NOT NULL, slot INTEGER NOT NULL) STRICT;`);
  function market(club) {
    const epoch = db.prepare('SELECT start_at FROM world_clock WHERE id=1').get()?.start_at;
    if (!Number.isSafeInteger(epoch)) throw Error('Set the shared wage calendar first.');
    const settings = config();
    const terms = payrollTerms(settings,club,epoch);
    const addresses=JSON.stringify([settings.wageSettlement.treasury,...clubs.map(c=>settings.wageSettlement.payroll[c.id])]);
    if (db.prepare(`WITH payroll AS (SELECT value FROM json_each(?))
      SELECT 1 FROM sporting_wallets WHERE wallet IN payroll UNION ALL
      SELECT 1 FROM sporting_sales WHERE json_extract(terms,'$.listing.grant.treasury') IN payroll
        OR json_extract(terms,'$.listing.seller') IN payroll OR json_extract(terms,'$.buyer') IN payroll LIMIT 1`).get(addresses) ||
      (db.prepare("SELECT 1 FROM pragma_database_list WHERE name='resale'").get() &&
        db.prepare('SELECT 1 FROM resale.grant_market WHERE treasury IN (SELECT value FROM json_each(?)) LIMIT 1').get(addresses)))
      throw Error('Choose dedicated payroll accounts outside historical club and grant treasury custody.');
    if (db.prepare('SELECT 1 FROM sporting_players WHERE genesis<>? OR bb<>? OR sponsor<>? LIMIT 1')
      .get(terms.genesis,terms.mint,terms.sponsor)) throw Error('Payroll conflicts with the registered sporting market.');
    const binding = JSON.stringify(clubs.map(c => payrollTerms(settings,c.id,epoch)));
    const prior = db.prepare('SELECT binding FROM wage_market WHERE id=1').get();
    if (prior && prior.binding !== binding) throw Error('The registered payroll market changed.');
    return {terms,binding};
  }
  function pinMarket(club,binding) {
    if (market(club).binding !== binding) throw Error('Payroll terms changed. Review the current market.');
    db.prepare('INSERT OR IGNORE INTO wage_market VALUES(1,?)').run(binding);
  }
  async function checkNetwork(terms) {
    if (await rpc.getGenesisHash() !== terms.genesis) throw Error('The payroll RPC belongs to another network.');
  }
  async function prepare(club,wholeBB) {
    const {terms,binding} = market(club);
    await checkNetwork(terms);
    if (!/^[1-9]\d{0,19}$/.test(wholeBB)) throw Error('Choose a positive whole-BB amount.');
    const firstSlot=await rpc.getSlot('finalized');
    const block = await rpc.getLatestBlockhash('finalized');
    const tx = new Transaction({feePayer:new PublicKey(terms.payroll),...block})
      .add(...wagePaymentInstructions(terms,BigInt(wholeBB)));
    const unsignedTransaction = tx.serialize({requireAllSignatures:false}).toString('base64');
    db.exec('BEGIN IMMEDIATE');
    try {
      pinMarket(club,binding);
      if (db.prepare('SELECT 1 FROM wage_collection_pending WHERE club=?').get(club))
        throw Error('Recover the pending automatic payment before preparing a manual prepayment.');
      db.prepare('INSERT OR IGNORE INTO wage_manual_intents VALUES(?,?,?,?)').run(
        tx.serializeMessage().toString('base64'),club,firstSlot,block.lastValidBlockHeight);
      db.exec('COMMIT');
    } catch (error) {db.exec('ROLLBACK');throw error;}
    return {terms,wholeBB,lastValidBlockHeight:block.lastValidBlockHeight,unsignedTransaction};
  }
  async function reconcile(club,signature,{verified,after}={}) {
    const {terms,binding} = market(club);
    await checkNetwork(terms);
    const receipt = signature ? await finalizedWagePayment(rpc,terms,signature) : null;
    let manualMessage;
    if (receipt && db.prepare('SELECT 1 FROM wage_manual_intents WHERE club=? LIMIT 1').get(club)) {
      const raw=await rpc.getTransaction(signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
      if (raw?.transaction.signatures[0]!==signature) throw Error('Missing finalized manual payment message.');
      manualMessage=Buffer.from(raw.transaction.message.serialize()).toString('base64');
    }
    const slot = await rpc.getSlot('finalized');
    const time = await rpc.getBlockTime(slot);
    if (!Number.isSafeInteger(slot) || !Number.isSafeInteger(time) || (receipt && receipt.slot > slot) || (verified && verified.slot>slot))
      throw Error('A finalized payroll checkpoint is required.');
    const asOf = Math.min(clock(),time*1000);
    if (asOf < terms.epoch) throw Error('The wage calendar has not started at this checkpoint.');
    const closedYears = Math.floor((asOf-terms.epoch)/GAME_YEAR_MS);
    db.exec('BEGIN IMMEDIATE');
    try {
      pinMarket(club,binding);
      const pending=db.prepare('SELECT * FROM wage_collection_pending WHERE club=?').get(club);
      if (verified && pending?.signature===verified.signature) {
        const {sale,income,year,amount}=JSON.parse(pending.details);
        db.prepare('INSERT INTO wage_collections VALUES(?,?,?,?,?,?,?)').run(verified.signature,club,sale,income,year,amount,verified.slot);
        db.prepare('DELETE FROM wage_collection_pending WHERE signature=?').run(verified.signature);
      } else if (verified && !db.prepare('SELECT 1 FROM wage_collections WHERE signature=? AND club=?').get(verified.signature,club)) {
        throw Error('Automatic payment differs from the recorded collection.');
      }
      if (pending && receipt) throw Error('Recover the pending collection before importing a manual payment.');
      const previous = db.prepare('SELECT slot FROM wage_credit WHERE club=?').get(club);
      const lastYear = db.prepare('SELECT MAX(year) AS year FROM wage_closings WHERE club=?').get(club).year;
      if (previous?.slot > slot || lastYear > closedYears) throw Error('Retry with a current finalized checkpoint.');
      if (receipt) {
        db.prepare('INSERT OR IGNORE INTO wage_receipts VALUES(?,?,?,?)').run(signature,club,receipt.slot,receipt.amount);
        const stored = db.prepare('SELECT * FROM wage_receipts WHERE signature=?').get(signature);
        if (stored.club !== club || stored.slot !== receipt.slot || stored.amount !== receipt.amount)
          throw Error('Wage payment conflicts with an existing receipt.');
        if (manualMessage) db.prepare('DELETE FROM wage_manual_intents WHERE club=? AND message=?').run(club,manualMessage);
      }
      const cutoff = terms.epoch + closedYears*GAME_YEAR_MS;
      if (closedYears && (db.prepare("SELECT 1 FROM sporting_sales WHERE status='pending' LIMIT 1").get() ||
          db.prepare(`SELECT 1 FROM fixtures WHERE json_extract(state,'$.appearanceApproval') IS NOT NULL AND
            json_extract(state,'$.schedule.kickoffAt') >= ? AND json_extract(state,'$.schedule.kickoffAt') < ? AND
            json_extract(state,'$.appearanceReceipt') IS NULL LIMIT 1`).get(terms.epoch,cutoff)))
        throw Error('Reconcile pending sporting transfers and match rewards before closing wages.');
      let available = db.prepare(`SELECT amount FROM wage_receipts WHERE club=? UNION ALL
        SELECT amount FROM wage_collections WHERE club=? AND sale=''`).all(club,club)
        .reduce((sum,row) => sum + BigInt(row.amount),0n);
      let carry = 0n;
      const years = [];
      const save = db.prepare('INSERT OR REPLACE INTO wage_closings VALUES(?,?,?,?,?,?,?,?)');
      for (let year=1; year<=closedYears; year++) {
        const report = statement(club,year,asOf);
        if (!report.total) throw Error('Publish missing wage rates before closing year '+year+'.');
        const denominator = BigInt(report.denominator);
        carry += BigInt(report.total.remainder);
        const due = BigInt(report.total.wholeBB) + carry/denominator;
        carry %= denominator;
        let reserved=0n;
        const payments=db.prepare("SELECT sale,amount FROM wage_collections WHERE club=? AND year=? AND sale<>''").all(club,year);
        if (payments.length) {
          for (const reserve of clubReserves(db,terms,year,asOf,statement)) {
            const remitted=payments.filter(p=>p.sale===reserve.reference).reduce((sum,p)=>sum+BigInt(p.amount),0n);
            reserved+=remitted<reserve.limit?remitted:reserve.limit;
          }
        }
        const uncovered=due-reserved;
        const ordinary=available<uncovered?available:uncovered;
        const paid=reserved+ordinary;
        available-=ordinary;
        const arrears = due-paid;
        save.run(club,year,String(due),String(paid),String(arrears),String(carry),slot,asOf);
        db.prepare('INSERT OR REPLACE INTO wage_reserve_applied VALUES(?,?,?)').run(club,year,String(reserved));
        years.push({year,due:String(due),paid:String(paid),arrears:String(arrears)});
      }
      db.prepare('INSERT OR REPLACE INTO wage_credit VALUES(?,?,?)').run(club,String(available),slot);
      const result={club,slot,asOf,years,unappliedBB:String(available)};
      after?.(result,terms);
      db.exec('COMMIT');
      return result;
    } catch (error) {db.exec('ROLLBACK');throw error;}
  }
  function closed(club,year) {
    const row = db.prepare('SELECT due,paid,arrears,carry,slot,checkedAt FROM wage_closings WHERE club=? AND year=?').get(club,year);
    if (!row) return null;
    market(club);
    return {...row,reservePaid:db.prepare('SELECT amount FROM wage_reserve_applied WHERE club=? AND year=?').get(club,year)?.amount??'0'};
  }
  return {prepare,reconcile:(club,signature)=>reconcile(club,signature),closed,
    collect:wageCollector(db,rpc,market,statement,reconcile,config)};
}
