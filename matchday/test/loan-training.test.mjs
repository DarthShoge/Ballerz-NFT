import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { Keypair } from '@solana/web3.js';
import { ed25519 } from '@noble/curves/ed25519';
import { openStore } from '../src/local-store.js';
import { loanAgreements } from '../src/loan-agreements.js';
import { loanTraining } from '../src/loan-training.js';
import { loanApi } from '../src/loan-desk.js';
import { GAME_WEEK_MS } from '../src/world-clock.js';
import { trainingAccess,trainingOrder } from '../public/training-message.js';

function world(t,players=['northbank-7']) {
  const directory=mkdtempSync(join(tmpdir(),'focused-')),file=join(directory,'world.sqlite');
  const store=openStore(file), db=new DatabaseSync(file),peer=new DatabaseSync(file);
  t.after(()=>{peer.close();db.close();store.close();rmSync(directory,{recursive:true,force:true});});
  const epoch=1700000000000; let now=epoch+1,slot=0;
  const [parent,borrower,buyer]=Array.from({length:3},()=>Keypair.generate());
  const key=manager=>String(manager.publicKey),origin='http://localhost:4173';
  const config={players:Object.fromEntries(players.map(p=>['mint-'+p,p])),sponsor:'pilot',bbMint:'bb',genesis:'test',
    loanManagers:{eastport:key(parent),northbank:key(borrower)},wallets:{[key(parent)]:'eastport',[key(borrower)]:'northbank',[key(buyer)]:'eastport'}};
  function sale(player,manager) {
    const reference='sale-'+ ++slot;
    store.registration.observe({mint:'mint-'+player,player,genesis:'test',bb:'bb',sponsor:'pilot',terms:{buyer:key(manager)},reference,
      seller:'northbank',buyer:'eastport'});
    store.registration.finalize(reference,{slot,position:0,effectiveAt:now},()=>now);
  }
  for (const p of players) sale(p,parent);
  store.worldStart(epoch);
  loanAgreements(db,null,()=>config,()=>now);
  const desk=loanTraining(db,()=>config,()=>now),other=loanTraining(peer,()=>config,()=>now);
  const sign=(manager,message)=>Buffer.from(ed25519.sign(Buffer.from(message),manager.secretKey.slice(0,32))).toString('base64');
  const read=manager=>{
    const wallet=key(manager),ticket=desk.challenge(wallet,origin);
    return desk.read({wallet,nonce:ticket.nonce,signature:sign(manager,trainingAccess(origin,wallet,ticket))},origin);
  };
  const order=(manager,player=players[0])=>{
    const {club,week,players:rows}=read(manager);
    const {authority,mint}=rows.find(row=>row.player===player);
    return {action:'book',id:randomUUID(),player,mint,week,club,wallet:key(manager),authority,skill:'passing',genesis:'test',sponsor:'pilot'};
  };
  const submit=(manager,order,connection=desk)=>connection.submit(order,sign(manager,trainingOrder(origin,order)),origin);
  return {epoch,tick:ms=>{now=epoch+ms;},parent,borrower,buyer,config,desk,other,db,read,order,submit,sale,sign,origin,key};
}

