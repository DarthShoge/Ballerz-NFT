import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import { purchaseListing, transferTerms } from '../src/player-transfer.js';

test('the buyer approves the price and remaining wages in whole BB', () => {
  assert.deepEqual(transferTerms({price:100000,wages:30000}),{price:100000,wages:30000,total:130000});
  for (const [price,wages] of [[0,1],[2,-1],[1,0.5],[Number.MAX_SAFE_INTEGER,1]]) {
    assert.throws(() => transferTerms({price,wages}),/terms/);
  }
});

test('all parties sign the exact transfer, including expiry and wage reserve', () => {
  const [sponsor,seller,buyer,bbMint,playerMint,version] = Array.from({length:6},() => Keypair.generate());
  const listing = {sponsor:sponsor.publicKey,seller:seller.publicKey,bbMint:bbMint.publicKey,
    playerMint:playerMint.publicKey,version:version.publicKey,price:100000,wages:30000,
    blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:150};
  assert.throws(() => purchaseListing(listing,seller.publicKey),/Independent/);
  const trade = purchaseListing(listing,buyer.publicKey);
  trade.partialSign(sponsor,buyer);
  assert.equal(trade.verifySignatures(),false);
  trade.partialSign(seller);
  assert.ok(trade.verifySignatures());
  assert.ok(trade.serialize().length <= 1232);
  for (const change of [{wages:1},{price:1},{lastValidBlockHeight:500},{version:buyer.publicKey}]) {
    const changed = purchaseListing({...listing,...change},buyer.publicKey);
    assert.notDeepEqual(trade.serializeMessage(),changed.serializeMessage());
  }
});
