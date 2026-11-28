import { connectLoanWallet } from './loan-wallet.js';
import { wageStatementMessage } from './wage-statement-message.js';

const el=id=>document.getElementById(id);
const time=ms=>new Date(ms).toISOString().slice(0,16).replace('T',' ')+' UTC';
const money=row=>BigInt(row.wholeBB).toLocaleString()+' test BB'+(row.remainder==='0'?'':' plus a fraction of 1 BB');
let version=0,unwatch;
function close() {
  version++;unwatch?.();unwatch=undefined;
  for (const id of ['title','cutoff','total','lines','notice']) el(id).replaceChildren();
  el('report').hidden=true;el('open').disabled=false;
}
async function post(path,data) {
  const res=await fetch('/api/loans/wages'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const result=await res.json();if (!res.ok) throw Error(result.error);return result;
}
el('lookup').onsubmit=async event=>{
  event.preventDefault(); close();const attempt=version;
  const chosen=el('year').value;
  el('open').disabled=true;
  try {
    const signer=await connectLoanWallet();if (attempt!==version) return;
    unwatch=signer.watch(close);
    const wallet=signer.address,ticket=await post('/challenge',{wallet});if (attempt!==version) return;
    const bytes=await signer.sign(new TextEncoder().encode(wageStatementMessage(location.origin,wallet,ticket)));if (attempt!==version) return;
    const result=await post('',{wallet,nonce:ticket.nonce,signature:btoa(String.fromCharCode(...bytes)),...(chosen && {year:Number(chosen)})});
    if (attempt!==version) return;
    const club=({northbank:'Northbank Athletic',eastport:'Eastport Rovers'})[result.club] ?? result.club;
    el('title').textContent=club+' · Wage year '+result.year;
    el('cutoff').textContent='Through '+time(result.asOf)+' · Year ends '+time(result.end);
    el('total').textContent=result.total?'Total accrued · '+money(result.total):'Total awaiting a published wage rate.';
    for (const line of result.lines) {
      const li=document.createElement('li');
      li.textContent=line.name+' · '+time(line.from)+' to '+time(line.until)+' · '+line.status+(line.amount?' · '+money(line.amount):'');
      el('lines').append(li);
    }
    if (!result.lines.length) el('notice').textContent='No loan wage entries for this club in the selected year.';
    el('report').hidden=false;
  } catch(error) {if (attempt===version) el('notice').textContent=error.message;}
  finally {if (attempt===version) el('open').disabled=false;}
};
el('close').onclick=close;
window.addEventListener('pagehide',close);