test('a confirmed loan hands training to the borrower and returns it to the finalized owner, preserving workload',t=>{
  const w=world(t),{parent,borrower,buyer,epoch,desk,other,read,order,submit}=w;
  const start=epoch+100,end=start+4*GAME_WEEK_MS;
  const terms={parent:'eastport',borrower:'northbank',borrowerWallet:w.key(borrower)};
  w.db.prepare(`INSERT INTO loan_agreements(id,mint,startAt,endAt,terms,checkedSlot) VALUES('loan',?,?,?,?,1)`)
    .run('mint-northbank-7',start,end,JSON.stringify(terms));
  assert.deepEqual(read(borrower).players,[]);
  w.db.exec("UPDATE loan_agreements SET parentSignature='p',borrowerSignature='b',confirmedAt=startAt-1,ownershipSlot=1");
  assert.equal(read(borrower).players[0].canBook,false);
  const first=order(parent),unused=order(parent);submit(parent,first);
  assert.deepEqual(desk.finish(first.id,'completed'),{status:'completed',weight:100});
  submit(parent,unused);w.tick(100);
  assert.equal(read(parent).players[0].canBook,false);
  assert.equal(read(borrower).players[0].available,1);
  assert.equal(desk.finish(unused.id,'completed').status,'released');
  assert.throws(()=>submit(parent,{...unused,id:randomUUID()}),/control/);
  const second=order(borrower);submit(borrower,second);submit(borrower,second,other);
  assert.ok(!read(parent).players[0].sessions.some(s=>s.id===second.id || (s.club==='northbank' && s.status==='reserved')));
  w.sale('northbank-7',buyer);w.config.loanManagers.eastport=w.key(buyer);
  assert.throws(()=>read(parent),/Verify this wallet/);
  assert.equal(read(buyer).players[0].canBook,false);
  assert.deepEqual(other.finish(second.id,'completed'),{status:'completed',weight:50});
  assert.deepEqual(desk.finish(second.id,'completed'),{status:'completed',weight:50});
  assert.equal(read(buyer).players[0].sessions.filter(s=>s.status==='completed').length,2);
  assert.ok(read(buyer).players[0].sessions.every(s=>!s.id));
  assert.throws(()=>submit(borrower,order(borrower)),/allowance/);
  w.tick(4*GAME_WEEK_MS+99);
  const last=order(borrower);submit(borrower,last);desk.finish(last.id,'completed');
  w.tick(end-epoch);
  assert.equal(read(buyer).players[0].available,1);
  assert.deepEqual(read(borrower).players,[]);
  const returned=order(buyer);submit(buyer,returned);
  assert.equal(desk.finish(returned.id,'completed').weight,50);
});

test('club capacity, cancellation, eligibility and authenticated reads hold across independent database connections',async t=>{
  const players=['northbank-7','northbank-1','northbank-5','northbank-8'];
  const w=world(t,players),{parent,desk,other,order,submit,read}=w;
  const invalid=order(parent);assert.throws(()=>submit(parent,{...invalid,skill:'handling'}),/eligible/);
  const sig=w.sign(parent,trainingOrder(w.origin,invalid));
  assert.throws(()=>desk.submit({...invalid,skill:'crossing'},sig,w.origin),/Sign the exact/);
  assert.throws(()=>desk.submit(invalid,sig,'https://other.example'),/Sign the exact/);
  assert.throws(()=>submit(w.borrower,invalid),/Sign the exact/);
  assert.throws(()=>submit(parent,{...invalid,genesis:'other'}),/control/);
  for (const player of players.slice(0,3)) for (let n=0;n<2;n++) submit(parent,order(parent,player),other);
  assert.throws(()=>submit(parent,order(parent,players[3])),/allowance/);
  const session=read(parent).players[0].sessions[0];
  const cancel={...order(parent),id:session.id,action:'cancel'};
  assert.equal(submit(parent,cancel).status,'cancelled');
  assert.equal(submit(parent,cancel,other).status,'cancelled');
  assert.equal(other.finish(cancel.id,'completed').status,'cancelled');
  const skip=order(parent,players[3]);submit(parent,skip);
  assert.equal(desk.finish(skip.id,'skipped').weight,null);assert.equal(read(parent).available,1);
  const keeper=read(parent).players[1];assert.ok(keeper.skills.includes('handling'));
  w.tick(GAME_WEEK_MS);
  assert.equal(read(parent).available,6);
  assert.throws(()=>submit(parent,invalid),/control/);
  const wallet=w.key(parent),ticket=desk.challenge(wallet,w.origin);
  assert.deepEqual(desk.challenge(wallet,w.origin),ticket);
  const unknown=w.key(Keypair.generate());
  const unregistered=desk.challenge(unknown,w.origin);
  assert.notEqual(desk.challenge(unknown,w.origin).nonce,unregistered.nonce);
  const input={wallet,nonce:ticket.nonce,signature:w.sign(parent,trainingAccess(w.origin,wallet,ticket))};
  const post=(path,origin)=>loanApi(new Request(w.origin+'/api/loans/training'+path,{method:'POST',
    headers:{host:'localhost:4173',origin,'content-type':'application/json'},body:JSON.stringify(input)}),{training:desk});
  assert.equal((await post('','https://other.example')).status,403);
  assert.equal((await post('',w.origin)).status,200);assert.equal((await post('',w.origin)).status,403);
  assert.equal((await post('/finish',w.origin)).status,404);
});
