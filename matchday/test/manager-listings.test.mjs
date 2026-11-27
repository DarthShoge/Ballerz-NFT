import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import * as web3 from '@solana/web3.js';
import { reviewedListing } from '../public/reviewed-listing.js';
import { AccountLayout, MintLayout, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { openListingDesk, listingApi } from '../src/manager-listings.js';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('seller approval is bound to terms, title, network, revision and the last valid block',async t=>{
  const sponsor=Keypair.generate(), seller=Keypair.generate();
  const mint=await PublicKey.createWithSeed(sponsor.publicKey,'ballerz-transfer-winger-v1',TOKEN_PROGRAM_ID);
  const ata=getAssociatedTokenAddressSync(mint,seller.publicKey);
  let height=90, owned=true, status=null, delegate;
  const wires=new Set();
  const blockhash=Keypair.generate().publicKey.toBase58();
  function data(layout,fields) {
    const bytes=Buffer.alloc(layout.span);const defaults=layout.decode(bytes);
    layout.encode({...defaults,...fields},bytes);return {owner:TOKEN_PROGRAM_ID,data:bytes};
  }
  const rpc={
    getGenesisHash:async()=>'local',getBlockHeight:async()=>height,
    getLatestBlockhash:async()=>({blockhash,lastValidBlockHeight:height+10}),
    getMinimumBalanceForRentExemption:async()=>1234,
    getSignatureStatuses:async()=>({value:[status]}),
    sendRawTransaction:async wire=>wires.add(wire.toString('base64')),
    getAccountInfo:async key=>key.equals(mint)?data(MintLayout,{supply:1n,isInitialized:true}):
      owned && key.equals(ata)?data(AccountLayout,{mint,owner:seller.publicKey,amount:1n,state:1,
        ...(delegate && {delegate,delegateOption:1,delegatedAmount:1n})}):null
  };
  await assert.rejects(openListingDesk(rpc,sponsor,':memory:','wrong'),/network/);
  const desk=await openListingDesk(rpc,sponsor,':memory:','local',3);t.after(()=>desk.close());
  const terms={action:'list',seller:seller.publicKey.toBase58(),price:100000,revision:0};
  async function signed() {
    const packet=await desk.prepare(terms);
    const tx=Transaction.from(Buffer.from(packet.quote.wire,'base64'));
    tx.partialSign(seller);
    return {...packet,signed:tx.serialize({requireAllSignatures:false}).toString('base64')};
  }
  const a=await signed(),b=await signed();
  const market=await desk.view(terms.seller);
  await reviewedListing(web3,a.quote,market,terms);
  await assert.rejects(reviewedListing(web3,a.quote,market,{...terms,price:1}),/reviewed/);
  await assert.rejects(reviewedListing(web3,{...a.quote,wire:b.quote.wire},market,terms),/reviewed/);
  assert.equal(a.quote.net,100000);assert.equal(a.quote.total,130000);
  owned=false;await assert.rejects(desk.approve(a),/Ownership/);owned=true;
  height=101;await assert.rejects(desk.approve(a),/expiry/);
  height=100;
  const [first,second]=await Promise.allSettled([desk.approve(a),desk.approve(b)]);
  assert.equal([first,second].filter(x=>x.status==='fulfilled').length,1);
  assert.equal(wires.size,1);
  height=101;
  status={confirmationStatus:'confirmed',err:null};
  assert.equal((await desk.view()).last.state,'pending');
  status=null;
  assert.equal((await desk.view()).last.state,'expired');
  assert.equal((await desk.view()).active,null);
  assert.equal(wires.size,1);
  terms.revision=(await desk.view()).revision;
  const publish=await signed();await desk.approve(publish);
  delegate=new PublicKey(publish.quote.version);
  status={confirmationStatus:'finalized',err:null};
  height=publish.quote.expiry+1;
  const expired=await desk.view(terms.seller);
  assert.equal(expired.active,null);assert.equal(expired.delegated.version,publish.quote.version);
  await assert.rejects(desk.prepare({...terms,revision:expired.revision}),/budget/);
  const cancelIntent={...terms,action:'cancel',revision:expired.revision};
  const revoke=await desk.prepare(cancelIntent);
  const cancelTx=await reviewedListing(web3,revoke.quote,expired,cancelIntent);
  cancelTx.partialSign(seller);
  await desk.approve({...revoke,signed:cancelTx.serialize({requireAllSignatures:false}).toString('base64')});
  assert.equal((await desk.view()).last.action,'cancel');
});

test('an unconfigured market reports its availability to the manager',async()=>{
  assert.equal((await listingApi(new Request('http://local/api/listings'),null)).status,503);
});

test('match centre serves the wallet page and stays available when sponsorship is offline',{timeout:15000},async t=>{
  const server=spawn(process.execPath,[fileURLToPath(new URL('../server.js',import.meta.url))],{
    env:{...process.env,HOST:'127.0.0.1',PORT:'0',FIXTURE_DB:':memory:',BALLERZ_LISTING_SPONSOR:'missing-pilot-sponsor.json'},
    stdio:['ignore','pipe','pipe']
  });
  const stopped=once(server,'close');
  t.after(async()=>{server.kill();await stopped;});
  const [line]=await once(server.stdout,'data');
  const origin=String(line).match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  assert.match(await (await fetch(origin)).text(),/href="\/listings.html"/);
  assert.equal((await fetch(origin+'/api/listings')).status,503);
  assert.match(await (await fetch(origin+'/listings.html')).text(),/Connect seller wallet/);
  assert.match((await fetch(origin+'/vendor/solana.js')).headers.get('content-type'),/javascript/);
});
