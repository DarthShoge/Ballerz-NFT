import { openLoanDesk } from '../src/loan-desk.js';

const [file,mint,count]=process.argv.slice(2);
if (!file || !mint || !/^\d+$/.test(count ?? '')) throw Error('Use record-suspension.mjs operator.json playerMint remainingMatches.');
const desk=openLoanDesk(file);
try { console.log(JSON.stringify(desk.buyers.record({mint,remaining:Number(count)}))); }
finally { desk.close(); }
