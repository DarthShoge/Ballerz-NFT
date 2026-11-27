import test from 'node:test';
import assert from 'node:assert/strict';
import { fork, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, openSync, closeSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, createTransferCheckedInstruction, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import { appearanceBatch, treasuryAddresses, fundTreasury } from '../src/devnet-settlement.js';
import { approveFixture } from '../src/fixture-appearance.js';
import { fixtureApi } from '../src/fixtures.js';
import { openStore } from '../src/local-store.js';
import { cancelCurrentListing, purchaseListing } from '../src/player-transfer.js';
import { signTrial, setupTransferTrial, settleTrial, submitSigned } from '../scripts/transfer-trial.mjs';

async function playFixture(store, accounts) {
  const now = Date.now();
  const worldStart = store.worldStart() ?? store.worldStart(now);
  async function call(path, method, token, body) {
    const response = await fixtureApi(new Request('http://local/api/' + path, {
      method, headers:token ? {Authorization:'Bearer ' + token} : {}, body:JSON.stringify(body)
    }), store, {worldStart, receivedAt:now, playtest:true});
    const value = await response.json();
    assert.ok(response.ok, JSON.stringify(value.error));
    return value;
  }
  const {id, key} = await call('fixtures','POST',null,{kickoffAt:now + 3_600_000});
  const path = 'fixtures/' + id;
  const home = await call(path,'GET',key);
  const away = await call(path + '/join','POST',home.invite);
  approveFixture(store, accounts, id, now);
  await call(path + '/ready','POST',key,home.defaults[0]);
  await call(path + '/ready','POST',away.key,home.defaults[1]);
  let view = await call(path + '/kickoff-now','POST',key);
  for (let i=0; i<24 && !view.result; i++) view = await call(path + '/fast-forward','POST',key);
  assert.ok(view.result?.engineVersion);
  return {id, homeKey:key};
}

test('matchday payouts against a fresh Solana validator', {timeout:540_000}, async t => {
  const world = mkdtempSync(join(tmpdir(), 'ballerz-payouts-'));
  const payer = Keypair.generate();
  const clubKeys = [Keypair.generate(), Keypair.generate()];
  const accounts = await treasuryAddresses(payer.publicKey, clubKeys.map(key => key.publicKey));
  writeFileSync(join(world,'payer.json'), JSON.stringify([...payer.secretKey]), {mode:0o600});
  const port = randomInt(18000,28000);
  const rpc = new Connection('http://127.0.0.1:' + port, 'finalized');
  const log = openSync(join(world,'validator.out'),'w');
  const programs = process.env.SOLANA_TEST_PROGRAM_DIR;
  const validator = spawn(process.env.SOLANA_TEST_VALIDATOR || 'solana-test-validator', [
    '--ledger',join(world,'ledger'),'--bind-address','127.0.0.1','--rpc-port',String(port),
    '--faucet-port',String(port+2),'--gossip-port',String(port+3),
    '--dynamic-port-range',(port+4)+'-'+(port+40),'--mint',payer.publicKey.toBase58(),'--quiet',
    '--bpf-program',TOKEN_PROGRAM_ID.toBase58(),join(programs,'spl_token.so'),
    '--bpf-program',ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),join(programs,'spl_associated_token_account.so'),
    '--bpf-program','MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',join(programs,'spl_memo.so')
  ], {stdio:['ignore',log,log]});
  closeSync(log);
  const stopped = once(validator,'close');
  stopped.catch(() => {});
  const store = openStore(join(world,'fixtures.sqlite'));
  const children = new Set();
  t.after(async () => {
    for (const child of children) child.kill();
    store.close();
    // web3.js keeps the confirmation socket alive briefly after the final
    // signature. Disconnect it before taking its validator offline.
    rpc._rpcWebSocket.setAutoReconnect(false);
    rpc._rpcWebSocket.close();
    validator.kill('SIGTERM');
    await stopped.catch(() => {});
    rmSync(world,{recursive:true,force:true});
  });
  for (let attempt=0;;attempt++) {
    if (validator.exitCode !== null || validator.signalCode || !validator.pid || attempt >= 120) {
      throw new Error('Local validator failed to start: ' + readFileSync(join(world,'validator.out'),'utf8').slice(-1500));
    }
    try {
      if (await rpc.getSlot('finalized') >= 2 && await rpc.getBalance(payer.publicKey,'finalized') > 1_000_000_000) break;
    } catch {}
    await delay(500);
  }
  for (const key of [TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID]) {
    assert.ok((await rpc.getAccountInfo(key,'finalized'))?.executable, 'Missing executable program ' + key.toBase58());
  }
  await fundTreasury(rpc,payer,accounts);
  async function balances() {
    return Promise.all([accounts.vault,...accounts.clubs].map(async key =>
      BigInt((await rpc.getTokenAccountBalance(key,'finalized')).value.amount)));
  }
  function worker(id, mode) {
    const child = fork(new URL('./payout-worker.mjs',import.meta.url),[world,String(port),id,mode]);
    children.add(child);
    let result;
    child.on('message', message => { if (message.result) result = message.result; });
    const done = once(child,'exit').then(([code]) => { children.delete(child); return {code,result}; });
    return {child,done};
  }
  async function markerFor(id) {
    return appearanceBatch(id,JSON.parse(store.read(id).state),payer.publicKey,accounts,
      await rpc.getMinimumBalanceForRentExemption(0));
  }

  await t.test('recover the original payment after a process dies before the SQLite write', async () => {
    const {id,homeKey} = await playFixture(store,accounts);
    assert.deepEqual(await balances(),[160000n,0n,0n]);
    assert.equal((await worker(id,'crash').done).code,86);
    assert.equal(JSON.parse(store.read(id).state).appearanceReceipt,undefined);
    const {marker} = await markerFor(id);
    const history = await rpc.getSignaturesForAddress(marker,{},'finalized');
    assert.equal(history.filter(entry => !entry.err).length,1);
    const recovered = await worker(id,'recover').done;
    assert.equal(recovered.code,0);
    assert.equal(recovered.result.status,'already paid');
    assert.equal(recovered.result.signature,history[0].signature);
    assert.equal(JSON.parse(store.read(id).state).appearanceReceipt.signature,history[0].signature);
    const report = await fixtureApi(new Request('http://local/api/fixtures/' + id,{
      headers:{Authorization:'Bearer ' + homeKey}
    }),store,{worldStart:store.worldStart()});
    assert.equal(report.status,200);
    assert.equal((await report.json()).appearanceReceipt.signature,history[0].signature);
    assert.deepEqual(await balances(),[144000n,8000n,8000n]);
  });

  await t.test('two workers with different blockhashes race for the next fixture', async () => {
    const {id} = await playFixture(store,accounts);
    function signed(worker) {
      return Promise.race([once(worker.child,'message'),worker.done.then(({code}) => {
        throw new Error('Worker exited before the submission barrier with code ' + code);
      })]);
    }
    const first = worker(id,'race');
    const [a] = await signed(first);
    while ((await rpc.getLatestBlockhash('finalized')).blockhash === a.ready) await delay(150);
    const second = worker(id,'race');
    const [b] = await signed(second);
    assert.ok(a.ready && b.ready && a.ready !== b.ready);
    first.child.send('submit');
    second.child.send('submit');
    const results = await Promise.all([first.done,second.done]);
    assert.deepEqual(results.map(r => r.code),[0,0]);
    assert.deepEqual(results.map(r => r.result.status).sort(),['already paid','paid']);
    assert.equal(results[0].result.signature,results[1].result.signature);
    const {marker} = await markerFor(id);
    assert.equal((await rpc.getSignaturesForAddress(marker,{},'finalized')).filter(entry => !entry.err).length,1);
    assert.deepEqual(await balances(),[128000n,16000n,16000n]);
  });

  await t.test('a failed second transfer rolls back the entire batch and a funded retry pays once', async () => {
    const {id} = await playFixture(store,accounts);
    const {transaction,marker} = await markerFor(id);
    // Park BB in a separate token account so neither club receives a setup transfer.
    const reserveKey = Keypair.generate();
    const reserve = await getOrCreateAssociatedTokenAccount(rpc,payer,accounts.mint,reserveKey.publicKey);
    async function move(source,destination,authority,amount) {
      await sendAndConfirmTransaction(rpc,new Transaction().add(createTransferCheckedInstruction(
        source,accounts.mint,destination,authority.publicKey,amount,0)),authority === payer ? [payer] : [payer,authority],
        {commitment:'finalized'});
    }
    await move(accounts.vault,reserve.address,payer,120000n);
    const before = await balances();
    assert.deepEqual(before,[8000n,16000n,16000n]);
    const block = await rpc.getLatestBlockhash('confirmed');
    transaction.feePayer=payer.publicKey;
    transaction.recentBlockhash=block.blockhash;
    transaction.sign(payer);
    const signature = await rpc.sendRawTransaction(transaction.serialize(),{skipPreflight:true});
    const confirmation = await rpc.confirmTransaction({...block,signature},'finalized');
    assert.deepEqual(confirmation.value.err,{InstructionError:[2,{Custom:1}]});
    assert.deepEqual(await balances(),before);
    assert.equal(await rpc.getAccountInfo(marker,'finalized'),null);
    assert.equal(JSON.parse(store.read(id).state).appearanceReceipt,undefined);
    await move(reserve.address,accounts.vault,reserveKey,8000n);
    const paid = await worker(id,'recover').done;
    assert.equal(paid.result.status,'paid');
    const retry = await worker(id,'recover').done;
    assert.equal(retry.result.signature,paid.result.signature);
    assert.deepEqual(await balances(),[0n,24000n,24000n]);
  });

  await t.test('a cancelled listing and losing buyer move no funds; the winner receives the only title', async () => {
    const [seller,buyer] = clubKeys;
    const other = Keypair.generate();
    const assets = await setupTransferTrial(rpc,payer,seller.publicKey,[buyer.publicKey,other.publicKey]);
    const cancelled = await signTrial(rpc,payer,seller,buyer,assets);
    await submitSigned(rpc,cancelled.publication,cancelled.listing);
    const revoke = new Transaction().add(cancelCurrentListing(cancelled.listing));
    await sendAndConfirmTransaction(rpc,revoke,[payer,seller],{commitment:'finalized'});
    await assert.rejects(submitSigned(rpc,cancelled.purchase,cancelled.listing),/simulation failed/i);
    const fresh = await signTrial(rpc,payer,seller,buyer,assets);
    await submitSigned(rpc,fresh.publication,fresh.listing);
    const rival = purchaseListing(fresh.listing,other.publicKey);
    rival.sign(payer,seller,other);
    const offers = [fresh,{...fresh,buyer:other.publicKey,purchase:rival.serialize().toString('base64')}];
    const outcomes = await Promise.allSettled(offers.map(offer => settleTrial(rpc,offer)));
    assert.equal(outcomes.filter(o => o.status === 'fulfilled').length,1);
    const won = outcomes.findIndex(o => o.status === 'fulfilled');
    const receipt = outcomes[won].value;
    assert.equal(receipt.buyerBB.after,'0');
    assert.equal(receipt.sellerBB.after,'100000');
    assert.equal(receipt.wageReserve.after,'30000');
    assert.equal(receipt.buyerTitle.after,'1');
    assert.equal(receipt.sellerTitle.after,'0');
    const loser = getAssociatedTokenAddressSync(assets.bbMint,offers[1-won].buyer);
    assert.equal((await rpc.getTokenAccountBalance(loser,'finalized')).value.amount,'130000');
    assert.deepEqual(await settleTrial(rpc,offers[won]),receipt);
  });
});
