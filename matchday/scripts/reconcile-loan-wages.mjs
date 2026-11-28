import { openLoanDesk } from '../src/loan-desk.js';

const [file,action,club,value,...extra] = process.argv.slice(2);
if (!file || !club || extra.length || !['prepare','reconcile'].includes(action) || (action==='prepare' && !value))
  throw Error('Use reconcile-loan-wages.mjs operator.json prepare CLUB WHOLE_BB or reconcile CLUB [FINALIZED_SIGNATURE].');
const desk = openLoanDesk(file);
try {
  console.log(JSON.stringify(await desk.statements.settlement[action](club,value),null,2));
} finally {desk.close();}
