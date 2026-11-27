import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair } from '@solana/web3.js';
import { fixtureApi } from '../src/fixtures.js';
import { openStore } from '../src/local-store.js';
import { DEVNET_GENESIS, fundTreasury, settleAppearance, treasuryAddresses } from '../src/devnet-settlement.js';

const [command, fixtureId] = process.argv.slice(2);
if (!['setup','play','approve','settle','wallet'].includes(command)
    || (['approve','settle'].includes(command) && !/^[0-9a-f-]{36}$/.test(fixtureId ?? ''))) {
  throw new Error('Use wallet, setup, play, approve FIXTURE_ID or settle FIXTURE_ID.');
}
const keyDir = process.env.BALLERZ_DEVNET_KEYS || join(process.env.LOCALAPPDATA || join(homedir(),'.local','share'),'Ballerz','matchday-devnet');
mkdirSync(keyDir, {recursive:true, mode:0o700});
function demoKey(name) {
  const file = join(keyDir, name + '.json');
  if (!existsSync(file)) {
    try { writeFileSync(file, JSON.stringify([...Keypair.generate().secretKey]), {flag:'wx', mode:0o600}); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(file, 'utf8'))));
}
const payer = demoKey('payer');
const accounts = await treasuryAddresses(payer.publicKey, ['northbank','eastport'].map(name => demoKey(name).publicKey));
const connection = new Connection(process.env.BALLERZ_DEVNET_RPC || 'https://api.devnet.solana.com', 'finalized');
if (await connection.getGenesisHash() !== DEVNET_GENESIS) throw new Error('RPC is not Solana Devnet.');
if (command === 'wallet') {
  console.log(JSON.stringify({payer:payer.publicKey.toBase58(), lamports:await connection.getBalance(payer.publicKey),
    mint:accounts.mint.toBase58(), clubs:accounts.owners.map(key => key.toBase58())}, null, 2));
} else if (command === 'setup') {
  await fundTreasury(connection, payer, accounts);
  console.log('Test BB treasury ready:', accounts.vault.toBase58());
} else {
  const filename = process.env.FIXTURE_DB || fileURLToPath(new URL('../data/fixtures.sqlite', import.meta.url));
  mkdirSync(dirname(filename), {recursive:true});
  const store = openStore(filename);
  try {
    if (command === 'approve') await approve(fixtureId);
    else if (command === 'settle') await settle(fixtureId);
    else await play();
  } finally { store.close(); }

  async function approve(id) {
    const row = store.read(id);
    if (!row) throw new Error('Unknown fixture.');
    const state = JSON.parse(row.state);
    const binding = {mint:accounts.mint.toBase58(), owners:accounts.owners.map(key => key.toBase58())};
    if (state.appearanceApproval) {
      if (JSON.stringify(state.appearanceApproval) !== JSON.stringify(binding)) throw new Error('Different prior approval.');
      return;
    }
    if (!state.schedule || state.computerAway || state.result || state.live || Date.now() >= state.schedule.deadlineAt)
      throw new Error('Approve a scheduled two-manager fixture before lineup lock.');
    state.appearanceApproval = binding;
    if (!store.update(id, row.version, state)) throw new Error('Fixture changed; retry approval.');
    console.log('Approved test BB for fixture', id);
  }

  async function settle(id) {
    const row = store.read(id);
    if (!row) throw new Error('Unknown fixture.');
    const state = JSON.parse(row.state);
    if (!state.appearanceApproval || !state.result) throw new Error('An approved final result is required.');
    const result = await settleAppearance(connection, payer, accounts, id, state);
    // Persist only public, verified evidence. A crash here is recoverable from the marker.
    if (!state.appearanceReceipt) {
      state.appearanceReceipt = {signature:result.signature ?? null, payments:result.payments};
      if (!store.update(id, row.version, state) && !JSON.parse(store.read(id).state).appearanceReceipt)
        throw new Error('Payment verified; retry to save the public receipt.');
    }
    console.log(JSON.stringify({...result, score:state.result.score}, null, 2));
    return result;
  }

  async function play() {
    await fundTreasury(connection, payer, accounts);
    const now = Date.now();
    const worldStart = store.worldStart() ?? store.worldStart(now);
    async function call(path, method, token, body) {
      const req = new Request('http://localhost/api/' + path, {method,
        headers:token ? {Authorization:'Bearer ' + token} : {}, body:JSON.stringify(body)});
      const response = await fixtureApi(req, store, {worldStart, playtest:true});
      const view = await response.json();
      if (!response.ok) throw new Error(view.error || 'Matchday request failed.');
      return view;
    }
    const {id, key} = await call('fixtures','POST',null,{kickoffAt:Math.max(now, worldStart) + 3_600_000});
    const path = 'fixtures/' + id;
    const homeView = await call(path,'GET',key);
    const away = await call(path + '/join','POST',homeView.invite);
    await approve(id);
    await call(path + '/ready','POST',key,homeView.defaults[0]);
    await call(path + '/ready','POST',away.key,homeView.defaults[1]);
    let view = await call(path + '/kickoff-now','POST',key);
    for (let i = 0; i < 24 && !view.result; i++) view = await call(path + '/fast-forward','POST',key);
    if (!view.result) throw new Error('Fixture has not finished.');
    console.log('Full time', id, view.result.score, 'engine', view.result.engineVersion);
    const paid = await settle(id);
    const retry = await settle(id);
    if (paid.signature !== retry.signature) throw new Error('Retry changed the settlement signature.');
  }
}
