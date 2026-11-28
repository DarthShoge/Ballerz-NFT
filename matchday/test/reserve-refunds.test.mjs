import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { refundClaim, reserveSourceStatement, splitReserveRefund } from '../src/reserve-refunds.js';
import { GAME_YEAR_MS } from '../src/world-clock.js';

test('whole-BB refunds conserve both sources for every partial return',()=>{
  for (const deposit of [1n,7n,20n]) {
    for (let bursary=0n;bursary<=deposit;bursary++) {
      for (let unused=0n;unused<=deposit;unused++) {
        const split=splitReserveRefund(deposit,bursary,unused);
        assert.equal(split.club+split.bursary,unused);
        assert.ok(split.club<=deposit-bursary && split.bursary<=bursary);
        assert.equal(split.club,unused*(deposit-bursary)/deposit);
      }
    }
  }
  const max=9007199254740991n;
  assert.deepEqual(splitReserveRefund(max,max-1n,max-1n),{club:0n,bursary:max-1n});
  assert.throws(()=>splitReserveRefund(3n,4n,3n));
});

test('returns follow signed sources, protect earned wages and reconcile later treasury excess',t=>{
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  db.exec(`CREATE TABLE sporting_players(player,mint,genesis,bb,sponsor);
    CREATE TABLE sporting_sales(player,reference,terms,buyer,status,effectiveAt,slot,position);
    CREATE TABLE wage_collections(sale,amount);
    CREATE TABLE wage_refunds(sale,kind,pocket,amount);
    CREATE TABLE player_wage_rates(mint,year,annualBB,startAt);
    CREATE TABLE loan_agreements(mint,startAt,endAt,confirmedAt,terms);
    INSERT INTO sporting_players VALUES('winger','W','test','BB','custody');`);
  const sale={buyer:'original',listing:{wages:100,grant:{wageBursary:{owner:'restricted',bb:60}}}};
  const insert=db.prepare('INSERT INTO sporting_sales VALUES(?,?,?,?,?,?,?,0)');
  insert.run('winger','purchase',JSON.stringify(sale),'east','finalized',1,1);
  const terms={genesis:'test',mint:'BB',sponsor:'custody',treasury:'treasury',club:'east',epoch:0};
  const closing={slot:2,asOf:101,years:[]};
  const claim=(pocket='escrow')=>refundClaim(db,terms,closing,pocket,1000n);
  assert.equal(claim(),null);
  insert.run('winger','sale','{}','north','pending',101,2);
  assert.throws(()=>claim(),/pending/);
  db.exec("UPDATE sporting_sales SET status='finalized' WHERE reference='sale'");
  assert.equal(claim(),null);
  db.prepare("INSERT INTO player_wage_rates VALUES('W',1,?,0)").run(GAME_YEAR_MS);
  assert.equal(claim(),null); // Full annual rate across all 100 milliseconds.
  db.prepare("INSERT INTO loan_agreements VALUES('W',21,101,1,?)").run(JSON.stringify({borrower:'north',parentWageBps:2500}));
  closing.slot=1;assert.equal(claim(),null);
  closing.slot=2;
  assert.equal(claim(),null); // The next buyer has yet to fund the unused portion.
  db.prepare("UPDATE sporting_sales SET terms=? WHERE reference='sale'").run(JSON.stringify({listing:{wages:60}}));
  // 20 ordinary BB and 20 loan BB are earned; 60 are unused.
  assert.deepEqual([claim().amount,claim().recipient],['36','restricted']);
  db.exec("INSERT INTO wage_collections VALUES('purchase','50')");
  assert.equal(claim('treasury').amount,'30');
  db.exec("INSERT INTO wage_refunds VALUES('purchase','bursary','treasury','30')");
  assert.equal(claim('treasury'),null);
  assert.deepEqual([claim().amount,claim().offset],['6','30']);
  db.exec("INSERT INTO wage_refunds VALUES('purchase','bursary','escrow','6')");
  assert.deepEqual([claim().amount,claim().recipient],['24','original']);
  db.exec("INSERT INTO wage_refunds VALUES('purchase','club','escrow','24')");
  assert.equal(claim(),null);
  closing.asOf=GAME_YEAR_MS;closing.years=[{year:1,arrears:'0'}];
  assert.equal(claim(),null);
  assert.deepEqual(reserveSourceStatement(db,'east',0,GAME_YEAR_MS)[0].sources,[
    {source:'club',funded:'40',remitted:'8',refunded:'24'},
    {source:'bursary',funded:'60',remitted:'12',refunded:'36'}]);
  assert.deepEqual(reserveSourceStatement(db,'north',0,GAME_YEAR_MS)[0].sources,
    [{source:'club',funded:'60',remitted:'0',refunded:'0'}]);
});
