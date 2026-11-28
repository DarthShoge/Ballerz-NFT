import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { Keypair, PublicKey } from '@solana/web3.js';
import { wageSettlement } from '../src/wage-settlement.js';
import { GAME_YEAR_MS } from '../src/world-clock.js';

test('close after rewards, preserve fractions across years, and reconcile oldest arrears atomically', async t => {
  const wallet = () => String(Keypair.generate().publicKey);
  const config = {genesis:'pilot',bbMint:wallet(),sponsor:wallet(),wageSettlement:{
    treasury:wallet(),payroll:{northbank:wallet(),eastport:wallet()}}};
  const db = new DatabaseSync(':memory:'); t.after(()=>db.close());
  const epoch = 100000;
  db.exec('CREATE TABLE world_clock(id,start_at); CREATE TABLE fixtures(state); CREATE TABLE sporting_sales(status,terms); CREATE TABLE sporting_wallets(wallet)');
  db.exec('CREATE TABLE sporting_players(genesis,bb,sponsor)');
  db.prepare('INSERT INTO world_clock VALUES(1,?)').run(epoch);
  let now = epoch+GAME_YEAR_MS-1000, slot = 1, genesis = config.genesis;
  const rpc = {getGenesisHash:async()=>genesis,getSlot:async()=>slot,getBlockTime:async()=>Math.floor(now/1000)};
  const rates = [15,28]; // Tenths of a BB. Carry the first half BB into year two.
  const statement = (club,year) => {
    const units = rates[year-1];
    return {denominator:'10', total:units==null?null:{wholeBB:String(Math.floor(units/10)),remainder:String(units%10)}};
  };
  const ledger = wageSettlement(db,rpc,()=>config,statement,()=>now);
  const reconcile = () => ledger.reconcile('eastport');
  db.prepare('INSERT INTO sporting_sales VALUES(?,?)').run('finalized',JSON.stringify({listing:{grant:{treasury:config.wageSettlement.payroll.eastport}}}));
  await assert.rejects(reconcile(),/grant treasury custody/);
  db.exec('DELETE FROM sporting_sales');
  rpc.getLatestBlockhash=async()=>({blockhash:wallet(),lastValidBlockHeight:100});
  db.prepare('INSERT INTO sporting_players VALUES(?,?,?)').run('another pilot',config.bbMint,config.sponsor);
  await assert.rejects(ledger.prepare('eastport','1'),/sporting market/);
  db.exec('DELETE FROM sporting_players');
  const treasury=config.wageSettlement.treasury;
  rpc.getLatestBlockhash=async()=>{config.wageSettlement.treasury=wallet();return {blockhash:wallet(),lastValidBlockHeight:100};};
  await assert.rejects(ledger.prepare('eastport','1'),/terms changed/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM wage_market').get().n,0);
  config.wageSettlement.treasury=treasury;
  rpc.getLatestBlockhash=async()=>({blockhash:wallet(),lastValidBlockHeight:100});
  assert.ok((await ledger.prepare('eastport','1')).unsignedTransaction);
  const collector={publicKey:new PublicKey(config.wageSettlement.payroll.eastport)};
  rpc.getBlockHeight=async()=>100;
  assert.equal((await ledger.collect('eastport','income',collector)).status,'awaiting manual payment');
  rpc.getBlockHeight=async()=>101;
  rpc.getFirstAvailableBlock=async()=>slot+1;
  await assert.rejects(ledger.collect('eastport','income',collector),/Restore finalized history/);
  rpc.getFirstAvailableBlock=async()=>slot;
  rpc.getSignaturesForAddress=async()=>[];
  assert.equal((await ledger.collect('eastport','income',collector)).status,'no arrears');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM wage_manual_intents').get().n,0);
  config.wageSettlement.treasury=wallet();
  await assert.rejects(reconcile(),/registered payroll market changed/);
  config.wageSettlement.treasury=treasury;
  assert.deepEqual((await reconcile()).years,[]);
  now = epoch+2*GAME_YEAR_MS;
  db.prepare('INSERT INTO fixtures VALUES(?)').run(JSON.stringify({appearanceApproval:{},schedule:{kickoffAt:epoch}}));
  await assert.rejects(reconcile(),/match rewards/);
  db.exec("DELETE FROM fixtures; INSERT INTO sporting_sales(status) VALUES('pending')");
  await assert.rejects(reconcile(),/sporting transfers/);
  db.exec('DELETE FROM sporting_sales');
  assert.deepEqual((await reconcile()).years.map(r=>r.arrears),['1','3']);
  assert.equal(ledger.closed('eastport',2).carry,'3');
  // The validator journey tests receipt admission. This fixture starts with admitted credits.
  db.exec("INSERT INTO wage_receipts VALUES('receipt','eastport',1,'3'),('other','northbank',1,'20')");
  slot++;
  const partial = await reconcile();
  assert.deepEqual(partial.years.map(r=>[r.paid,r.arrears]),[['1','0'],['2','1']]);
  assert.deepEqual(await reconcile(),partial);
  rates[0] = 0; // Late finalized title evidence changes prior exposure.
  assert.equal((await reconcile()).unappliedBB,'1');
  rates[1] = null;
  await assert.rejects(reconcile(),/missing wage rates/);
  assert.equal(ledger.closed('eastport',2).paid,'2');
  slot--;
  await assert.rejects(reconcile(),/current finalized checkpoint/);
  genesis = 'elsewhere';
  await assert.rejects(reconcile(),/another network/);
  config.wageSettlement.payroll.eastport = config.sponsor;
  await assert.rejects(reconcile(),/distinct dedicated/);
});
