import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Keypair } from '@solana/web3.js';
import { ed25519 } from '@noble/curves/ed25519';
import { buyerMessage } from '../public/buyer-message.js';
import { buyerReviewApi,reviewedSportingTerms } from '../src/buyer-review.js';
import { loanAgreements } from '../src/loan-agreements.js';
import { openStore } from '../src/local-store.js';

test('only the intended manager can acknowledge current, verified resale obligations',async t=>{
  const root=mkdtempSync(join(tmpdir(),'buyer-review-')), file=join(root,'fixtures.sqlite');
  const store=openStore(file), db=new DatabaseSync(file);
  t.after(()=>{db.close();store.close();rmSync(root,{recursive:true,force:true});});
  const [seller,buyer,other]=Array.from({length:3},()=>Keypair.generate());
  const owner=String(seller.publicKey),wallet=String(buyer.publicKey),mint='pilot-mint',now=Date.now();
  const config={players:{[mint]:'northbank-7'},genesis:'network',bbMint:'BB',sponsor:'sponsor',wallets:{[wallet]:'northbank'}};
  const desk=loanAgreements(db,null,()=>config,()=>now),reviews=desk.buyers;
  const read=()=>reviews.list()[0].report;
  const signature=(report,key=buyer,address=wallet)=>Buffer.from(ed25519.sign(Buffer.from(buyerMessage(report,address)),
    key.secretKey.slice(0,32))).toString('base64');
  const record=remaining=>reviews.record({mint,remaining});
  const quote=()=>reviewedSportingTerms(file,{playerMint:mint,seller:owner,bbMint:'BB',sponsor:'sponsor'},wallet,'network');
  const acknowledge=(sig,who=wallet)=>reviews.acknowledge({mint,wallet:who,signature:sig});
  store.registration.observe({reference:'sale',mint,bb:'BB',player:'northbank-7',buyer:'eastport',seller:'northbank',
    genesis:'network',sponsor:'sponsor',terms:{buyer:owner}});
  assert.deepEqual(reviews.list(),[]);
  store.registration.finalize('sale',{slot:1,position:0,effectiveAt:now-100},()=>now);
  const loan=(id,start,end,confirmed)=>db.prepare(`INSERT INTO loan_agreements
    (id,mint,startAt,endAt,terms,checkedSlot,parentSignature,borrowerSignature,confirmedAt,ownershipSlot)
    VALUES(?,?,?,?,?,1,'private-seller','private-borrower',?,1)`).run(id,mint,start,end,
      JSON.stringify({borrower:'northbank',borrowerWageBps:7500,parentWageBps:2500}),confirmed?start-1:null);
  loan('private-current',now-10,now+10000000,true);
  loan('private-proposal',now+10000000,now+20000000,false);
  loan('private-ended',now-30,now-20,true);
  loan('private-held',now-20,now-10,true);
  db.prepare("INSERT INTO sporting_loan_holds VALUES('private-held','fixture')").run();
  assert.equal(read().suspension,null);
  assert.deepEqual(read().loans.map(l=>l.returnPending),[true,false]);
  assert.ok(!JSON.stringify(read()).includes('private-'));
  assert.throws(()=>acknowledge(signature(read())),/needs verification/);
  const first=record(2);
  assert.deepEqual(record(2),first);
  const old=signature(read());
  for (const key of [seller,other]) {
    const who=String(key.publicKey);
    assert.throws(()=>acknowledge(signature(read(),key,who),who),/buyer must sign/);
  }
  assert.throws(()=>acknowledge(signature(read(),other)),/buyer must sign/);
  const approval=acknowledge(old);
  assert.deepEqual(acknowledge(old),approval);
  assert.equal(quote().disclosures,approval.digest);
  db.prepare("DELETE FROM sporting_loan_holds WHERE agreement='private-held'").run();
  assert.throws(quote,/acknowledge/);
  record(1);record(2);
  assert.throws(()=>acknowledge(old),/buyer must sign/);
  const approved=acknowledge(signature(read()));
  db.prepare('INSERT INTO fixtures VALUES(?,1,?)').run('friendly',JSON.stringify({result:{}}));
  assert.equal(quote().disclosures,approved.digest);
  db.prepare('INSERT INTO fixtures VALUES(?,1,?)').run('official',JSON.stringify({result:{},appearanceApproval:{}}));
  assert.equal(read().suspension,null);
  assert.throws(quote,/acknowledge/);
  assert.equal(record(0).remaining,0);
  const response=await buyerReviewApi(new Request('http://localhost/api/buyer-reviews/acknowledge',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({mint,wallet,signature:old,remaining:0})}),desk);
  assert.equal(response.status,400);
  assert.equal((await buyerReviewApi(new Request('http://localhost/api/buyer-reviews/record',{method:'POST'}),desk)).status,404);
});
