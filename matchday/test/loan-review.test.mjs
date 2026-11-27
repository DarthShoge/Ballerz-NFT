import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
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

test('a loan quote requires matching finalized title and cannot change sporting rights',async t=>{
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  db.exec('CREATE TABLE fixtures (id TEXT, state TEXT, version INTEGER)');
  const register=sportingRegister(db);
  const [mint,owner]=Array.from({length:2},()=>Keypair.generate().publicKey);
  const pilot={genesis:'validator',bbMint:'game-bb',sponsor:'operator'};
  const sale={...pilot,bb:pilot.bbMint,player:request.player,mint:String(mint),reference:'settled',
    seller:'northbank',buyer:'eastport',terms:{buyer:String(owner)}};
  register.observe(sale);
  let balance=1n;
  const zero=PublicKey.default;
  function account(layout,fields) {
    const data=Buffer.alloc(layout.span);
    layout.encode(fields,data);
    return {owner:TOKEN_PROGRAM_ID,data};
  }
  const rpc={getGenesisHash:async()=>pilot.genesis,getMultipleAccountsInfoAndContext:async(keys,options)=>{
    assert.deepEqual(keys,[mint,getAssociatedTokenAddressSync(mint,owner)]);
    assert.deepEqual(options,{commitment:'finalized',minContextSlot:25});
    return {context:{slot:27},value:[
      account(MintLayout,{mintAuthorityOption:0,mintAuthority:zero,supply:1n,decimals:0,isInitialized:true,
        freezeAuthorityOption:0,freezeAuthority:zero}),
      account(AccountLayout,{mint,owner,amount:balance,delegateOption:0,delegate:zero,state:1,
        isNativeOption:0,isNative:0n,delegatedAmount:0n,closeAuthorityOption:0,closeAuthority:zero})]};
  }};
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
  balance=0n;
  await assert.rejects(review(),/registered owner/);
  await assert.rejects(review({...pilot,sponsor:'different'}),/match this pilot/);
  assert.equal(changes(),before);
  balance=1n;
  const snapshot=rpc.getMultipleAccountsInfoAndContext;
  rpc.getMultipleAccountsInfoAndContext=async(...args)=>{
    const evidence=await snapshot(...args);
    register.observe({...sale,reference:'new-purchase'});
    register.finalize('new-purchase',{slot:26,position:0,effectiveAt:startAt},()=>startAt);
    return evidence;
  };
  await assert.rejects(review(),/changed during review/);
});
