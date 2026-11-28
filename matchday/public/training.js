import { connectLoanWallet } from './loan-wallet.js';
import { trainingAccess,trainingOrder } from './training-message.js';

const el=id=>document.getElementById(id);
const club=id=>({northbank:'Northbank Athletic',eastport:'Eastport Rovers'})[id] ?? id;
const skillName=value=>value==='firstTouch'?'First touch':value[0].toUpperCase()+value.slice(1);
const time=ms=>new Date(ms).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})+' UTC';
let report,signer,unwatch,version=0,busy=false;
function close() {
  version++; unwatch?.(); unwatch=undefined; signer=report=undefined; busy=false;
  el('report').hidden=el('close').hidden=true; el('open').disabled=false;
  el('players').replaceChildren();el('sessions').replaceChildren();el('notice').textContent='';
}
async function post(suffix,data) {
  const response=await fetch('/api/loans/training'+suffix,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const body=await response.json();if (!response.ok) throw Error(body.error);return body;
}
async function sign(wallet,text) {
  const bytes=await wallet.sign(new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...bytes));
}
function render() {
  el('open').disabled=busy;
  if (!report) return;
  el('report').hidden=el('close').hidden=false;
  el('allowance').textContent=report.club?club(report.club)+' · '+report.available+' of 6 sessions available · Week starting '+time(report.week):
    'This wallet has no registered training club.';
  const player=report.players.find(p=>p.mint===el('players').value);
  el('details').hidden=!player;
  el('players').disabled=busy || !player;
  if (!player) return;
  el('control').textContent='Training controlled by '+club(player.controller)+'.';
  el('dates').textContent=player.loan?'Loan to '+club(player.loan.borrower)+' · '+time(player.loan.startAt)+' to '+time(player.loan.endAt):'';
  el('workload').textContent=player.available+' of 2 player sessions available.';
  el('book').disabled=el('skill').disabled=busy || !player.canBook || !player.available || !report.available;
  el('sessions').replaceChildren();
  for (const session of player.sessions) {
    const item=document.createElement('li');
    item.textContent=skillName(session.skill)+' · '+club(session.club)+' · '+session.status+
      (session.weight===null?'':' · '+session.weight+'% weight');
    if (session.status==='reserved' && player.canBook && session.club===report.club) {
      const cancel=document.createElement('button');cancel.textContent='Cancel reservation';cancel.disabled=busy;
      cancel.onclick=()=>order('cancel',session.id,session.skill);item.append(' ',cancel);
    }
    el('sessions').append(item);
  }
  if (!player.sessions.length) {const item=document.createElement('li');item.textContent='No sessions to show.';el('sessions').append(item);}
}
function select() {
  const player=report.players.find(p=>p.mint===el('players').value);
  el('skill').replaceChildren(...(player?.skills ?? []).map(s=>new Option(skillName(s),s)));
  render();
}
el('open').onclick=async()=>{
  close();const attempt=version;busy=true;render();
  try {
    const wallet=await connectLoanWallet();if (attempt!==version) return;
    signer=wallet;unwatch=wallet.watch(close);
    const ticket=await post('/challenge',{wallet:wallet.address});if (attempt!==version) return;
    const signature=await sign(wallet,trainingAccess(location.origin,wallet.address,ticket));if (attempt!==version) return;
    const next=await post('',{wallet:wallet.address,nonce:ticket.nonce,signature});if (attempt!==version) return;
    report=next;el('players').replaceChildren(...next.players.map(p=>new Option(p.name,p.mint)));select();
    if (!next.players.length) el('notice').textContent='No registered players or confirmed loans for this manager.';
  } catch(error) {if (attempt===version) el('notice').textContent=error.message;}
  finally {if (attempt===version) {busy=false;render();}}
};
async function order(action,id,skill) {
  if (busy) return;
  const attempt=version,player=report.players.find(p=>p.mint===el('players').value);
  const request={action,id,skill,wallet:signer.address,club:report.club,genesis:report.genesis,sponsor:report.sponsor,
    week:report.week,mint:player.mint,player:player.player,authority:player.authority};
  busy=true;render();
  try {
    const signature=await sign(signer,trainingOrder(location.origin,request));if (attempt!==version) return;
    const result=await post('/order',{order:request,signature});if (attempt!==version) return;
    close();el('notice').textContent='Session '+result.status+'. Open the report to see the current allowance.';
  } catch(error) {
    if (attempt===version) {close();el('notice').textContent=error.message+' Open the report to check the reservation before retrying.';}
  }
  finally {if (attempt===version) {busy=false;render();}}
}
el('book').onclick=()=>order('book',crypto.randomUUID(),el('skill').value);
el('players').onchange=select;el('close').onclick=close;
window.addEventListener('pagehide',close);
