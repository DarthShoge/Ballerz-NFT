import { connectLoanWallet } from './loan-wallet.js';
import { buyerMessage } from './buyer-message.js';

const el=id=>document.getElementById(id);
let players=[],busy=false;
const selected=()=>players.find(p=>p.report.mint===el('players').value);
const time=ms=>new Date(ms).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})+' UTC';
function render() {
  const player=selected();
  el('details').hidden=!player;
  el('refresh').disabled=busy;
  el('players').disabled=busy || !players.length;
  el('sign').disabled=busy || !player?.report.suspension;
  if (!player) return;
  const {parent,loans,suspension}=player.report;
  el('player').textContent=player.name;
  el('owner').textContent='Registered parent club · '+parent;
  el('loans').replaceChildren(...(loans.length?loans.map(loan=>
    loan.borrower+' · '+time(loan.startAt)+' to '+time(loan.endAt)+
    ' · Borrower wage share '+loan.borrowerWageBps/100+'% · Inherited parent wage share '+loan.parentWageBps/100+'%'+
    (loan.returnPending?' · Matchday return pending':'')):['No confirmed loan commitments.']).map(line=>{
      const li=document.createElement('li'); li.textContent=line; return li;
    }));
  el('discipline').textContent=suspension?suspension.remaining+' matches · Verified '+time(suspension.checkedAt):
    'Unverified. The operator must check the count before you can acknowledge these terms.';
}
async function refresh() {
  const mint=el('players').value;
  const response=await fetch('/api/buyer-reviews',{cache:'no-store'});
  const data=await response.json();
  if (!response.ok) throw Error(data.error);
  players=data;
  el('players').replaceChildren(...players.map(p=>new Option(p.name,p.report.mint)));
  if (players.some(p=>p.report.mint===mint)) el('players').value=mint;
  if (!players.length) el('status').textContent='No finalized registrations are available.';
  render();
}
async function run(action) {
  if (busy) return;
  busy=true; el('status').textContent=''; render();
  try { await action(); }
  catch (error) {players=[];el('players').replaceChildren();el('status').textContent=error.message;}
  finally {busy=false;render();}
}
el('players').onchange=()=>{el('status').textContent='';render();};
el('refresh').onclick=()=>run(refresh);
el('sign').onclick=()=>run(async()=>{
  const before=selected().report;
  const signer=await connectLoanWallet();
  await refresh();
  const report=selected()?.report;
  const message=buyerMessage(before,signer.address);
  if (!report?.suspension || message!==buyerMessage(report,signer.address)) throw Error('Sporting terms changed. Refresh the review.');
  if ([report.owner,report.sponsor].includes(signer.address)) throw Error('Connect the buying manager’s wallet.');
  const bytes=await signer.sign(new TextEncoder().encode(message));
  const response=await fetch('/api/buyer-reviews/acknowledge',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({mint:report.mint,wallet:signer.address,signature:btoa(String.fromCharCode(...bytes))})});
  const data=await response.json();
  if (!response.ok) throw Error(data.error);
  el('status').textContent='Sporting terms acknowledged for '+signer.address+'.';
});
run(refresh);
