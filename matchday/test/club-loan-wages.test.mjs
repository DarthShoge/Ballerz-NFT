import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { Keypair } from '@solana/web3.js';
import { ed25519 } from '@noble/curves/ed25519';
import { sportingRegister } from '../src/sporting-register.js';
import { loanAgreements } from '../src/loan-agreements.js';
import { loanApi } from '../src/loan-desk.js';
import { clubLoanWages } from '../src/club-loan-wages.js';
import { wageStatementMessage } from '../public/wage-statement-message.js';
import { GAME_YEAR_MS as year } from '../src/world-clock.js';

test('club statements combine fractional obligations, split the wage years and reconcile indexed sales',async t=>{
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  const epoch=Date.UTC(2026,0,1);let now=epoch+year/2;
  db.exec('CREATE TABLE fixtures(id TEXT,state TEXT,version INTEGER); CREATE TABLE world_clock(id INTEGER,start_at INTEGER)');
  db.prepare('INSERT INTO world_clock VALUES(1,?)').run(epoch);
  const manager=Keypair.generate(),wallet=String(manager.publicKey),origin='http://localhost:4173';
  const config={genesis:'pilot',bbMint:'BB',sponsor:'operator',players:{a:'northbank-7',b:'northbank-5'},
    wallets:{[wallet]:'eastport'},loanManagers:{eastport:wallet}};
  const register=sportingRegister(db),desk=loanAgreements(db,null,()=>config,()=>now);
  const statements=clubLoanWages(db,()=>config,()=>now);
  const sale=(mint,reference,buyer)=>register.observe({mint,reference,player:config.players[mint],genesis:'pilot',bb:'BB',
    sponsor:'operator',seller:'other',buyer,terms:{}});
  for (const [mint,player] of Object.entries(config.players)) {
    sale(mint,'original-'+mint,'eastport');
    register.finalize('original-'+mint,{slot:1,position:1,effectiveAt:epoch-10},()=>epoch);
    const terms={mint,player,ownershipReference:'original-'+mint,parent:'eastport',borrower:'northbank',startAt:epoch,
      endAt:epoch+2*year,borrowerWageBps:0,parentWageBps:10000};
    db.prepare(`INSERT INTO loan_agreements(id,mint,startAt,endAt,terms,checkedSlot,parentSignature,borrowerSignature,confirmedAt,ownershipSlot)
      VALUES(?,?,?,?,?,1,'p','b',?,1)`).run('private-'+mint,mint,terms.startAt,terms.endAt,JSON.stringify(terms),epoch-1);
  }
  const proof=year=>{
    const ticket=statements.challenge(wallet,origin,year);
    return {wallet,nonce:ticket.nonce,signature:Buffer.from(ed25519.sign(Buffer.from(wageStatementMessage(origin,wallet,ticket)),
      manager.secretKey.slice(0,32))).toString('base64')};
  };
  const read=y=>statements.read({...proof(y),year:y},origin);
  assert.equal(read().total,null);
  for (const mint of ['a','b']) desk.publishRate({mint,year:1,annualBB:1});
  const first=read();
  assert.deepEqual(first.total,{wholeBB:'1',remainder:'0'});
  assert.deepEqual(first.lines.map(l=>l.amount.wholeBB),['0','0']);
  assert.ok(!JSON.stringify(first).includes('private-'));
  assert.throws(()=>read(2),/year/);
  sale('a','resale','northbank');
  assert.deepEqual(read().total,first.total);
  register.finalize('resale',{slot:2,position:0,effectiveAt:epoch+year/4},()=>now);
  assert.equal(BigInt(read().total.remainder),BigInt(first.denominator)*3n/4n);
  now=epoch+year;
  assert.deepEqual(read().total,{wholeBB:'0',remainder:'0'});
  assert.equal(read(1).asOf,now);
  now+=year/2;desk.publishRate({mint:'b',year:2,annualBB:10});
  assert.deepEqual(read(2).total,{wholeBB:'5',remainder:'0'});
  assert.equal(read(2).lines.length,1);
  assert.throws(()=>statements.read({...proof(1),year:2},origin),/selected wage year/);
  assert.deepEqual(read(1).total,{wholeBB:'1',remainder:String(BigInt(first.denominator)/4n)});
  const data=proof();
  const post=(site,body)=>loanApi(new Request(origin+'/api/loans/wages',{method:'POST',
    headers:{origin:site,host:'localhost:4173','content-type':'application/json'},body:JSON.stringify(body)}),{statements});
  assert.equal((await post('https://elsewhere.example',data)).status,403);
  assert.equal((await post(origin,data)).status,200);assert.equal((await post(origin,data)).status,403);
  const revoked=proof();delete config.loanManagers.eastport;
  assert.equal((await post(origin,revoked)).status,403);
});
