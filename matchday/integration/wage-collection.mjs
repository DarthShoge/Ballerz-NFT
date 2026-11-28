import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createApproveCheckedInstruction, createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction,
  getAssociatedTokenAddressSync } from '@solana/spl-token';
import { GAME_YEAR_MS } from '../src/world-clock.js';
import { clubLoanWages } from '../src/club-loan-wages.js';

export async function collectionJourney(rpc,payer,seller,world,assets,receipt) {
  // Run a separate year-end calendar against the two real sales and signed loan.
  const original=new DatabaseSync(join(world,'loan-wage-resale.sqlite'));
  const file=join(world,'collection.sqlite');
  try {original.prepare('VACUUM INTO ?').run(file);} finally {original.close();}
  const db=new DatabaseSync(file);
  try {
    const end=receipt.blockTime*1000,epoch=end-GAME_YEAR_MS;
    const {startAt}=db.prepare('SELECT startAt FROM loan_agreements WHERE confirmedAt IS NOT NULL').get();
    const elapsed=BigInt(end-startAt), annual=Number((30100n*4n*BigInt(GAME_YEAR_MS)+elapsed-1n)/elapsed);
    db.prepare('UPDATE world_clock SET start_at=?').run(epoch);
    db.prepare('UPDATE player_wage_rates SET startAt=?,annualBB=?').run(epoch,annual);
    const mint=assets.bbMint,treasury=Keypair.generate().publicKey,payroll=Keypair.generate();
    const config={genesis:await rpc.getGenesisHash(),sponsor:String(payer.publicKey),bbMint:String(mint),
      wallets:{[seller.publicKey]:'eastport'},wageSettlement:{treasury:String(treasury),
        payroll:{eastport:String(payroll.publicKey),northbank:String(Keypair.generate().publicKey)},
        collectionBudgetLamports:{[payer.publicKey]:10000000,[payroll.publicKey]:0}}};
    const ata=owner=>getAssociatedTokenAddressSync(mint,owner);
    const send=(tx,...others)=>sendAndConfirmTransaction(rpc,tx,[payer,...others],{commitment:'finalized'});
    await send(new Transaction().add(
      SystemProgram.transfer({fromPubkey:payer.publicKey,toPubkey:payroll.publicKey,lamports:10000000}),
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey,ata(treasury),treasury,mint),
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey,ata(payroll.publicKey),payroll.publicKey,mint),
      createTransferCheckedInstruction(ata(seller.publicKey),mint,ata(payroll.publicKey),seller.publicKey,2n,0)),seller);
    const open=connection=>clubLoanWages(db,()=>config,Date.now,connection).settlement;
    const ledger=open(rpc);
    const collect=(mode,signer)=>ledger.collect('eastport',mode,signer);
    const debt=BigInt((await ledger.reconcile('eastport')).years[0].arrears);
    assert.ok(debt>=30100n);
    const manual=await ledger.prepare('eastport','2');
    assert.equal((await collect('income',payroll)).status,'awaiting manual payment');
    const signed=Transaction.from(Buffer.from(manual.unsignedTransaction,'base64'));
    signed.sign(payroll);
    const signature=await rpc.sendRawTransaction(signed.serialize());
    await rpc.confirmTransaction({signature,blockhash:signed.recentBlockhash,lastValidBlockHeight:manual.lastValidBlockHeight},'finalized');
    await ledger.reconcile('eastport',signature);
    assert.equal((await collect('proceeds',payroll)).status,'no eligible funds');
    await assert.rejects(collect('reserve',payroll),/source signer/);
    await send(new Transaction().add(createApproveCheckedInstruction(ata(seller.publicKey),mint,payroll.publicKey,
      seller.publicKey,5n,0)),seller);
    await assert.rejects(collect('proceeds',payroll),/fee and rent budget/);
    config.wageSettlement.collectionBudgetLamports[payroll.publicKey]=10000000;
    const lostReply=new Proxy(rpc,{get(target,field) {
      if (field==='confirmTransaction') return async(...args)=>{
        await target.confirmTransaction(...args);throw Error('Connection interrupted after submission.');
      };
      const value=target[field];return typeof value==='function'?value.bind(target):value;
    }});
    await assert.rejects(open(lostReply).collect('eastport','proceeds',payroll),/interrupted/);
    assert.equal((await collect('proceeds',payroll)).amount,'5');
    assert.equal((await collect('proceeds',payroll)).status,'no eligible funds');
    const rest=debt-30007n;
    await send(new Transaction().add(createTransferCheckedInstruction(ata(seller.publicKey),mint,ata(payroll.publicKey),
      seller.publicKey,rest+1n,0)),seller);
    assert.equal((await collect('income',payroll)).amount,String(rest));
    assert.equal((await collect('income',payroll)).status,'no eligible funds');
    assert.equal((await collect('reserve',payer)).amount,'30000');
    assert.equal((await collect('reserve',payer)).status,'no arrears');
    assert.equal((await collect('income',payroll)).status,'no arrears');
    assert.equal((await rpc.getTokenAccountBalance(ata(treasury),'finalized')).value.amount,String(debt));
    assert.equal((await rpc.getTokenAccountBalance(ata(payroll.publicKey),'finalized')).value.amount,'1');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM wage_collections').get().n,3);
  } finally {db.close();}
}
