import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureApi,playDueFixtures } from '../src/fixtures.js';
import { openStore } from '../src/local-store.js';
import { TEAM_SHEET_LOCK_MS } from '../src/world-clock.js';
import { Keypair } from '@solana/web3.js';
import { purchaseListing } from '../src/player-transfer.js';
import { indexTransfers } from '../src/registration-index.js';

const start=Date.UTC(2027,0,1);
const first=start+3600000;
const sale={reference:'purchase-1',player:'northbank-7',mint:'winger',bb:'test-bb',sponsor:'operator',
  genesis:'validator',seller:'northbank',buyer:'eastport',terms:{}};
async function call(db,path,time,token,body) {
  const res=await fixtureApi(new Request('http://local/api/fixtures'+path,{
    method:body===undefined?'GET':'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify(body)
  }),db,{worldStart:start,receivedAt:time});
  return {status:res.status,data:await res.json()};
}
async function fixture(db,deadline) {
  const {id,key}= (await call(db,'',start,null,{kickoffAt:deadline+TEAM_SHEET_LOCK_MS})).data;
  const {data}=await call(db,'/'+id,start,key);
  const away=(await call(db,'/'+id+'/join',start,data.invite,{})).data.key;
  return {id,home:key,away,defaults:data.defaults};
}
const requestSale=(db,reference,slot,effectiveAt,indexedAt,position=0)=>
  db.registration.finalize(reference,{slot,effectiveAt,position},()=>indexedAt);

test('effective time strictly precedes cutoff and late indexing preserves locked sheets and results',async t=>{
  const db=openStore(':memory:');t.after(()=>db.close());
  const past=await fixture(db,first-400000);
  const locked=await fixture(db,first);
  const next=await fixture(db,first+3600000);
  for (const f of [past,locked,next]) {
    for (const [side,key] of [f.home,f.away].entries())
      assert.equal((await call(db,'/'+f.id+'/ready',start,key,f.defaults[side])).status,200);
  }
  await playDueFixtures(db,first+TEAM_SHEET_LOCK_MS);
  // Both earlier fixtures have started. Finish their simulation before indexing.
  await playDueFixtures(db,first+TEAM_SHEET_LOCK_MS+900000);
  const historical=db.read(past.id);
  const lockedRow=db.read(locked.id);
  const oldOpen=db.read(next.id);
  db.registration.observe(sale);
  assert.equal(db.registration.status()[0].status,'pending');
  requestSale(db,sale.reference,100,first-1000,first+TEAM_SHEET_LOCK_MS+900001);
  assert.deepEqual(db.read(past.id),historical);
  assert.deepEqual(db.read(locked.id),lockedRow);
  assert.equal(db.update(next.id,oldOpen.version,JSON.parse(oldOpen.state)),false);
  const home=(await call(db,'/'+next.id,first+3000000,next.home)).data;
  assert.equal(home.ready[0],false);
  assert.equal(home.ready[1],true);
  assert.equal(home.transfers[0].firstFixture,next.id);
  assert.equal(home.transfers[0].effectiveAt,first-1000);
  assert.equal(home.clubs[0].squad.some(p=>p.id===sale.player),false);
  assert.equal((await call(db,'/'+next.id+'/ready',first+3000000,next.home,next.defaults[0])).status,400);
  const awayPlan={...next.defaults[1],xi:next.defaults[1].xi.map(id=>id==='eastport-7'?sale.player:id)};
  assert.equal((await call(db,'/'+next.id+'/ready',first+3000000,next.away,awayPlan)).status,200);
  assert.equal((await call(db,'/'+next.id+'/ready',first+3000000,next.home,home.defaults[0])).status,200);
  await playDueFixtures(db,first+3600000+TEAM_SHEET_LOCK_MS);
  const teams=JSON.parse(db.read(next.id).state).live.checkpoint.teams;
  assert.ok(teams[1].players.some(p=>p.id===sale.player));
  assert.ok(![...teams[0].players,...teams[0].bench].some(p=>p.id===sale.player));
});

