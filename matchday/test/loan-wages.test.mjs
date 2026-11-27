import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { accrueLoanWages, loanWages } from '../src/loan-wages.js';
import { GAME_YEAR_MS as year } from '../src/world-clock.js';
import { openStore } from '../src/local-store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const epoch=Date.UTC(2027,0,1);
const terms={mint:'winger',parent:'parent',borrower:'borrower',startAt:epoch,endAt:epoch+year,
  ownershipReference:'original',parentWageBps:2500,borrowerWageBps:7500};
const rates=[{year:1,startAt:epoch,annualBB:52000}];
const asUnits=rows=>Object.fromEntries(rows.map(row=>[row.club,
  BigInt(row.wholeBB)*BigInt(year)*10000n+BigInt(row.remainder)]));

test('exact wage units survive fractional splits and same-block sales across a wage rollover',()=>{
  const first={...terms,startAt:epoch+year/2,endAt:epoch+2*year};
  const published=[...rates,{year:2,startAt:epoch+year,annualBB:104000}];
  const sales=[{effectiveAt:epoch+year,buyer:'other'},{effectiveAt:epoch+year,buyer:'borrower'}];
  for (const bps of [0,1,3333,5000,9999,10000]) {
    const loan={...first,parentWageBps:10000-bps,borrowerWageBps:bps};
    for (const elapsed of [0,1,year/2-1,year/2,year/2+1,year,1.5*year]) {
      const oldUnits=BigInt(Math.min(year/2,elapsed))*52000n;
      const newUnits=BigInt(Math.max(0,elapsed-year/2))*104000n;
      const result=asUnits(accrueLoanWages(loan,loan.startAt+elapsed,published,sales));
      assert.equal(result.parent ?? 0n,oldUnits*BigInt(10000-bps));
      assert.equal(result.borrower ?? 0n,oldUnits*BigInt(bps)+newUnits*10000n);
      assert.equal(result.other,undefined);
    }
  }
  assert.equal(accrueLoanWages(first,first.endAt,rates,sales),null);
  assert.equal(accrueLoanWages(first,first.endAt,published.slice(1),sales),null);
});

test('sales at the start or end and a sale recorded before the loan starts respect the signed term',()=>{
  const sales=[{effectiveAt:epoch-1,buyer:'former'},{effectiveAt:epoch,buyer:'current'},
    {effectiveAt:epoch+year,buyer:'future'}];
  const rows=accrueLoanWages(terms,terms.endAt,[{...rates[0],annualBB:Number.MAX_SAFE_INTEGER}],sales);
  assert.deepEqual(asUnits(rows),{
    borrower:BigInt(year)*BigInt(Number.MAX_SAFE_INTEGER)*7500n,
    current:BigInt(year)*BigInt(Number.MAX_SAFE_INTEGER)*2500n
  });
});

test('durable published rates and finalized title history reconstruct the same club liability on every read',t=>{
  const folder=mkdtempSync(join(tmpdir(),'loan-wages-')), file=join(folder,'sporting.sqlite');
  const store=openStore(file);
  let db=new DatabaseSync(file);
  t.after(()=>{db.close();store.close();rmSync(folder,{recursive:true,force:true});});
  const config={players:{winger:'footballer'},genesis:'test',sponsor:'operator',bbMint:'BB'};
  const sale={mint:'winger',player:'footballer',bb:'BB',genesis:'test',sponsor:'operator',terms:{},
    reference:'original',seller:'borrower',buyer:'parent'};
  const registration=store.registration;
  registration.observe(sale);
  const input={mint:'winger',year:1,annualBB:52000};
  let wages=loanWages(db);
  assert.throws(()=>wages.publish(config,input),/registered player/);
  registration.finalize('original',{slot:1,position:1,effectiveAt:epoch-1},()=>epoch);
  assert.throws(()=>wages.publish(config,input),/shared world clock/);
  store.worldStart(epoch);
  const read=()=>wages.report(terms,true,terms.endAt+year);
  assert.equal(read().clubs,null);
  for (const patch of [{genesis:'wrong'},{bbMint:'wrong'},{sponsor:'wrong'},{players:{winger:'wrong'}}])
    assert.throws(()=>wages.publish({...config,...patch},input),/registered player/);
  for (const patch of [{year:0},{annualBB:-1},{annualBB:0.5}])
    assert.throws(()=>wages.publish(config,{...input,...patch}),/year|whole-BB/);
  assert.deepEqual({...wages.publish(config,input)},rates[0]);
  assert.throws(()=>wages.publish(config,{...input,annualBB:10000}),/locked/);
  assert.equal(wages.report(terms,false,terms.endAt).through,null);
  assert.deepEqual(wages.report(terms,true,epoch-1).clubs,[]);
  registration.observe({...sale,seller:'parent',buyer:'buyer',reference:'resale'});
  const charged=()=>Object.fromEntries(read().clubs.map(r=>[r.club,r.wholeBB]));
  assert.deepEqual(charged(),{parent:'13000',borrower:'39000'});
  registration.mark('resale','expired');
  assert.deepEqual(charged(),{parent:'13000',borrower:'39000'});
  registration.finalize('resale',{slot:4,position:0,effectiveAt:epoch+year/2},()=>epoch+year);
  assert.deepEqual(charged(),{parent:'6500',buyer:'6500',borrower:'39000'});
  const expected=read();
  assert.equal(expected.through,terms.endAt);
  db.close(); db=new DatabaseSync(file);
  wages=loanWages(db);
  assert.deepEqual({...wages.publish(config,input)},rates[0]);
  assert.deepEqual(read(),expected);
});
