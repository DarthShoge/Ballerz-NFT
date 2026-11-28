import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { clubLoanWages } from '../src/club-loan-wages.js';
import { indexTransfers } from '../src/registration-index.js';
import { openStore } from '../src/local-store.js';
import { GAME_YEAR_MS } from '../src/world-clock.js';

export async function refundJourney(rpc,payer,world,config,resale,purchase,exit) {
  const file=join(world,'collection.sqlite'),store=openStore(file),db=new DatabaseSync(file);
  try {
    const mint=resale.listing.bbMint,playerMint=String(resale.listing.playerMint);
    const originalBuyer=String(resale.listing.seller),bursary=purchase.grant.wageBursary.owner;
    config.players={[playerMint]:'northbank-7'};
    config.wallets[originalBuyer]='northbank';
    config.wageSettlement.collectionBudgetLamports[String(payer.publicKey)]=20000000;
    const balance=async owner=>BigInt((await rpc.getTokenAccountBalance(getAssociatedTokenAddressSync(mint,new PublicKey(owner)),'finalized')).value.amount);
    const beforeClub=await balance(originalBuyer),beforePool=await balance(payer.publicKey);
    assert.equal(await balance(bursary),0n);
    const elapsed=BigInt((exit.blockTime-purchase.blockTime)*1000);
    const rate=Number(10000n*BigInt(GAME_YEAR_MS)/elapsed);
    db.prepare('INSERT INTO player_wage_rates(mint,year,annualBB,startAt) VALUES(?,2,?,?)').run(playerMint,rate,purchase.blockTime*1000);
    const open=conn=>clubLoanWages(db,()=>config,Date.now,conn).settlement;
    const refund=()=>open(rpc).collect('northbank','refund-escrow',payer);
    assert.equal((await refund()).status,'no eligible funds');
    await indexTransfers(rpc,store.registration,config,[resale]);
    const interrupted=new Proxy(rpc,{get(target,key) {
      if (key==='confirmTransaction') return async(...args)=>{await target.confirmTransaction(...args);throw Error('Lost refund confirmation.');};
      const v=target[key];return typeof v==='function'?v.bind(target):v;
    }});
    await assert.rejects(open(interrupted).collect('northbank','refund-escrow',payer),/Lost refund confirmation/);
    const first=await refund();
    assert.deepEqual([first.status,first.source,first.recipient,first.amount],['refunded','bursary',bursary,'12000']);
    const second=await refund();
    assert.deepEqual([second.status,second.source,second.recipient,second.amount],['refunded','club',originalBuyer,'8000']);
    assert.equal((await refund()).status,'no eligible funds');
    assert.equal(await balance(bursary),12000n);
    assert.equal(await balance(originalBuyer)-beforeClub,8000n);
    assert.equal(beforePool-await balance(payer.publicKey),20000n);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM wage_refunds').get().n,2);
  } finally {db.close();store.close();}
}
