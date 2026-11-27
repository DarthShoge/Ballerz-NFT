import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { openGrantLedger } from '../src/grant-ledger.js';
import { fixedMint, parseTrial, settleTrial, signTrial } from '../scripts/transfer-trial.mjs';

export async function grantSaleJourney(rpc,payer,world) {
  const [home,affiliate,away,treasury]=Array.from({length:4},()=>Keypair.generate());
  const bbMint=await fixedMint(rpc,payer,'grant-test-bb',[[affiliate.publicKey,180000n],[away.publicKey,400000n]]);
  const config={genesis:await rpc.getGenesisHash(),treasury:treasury.publicKey,controlGroups:new Map(
    [[home,'A'],[affiliate,'A'],[away,'B']].map(([key,group])=>[key.publicKey.toBase58(),group]))};
  const filename=join(world,'grants.sqlite');
  let ledger=openGrantLedger(filename,config);
  const sign=(seller,buyer,assets,price,wages=30000)=>{
    const reviewedTerms=ledger.quote({...assets,sponsor:payer.publicKey,seller:seller.publicKey,price,wages},buyer.publicKey);
    return signTrial(rpc,payer,seller,buyer,assets,{ledger,reviewedTerms});
  };
  try {
    const issue = async seed=>{
      const playerMint=await fixedMint(rpc,payer,seed,[[home.publicKey,1n]]);
      await ledger.register({playerMint,bbMint,sponsor:payer.publicKey,seller:home.publicKey},200000);
      return {playerMint,bbMint};
    };
    const first=await issue('grant-test-connected');
    await assert.rejects(signTrial(rpc,payer,home,affiliate,first),/ledger/);
    const reviewedTerms=ledger.quote({...first,sponsor:payer.publicKey,seller:home.publicKey,price:150000,wages:30000},affiliate.publicKey);
    await assert.rejects(signTrial(rpc,payer,home,affiliate,first,{ledger,reviewedTerms:{...reviewedTerms,carried:0}}),/Review/);
    const sale=await sign(home,affiliate,first,150000);
    await assert.rejects(sign(home,away,first,150000),/pending/);
    await assert.rejects(settleTrial(rpc,sale),/ledger/);
    // Simulate a crash between finality and the database commit. Only the
    // reserved purchase may finish, including after the process restarts.
    const crash={...ledger,finalize(){throw Error('process stopped before commit');}};
    await assert.rejects(settleTrial(rpc,sale,crash),/process stopped/);
    await assert.rejects(sign(home,away,first,150000),/pending/);
    ledger.close();
    ledger=openGrantLedger(filename,config);
    const resumed=parseTrial(ledger.pending(first.playerMint).journal);
    const receipt=await settleTrial(rpc,resumed,ledger);
    assert.deepEqual([receipt.grant.recovered,receipt.grant.carried,receipt.grant.writtenOff],[150000,50000,0]);
    assert.equal(receipt.sellerBB.after,'0');
    assert.equal(receipt.wageReserve.after,'30000');
    assert.equal(receipt.buyerTitle.after,'1');
    assert.equal(ledger.pending(first.playerMint),undefined);
    assert.deepEqual(await settleTrial(rpc,sale,ledger),receipt);

    const resale=await sign(affiliate,away,first,75000);
    const second=await settleTrial(rpc,resale,ledger);
    assert.deepEqual([second.grant.recovered,second.grant.sellerProceeds,second.grant.carried],[50000,25000,0]);
    assert.equal(second.sellerBB.after,'25000');
    assert.equal(ledger.quote({...resale.listing,seller:away.publicKey},home.publicKey).grant.claim,0);
    const clearSale=await sign(away,affiliate,first,10000,0);
    const clear=await settleTrial(rpc,clearSale,ledger);
    assert.deepEqual([clear.grant.recovered,clear.grant.sellerProceeds,clear.grant.carried],[0,10000,0]);
    // Retrying a previous owner's finalized sale cannot reopen the old claim.
    assert.deepEqual(await settleTrial(rpc,sale,ledger),receipt);
    const other=await issue('grant-test-independent');
    const independent=await sign(home,away,other,150000);
    const loss=await settleTrial(rpc,independent,ledger);
    assert.deepEqual([loss.grant.recovered,loss.grant.writtenOff,loss.grant.carried],[150000,50000,0]);
    assert.equal(ledger.quote({...independent.listing,seller:away.publicKey},home.publicKey).grant.claim,0);
    assert.equal((await rpc.getTokenAccountBalance(getAssociatedTokenAddressSync(bbMint,treasury.publicKey),'finalized')).value.amount,'350000');
  } finally {ledger.close();}
}
