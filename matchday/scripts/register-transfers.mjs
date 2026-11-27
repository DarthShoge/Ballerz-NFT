import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { Connection } from '@solana/web3.js';
import { DEVNET_GENESIS } from '../src/devnet-settlement.js';
import { openStore } from '../src/local-store.js';
import { indexTransfers } from '../src/registration-index.js';

const [file,mode]=process.argv.slice(2);
if (!file || (mode && mode!=='--watch')) throw new Error('Use register-transfers.mjs operator.json [--watch].');
const load=path=>JSON.parse(readFileSync(path,'utf8'));
const path=name=>resolve(dirname(file),name);
const endpoint=process.env.BALLERZ_DEVNET_RPC || 'https://api.devnet.solana.com';
const rpc=new Connection(endpoint,'finalized');
const local=['127.0.0.1','localhost','[::1]'].includes(new URL(endpoint).hostname);
do {
  const config=load(file);
  config.genesis=(local && config.validatorGenesis) || DEVNET_GENESIS;
  const store=openStore(path(config.fixtureDb));
  try {
    const journals=[], errors=[];
    for (const name of config.journals ?? []) {
      try { journals.push(load(path(name))); } catch (error) { errors.push(error.message); }
    }
    if (config.grantLedger) {
      let grants;
      try {
        grants=new DatabaseSync(path(config.grantLedger),{readOnly:true});
        for (const row of grants.prepare('SELECT mint,journal FROM grant_sales ORDER BY rowid').iterate())
          if (Object.hasOwn(config.players,row.mint)) journals.push(JSON.parse(row.journal));
      } catch (error) { errors.push(error.message); } finally { grants?.close(); }
    }
    await indexTransfers(rpc,store.registration,config,journals);
    if (errors.length) throw new Error(errors.join('\n'));
    if (!mode) console.log(JSON.stringify(store.registration.status(),null,2));
  } catch (error) {
    if (!mode) throw error;
    console.error(error.message);
  } finally { store.close(); }
  if (mode) await delay(15000);
} while (mode);
