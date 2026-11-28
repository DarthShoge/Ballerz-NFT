import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Connection } from '@solana/web3.js';
import { loanNetwork } from './loan-review.js';
import { loanAgreements, LoanError } from './loan-agreements.js';
import { loanInbox } from './loan-inbox.js';
import { loanTraining } from './loan-training.js';
import { clubLoanWages } from './club-loan-wages.js';

export function openLoanDesk(file, expectedDb) {
  const endpoint = process.env.BALLERZ_DEVNET_RPC || 'https://api.devnet.solana.com';
  const read = () => JSON.parse(readFileSync(file,'utf8'));
  const filename = resolve(dirname(file),read().fixtureDb);
  if (!existsSync(filename) || (expectedDb && filename !== resolve(expectedDb)))
    throw new Error('Loan approvals require the existing matchday sporting database.');
  function config() {
    const settings = read();
    if (resolve(dirname(file),settings.fixtureDb) !== filename) throw new Error('The configured sporting database changed.');
    return {...settings,saleLedger:settings.saleLedger && resolve(dirname(file),settings.saleLedger),
      genesis:loanNetwork(endpoint,settings.validatorGenesis)};
  }
  config();
  const db = new DatabaseSync(filename);
  try {
    const rpc=new Connection(endpoint,'finalized');
    return {...loanAgreements(db,rpc,config),inbox:loanInbox(db),training:loanTraining(db,config),
      statements:clubLoanWages(db,config,Date.now,rpc),close:()=>db.close()};
  } catch (error) { db.close(); throw error; }
}

export async function loanApi(request,desk) {
  const reply = (data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  if (!desk) return reply({error:'The loan desk is offline.'},503);
  const path=new URL(request.url).pathname;
  const match = /^\/api\/loans\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})(\/approve)?$/.exec(path);
  const inbox=path==='/api/loans/inbox' || path==='/api/loans/inbox/challenge';
  const training=['/api/loans/training','/api/loans/training/challenge','/api/loans/training/order'].includes(path);
  const statements=path==='/api/loans/wages' || path==='/api/loans/wages/challenge';
  if (!match && !inbox && !training && !statements) return reply({error:'Unknown loan agreement.'},404);
  try {
    if (match && !match[2] && request.method==='GET') return reply(desk.get(match[1]));
    if ((match && !match[2]) || request.method!=='POST') return reply({error:'Unsupported method.'},405);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
      return reply({error:'Expected a JSON approval.'},415);
    const body = await request.json().catch(()=>null);
    if (inbox || training || statements) {
      const origin=request.headers.get('origin');
      if (!origin || !URL.canParse(origin) || !['http:','https:'].includes(new URL(origin).protocol) ||
        new URL(origin).origin!==origin || new URL(origin).host!==request.headers.get('host'))
        return reply({error:'Open this page on the same matchday service.'},403);
      if (training && path.endsWith('/order')) return reply(desk.training.submit(body?.order,body?.signature,origin));
      if (!body || typeof body.wallet!=='string') return reply({error:'Choose a manager wallet.'},400);
      if (statements) return reply(path.endsWith('/challenge') ? desk.statements.challenge(body.wallet,origin,body.year) : desk.statements.read(body,origin));
      if (training) return reply(path.endsWith('/challenge') ? desk.training.challenge(body.wallet,origin) : desk.training.read(body,origin));
      return reply(path.endsWith('/challenge') ? desk.inbox.challenge(body.wallet,origin) : desk.inbox.list(body,origin));
    }
    if (!body || typeof body.wallet!=='string' || typeof body.signature!=='string' || Object.keys(body).length!==2)
      return reply({error:'Submit the manager wallet and signature.'},400);
    return reply(await desk.approve(match[1],body.wallet,body.signature));
  } catch (error) {
    if (error instanceof LoanError) return reply({error:error.message},error.status);
    return reply({error:'Could not verify the current loan evidence. Refresh the agreement before retrying.'},503);
  }
}
