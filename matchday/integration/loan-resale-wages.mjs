import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { ed25519 } from '@noble/curves/ed25519';
import { loanMessage } from '../public/loan-message.js';
import { loanAgreements } from '../src/loan-agreements.js';
import { openStore } from '../src/local-store.js';
import { indexTransfers } from '../src/registration-index.js';
import { GAME_YEAR_MS, GAME_WEEK_MS } from '../src/world-clock.js';

// Use the same two settled grant sales as the financial journey. The first buyer
// signs a loan before selling, and the borrower becomes the new permanent owner.
export async function verifyLoanResale(rpc,world,firstSale,receipt,parent,borrower,nextOwner,settleResale) {
  const file=join(world,'loan-wage-resale.sqlite');
  const firstTime=receipt.blockTime*1000;
  const {listing}=firstSale;
  const config={genesis:await rpc.getGenesisHash(),bbMint:String(listing.bbMint),sponsor:String(listing.sponsor),
    players:{[listing.playerMint]:'northbank-7'},loanManagers:{eastport:String(parent.publicKey),northbank:String(borrower.publicKey)},
    wallets:{[parent.publicKey]:'eastport',[borrower.publicKey]:'northbank',[nextOwner.publicKey]:'northbank'}};
  const store=openStore(file);
  const db=new DatabaseSync(file);
  try {
    store.worldStart(firstTime);
    let now=firstTime+1;
    const index=journal=>indexTransfers(rpc,store.registration,config,[journal],()=>now);
    await index(firstSale);
    const desk=loanAgreements(db,rpc,()=>config,()=>now);
    desk.publishRate({mint:String(listing.playerMint),year:1,annualBB:52000});
    const startAt=now+1, endAt=startAt+4*GAME_WEEK_MS;
    const {terms}=await desk.propose({player:'northbank-7',borrower:'northbank',borrowerWageBps:7500,startAt,endAt});
    for (const signer of [parent,borrower]) {
      const signature=ed25519.sign(Buffer.from(loanMessage(terms)),signer.secretKey.slice(0,32));
      await desk.approve(terms.id,String(signer.publicKey),Buffer.from(signature).toString('base64'));
    }
    const {resale,second}=await settleResale();
    const changedAt=second.blockTime*1000;
    assert.ok(changedAt>startAt && changedAt<endAt);
    now=endAt;
    await index(resale);
    const report=desk.get(terms.id).wages;
    const units=Object.fromEntries(report.clubs.map(r=>[r.club,BigInt(r.wholeBB)*BigInt(report.denominator)+BigInt(r.remainder)]));
    const sellerUnits=BigInt(changedAt-startAt)*52000n*2500n;
    assert.equal(units.eastport,sellerUnits);
    assert.equal(units.northbank,BigInt(endAt-startAt)*52000n*10000n-sellerUnits);
    assert.equal(report.denominator,String(BigInt(GAME_YEAR_MS)*10000n));
    await index(resale);
    assert.deepEqual(desk.get(terms.id).wages,report);
    return {resale,second};
  } finally { db.close(); store.close(); }
}
