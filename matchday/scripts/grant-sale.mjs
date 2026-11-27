// Operator entry point for the closed Devnet pilot. This process needs no
// signing keys. Settlement accepts the exact signed publication and purchase.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Connection, PublicKey } from '@solana/web3.js';
import { DEVNET_GENESIS } from '../src/devnet-settlement.js';
import { openGrantLedger } from '../src/grant-ledger.js';
import { parseTrial, settleTrial } from './transfer-trial.mjs';

const [action, configPath, input] = process.argv.slice(2);
if (!['register','review','settle','recover'].includes(action) || !configPath || !input)
  throw new Error('Use grant-sale.mjs register|review|settle|recover operator.json input.json (or player mint for recover).');
const read = file => readFileSync(file,'utf8');
const config = JSON.parse(read(configPath));
const rpc = new Connection(process.env.BALLERZ_DEVNET_RPC || 'https://api.devnet.solana.com','finalized');
if (await rpc.getGenesisHash()!==DEVNET_GENESIS) throw new Error('Expected Solana Devnet.');
const ledger = openGrantLedger(resolve(dirname(configPath),config.ledger),{
  genesis:DEVNET_GENESIS,treasury:new PublicKey(config.treasury),
  controlGroups:new Map(Object.entries(config.controlGroups)),reviewHolds:config.reviewHolds
});
try {
  if (action==='register' || action==='review') {
    const terms=JSON.parse(read(input));
    for (const key of ['bbMint','playerMint','sponsor','seller']) terms[key]=new PublicKey(terms[key]);
    if (action==='register') {
      await ledger.register(terms,terms.claim);
      console.log('Recorded the original funded purchase claim.');
    } else {
      console.log(JSON.stringify(ledger.quote(terms,new PublicKey(terms.buyer)),null,2));
    }
  } else {
    const journal=action==='recover' ? ledger.pending(new PublicKey(input))?.journal : read(input);
    if (!journal) throw new Error('No pending grant sale for this player.');
    console.log(JSON.stringify(await settleTrial(rpc,parseTrial(journal),ledger),null,2));
  }
} finally { ledger.close(); }
