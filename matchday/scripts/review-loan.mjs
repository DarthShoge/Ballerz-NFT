import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Connection } from '@solana/web3.js';
import { loanNetwork, reviewLoan } from '../src/loan-review.js';

const [operatorFile,requestFile]=process.argv.slice(2);
if (!operatorFile || !requestFile) throw new Error('Use review-loan.mjs operator.json proposed-loan.json.');
const load=file=>JSON.parse(readFileSync(file,'utf8'));
const config=load(operatorFile);
const endpoint=process.env.BALLERZ_DEVNET_RPC || 'https://api.devnet.solana.com';
config.genesis=loanNetwork(endpoint,config.validatorGenesis);
const db=new DatabaseSync(resolve(dirname(operatorFile),config.fixtureDb),{readOnly:true});
try {
  const review=await reviewLoan(db,new Connection(endpoint,'finalized'),config,load(requestFile));
  console.log(JSON.stringify(review,null,2));
} finally { db.close(); }
