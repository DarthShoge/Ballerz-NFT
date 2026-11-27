import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
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
