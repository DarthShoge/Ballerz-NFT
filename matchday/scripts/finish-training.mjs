import { openLoanDesk } from '../src/loan-desk.js';

const [operator,id,outcome]=process.argv.slice(2);
if (!operator || !id || !['completed','skipped'].includes(outcome))
  throw Error('Use finish-training.mjs operator.json reservation-id completed|skipped.');
const desk=openLoanDesk(operator);
try { console.log(JSON.stringify(desk.training.finish(id,outcome))); }
finally {desk.close();}
