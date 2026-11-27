import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { appearanceSides } from '../src/appearance-rewards.js';
import { keepsAppearanceOnAbandonment } from '../src/match-rules.js';
import { appearanceBatch, settleAppearance, treasuryAddresses, verifyPayout } from '../src/devnet-settlement.js';

const payer = Keypair.generate();
const owners = [Keypair.generate().publicKey, Keypair.generate().publicKey];
const accounts = await treasuryAddresses(payer.publicKey, owners);
const state = {
  schedule:{deadlineAt:100}, plans:[{}, {}], receivedAt:[99, 80],
  appearanceApproval:{mint:accounts.mint.toBase58(), owners:owners.map(key => key.toBase58())},
  result:{engineVersion:13, score:[1, 0]}
};

test('scheduled final pays both sides regardless of score, and a forfeit pays only the ready side', () => {
  assert.deepEqual(appearanceSides(state), [0, 1]);
  for (const side of [0, 1]) {
    const plans = [null, null];
    plans[side] = {};
    assert.deepEqual(appearanceSides({...state, plans, result:{kind:'forfeit'}}), [side]);
  }
  assert.deepEqual(appearanceSides({...state, plans:[null,null], result:{kind:'double-forfeit'}}), []);
});

test('unfinished, friendly, AI and inconsistent results cannot be paid', () => {
  for (const change of [{result:null}, {schedule:null}, {computerAway:true}, {receivedAt:[100,90]},
    {plans:[]}, {plans:[{}]}, {result:{engineVersion:13,score:[]}}, {result:{kind:'forfeit'}},
    {result:{kind:'abandoned'}}, {result:{kind:'unknown'}}]) {
    assert.throws(() => appearanceSides({...state,...change}));
  }
});

test('abandonment eligibility uses the on-field cause for each side', () => {
  const team = players => ({players:players.map(status => status ? {[status]:true} : {})});
  const six = Array(6).fill(null);
  assert.equal(keepsAppearanceOnAbandonment(team([...six, 'injured', 'replaced'])), true);
  assert.equal(keepsAppearanceOnAbandonment(team([...six, 'dismissed'])), false);
  assert.equal(keepsAppearanceOnAbandonment(team([...six, null, 'dismissed'])), true);
  assert.deepEqual(appearanceSides({...state,result:{kind:'abandoned',abandonmentEligible:[false,true]}}), [1]);
  assert.deepEqual(appearanceSides({...state,result:{kind:'double-abandonment',abandonmentEligible:[false,false]}}), []);
});

const batch = await appearanceBatch('fixture-a', state, payer.publicKey, accounts, 1);
test('one receipt per fixture covers both clubs and is independent of eligibility and score', async () => {
  const forfeit = {...state, plans:[{},null], result:{kind:'forfeit',score:[3,0]}};
  const retry = await appearanceBatch('fixture-a', forfeit, payer.publicKey, accounts, 1);
  assert.ok(retry.marker.equals(batch.marker));
  assert.notEqual(retry.memo, batch.memo);
  assert.equal(retry.transaction.instructions.length, 4);
  assert.ok(!(await appearanceBatch('fixture-b', state, payer.publicKey, accounts, 1)).marker.equals(batch.marker));
  await assert.rejects(appearanceBatch('fixture-a', {...state,appearanceApproval:null}, payer.publicKey, accounts, 1));
});

function finalizedTransaction() {
  const address = key => key.toBase58();
  const memoProgram = batch.transaction.instructions.at(-1).programId;
  const balances = amounts => amounts.map((amount,index) => ({
    accountIndex:index + 1, mint:address(accounts.mint), owner:address([payer.publicKey,...owners][index]),
    uiTokenAmount:{amount:String(amount), decimals:0}
  }));
  const accountKeys = [payer.publicKey, accounts.vault, ...accounts.clubs].map((pubkey,i) => ({pubkey, signer:i === 0}));
  const instructions = [
    {programId:SystemProgram.programId, parsed:{type:'createAccountWithSeed',info:{
      newAccount:address(batch.marker), owner:address(memoProgram), source:address(payer.publicKey)}}},
    ...accounts.clubs.map(key => ({programId:TOKEN_PROGRAM_ID, parsed:{type:'transferChecked', info:{
      mint:address(accounts.mint), authority:address(payer.publicKey), source:address(accounts.vault),
      destination:address(key), tokenAmount:{amount:'8000'}}}})),
    {programId:memoProgram, parsed:batch.memo}
  ];
  return {slot:100, transaction:{message:{accountKeys,instructions}},
    meta:{err:null, preTokenBalances:balances([16000,0,0]), postTokenBalances:balances([0,8000,8000])}};
}

test('recovery from an existing receipt needs only finalized reads and verifies both payments', async () => {
  const rpc = {
    getMinimumBalanceForRentExemption:async () => 1,
    getAccountInfo:async () => ({owner:batch.transaction.instructions.at(-1).programId}),
    getSignaturesForAddress:async () => [{signature:'original',err:null}],
    getParsedTransaction:async () => finalizedTransaction()
  };
  const result = await settleAppearance(rpc, payer, accounts, 'fixture-a', state);
  assert.equal(result.status, 'already paid');
  assert.equal(result.signature, 'original');
  assert.deepEqual(result.payments.map(payment => payment.bb), [8000,8000]);
  rpc.getSignaturesForAddress = async () => [];
  await assert.rejects(settleAppearance(rpc, payer, accounts, 'fixture-a', state), /history is unavailable/);
  const saved = await settleAppearance(rpc, payer, accounts, 'fixture-a', {...state,appearanceReceipt:{signature:'original'}});
  assert.equal(saved.signature,'original');
});

test('a wrong club credit, unexpected recipient or mismatched result cannot verify', () => {
  const verify = tx => verifyPayout(tx, batch, accounts, payer.publicKey);
  const wrongOwner = finalizedTransaction();
  wrongOwner.meta.postTokenBalances[1].owner = owners[1].toBase58();
  assert.throws(() => verify(wrongOwner), /ownership evidence/);
  const short = finalizedTransaction();
  short.meta.postTokenBalances[2].uiTokenAmount.amount = '7999';
  assert.throws(() => verify(short), /credit mismatch/);
  const redirected = finalizedTransaction();
  redirected.transaction.message.instructions[1].parsed.info.destination = owners[1].toBase58();
  assert.throws(() => verify(redirected), /transfer mismatch/);
  const wrongResult = finalizedTransaction();
  wrongResult.transaction.message.instructions.at(-1).parsed = 'different fixture';
  assert.throws(() => verify(wrongResult), /attestation mismatch/);
});
