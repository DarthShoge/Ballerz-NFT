import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, PublicKey } from '@solana/web3.js';
import { AccountLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { settleTrial, signTrial } from '../scripts/transfer-trial.mjs';
import { grantSettlement, purchaseListing } from '../src/player-transfer.js';
import { openGrantLedger } from '../src/grant-ledger.js';

test('purchase grant splits conserve both the price and the original claim in whole BB',()=>{
  for (const [price,claim] of [[150000,200000],[200000,150000],[150000,150000],[1,0],[1,Number.MAX_SAFE_INTEGER]]) {
    for (const relationship of ['connected','independent']) {
      const {recovered,sellerProceeds,carried,writtenOff}=grantSettlement(price,claim,relationship);
      assert.equal(recovered,Math.min(price,claim));
      assert.equal(recovered+sellerProceeds,price);
      assert.equal(recovered+carried+writtenOff,claim);
      assert.equal(relationship==='connected'?writtenOff:carried,0);
    }
  }
  for (const args of [[0,1,'connected'],[1,-1,'independent'],[2,1.5,'connected'],[1,1,'unknown']])
    assert.throws(()=>grantSettlement(...args));
});

test('an uncertain purchase keeps its reservation until finalized expiry and seller title agree',async t=>{
  const [payer,home,away]=Array.from({length:3},()=>Keypair.generate());
  const [bbMint,playerMint,treasury,block]=Array.from({length:4},()=>Keypair.generate().publicKey);
  const ledger=openGrantLedger(':memory:',{genesis:'local',treasury,controlGroups:new Map(
    [[home.publicKey.toBase58(),'A'],[away.publicKey.toBase58(),'B']])});
  t.after(()=>ledger.close());
  const terms={bbMint,playerMint,seller:home.publicKey,sponsor:payer.publicKey,price:150000,wages:30000};
  await ledger.register(terms,200000);
  let height=20, amount=1n;
  const rpc={
    getGenesisHash:async()=>'local',
    getMinimumBalanceForRentExemption:async()=>2500000,
    getLatestBlockhash:async()=>({blockhash:block.toBase58(),lastValidBlockHeight:20}),
    getTransaction:async()=>null,
    getSignatureStatuses:async()=>({value:[null]}),
    isBlockhashValid:async()=>({value:false}),
    getBlockHeight:async()=>height,
    getAccountInfo:async()=>{
      const data=Buffer.alloc(AccountLayout.span);
      AccountLayout.encode({mint:playerMint,owner:home.publicKey,amount,state:1,
        delegateOption:0,delegate:PublicKey.default,isNativeOption:0,isNative:0n,
        delegatedAmount:0n,closeAuthorityOption:0,closeAuthority:PublicKey.default},data);
      return {data,owner:TOKEN_PROGRAM_ID};
    }
  };
  const reviewedTerms=ledger.quote(terms,away.publicKey);
  const sale=await signTrial(rpc,payer,home,away,{bbMint,playerMint},{ledger,reviewedTerms});
  await assert.rejects(settleTrial(rpc,sale,ledger),/expired/);
  assert.ok(ledger.pending(playerMint));
  height++;
  amount=0n;
  await assert.rejects(settleTrial(rpc,sale,ledger),/expired/);
  assert.ok(ledger.pending(playerMint));
  amount=1n;
  await assert.rejects(settleTrial(rpc,sale,ledger),/expired/);
  assert.equal(ledger.pending(playerMint),undefined);
  assert.deepEqual(ledger.quote(terms,away.publicKey),reviewedTerms);
});

test('operator grants bind title, owner, currency, buyer group and treasury before approval',async t=>{
  const keys=Array.from({length:8},()=>Keypair.generate().publicKey);
  const [seller,buyer,treasury,bbMint,playerMint,sponsor,version,unknown]=keys;
  const listing={seller,bbMint,playerMint,sponsor,version,price:150000,wages:30000,
    blockhash:unknown.toBase58(),lastValidBlockHeight:513979320};
  const groups=new Map([[seller.toBase58(),'home'],[buyer.toBase58(),'home']]);
  const reviewHolds=[];
  const ledger=openGrantLedger(':memory:',{genesis:'local',treasury,controlGroups:groups,reviewHolds});
  t.after(()=>ledger.close());
  await ledger.register(listing,200000);
  await assert.rejects(ledger.register(listing,300000),/UNIQUE/);
  assert.throws(()=>ledger.quote(listing,unknown),/review/);
  assert.throws(()=>ledger.quote({...listing,bbMint:unknown},buyer),/No matching/);
  assert.throws(()=>ledger.quote({...listing,seller:unknown},buyer),/No matching/);
  const quote=ledger.quote(listing,buyer);
  assert.equal(quote.carried,50000);
  const reviewed={...listing,grant:quote.grant};
  assert.throws(()=>purchaseListing(reviewed,unknown),/buyer/);
  const wire=purchaseListing(reviewed,buyer).serializeMessage();
  groups.set(buyer.toBase58(),'away');
  const independent=ledger.quote(listing,buyer);
  assert.equal(independent.writtenOff,50000);
  assert.notDeepEqual(wire,purchaseListing({...listing,grant:independent.grant},buyer).serializeMessage());
  assert.throws(()=>ledger.reserve({listing:reviewed,buyer},'stale'),/changed/);
  reviewHolds.push({clubs:[buyer.toBase58(),seller.toBase58()],reason:'Control evidence disputed'});
  assert.throws(()=>ledger.quote(listing,buyer),/Control evidence disputed.*Appeal/);
  await assert.rejects(ledger.assertNetwork({getGenesisHash:async()=>'different'}),/network/);
});

test('bursary awards bind the original funding wallet, amount and buyer in the signed purchase',async t=>{
  const [seller,buyer,treasury,bbMint,playerMint,sponsor,version,restricted,other]=Array.from({length:9},()=>Keypair.generate().publicKey);
  const listing={seller,bbMint,playerMint,sponsor,version,price:150000,wages:30000,
    blockhash:String(other),lastValidBlockHeight:200};
  const groups=new Map([[String(seller),'east'],[String(buyer),'north']]);
  const award={playerMint:String(playerMint),buyer:String(buyer),revision:0,owner:String(restricted),bb:18000};
  const awards=[award];
  const ledger=openGrantLedger(':memory:',{genesis:'pilot',treasury,controlGroups:groups,wageBursaries:awards});
  t.after(()=>ledger.close());
  await ledger.register(listing,10000);
  const quote=()=>ledger.quote(listing,buyer);
  assert.equal(quote().buyerDebitBB,162000);
  const purchase=grant=>purchaseListing({...listing,grant,disclosures:'f'.repeat(64)},buyer);
  const wire=purchase(quote().grant).serializeMessage();
  assert.ok(purchase(quote().grant).serialize({requireAllSignatures:false}).length<=1232);
  award.bb=17999;assert.notDeepEqual(purchase(quote().grant).serializeMessage(),wire);
  award.bb=30000;assert.equal(quote().buyerDebitBB,150000);
  award.bb=30001;assert.throws(quote,/reserve/);
  award.bb=18000;award.owner=String(treasury);assert.throws(quote,/separate/);
  award.owner=String(restricted);awards.push({...award,buyer:String(other)});assert.throws(quote,/assignment/);
  awards.pop();groups.set(String(restricted),'elsewhere');assert.throws(quote,/assignment/);
});
