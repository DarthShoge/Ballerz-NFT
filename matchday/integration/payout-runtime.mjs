import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  AccountLayout, ASSOCIATED_TOKEN_PROGRAM_ID, AuthorityType, MINT_SIZE, TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction, createInitializeMint2Instruction,
  createMintToInstruction, createSetAuthorityInstruction, getAssociatedTokenAddressSync
} from '@solana/spl-token';
import { FailedTransactionMetadata, LiteSVM } from 'litesvm';
import { appearanceBatch, treasuryAddresses } from '../src/devnet-settlement.js';
import { wagePaymentInstructions } from '../src/wage-payment.js';
import { collectionTransaction } from '../src/wage-collector.js';

function payrollRuntime() {
  const svm = new LiteSVM().withSigverify(true);
  const programs = process.env.SOLANA_TEST_PROGRAM_DIR;
  for (const [key, name] of [[TOKEN_PROGRAM_ID,'spl_token'],[ASSOCIATED_TOKEN_PROGRAM_ID,'spl_associated_token_account'],
    [new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),'spl_memo']]) {
    svm.addProgramFromFile(key,join(programs,name+'.so'));
  }
  return svm;
}

test('signed payout instructions roll back together and a new blockhash cannot pay a fixture twice', async () => {
  const svm = payrollRuntime();
  const payer = Keypair.generate();
  const clubKeys = [Keypair.generate(), Keypair.generate()];
  const owners = clubKeys.map(key => key.publicKey);
  const accounts = await treasuryAddresses(payer.publicKey,owners);
  svm.airdrop(payer.publicKey,2_000_000_000n);
  function send(tx, ...additionalSigners) {
    svm.expireBlockhash();
    tx.recentBlockhash = svm.latestBlockhash();
    tx.feePayer = payer.publicKey;
    tx.sign(payer, ...additionalSigners);
    return svm.sendTransaction(tx);
  }
  function succeed(tx) {
    const result = send(tx);
    assert.ok(!(result instanceof FailedTransactionMetadata), result.toString());
  }
  function balances() {
    return [accounts.vault,...accounts.clubs].map(key => AccountLayout.decode(svm.getAccount(key).data).amount);
  }
  const setup = new Transaction().add(SystemProgram.createAccountWithSeed({
    fromPubkey:payer.publicKey, basePubkey:payer.publicKey, seed:'ballerz-test-bb-v1',
    newAccountPubkey:accounts.mint, programId:TOKEN_PROGRAM_ID, space:MINT_SIZE,
    lamports:Number(svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE)))
  }),createInitializeMint2Instruction(accounts.mint,0,payer.publicKey,null));
  for (const [i,owner] of [payer.publicKey,...owners].entries()) {
    setup.add(createAssociatedTokenAccountIdempotentInstruction(payer.publicKey,[accounts.vault,...accounts.clubs][i],owner,accounts.mint));
  }
  const topUp = () => createMintToInstruction(accounts.mint,accounts.vault,payer.publicKey,8000n);
  succeed(setup.add(topUp()));
  const state = {schedule:{deadlineAt:100},plans:[{},{}],receivedAt:[99,99],result:{engineVersion:13,score:[1,0]},
    appearanceApproval:{mint:accounts.mint.toBase58(),owners:owners.map(key => key.toBase58())}};
  const {transaction,marker} = await appearanceBatch('runtime-fixture',state,payer.publicKey,accounts,
    Number(svm.minimumBalanceForRentExemption(0n)));
  const underfunded = send(transaction);
  assert.ok(underfunded instanceof FailedTransactionMetadata);
  assert.match(underfunded.meta().logs().join('\n'),/insufficient funds/i);
  assert.equal(svm.getAccount(marker),null);
  assert.deepEqual(balances(),[8000n,0n,0n]);
  succeed(new Transaction().add(topUp()));
  succeed(transaction);
  const duplicate = send(transaction);
  assert.ok(duplicate instanceof FailedTransactionMetadata);
  assert.match(duplicate.meta().logs().join('\n'),/already in use/i);
  assert.deepEqual(balances(),[0n,8000n,8000n]);
  succeed(new Transaction().add(topUp(),topUp()));
  const changeOwner = createSetAuthorityInstruction(accounts.clubs[0],owners[0],AuthorityType.AccountOwner,owners[1]);
  const rotated = send(new Transaction().add(changeOwner),clubKeys[0]);
  assert.ok(!(rotated instanceof FailedTransactionMetadata),rotated.toString());
  const another = await appearanceBatch('next-fixture',state,payer.publicKey,accounts,
    Number(svm.minimumBalanceForRentExemption(0n)));
  assert.ok(send(another.transaction) instanceof FailedTransactionMetadata);
  assert.deepEqual(balances(),[16000n,8000n,8000n]);
  assert.equal(svm.getAccount(another.marker),null);
});

