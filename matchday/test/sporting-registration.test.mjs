import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureApi,playDueFixtures } from '../src/fixtures.js';
import { openStore } from '../src/local-store.js';
import { TEAM_SHEET_LOCK_MS } from '../src/world-clock.js';
import { Keypair } from '@solana/web3.js';
import { purchaseListing } from '../src/player-transfer.js';
import { indexTransfers } from '../src/registration-index.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GAME_WEEK_MS } from '../src/world-clock.js';
import { loanAgreements } from '../src/loan-agreements.js';
import { approveFixture } from '../src/fixture-appearance.js';

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

// Seed a persisted agreement in the format shipped by #153. The validator journey
// exercises its creation and both real manager signatures through the normal entry points.
function persistedLoan(t) {
  const directory=mkdtempSync(join(tmpdir(),'ballerz-loan-fixtures-'));
  const filename=join(directory,'sporting.sqlite');
  let now=start;
  let db=openStore(filename,()=>now);
  const ledger=new DatabaseSync(filename);
  loanAgreements(ledger,null,()=>({}),()=>now);
  db.registration.observe(sale);
  requestSale(db,sale.reference,1,start-1000,start);
  const begins=first, ends=begins+4*GAME_WEEK_MS;
  const terms={id:'private-review-link',player:sale.player,borrower:'northbank'};
  ledger.prepare(`INSERT INTO loan_agreements(id,mint,startAt,endAt,terms,checkedSlot,parentSignature,borrowerSignature,
    confirmedAt,ownershipSlot) VALUES(?,?,?,?,?,3,'parent','borrower',?,3)`).run(
    terms.id,sale.mint,begins,ends,JSON.stringify(terms),start);
  t.after(()=>{db.close();ledger.close();rmSync(directory,{recursive:true,force:true});});
  const accounts={mint:Keypair.generate().publicKey,owners:[Keypair.generate().publicKey,Keypair.generate().publicKey]};
  return {begins,ends,get db(){return db;},restart(at){now=at;db.close();db=openStore(filename,()=>now);},
    approve:game=>approveFixture(db,accounts,game.id,start),
    minutes:()=>ledger.prepare('SELECT minutes FROM sporting_loan_minutes WHERE agreement=?').all(terms.id).map(r=>r.minutes)};
}
const hasPlayer=(view,side)=>view.clubs[side].squad.some(p=>p.id===sale.player);
const offerView=async(db,game,now)=>(await call(db,'/'+game.id,now,game.home)).data;

test('confirmed loans project at strict sheet cutoffs, including after upgrade and resale',async t=>{
  const pilot=persistedLoan(t);
  const {begins,ends}=pilot;
  const past=await fixture(pilot.db,start+1000);
  const before=await fixture(pilot.db,begins);
  const during=await fixture(pilot.db,begins+1);
  const last=await fixture(pilot.db,ends);
  const after=await fixture(pilot.db,ends+1);
  const frozen=pilot.db.read(past.id);
  const stale=pilot.db.read(during.id);
  pilot.restart(start+1500);
  const {db}=pilot;
  assert.deepEqual(db.read(past.id),frozen);
  assert.equal(db.update(during.id,stale.version,JSON.parse(stale.state)),false);
  for (const [game,owner] of [[before,1],[during,0],[last,0],[after,1]]) {
    const view=await offerView(db,game,start+1500);
    assert.ok(hasPlayer(view,owner));
    assert.equal(hasPlayer(view,1-owner),false);
    assert.ok(!JSON.stringify(view).includes('private-review-link'));
  }
  const fresh=await fixture(db,begins+2000);
  const home=await offerView(db,fresh,start+1500);
  for (const [i,key] of [fresh.home,fresh.away].entries())
    assert.equal((await call(db,'/'+fresh.id+'/ready',start+2000,key,home.defaults[i])).status,200);
  const kickoff=when=>fixtureApi(new Request('http://local/api/fixtures/'+fresh.id+'/kickoff-now',{
    method:'POST',headers:{Authorization:'Bearer '+fresh.home}
  }),db,{worldStart:start,receivedAt:when,playtest:true});
  assert.equal((await kickoff(begins-1)).status,409);
  assert.equal((await kickoff(begins+1)).status,200);
  const live=db.read(fresh.id);
  assert.ok(JSON.parse(live.state).live.checkpoint.teams[0].players.some(p=>p.id===sale.player));
  db.registration.observe({...sale,reference:'sale-to-borrower',seller:'eastport',buyer:'northbank'});
  requestSale(db,'sale-to-borrower',2,begins+10,begins+20);
  assert.deepEqual(db.read(fresh.id),live);
  assert.ok((await offerView(db,last,begins+20)).fixtureLoans.some(p=>p.player===sale.player));
  assert.ok(hasPlayer(await offerView(db,after,begins+20),0));
});

