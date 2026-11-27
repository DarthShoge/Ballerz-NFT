import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Connection } from '@solana/web3.js';
import { loanNetwork } from './loan-review.js';
import { loanAgreements, LoanError } from './loan-agreements.js';

export function openLoanDesk(file, expectedDb) {
  const endpoint = process.env.BALLERZ_DEVNET_RPC || 'https://api.devnet.solana.com';
  const read = () => JSON.parse(readFileSync(file,'utf8'));
  const filename = resolve(dirname(file),read().fixtureDb);
  if (!existsSync(filename) || (expectedDb && filename !== resolve(expectedDb)))
    throw new Error('Loan approvals require the existing matchday sporting database.');
  function config() {
    const settings = read();
    if (resolve(dirname(file),settings.fixtureDb) !== filename) throw new Error('The configured sporting database changed.');
    return {...settings,genesis:loanNetwork(endpoint,settings.validatorGenesis)};
  }
  config();
  const db = new DatabaseSync(filename);
  try {
    return {...loanAgreements(db,new Connection(endpoint,'finalized'),config),close:()=>db.close()};
  } catch (error) { db.close(); throw error; }
}

export async function loanApi(request,desk) {
  const reply = (data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  if (!desk) return reply({error:'The loan desk is offline.'},503);
  const match = /^\/api\/loans\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})(\/approve)?$/.exec(new URL(request.url).pathname);
  if (!match) return reply({error:'Unknown loan agreement.'},404);
  try {
    if (!match[2] && request.method==='GET') return reply(desk.get(match[1]));
    if (!match[2] || request.method!=='POST') return reply({error:'Unsupported method.'},405);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
      return reply({error:'Expected a JSON approval.'},415);
    const body = await request.json().catch(()=>null);
    if (!body || typeof body.wallet!=='string' || typeof body.signature!=='string' || Object.keys(body).length!==2)
      return reply({error:'Submit the manager wallet and signature.'},400);
    return reply(await desk.approve(match[1],body.wallet,body.signature));
  } catch (error) {
    if (error instanceof LoanError) return reply({error:error.message},error.status);
    return reply({error:'Could not verify the current loan evidence. Refresh the agreement before retrying.'},503);
  }
}