test('club payroll collections preserve balances on duplicate, underfunded and changed-owner instructions', async () => {
  const svm = payrollRuntime();
  const source = Keypair.generate(), treasury = Keypair.generate(), mint = Keypair.generate();
  svm.airdrop(source.publicKey,2_000_000_000n);
  const terms = {club:'eastport',epoch:1,genesis:'runtime',mint:String(mint.publicKey),
    sponsor:String(Keypair.generate().publicKey),payroll:String(source.publicKey),treasury:String(treasury.publicKey)};
  const [transfer] = wagePaymentInstructions(terms,1n);
  const from = transfer.keys[0].pubkey, to = transfer.keys[2].pubkey;
  function send(tx,...extra) {
    svm.expireBlockhash();
    tx.recentBlockhash=svm.latestBlockhash();tx.feePayer=source.publicKey;tx.sign(source,...extra);
    return svm.sendTransaction(tx);
  }
  const setup = new Transaction().add(SystemProgram.createAccount({fromPubkey:source.publicKey,newAccountPubkey:mint.publicKey,
    space:MINT_SIZE,lamports:Number(svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE))),programId:TOKEN_PROGRAM_ID}),
    createInitializeMint2Instruction(mint.publicKey,0,source.publicKey,null),
    createAssociatedTokenAccountIdempotentInstruction(source.publicKey,from,source.publicKey,mint.publicKey),
    createAssociatedTokenAccountIdempotentInstruction(source.publicKey,to,treasury.publicKey,mint.publicKey),
    createMintToInstruction(mint.publicKey,from,source.publicKey,80n));
  assert.ok(!(send(setup,mint) instanceof FailedTransactionMetadata));
  const pay = amount => send(new Transaction().add(...wagePaymentInstructions(terms,amount)));
  const balances = () => [from,to].map(key => AccountLayout.decode(svm.getAccount(key).data).amount);
  assert.ok(pay(100n) instanceof FailedTransactionMetadata);
  assert.deepEqual(balances(),[80n,0n]);
  assert.ok(!(pay(40n) instanceof FailedTransactionMetadata));
  assert.deepEqual(balances(),[40n,40n]);
  const claim={sale:'',income:'',holder:terms.payroll,year:0,offset:'0',amount:'5'};
  const {tx}=await collectionTransaction(terms,terms.payroll,claim,{blockhash:svm.latestBlockhash(),lastValidBlockHeight:50},
    Number(svm.minimumBalanceForRentExemption(0n)));
  assert.ok(!(send(tx) instanceof FailedTransactionMetadata));
  assert.ok(send(tx) instanceof FailedTransactionMetadata);
  assert.deepEqual(balances(),[35n,45n]);
  const rotate=createSetAuthorityInstruction(to,treasury.publicKey,AuthorityType.AccountOwner,Keypair.generate().publicKey);
  assert.ok(!(send(new Transaction().add(rotate),treasury) instanceof FailedTransactionMetadata));
  assert.ok(pay(10n) instanceof FailedTransactionMetadata);
  assert.deepEqual(balances(),[35n,45n]);
  const recipient=Keypair.generate().publicKey, destination=getAssociatedTokenAddressSync(mint.publicKey,recipient);
  const refund={sale:'original-sale',pocket:'escrow',refund:'bursary',recipient:String(recipient),
    offset:'0',holder:String(source.publicKey),year:1};
  const build=amount=>collectionTransaction({...terms,sponsor:String(source.publicKey)},String(source.publicKey),
    {...refund,amount},{blockhash:svm.latestBlockhash(),lastValidBlockHeight:60},Number(svm.minimumBalanceForRentExemption(0n)));
  const over=await build('36');
  assert.ok(send(over.tx) instanceof FailedTransactionMetadata);
  assert.equal(svm.getAccount(destination),null);
  assert.equal(svm.getAccount(over.marker),null);
  const valid=await build('20');
  assert.ok(!(send(valid.tx) instanceof FailedTransactionMetadata));
  assert.ok(send(valid.tx) instanceof FailedTransactionMetadata);
  assert.deepEqual(balances(),[15n,45n]);
  assert.equal(AccountLayout.decode(svm.getAccount(destination).data).amount,20n);
});