test('locked borrower starts hold a return until the last result; missed ticks preserve earlier cutoffs',async t=>{
  const pilot=persistedLoan(t);
  const {begins,ends}=pilot;
  pilot.restart(start);
  const firstLock=await fixture(pilot.db,ends-1000);
  const secondLock=await fixture(pilot.db,ends);
  const missed=await fixture(pilot.db,ends+100);
  const atRelease=await fixture(pilot.db,ends+TEAM_SHEET_LOCK_MS);
  const open=await fixture(pilot.db,ends+TEAM_SHEET_LOCK_MS+1);
  for (const game of [firstLock,secondLock]) {
    pilot.approve(game);
    const v=await offerView(pilot.db,game,begins);
    assert.ok(v.defaults[0].xi.includes(sale.player));
    assert.equal((await call(pilot.db,'/'+game.id+'/ready',begins,game.home,v.defaults[0])).status,200);
  }
  const signed=pilot.db.read(secondLock.id);
  const v=await offerView(pilot.db,open,begins);
  const xi={...v.defaults[1],xi:v.defaults[1].xi.map(id=>id==='eastport-7'?sale.player:id)};
  assert.equal((await call(pilot.db,'/'+open.id+'/ready',begins,open.away,xi)).status,200);
  pilot.restart(ends+101); // The service was offline over the loan end and the next deadline.
  const {db}=pilot;
  assert.deepEqual(db.read(secondLock.id),signed);
  for (const game of [missed,atRelease,open]) {
    const view=await offerView(db,game,ends+101);
    assert.ok(!hasPlayer(view,0) && !hasPlayer(view,1));
    assert.ok(view.fixtureLoans[0].returnPending);
    assert.ok(!JSON.stringify(view).includes('private-review-link'));
  }
  assert.equal((await offerView(db,open,ends+101)).ready[1],false);
  assert.equal((await call(db,'/'+open.id+'/ready',ends+101,open.away,xi)).status,400);
  const changed=JSON.parse(signed.state);changed.plans[0]=null;
  assert.equal(db.update(secondLock.id,signed.version,changed,ends+102),false);
  const firstResult=ends-1000+TEAM_SHEET_LOCK_MS;
  await playDueFixtures(db,firstResult);
  assert.equal(JSON.parse(db.read(firstLock.id).state).result.kind,'forfeit');
  assert.ok(!hasPlayer(await offerView(db,open,firstResult),1));
  await playDueFixtures(db,ends+TEAM_SHEET_LOCK_MS);
  assert.deepEqual(pilot.minutes(),[]);
  assert.ok(!hasPlayer(await offerView(db,atRelease,ends+TEAM_SHEET_LOCK_MS),1));
  assert.ok(hasPlayer(await offerView(db,open,ends+TEAM_SHEET_LOCK_MS),1));
  assert.equal((await call(db,'/'+open.id+'/ready',ends+TEAM_SHEET_LOCK_MS,open.away,xi)).status,200);
  assert.ok(!hasPlayer(await offerView(db,missed,ends+TEAM_SHEET_LOCK_MS),1));
});

