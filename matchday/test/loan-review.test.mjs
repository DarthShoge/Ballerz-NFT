import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ed25519 } from '@noble/curves/ed25519';
import { loanMessage } from '../public/loan-message.js';
import { loanAgreements } from '../src/loan-agreements.js';
import { Keypair, PublicKey } from '@solana/web3.js';
import { AccountLayout, MintLayout, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { sportingRegister } from '../src/sporting-register.js';
import { loanNetwork, loanTerms, reviewLoan } from '../src/loan-review.js';
import { DEVNET_GENESIS } from '../src/devnet-settlement.js';
import { GAME_WEEK_MS } from '../src/world-clock.js';

const startAt=Date.UTC(2027,0,1);
const request={player:'northbank-7',borrower:'northbank',startAt,endAt:startAt+4*GAME_WEEK_MS};

test('remote loan review requires TLS and pins Devnet',()=>{
  assert.equal(loanNetwork('http://127.0.0.1:8899','validator'),'validator');
  assert.equal(loanNetwork('https://example.org','validator'),DEVNET_GENESIS);
  assert.throws(()=>loanNetwork('http://example.org','validator'),/HTTPS/);
});

test('ordinary loan quotes use the published clock and conserve the wage split',()=>{
  const quote=extra=>loanTerms('eastport',{...request,...extra},startAt);
  assert.equal(quote({}).borrowerWageBps,10000);
  for (const share of [0,1,5000,9999,10000]) {
    const terms=quote({borrowerWageBps:share});
    assert.equal(terms.parentWageBps+terms.borrowerWageBps,10000);
    assert.equal(terms.trainingClubDuringLoan,'northbank');
  }
  for (const share of [null,-1,10001,0.5,'75']) assert.throws(()=>quote({borrowerWageBps:share}),/basis points/);
  for (const borrower of ['eastport','unknown']) assert.throws(()=>quote({borrower}),/different registered/);
  assert.throws(()=>quote({startAt:startAt-1}),/future loan/);
  assert.throws(()=>quote({endAt:request.endAt-1}),/four in-game weeks/);
  assert.throws(()=>quote({endAt:Infinity}),/epoch milliseconds/);
});

function pilotTitle(db) {
  db.exec('CREATE TABLE fixtures (id TEXT, state TEXT, version INTEGER)');
  const register=sportingRegister(db);
  const [parent,borrower]=[Keypair.generate(),Keypair.generate()];
  const mint=Keypair.generate().publicKey, owner=parent.publicKey;
  const pilot={genesis:'validator',bbMint:'game-bb',sponsor:'operator',players:{[mint]:request.player},
    wallets:{[owner]:'eastport',[borrower.publicKey]:'northbank'},
    loanManagers:{eastport:String(owner),northbank:String(borrower.publicKey)}};
  const sale={...pilot,bb:pilot.bbMint,player:request.player,mint:String(mint),reference:'settled',
    seller:'northbank',buyer:'eastport',terms:{buyer:String(owner)}};
  register.observe(sale);
  const holding={balance:1n,slot:27};
  const zero=PublicKey.default;
  function account(layout,fields) {
    const data=Buffer.alloc(layout.span);
    layout.encode(fields,data);
    return {owner:TOKEN_PROGRAM_ID,data};
  }
  const rpc={getGenesisHash:async()=>pilot.genesis,getMultipleAccountsInfoAndContext:async(keys,options)=>{
    assert.deepEqual(keys,[mint,getAssociatedTokenAddressSync(mint,owner)]);
    assert.equal(options.commitment,'finalized');
    assert.ok([25,27].includes(options.minContextSlot));
    return {context:{slot:holding.slot},value:[
      account(MintLayout,{mintAuthorityOption:0,mintAuthority:zero,supply:1n,decimals:0,isInitialized:true,
        freezeAuthorityOption:0,freezeAuthority:zero}),
      account(AccountLayout,{mint,owner,amount:holding.balance,delegateOption:0,delegate:zero,state:1,
        isNativeOption:0,isNative:0n,delegatedAmount:0n,closeAuthorityOption:0,closeAuthority:zero})]};
  }};
  return {rpc,register,sale,pilot,holding,parent,borrower};
}

test('a loan quote requires matching finalized title and cannot change sporting rights',async t=>{
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  const {rpc,register,sale,pilot,holding}=pilotTitle(db);
  const review=(config=pilot)=>reviewLoan(db,rpc,config,request,()=>startAt);
  await assert.rejects(review(),/finalized player registration/);
  register.finalize(sale.reference,{slot:25,position:0,effectiveAt:startAt-1},()=>startAt);
  const changes=()=>db.prepare('SELECT total_changes() AS count').get().count;
  const before=changes();
  const terms=await review();
  assert.equal(terms.status,'proposal');
  assert.equal(terms.parent,'eastport');
  assert.equal(terms.ownershipReference,sale.reference);
  assert.equal(terms.checkedSlot,27);
  holding.balance=0n;
  await assert.rejects(review(),/registered owner/);
  await assert.rejects(review({...pilot,sponsor:'different'}),/match this pilot/);
  assert.equal(changes(),before);
  holding.balance=1n;
  const snapshot=rpc.getMultipleAccountsInfoAndContext;
  rpc.getMultipleAccountsInfoAndContext=async(...args)=>{
    const evidence=await snapshot(...args);
    register.observe({...sale,reference:'new-purchase'});
    register.finalize('new-purchase',{slot:26,position:0,effectiveAt:startAt},()=>startAt);
    return evidence;
  };
  await assert.rejects(review(),/changed during review/);
});

test('two designated managers approve one immutable revision and activate once across connections',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'ballerz-loan-'));
  const file=join(directory,'sporting.sqlite');
  const db=new DatabaseSync(file), other=new DatabaseSync(file);
  try {
    const {rpc,register,sale,pilot,holding,parent,borrower}=pilotTitle(db);
    let now=startAt-1000;
    register.finalize(sale.reference,{slot:25,position:0,effectiveAt:now},()=>now);
    const desk=loanAgreements(db,rpc,()=>pilot,()=>now);
    const peer=loanAgreements(other,rpc,()=>pilot,()=>now);
    const signature=(terms,signer)=>Buffer.from(ed25519.sign(Buffer.from(loanMessage(terms)),signer.secretKey.slice(0,32))).toString('base64');
    const approve=(connection,terms,signer)=>connection.approve(terms.id,String(signer.publicKey),signature(terms,signer));
    await assert.rejects(desk.propose({...request,recall:true}),/supported ordinary loan terms/);
    const priorManager=Keypair.generate().publicKey.toBase58();
    register.observe({...sale,reference:'other-sale',terms:{buyer:priorManager}});
    pilot.loanManagers.northbank=priorManager;
    pilot.wallets[priorManager]='northbank';
    await assert.rejects(desk.propose(request),/wallets/);
    pilot.loanManagers.northbank=String(borrower.publicKey);
    const initial=(await desk.propose(request)).terms;
    assert.equal((await peer.propose(request)).terms.id,initial.id);
    const one=await approve(desk,initial,borrower);
    assert.equal(one.borrowerApproved,true);
    assert.equal(one.confirmedAt,null);
    assert.throws(()=>register.observe({...sale,reference:'reassigned-manager',terms:{buyer:String(borrower.publicKey)}}),/club mapping/);
    const revised=(await desk.propose({...request,borrowerWageBps:6500})).terms;
    assert.equal(peer.get(initial.id).status,'superseded');
    await assert.rejects(approve(peer,initial,parent),/replaced/);
    await assert.rejects(peer.approve(revised.id,String(borrower.publicKey),signature(initial,borrower)),/signature/);
    await assert.rejects(approve(peer,revised,Keypair.generate()),/designated manager/);
    await assert.rejects(peer.approve(revised.id,String(parent.publicKey),signature(revised,borrower)),/signature/);
    for (const patch of [{borrowerWageBps:1},{endAt:request.endAt+1},{genesis:'another cluster'},
      {ownerWallet:String(borrower.publicKey)},{ownershipReference:'different'}]) {
      await assert.rejects(peer.approve(revised.id,String(parent.publicKey),signature({...revised,...patch},parent)),/signature/);
    }
    await approve(desk,revised,parent);
    holding.balance=0n;
    await assert.rejects(approve(peer,revised,borrower),/registered owner/);
    holding.balance=1n;
    holding.slot=26;
    await assert.rejects(approve(peer,revised,borrower),/registered owner/);
    holding.slot=27;
    pilot.loanManagers.eastport=String(Keypair.generate().publicKey);
    await assert.rejects(approve(peer,revised,borrower),/wallets/);
    pilot.loanManagers.eastport=String(parent.publicKey);
    assert.equal(desk.get(revised.id).borrowerApproved,false);
    db.exec(`CREATE TABLE activations(id TEXT UNIQUE);
      CREATE TRIGGER count_activations AFTER UPDATE OF confirmedAt ON loan_agreements
      BEGIN INSERT INTO activations VALUES(NEW.id); END;`);
    const [a,b]=await Promise.all([approve(peer,revised,borrower),approve(desk,revised,borrower)]);
    assert.deepEqual(a,b);
    assert.equal(a.ownershipSlot,27);
    assert.equal(a.status,'scheduled');
    assert.equal(a.confirmedAt,now);
    assert.equal(db.prepare('SELECT count(*) AS n FROM activations').get().n,1);
    await assert.rejects(desk.propose(request),/already has an agreement/);
    const following=(await desk.propose({...request,startAt:request.endAt,endAt:request.endAt+4*GAME_WEEK_MS})).terms;
    const later=(await desk.propose({...request,startAt:following.endAt,endAt:following.endAt+4*GAME_WEEK_MS})).terms;
    await Promise.all([approve(peer,later,parent),approve(desk,later,borrower)]);
    assert.equal(peer.get(later.id).status,'scheduled');
    assert.equal(db.prepare('SELECT count(*) AS n FROM activations WHERE id=?').get(later.id).n,1);
    now=startAt;
    assert.equal(peer.get(revised.id).status,'active');
    now=request.endAt;
    assert.equal((await approve(peer,revised,parent)).status,'ended');
    await assert.rejects(approve(peer,following,borrower),/deadline/);
    assert.equal(peer.get(following.id).status,'expired');
  } finally {other.close();db.close();rmSync(directory,{recursive:true,force:true});}
});
