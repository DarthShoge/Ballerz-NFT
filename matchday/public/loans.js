import { connectLoanWallet } from './loan-wallet.js';
import { loanMessage } from './loan-message.js';

const el = id => document.getElementById(id);
const id = location.hash.slice(1);
let agreement, signer, busy=false;
const path='/api/loans/'+encodeURIComponent(id);
async function api(suffix='',options) {
  const response=await fetch(path+suffix,options);
  const data=await response.json();
  if (!response.ok) throw Error(data.error);
  return data;
}
function render() {
  if (!agreement) return;
  const {terms,status,parentApproved,borrowerApproved}=agreement;
  el('review').hidden=false;
  el('terms').textContent=loanMessage(terms);
  el('state').textContent='Agreement '+status+' · Parent '+(parentApproved?'approved':'pending')+
    ' · Borrower '+(borrowerApproved?'approved':'pending');
  if (agreement.confirmedAt!==null)
    el('state').textContent+=' · Recorded '+new Date(agreement.confirmedAt).toISOString()+' at finalized ownership slot '+agreement.ownershipSlot+
      '. Verified match minutes on loan: '+agreement.matchMinutes+'.';
  const {rates,clubs,through}=agreement.wages;
  const list=(id,lines)=>el(id).replaceChildren(...lines.map(line=>{
    const li=document.createElement('li'); li.textContent=line; return li;
  }));
  list('rates',rates.length ? rates.map(rate=>'Year '+rate.year+' annual wage · '+rate.annualBB.toLocaleString()+' test BB') :
    ['Annual wage awaiting publication.']);
  let accrual='Accrual begins when a confirmed loan starts.';
  if (status==='superseded' || status==='expired') accrual='This proposal accrued no wages.';
  else if (clubs===null) accrual='Accrued amounts unavailable until the annual rate is published for the elapsed term.';
  else if (through>terms.startAt) accrual='Accrued through '+new Date(through).toISOString()+'. Whole test BB shown. Fractional amounts carry forward to settlement.';
  el('accrual').textContent=accrual;
  list('shares',(clubs ?? []).map(row=>row.club+' · '+BigInt(row.wholeBB).toLocaleString()+' test BB'));
  const address=signer?.address;
  el('account').textContent=address?'Connected wallet · '+address:'';
  const canApprove=(address===terms.ownerWallet && !parentApproved) || (address===terms.borrowerWallet && !borrowerApproved);
  el('sign').disabled=busy || status!=='awaiting approvals' || !canApprove;
  el('connect').disabled=el('refresh').disabled=busy;
}
async function refresh() {
  const next=await api();
  if (next.terms.id!==id) throw Error('The agreement reference changed.');
  agreement=next;
  render();
}
async function run(action) {
  if (busy) return;
  busy=true; el('message').textContent=''; render();
  try { await action(); } catch(error) { el('message').textContent=error.message; }
  finally { busy=false; render(); }
}
el('connect').onclick=()=>run(async()=>{
  signer=undefined;
  signer=await connectLoanWallet();
  await refresh();
});
el('sign').onclick=()=>run(async()=>{
  const displayed=el('terms').textContent;
  await refresh();
  if (agreement.status!=='awaiting approvals' || displayed!==loanMessage(agreement.terms))
    throw Error('The agreement changed. Review its current status.');
  const signature=await signer.sign(new TextEncoder().encode(displayed));
  if (!(signature instanceof Uint8Array) || signature.length!==64) throw Error('Invalid wallet signature.');
  agreement=await api('/approve',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({wallet:signer.address,signature:btoa(String.fromCharCode(...signature))})});
});
el('refresh').onclick=()=>run(refresh);
window.addEventListener('hashchange',()=>location.reload());
if (id) run(refresh);
else location.replace('/my-loans.html');
