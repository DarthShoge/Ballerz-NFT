import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { fixedMint } from '../scripts/transfer-trial.mjs';
import { openStore } from '../src/local-store.js';
import { clubLoanWages } from '../src/club-loan-wages.js';
import { loanAgreements } from '../src/loan-agreements.js';
import { GAME_YEAR_MS } from '../src/world-clock.js';
import { ed25519 } from '@noble/curves/ed25519';
import { wageStatementMessage } from '../public/wage-statement-message.js';

export async function wagePayrollJourney(rpc,payer,world) {
  const source = Keypair.generate(), treasury = Keypair.generate().publicKey;
  const mint = await fixedMint(rpc,payer,'wage-settlement-bb',[[source.publicKey,105n],[treasury,0n]]);
  await sendAndConfirmTransaction(rpc,new Transaction().add(SystemProgram.transfer({
    fromPubkey:payer.publicKey,toPubkey:source.publicKey,lamports:2000000})),[payer],{commitment:'finalized'});
  const file = join(world,'year-end-wages.sqlite');
  const store = openStore(file);
  const epoch = Math.min(Date.now(),(await rpc.getBlockTime(await rpc.getSlot('finalized')))*1000)-GAME_YEAR_MS-10000;
  const manager = Keypair.generate(), wallet=String(manager.publicKey);
  const config = {genesis:await rpc.getGenesisHash(),sponsor:String(payer.publicKey),bbMint:String(mint),
    wallets:{[wallet]:'eastport'},loanManagers:{eastport:wallet},
    players:{winger:'northbank-7'},wageSettlement:{treasury:String(treasury),
      payroll:{eastport:String(source.publicKey),northbank:String(Keypair.generate().publicKey)}}};
  let db = new DatabaseSync(file);
  try {
    store.worldStart(epoch);
    store.registration.observe({mint:'winger',player:'northbank-7',genesis:config.genesis,bb:String(mint),
      sponsor:config.sponsor,reference:'original',seller:'northbank',buyer:'eastport',terms:{}});
    store.registration.finalize('original',{slot:1,position:0,effectiveAt:epoch-1},()=>epoch);
    const desk = loanAgreements(db,rpc,()=>config);
    desk.publishRate({mint:'winger',year:1,annualBB:100});
    const terms = {mint:'winger',player:'northbank-7',ownershipReference:'original',parent:'eastport',borrower:'northbank',
      borrowerWageBps:0,parentWageBps:10000,startAt:epoch,endAt:epoch+GAME_YEAR_MS};
    db.prepare(`INSERT INTO loan_agreements(id,mint,startAt,endAt,terms,checkedSlot,parentSignature,borrowerSignature,confirmedAt,ownershipSlot)
      VALUES('example','winger',?,?,?,1,'p','b',?,1)`).run(epoch,terms.endAt,JSON.stringify(terms),epoch-1);
    const open = () => clubLoanWages(db,()=>config,Date.now,rpc).settlement;
    let payroll = open();
    const pay = async amount => {
      const prepared = await payroll.prepare('eastport',String(amount));
      const tx = Transaction.from(Buffer.from(prepared.unsignedTransaction,'base64'));
      return sendAndConfirmTransaction(rpc,tx,[source],{commitment:'finalized'});
    };
    assert.equal((await payroll.reconcile('eastport')).years[0].arrears,'100');
    const first = await pay(40);
    await assert.rejects(payroll.reconcile('northbank',first),/authority/);
    assert.equal((await payroll.reconcile('eastport',first)).years[0].arrears,'60');
    db.close(); db = new DatabaseSync(file); payroll = open();
    assert.equal((await payroll.reconcile('eastport',first)).years[0].paid,'40');
    const second = await pay(65);
    const results = await Promise.all([payroll.reconcile('eastport',second),payroll.reconcile('eastport',second)]);
    for (const row of results) {
      assert.deepEqual(row.years,[{year:1,due:'100',paid:'100',arrears:'0'}]);
      assert.equal(row.unappliedBB,'5');
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM wage_receipts').get().n,2);
    assert.equal((await rpc.getTokenAccountBalance(getAssociatedTokenAddressSync(mint,treasury),'finalized')).value.amount,'105');
    const statements=clubLoanWages(db,()=>config,Date.now,rpc), origin='http://localhost:4173';
    const proof=statements.challenge(wallet,origin,1);
    const signature=Buffer.from(ed25519.sign(Buffer.from(wageStatementMessage(origin,wallet,proof)),
      manager.secretKey.slice(0,32))).toString('base64');
    const {settlement}=statements.read({wallet,year:1,nonce:proof.nonce,signature},origin);
    assert.equal(settlement.paid,'100');
    assert.equal(settlement.arrears,'0');
    assert.equal(settlement.slot,Math.max(...results.map(row=>row.slot)));
  } finally {db.close();store.close();}
}
