import { existsSync, linkSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Connection, Keypair, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { DEVNET_GENESIS } from '../src/devnet-settlement.js';
import { parseTrial, setupTransferTrial, settleTrial, signTrial } from './transfer-trial.mjs';

const [action] = process.argv.slice(2);
if (!['play','status'].includes(action)) throw new Error('Use play or status.');
const keyDir = process.env.BALLERZ_DEVNET_KEYS || join(process.env.LOCALAPPDATA || join(homedir(),'.local','share'),'Ballerz','matchday-devnet');
const journal = join(keyDir,'first-transfer-v1.json');
const rpc = new Connection(process.env.BALLERZ_DEVNET_RPC || 'https://api.devnet.solana.com','finalized');
if (await rpc.getGenesisHash() !== DEVNET_GENESIS) throw new Error('Expected Solana Devnet.');

if (!existsSync(journal) && action === 'play') {
  function key(name) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(join(keyDir,name+'.json'),'utf8'))));
  }
  const sponsor=key('payer'), seller=key('northbank'), buyer=key('eastport');
  const assets = await setupTransferTrial(rpc,sponsor,seller.publicKey,[buyer.publicKey]);
  const prepared = await signTrial(rpc,sponsor,seller,buyer,assets);
  // Store the exact two signed messages before publication. Concurrent calls
  // adopt the winning journal and cannot replace the offer being settled.
  const temp = journal + '.' + randomUUID();
  writeFileSync(temp,JSON.stringify(prepared),{mode:0o600,flag:'wx'});
  try { linkSync(temp,journal); } catch (e) { if (e.code !== 'EEXIST') throw e; } finally { unlinkSync(temp); }
}
if (!existsSync(journal)) throw new Error('No prepared transfer for these test clubs.');
const trial = parseTrial(readFileSync(journal,'utf8'));
const signature = bs58.encode(Transaction.from(Buffer.from(trial.purchase,'base64')).signature);
console.log('Transfer reference:',signature);
if (action === 'play') console.log(JSON.stringify(await settleTrial(rpc,trial),null,2));
else console.log(JSON.stringify((await rpc.getSignatureStatuses([signature],{searchTransactionHistory:true})).value[0],null,2));
