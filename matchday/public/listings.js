const el = id => document.getElementById(id);
let wallet, seller, state, draft, busy=false, generation=0;
async function api(path='',body) {
  const response=await fetch('/api/listings'+path,body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {});
  const data=await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
function invalidate() { generation++; draft=null; el('approval').hidden=true; }
function availability() {
  const pending=state?.last?.state==='pending';
  el('editor').hidden=!state?.owns;
  el('cancel').hidden=!state?.active;
  for (const id of ['connect','review','cancel','sign','refresh','price']) el(id).disabled=busy;
  el('review').disabled=el('cancel').disabled=busy || pending;
}
async function refresh() {
  const current=seller;
  const result=await api(current?'?seller='+encodeURIComponent(current):'');
  if (seller!==current) return;
  state=result;
  if (draft && (draft.quote.revision!==state.revision || draft.quote.expiry<state.height || !state.owns)) invalidate();
  const offer=state.active;
  const bb=n=>n.toLocaleString('en-GB')+' test BB';
  el('market').textContent=offer?'Listed for '+bb(offer.price)+' through block '+offer.expiry: 'No active listing.';
  const last=state.last;
  el('reference').textContent=last?'Latest '+(last.action==='list'?'listing':'cancellation')+' · '+last.state+' · '+last.signature:'';
  el('account').textContent=current ? (state.owns?'Seller wallet · ':'Connected wallet does not own this player · ')+current:'';
  availability();
}
async function run(fn) {
  if (busy) return;
  busy=true; availability(); el('message').textContent='';
  try { await fn(); } catch(e) { el('message').textContent=e.message; }
  finally { busy=false; availability(); }
}
el('connect').onclick=()=>run(async()=>{
  const provider=window.phantom?.solana || window.solana;
  if (!provider?.signTransaction) throw Error('Open this page in a Solana wallet browser or connect a compatible wallet extension.');
  const {publicKey}=await provider.connect();
  if (wallet!==provider) {
    const reset=()=>{invalidate();seller=undefined;state=null;el('account').textContent='Wallet changed. Reconnect to review terms.';availability();};
    provider.on?.('accountChanged',reset); provider.on?.('disconnect',reset);
  }
  wallet=provider; seller=publicKey.toBase58(); invalidate(); await refresh();
});
el('price').oninput=invalidate;
function review(action) {
  return run(async()=>{
    invalidate(); const seq=generation;
    if (action==='list' && !el('price').reportValidity()) return;
    const packet=await api('/review',{seller,action,price:el('price').valueAsNumber,revision:state.revision});
    if (generation!==seq || wallet.publicKey?.toBase58()!==seller) throw Error('Reconnect the seller wallet.');
    draft=packet;
    const q=draft.quote, p=q.policy, bb=n=>n.toLocaleString('en-GB')+' test BB';
    const rows=[['Player',p.name],['Player mint',q.asset],['Seller',seller],['Test BB mint',state.bbMint],['Gross selling price',bb(q.price)],
      ['Commission',bb(p.commission)],['Grant recovery',bb(p.grantRecovery)],['Arrears',bb(p.arrears)],['Net to seller',bb(q.net)],
      ['Buyer wage reserve',bb(q.wages)],['Total buyer commitment',bb(q.total)],['Approval expires','After Solana block '+q.expiry+' (current block '+state.height+'). This pilot uses short-lived offers.'],
      ['Retirement risk',p.risk],['Restrictions',p.restrictions],['Fee sponsor',p.feePayer],['Listing version',q.version]];
    const list=el('terms'); list.replaceChildren();
    for (const [label,value] of rows) { const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;list.append(dt,dd); }
    el('review-title').textContent=action==='cancel'?'Cancel this listing':(state.active?'Replace the current listing':'Publish this listing');
    el('sign').textContent=action==='cancel'?'Approve cancellation in wallet':'Approve listing in wallet';
    el('approval').hidden=false;el('sign').focus();
  });
}
el('review').onclick=()=>review('list');el('cancel').onclick=()=>review('cancel');
el('sign').onclick=()=>run(async()=>{
  const packet=draft;
  if (!packet || wallet.publicKey?.toBase58()!==seller) throw Error('Reconnect and review the terms.');
  const tx=solanaWeb3.Transaction.from(Uint8Array.from(atob(packet.quote.wire),c=>c.charCodeAt(0)));
  const approved=await wallet.signTransaction(tx);
  if (packet!==draft || wallet.publicKey?.toBase58()!==seller) throw Error('Wallet or terms changed. Review again.');
  const signed=btoa(String.fromCharCode(...approved.serialize({requireAllSignatures:false})));
  const {signature}=await api('/approve',{...packet,signed});
  invalidate(); el('message').textContent='Approval recorded. Transfer reference · '+signature;await refresh();
});
el('refresh').onclick=()=>run(refresh);
setInterval(()=>{if (!busy && (state?.active || state?.last?.state==='pending' || draft)) refresh().catch(()=>{});},5000);
run(refresh);
