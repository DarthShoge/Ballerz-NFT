import { getWallets } from '/vendor/wallet-standard.js';
import { connectInjected, keyOf } from './listing-wallet.js';
import { loanMessage } from './loan-message.js';

const el = id => document.getElementById(id);
const id = location.hash.slice(1);
const registry = getWallets();
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
  const wallet=registry.get().find(w=>w.name==='Solflare');
  if (wallet?.features['solana:signMessage'] && wallet.features['standard:connect']) {
    const {accounts}=await wallet.features['standard:connect'].connect();
    const account=accounts[0];
    if (!account?.chains.includes('solana:devnet')) throw Error('Select your Ballerz Devnet account in Solflare.');
    signer={address:account.address,async sign(message) {
      if (wallet.accounts[0]?.address!==account.address) throw Error('Wallet changed. Reconnect before approving.');
      const [result]=await wallet.features['solana:signMessage'].signMessage({account,message});
      if (!(result.signedMessage instanceof Uint8Array) || result.signedMessage.length!==message.length ||
          !message.every((byte,i)=>result.signedMessage[i]===byte)) throw Error('Wallet returned a different message.');
      return result.signature;
    }};
  } else {
    const injected=window.solflare;
    if (!injected?.signMessage) throw Error('Open this agreement in the browser profile with Solflare installed.');
    const address=(await connectInjected(injected)).toBase58();
    signer={address,async sign(message) {
      if (keyOf(injected.publicKey)?.toBase58()!==address) throw Error('Wallet changed. Reconnect before approving.');
      const reply=await injected.signMessage(message,'utf8');
      return reply.signature ?? reply;
    }};
  }
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
run(refresh);
