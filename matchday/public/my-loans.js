import { connectLoanWallet } from './loan-wallet.js';
import { inboxMessage } from './inbox-message.js';

const el=id=>document.getElementById(id);
let version=0, unsubscribe;
function closeInbox() {
  version++;
  unsubscribe?.(); unsubscribe=undefined;
  el('agreements').replaceChildren(); el('notice').textContent='';
  el('close-inbox').hidden=true; el('open').disabled=false;
}
async function post(path,data) {
  const response=await fetch('/api/loans/inbox'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const result=await response.json();
  if (!response.ok) throw Error(result.error);
  return result;
}
el('open').onclick=async()=>{
  closeInbox();
  const attempt=version;
  el('open').disabled=true;
  try {
    const signer=await connectLoanWallet();
    if (attempt!==version) return;
    unsubscribe=signer.watch(closeInbox);
    const wallet=signer.address;
    const ticket=await post('/challenge',{wallet});
    if (attempt!==version) return;
    el('notice').textContent='Verify read-only inbox access in Solflare.';
    const bytes=await signer.sign(new TextEncoder().encode(inboxMessage(location.origin,wallet,ticket)));
    if (attempt!==version) return;
    const rows=await post('',{wallet,nonce:ticket.nonce,signature:btoa(String.fromCharCode(...bytes))});
    if (attempt!==version) return;
    el('notice').textContent=rows.length?'Agreements for '+wallet:'No agreements for '+wallet+'.';
    for (const row of rows) {
      const item=document.createElement('li'), link=document.createElement('a'), detail=document.createElement('p');
      link.href='/loans.html#'+row.id; link.textContent=row.player+' · '+row.status;
      detail.textContent=row.from+' → '+row.to+' · '+row.role+' · Starts '+new Date(row.startAt).toLocaleString();
      item.append(link,detail); el('agreements').append(item);
    }
    el('close-inbox').hidden=false;
  } catch (error) { if (attempt===version) el('notice').textContent=error.message; }
  finally { if (attempt===version) el('open').disabled=false; }
};
el('open').disabled=false;
el('close-inbox').onclick=closeInbox;
window.addEventListener('pagehide',closeInbox);
el('invitation').onsubmit=event=>{
  event.preventDefault();
  const raw=el('link').value.trim();
  const url=URL.canParse(raw,location.origin)?new URL(raw,location.origin):null;
  const id=url?.origin===location.origin && url.pathname==='/loans.html'?url.hash.slice(1):raw;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) {
    el('link-error').textContent='Enter a Ballerz agreement link from this site or its reference.'; return;
  }
  location.assign('/loans.html#'+id);
};
