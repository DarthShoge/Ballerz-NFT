import { readFileSync } from 'node:fs';
import { openLoanDesk } from '../src/loan-desk.js';

const [operatorFile, requestFile] = process.argv.slice(2);
if (!operatorFile || !requestFile) throw new Error('Use propose-loan.mjs operator.json proposed-loan.json.');
const desk = openLoanDesk(operatorFile);
try {
  const proposal = await desk.propose(JSON.parse(readFileSync(requestFile,'utf8')));
  console.log(JSON.stringify({...proposal,reviewPath:'/loans.html#'+proposal.terms.id},null,2));
} finally { desk.close(); }
