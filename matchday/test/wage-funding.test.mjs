import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { clubProceeds, clubReserves, remainingReserveCustody } from '../src/wage-reserves.js';
import { GAME_YEAR_MS } from '../src/world-clock.js';

test('funding follows each finalized purchase, custody period and net sale after grant recovery',t=>{
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  db.exec(`CREATE TABLE sporting_players(player,mint,genesis,bb,sponsor);
    CREATE TABLE sporting_sales(player,reference,terms,seller,buyer,status,effectiveAt,slot,position);
    CREATE TABLE wage_collections(sale,amount);
    CREATE TABLE wage_refunds(sale,kind,pocket,amount);
    INSERT INTO sporting_players VALUES('winger','W','pilot','BB','custody');`);
  const terms={genesis:'pilot',mint:'BB',sponsor:'custody',club:'eastport',epoch:1000};
  const insert=(id,time,status,seller,buyer,wages,claim)=>db.prepare('INSERT INTO sporting_sales VALUES(?,?,?,?,?,?,?,?,?)')
    .run('winger',id,JSON.stringify({listing:{seller,price:100,wages,grant:{claim,relationship:'independent'}}}),
      seller,buyer,status,time,time,0);
  insert('bought',2000,'finalized','northbank','eastport',50,0);
  insert('pending',3000,'pending','eastport','northbank',900,0);
  insert('sold',4000,'finalized','eastport','northbank',25,80);
  insert('next-year',terms.epoch+GAME_YEAR_MS,'finalized','northbank','eastport',100,0);
  const statement=(club,year,asOf,period)=>{
    assert.equal(club,'eastport');assert.equal(year,1);
    assert.deepEqual(period,{mint:'W',startAt:2000,endAt:4000});
    return {total:{wholeBB:'27',remainder:'1'}};
  };
  const [reserve]=clubReserves(db,terms,1,terms.epoch+GAME_YEAR_MS,statement);
  assert.equal(reserve.reference,'bought');assert.equal(reserve.limit,27n);
  const proceeds=clubProceeds(db,terms);
  assert.deepEqual(proceeds.map(p=>[p.reference,p.limit]),[['sold',20n]]);
  db.exec("INSERT INTO wage_collections VALUES('bought','12'),('','5')");
  assert.equal(remainingReserveCustody(db,terms),163n);
});
