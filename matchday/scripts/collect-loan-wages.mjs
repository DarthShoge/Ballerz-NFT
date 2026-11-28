import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { Keypair } from '@solana/web3.js';
import { openLoanDesk } from '../src/loan-desk.js';

const [config,club,source,keyFile,watch,...extra]=process.argv.slice(2);
if (!keyFile || !['income','proceeds','reserve','refund-escrow','refund-treasury'].includes(source) || (watch && watch!=='--watch') || extra.length)
  throw Error('Use collect-loan-wages.mjs operator.json CLUB income|proceeds|reserve|refund-escrow|refund-treasury SOURCE_KEY.json [--watch].');
const signer=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keyFile,'utf8'))));
const desk=openLoanDesk(config);
try {
  do {
    try {
      const result=await desk.statements.settlement.collect(club,source,signer);
      console.log(JSON.stringify(result));
    } catch (error) {
      if (!watch) throw error;
      console.error(error.message);
    }
    if (watch) await delay(15000);
  } while (watch);
} finally {desk.close();}
