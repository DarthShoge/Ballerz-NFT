import { readFileSync } from 'node:fs';
import { openLoanDesk } from '../src/loan-desk.js';

const [operatorFile, rateFile] = process.argv.slice(2);
if (!operatorFile || !rateFile) throw Error('Use publish-wage-rate.mjs operator.json rate.json.');
const desk = openLoanDesk(operatorFile);
try {
  console.log(JSON.stringify(desk.publishRate(JSON.parse(readFileSync(rateFile,'utf8')))));
} finally { desk.close(); }