test('a bench-only loan fixture does not delay the return',async t=>{
  const pilot=persistedLoan(t);pilot.restart(start);
  const {db,begins,ends}=pilot;
  const last=await fixture(db,ends-1),next=await fixture(db,ends+1);
  pilot.approve(last);
  const home=(await offerView(db,last,begins)).defaults[0];
  const benchOnly={...home,xi:home.xi.map(id=>id===sale.player?'northbank-16':id)};
  assert.equal((await call(db,'/'+last.id+'/ready',begins,last.home,benchOnly)).status,200);
  assert.equal((await call(db,'/'+last.id+'/ready',begins,last.away,last.defaults[1])).status,200);
  const view=await offerView(db,next,ends);
  assert.ok(hasPlayer(view,1));
  assert.equal(view.fixtureLoans.length,0);
  await playDueFixtures(db,ends-1+TEAM_SHEET_LOCK_MS);
  const team=JSON.parse(db.read(last.id).state).live.checkpoint.teams[0];
  assert.ok(!team.bench.some(p=>p.id===sale.player));
});

test('loan return cancels a queued substitute but protects a substitute who already played',async t=>{
  const pilot=persistedLoan(t);pilot.restart(start);
  const {db,begins,ends}=pilot;
  const next=await fixture(db,ends+1);
  const at=async(kickoff)=>{
    const game=await fixture(db,kickoff-TEAM_SHEET_LOCK_MS);
    const row=db.read(game.id);
    assert.ok(db.update(game.id,row.version,{...JSON.parse(row.state),matchSeed:42}));
    pilot.approve(game);
    const home=game.defaults[0];
    const benchOnly={...home,xi:home.xi.map(id=>id===sale.player?'northbank-16':id)};
    assert.equal((await call(db,'/'+game.id+'/ready',begins,game.home,benchOnly)).status,200);
    assert.equal((await call(db,'/'+game.id+'/ready',begins,game.away,game.defaults[1])).status,200);
    await playDueFixtures(db,kickoff);
    const order={kind:'substitution',outgoingId:'northbank-16',incomingId:sale.player};
    assert.equal((await call(db,'/'+game.id+'/touchline',kickoff+10,game.home,order)).status,200);
    return game;
  };
  const played=await at(ends-90000);
  await playDueFixtures(db,ends-10000);
  assert.ok(JSON.parse(db.read(played.id).state).live.checkpoint.teams[0].players.some(p=>p.id===sale.player));
  const queued=await at(ends-100);
  assert.equal(JSON.parse(db.read(queued.id).state).live.checkpoint.teams[0].pendingSubstitution.incomingId,sale.player);
  const view=await offerView(db,next,ends);
  assert.ok(!hasPlayer(view,1));
  const state=JSON.parse(db.read(queued.id).state);
  assert.equal(state.live.checkpoint.teams[0].pendingSubstitution,null);
  assert.ok(!state.live.checkpoint.teams[0].bench.some(p=>p.id===sale.player));
  await playDueFixtures(db,ends+900000);
  const final=db.read(played.id),result=JSON.parse(final.state);
  const minutes=result.result.performances[0].find(p=>p.playerId===sale.player).minutes;
  assert.ok(minutes>0);
  assert.deepEqual(pilot.minutes(),[minutes]);
  assert.ok(db.update(played.id,final.version,result,ends+900001));
  assert.deepEqual(pilot.minutes(),[minutes]);
});

test('a self-scheduled fixture can rehearse a loan but cannot hold a return or earn minutes',async t=>{
  const pilot=persistedLoan(t);pilot.restart(start);
  const {db,begins,ends}=pilot;
  const game=await fixture(db,ends-1),next=await fixture(db,ends+1);
  for (const [side,key] of [game.home,game.away].entries())
    assert.equal((await call(db,'/'+game.id+'/ready',begins,key,game.defaults[side])).status,200);
  assert.ok(hasPlayer(await offerView(db,next,ends),1));
  await playDueFixtures(db,ends+TEAM_SHEET_LOCK_MS);
  await playDueFixtures(db,ends+TEAM_SHEET_LOCK_MS+900000);
  const {result}=JSON.parse(db.read(game.id).state);
  assert.ok(result.performances[0].some(p=>p.playerId===sale.player && p.minutes>0));
  assert.deepEqual(pilot.minutes(),[]);
});

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
