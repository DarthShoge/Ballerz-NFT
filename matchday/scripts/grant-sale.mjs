// Operator entry point for the closed Devnet pilot. This process needs no
// signing keys. Settlement accepts the exact signed publication and purchase.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint, getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { DEVNET_GENESIS } from '../src/devnet-settlement.js';
import { openGrantLedger } from '../src/grant-ledger.js';
import { parseTrial, settleTrial } from './transfer-trial.mjs';

const [action, configPath, input] = process.argv.slice(2);
if (!['register','review','settle','recover'].includes(action) || !configPath || !input)
  throw new Error('Use grant-sale.mjs register|review|settle|recover operator.json input.json (or player mint for recover).');
const read = file => readFileSync(file,'utf8');
const config = JSON.parse(read(configPath));
const endpoint = process.env.BALLERZ_DEVNET_RPC || 'https://api.devnet.solana.com';
const rpc = new Connection(endpoint,'finalized');
// Validator rehearsals pin their own genesis in a private local configuration.
const local = ['127.0.0.1','localhost','[::1]'].includes(new URL(endpoint).hostname);
const genesis = local && config.validatorGenesis ? config.validatorGenesis : DEVNET_GENESIS;
if (await rpc.getGenesisHash()!==genesis) throw new Error('Unexpected grant settlement network.');
const ledger = openGrantLedger(resolve(dirname(configPath),config.ledger),{
  genesis,treasury:new PublicKey(config.treasury),
  controlGroups:new Map(Object.entries(config.controlGroups)),reviewHolds:config.reviewHolds,wageBursaries:config.wageBursaries
});
try {
  if (action==='register' || action==='review') {
    const terms=JSON.parse(read(input));
    for (const key of ['bbMint','playerMint','sponsor','seller']) terms[key]=new PublicKey(terms[key]);
    if (action==='register') {
      const [mint,title,currency]=await Promise.all([
        getMint(rpc,terms.playerMint,'finalized'),
        getAccount(rpc,getAssociatedTokenAddressSync(terms.playerMint,terms.seller),'finalized'),
        getMint(rpc,terms.bbMint,'finalized')
      ]);
      if (mint.supply!==1n || mint.decimals || mint.mintAuthority || mint.freezeAuthority ||
          title.amount!==1n || !title.owner.equals(terms.seller) || !title.mint.equals(terms.playerMint) ||
          title.isFrozen || currency.decimals || terms.playerMint.equals(terms.bbMint))
        throw new Error('Expected a single fixed player title held by the registered seller and a separate whole-BB mint.');
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