test('a stale purchase or changed wallet cannot register a player, and retries retain one public reference',async t=>{
  const db=openStore(':memory:');t.after(()=>db.close());
  const [operator,home,away]=Array.from({length:3},()=>Keypair.generate());
  const [playerMint,bbMint,version,hash]=Array.from({length:4},()=>Keypair.generate().publicKey);
  const listing={playerMint,bbMint,version,sponsor:operator.publicKey,seller:home.publicKey,
    blockhash:hash.toBase58(),lastValidBlockHeight:50,price:100000,wages:30000};
  const signed=purchaseListing(listing,away.publicKey);
  signed.sign(operator,home,away);
  const journal={listing,buyer:away.publicKey,purchase:signed.serialize().toString('base64')};
  const config={genesis:'validator',players:{[playerMint]:'northbank-7'},bbMint:bbMint.toBase58(),
    sponsor:operator.publicKey.toBase58(),wallets:{[away.publicKey]:'eastport',[home.publicKey]:'northbank'}};
  let height=50, status=null;
  const rpc={getGenesisHash:async()=>'validator',getTransaction:async()=>null,
    getBlockHeight:async()=>height,getSignatureStatuses:async()=>({value:[status]})};
  const read=(journals,settings=config)=>indexTransfers(rpc,db.registration,settings,journals);
  await assert.rejects(read([journal],{...config,genesis:'different'}),/network/);
  await assert.rejects(read([{...journal,listing:{...listing,price:1}}]),/signatures/);
  await assert.rejects(read([{...journal,buyer:version}]),/wallet/);
  assert.deepEqual(db.registration.status(),[]);
  await read([journal,journal]);
  assert.equal(db.registration.status().length,1);
  const replacement={...listing,version:Keypair.generate().publicKey};
  const next=purchaseListing(replacement,away.publicKey);
  next.sign(operator,home,away);
  const newJournal={...journal,listing:replacement,purchase:next.serialize().toString('base64')};
  await assert.rejects(read([newJournal],{...config,wallets:{[home.publicKey]:'eastport',[away.publicKey]:'northbank'}}),/club mapping/);
  await assert.rejects(read([],{...config,bbMint:version.toBase58()}),/different registration/);
  assert.equal(db.registration.status().length,1);
  height=51;
  status={confirmationStatus:'finalized',err:null};
  await read([]);
  assert.equal(db.registration.status()[0].status,'pending');
  status=null;
  await read([]);
  assert.equal(db.registration.status()[0].status,'expired');
  status={confirmationStatus:'finalized',err:{InstructionError:[2,'Custom']}};
  await read([]);
  assert.equal(db.registration.status()[0].status,'failed');
  assert.equal(db.registration.status()[0].firstFixture,null);
});

test('a computer club without a legal XI forfeits and can field a returned goalkeeper',async t=>{
  const db=openStore(':memory:');t.after(()=>db.close());
  const scheduled=async deadline=>(await call(db,'',start,null,{
    opponent:'computer',kickoffAt:deadline+TEAM_SHEET_LOCK_MS})).data;
  const firstGame=await scheduled(first);
  for (const number of [1,12]) {
    const player='eastport-'+number;
    db.registration.observe({...sale,player,mint:player,reference:player,seller:'eastport',buyer:'northbank'});
    requestSale(db,player,number,start+1,start+2);
  }
  const nextGame=await scheduled(first+7200000);
  for (const game of [firstGame,nextGame]) {
    const path='/'+game.id;
    const {data}=await call(db,path,start+5,game.key);
    assert.deepEqual(data.ready,[false,false]);
    const preview=await call(db,path+'/preview',start+5,game.key,{
      plan:data.defaults[0],phase:'inPossession',zone:'attack'});
    assert.equal(preview.status,400);
    assert.equal((await call(db,path+'/ready',start+6,game.key,data.defaults[0])).status,200);
  }
  await playDueFixtures(db,first+TEAM_SHEET_LOCK_MS);
  assert.equal(JSON.parse(db.read(firstGame.id).state).result.kind,'forfeit');
  const player='eastport-1';
  db.registration.observe({...sale,player,mint:player,reference:'returned-keeper'});
  requestSale(db,'returned-keeper',13,first+TEAM_SHEET_LOCK_MS+1,first+TEAM_SHEET_LOCK_MS+2);
  const {data}=await call(db,'/'+nextGame.id,first+TEAM_SHEET_LOCK_MS+3,nextGame.key);
  assert.deepEqual(data.ready,[true,true]);
  await playDueFixtures(db,first+7200000+TEAM_SHEET_LOCK_MS);
  assert.ok(JSON.parse(db.read(nextGame.id).state).live);
});

test('cutoff equality, roster snapshots at creation, and delayed earlier slots cannot undo a resale',async t=>{
  const db=openStore(':memory:');t.after(()=>db.close());
  const exact=await fixture(db,first);
  const next=await fixture(db,first+1000);
  db.registration.observe(sale);
  requestSale(db,sale.reference,100,first,first);
  assert.equal(JSON.parse(db.read(exact.id).state).registrations,undefined);
  assert.equal(db.registration.status()[0].firstFixture,next.id);
  const other=await fixture(db,first+2000);
  assert.equal(JSON.parse(db.read(other.id).state).registrations[sale.player].club,'eastport');
  const back={...sale,buyer:'northbank',seller:'eastport',reference:'return'};
  db.registration.observe(back);
  requestSale(db,'return',103,first+10,first+11);
  db.registration.observe({...sale,reference:'delayed'});
  requestSale(db,'delayed',102,first+5,first+20);
  assert.equal(JSON.parse(db.read(next.id).state).registrations[sale.player].reference,'return');
  assert.throws(()=>db.registration.observe({...sale,player:'northbank-11'}),/binding/);
  assert.throws(()=>db.registration.observe({...sale,buyer:'northbank'}),/mapping/);
  const unchanged=db.read(other.id);
  requestSale(db,'return',103,first+10,first+25);
  assert.deepEqual(db.read(other.id),unchanged);
});
