import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair } from '@solana/web3.js';
import { fixtureApi } from '../src/fixtures.js';
import { openStore } from '../src/local-store.js';
import { DEVNET_GENESIS, fundTreasury, treasuryAddresses } from '../src/devnet-settlement.js';

import { approveFixture, settleFixture } from '../src/fixture-appearance.js';

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

  function approve(id) {
    approveFixture(store, accounts, id);
    console.log('Approved test BB for fixture', id);
  }

  async function settle(id) {
    const result = await settleFixture(store, connection, payer, accounts, id);
    console.log(JSON.stringify(result, null, 2));
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
