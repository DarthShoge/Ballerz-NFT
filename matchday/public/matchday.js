const app = document.querySelector("#app");
const notice = document.querySelector("#notice");
const fields = ["GK", "DF", "MF", "FW"];
const shapes = { "4-4-2": [1,4,4,2], "4-3-3": [1,4,3,3], "3-5-2": [1,3,5,2] };
const positions = {GK:"Goalkeeper",DF:"Defender",MF:"Midfielder",FW:"Forward"};
const query = new URLSearchParams(location.search);
const inviteToken = new URLSearchParams(location.hash.slice(1)).get("invite");
let id = query.get("fixture");
let model, draft, key, currentTab = "team", picked = null, invitation = "", busy = false;
let poll = null, deadline = null, revision = 0;
const memoryKey = fixture => "ballerz.fixture." + fixture;
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const side = () => model?.side ?? 0;
const active = () => Boolean(id && key && model?.id);
const locked = () => active() && model.ready[side()];
function getStored(storage, item) { try { return storage.getItem(item); } catch { return null; } }
function saveStored(storage,item,value) { try { storage.setItem(item,value); } catch { /* Current session still works when storage is unavailable. */ } }
function remember(fixture, managerKey) {
  saveStored(sessionStorage,memoryKey(fixture),managerKey);
  saveStored(localStorage,memoryKey(fixture),managerKey);
  saveStored(localStorage,"ballerz.last",fixture);
}
function toast(message, duration=4000) {
  clearTimeout(deadline); notice.textContent = message;
  if (duration) deadline = setTimeout(() => {notice.textContent="";}, duration);
}
async function api(path,{method="GET",token,body,idempotencyKey}={}) {
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(path,{method,headers,body:body ? JSON.stringify(body) : undefined,cache:"no-store"});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {const error=new Error(typeof data.error === "string" ? data.error : "The match server could not complete that request.");error.status=response.status;throw error;}
  return data;
}
const fixturePath = () => "/api/fixtures/" + encodeURIComponent(id);
function joinAttemptKey() {
  const name = "ballerz.join." + id;
  const previous = getStored(sessionStorage,name);
  if(previous) return previous;
  const value = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte=>byte.toString(16).padStart(2,"0")).join("");
  saveStored(sessionStorage,name,value);
  return value;
}
function clonePlan(plan) { return {formation:plan.formation,tactic:plan.tactic,xi:[...plan.xi]}; }
function draftKey() {return "ballerz.draft." + id + "." + side();}
function restoreDraft(base) {
  if (!active() || locked()) return clonePlan(base);
  try {
    const saved = JSON.parse(getStored(localStorage,draftKey()));
    const squad = model.clubs[side()].squad;
    if (saved && Object.hasOwn(shapes,saved.formation) && Object.hasOwn(model.tactics,saved.tactic) && Array.isArray(saved.xi) &&
        new Set(saved.xi).size === 11 && saved.xi.length === 11 && fields.every((pos,i) => squad.filter(p=>saved.xi.includes(p.id)&&p.position===pos).length===shapes[saved.formation][i])) return clonePlan(saved);
  } catch { /* A missing or old draft can use the default squad. */ }
  return clonePlan(base);
}
function persistDraft() { if (active()) saveStored(localStorage,draftKey(),JSON.stringify(draft)); }
function applyModel(next,initial=false) {
  const wasResult=Boolean(model?.result);
  model=next;
  if (initial || !draft || locked()) draft=restoreDraft(model.plans?.[side()] || model.defaults[side()]);
  if (model.result && (!wasResult || initial)) {currentTab="report";picked=null;}
  render();
}
function newLocation(fixture) {history.replaceState(null,"","?fixture="+encodeURIComponent(fixture));}
async function enterSession(session,fromLanding=false) {
  const previousDraft=fromLanding && draft ? clonePlan(draft) : null;
  id=session.id;key=session.key;remember(id,key);newLocation(id);
  const next=await api(fixturePath(),{token:key});
  currentTab="team";picked=null;invitation="";
  applyModel(next,true);
  if(previousDraft && !locked()) {draft=previousDraft;persistDraft();render();}
  startPolling();
}
function startPolling() {
  clearInterval(poll);
  if (!active() || model.result) return;
  let reading=false;
  poll=setInterval(async()=>{
    if(document.hidden || busy || reading) return;
    const start=revision;
    reading=true;
    try {
      const next=await api(fixturePath(),{token:key});
      if(!busy && revision===start && JSON.stringify(next)!==JSON.stringify(model)) applyModel(next);
      if(model.result) clearInterval(poll);
    } catch { /* The next poll retries after a connection interruption. */ }
    finally {reading=false;}
  },2000);
}
function crest(i) {const c=model.clubs[i];return '<span class="crest '+(i?'away':'home')+'" aria-hidden="true">'+esc(c.shortName)+'</span>';}
function button(action,label,style="primary") {return '<button type="button" class="'+style+'" data-action="'+action+'">'+label+'</button>';}
function scoreboard() {
  const result=model.result, real=active();
  const status=result?"Full time":real?(model.ready[0]&&model.ready[1]?"Kickoff":model.joined?"Team selection":"Awaiting away manager"):"Fixture preview";
  const teams=model.clubs.map((club,i)=>{
    const info='<div><span class="team-sub">'+(i?'Away':'Home')+'</span><div class="team-name">'+esc(club.name)+'</div></div>';
    return '<div class="team '+(i?'away':'home')+'">'+(i?crest(i)+info:info+crest(i))+'</div>';
  });
  return '<section class="board" aria-label="Fixture"><div class="board-top"><span class="micro">Matchday 01 &nbsp; / &nbsp; Friendly</span><span class="status"><i></i>'+status+'</span></div><div class="teams">'+teams[0]+'<span class="versus '+(result?'final':'')+'">'+(result?result.score.map(esc).join(' – '):'VS')+'</span>'+teams[1]+'</div><div class="board-bottom">'+(real?'You manage '+esc(model.clubs[side()].name):'Two managers · 90 minutes')+'</div></section>';
}
function heading() {
  let action="";
  if(!active()) action=button("create",'Create fixture <span class="arrow" aria-hidden="true">↗</span>');
  else if(model.invite && !model.joined && side()===0) action=button("invite",'Invite opponent <span aria-hidden="true">↗</span>',"secondary");
  const recent=getStored(localStorage,"ballerz.last");
  return '<div class="page-heading"><div><div class="eyebrow">Ballerz football</div><h1>Match centre</h1></div><div>'+action+'</div></div>'+
    (!active() && recent?'<p class="hint" style="margin:-5px 0 12px;text-align:right"><a href="?fixture='+encodeURIComponent(recent)+'">Reopen last fixture</a></p>':'');
}
function tabBar() {
  const tabs=[["team","Team sheet"],["opposition","Opposition"]];
  if(model.result) tabs.unshift(["report","Match report"]);
  return '<nav class="tabs" aria-label="Fixture views">'+tabs.map(([id,label])=>'<button type="button" data-tab="'+id+'" class="'+(currentTab===id?'selected':'')+'" aria-current="'+(currentTab===id?'page':'false')+'">'+label+'</button>').join("")+'</nav>';
}
function pitch(club,plan,editable) {
  const rows=fields.map(pos=>{
    const selected=plan.xi.map(id=>club.squad.find(p=>p.id===id)).filter(p=>p?.position===pos);
    return '<div class="pitch-row">'+selected.map(p=>{
      const marker=editable?'button':'span', name=p.name.split(" ").at(-1);
      return '<'+marker+' class="footballer '+(editable?'editable ':'')+(pos==='GK'?'keeper ':'')+(p.id===picked?'selected-player':'')+'" '+
        (editable?'type="button" data-pick="'+esc(p.id)+'" aria-label="Change '+esc(p.name)+'"':'')+'><span class="shirt">'+esc(p.number)+'</span><span class="surname">'+esc(name)+'</span></'+marker+'>';
    }).join("")+'</div>';
  }).join("");
  return '<div class="pitch side-'+model.clubs.indexOf(club)+'"><div class="pitch-art" aria-hidden="true"><i class="box top"></i><i class="box bottom"></i></div>'+rows+'</div>';
}
function playerPicker(club) {
  if(!picked || locked())return "";
  const current=club.squad.find(p=>p.id===picked);
  if(!current)return "";
  const bench=club.squad.filter(p=>p.position===current.position && !draft.xi.includes(p.id));
  return '<div class="picker"><div class="picker-top"><h3>Replace '+esc(current.name)+'</h3>'+button("dismiss","Close","plain")+'</div>'+
    (bench.length?'<div class="picker-list">'+bench.map(p=>'<button type="button" class="control" data-swap="'+esc(p.id)+'">'+esc(p.name)+'</button>').join("")+'</div>':'<p class="hint">Every '+esc(positions[current.position].toLowerCase())+' is in your starting XI.</p>')+'</div>';
}
function tacticsCard() {
  const disable=locked()?' disabled':'';
  let footer;
  if(!active()) footer='<p class="hint">Create the fixture to manage Northbank and invite Eastport’s manager.</p>';
  else if(model.result) footer='<div class="statusline">Final team sheet</div>';
  else if(locked()) footer='<div class="statusline">Team sheet locked. Waiting for '+esc(model.clubs[1-side()].name)+'.</div>';
  else footer=button("ready",'Lock team sheet <span aria-hidden="true">→</span>')+'<p class="hint">Kickoff follows once both teams lock in.</p>';
  return '<section class="card tactics"><div class="headrow"><h2>Match plan</h2></div><span class="field-label">Formation</span><div class="formations">'+
    Object.keys(shapes).map(f=>'<button type="button" data-formation="'+f+'" aria-pressed="'+(draft.formation===f)+'" class="option '+(draft.formation===f?'selected':'')+'"'+disable+'>'+f+'</button>').join("")+
    '</div><span class="field-label">Team tactic</span><div class="choices">'+Object.entries(model.tactics).map(([id,t])=>'<button type="button" data-tactic="'+esc(id)+'" aria-pressed="'+(draft.tactic===id)+'" class="tactic '+(draft.tactic===id?'selected':'')+'"'+disable+'><span><b>'+esc(t.label)+'</b><small>'+esc(t.description)+'</small></span></button>').join("")+
    '</div><div class="actions">'+footer+'</div></section>';
}
function roster(club,plan,scout=false) {
  return '<section class="card roster"><div class="card-head"><h2>'+ (scout?'Opposition squad':'Squad list') +'</h2><span class="label">'+club.squad.length+' players</span></div><div class="roster-scroll"><table><thead><tr>'+
    ['No.','Pos.','Player','Pass','Defend','Finish','Stamina',...(scout?[]:['Selection'])].map(h=>'<th scope="col">'+h+'</th>').join("")+'</tr></thead><tbody>'+
    club.squad.map(p=>{const selected=plan?.xi.includes(p.id);return '<tr><td>'+esc(p.number)+'</td><td><span class="position '+esc(p.position)+'">'+esc(p.position)+'</span></td><td>'+esc(p.name)+'</td>'+['passing','defending','finishing','stamina'].map(s=>'<td>'+esc(p[s])+'</td>').join("")+(scout?'':'<td class="'+(selected?'':'bench')+'">'+(selected?'Starting XI':'Bench')+'</td>')+'</tr>';}).join("")+'</tbody></table></div></section>';
}
function teamPanel() {
  const club=model.clubs[side()];
  return '<div class="layout"><section class="card"><div class="card-head"><div><h2>Starting XI</h2><p class="hint">'+(locked()?'Confirmed lineup':'Select a shirt to change a player.')+'</p></div><span class="label">'+esc(draft.formation)+'</span></div><div class="pitch-wrap">'+pitch(club,draft,!locked())+playerPicker(club)+'</div></section>'+tacticsCard()+'</div>'+roster(club,draft);
}
function opponentPanel() {
  const i=1-side(),club=model.clubs[i], top=(prop)=>club.squad.reduce((a,b)=>a[prop]>=b[prop]?a:b);
  const players=[['finishing','Finishing'],['passing','Passing'],['defending','Defending']].map(([prop,label])=>{const p=top(prop);return '<li><strong>'+esc(p.name)+'</strong><span>'+esc(positions[p.position])+' · '+label+' '+esc(p[prop])+'</span></li>';}).join("");
  const known=model.result && model.plans?.[i];
  return '<div class="layout scout"><section class="card"><h2>'+esc(club.name)+'</h2><p class="hint">'+(known?'Final team sheet':'Players to watch')+'</p>'+(known?pitch(club,known,false):'<ul>'+players+'</ul>')+'</section><section class="card"><h2>Scouting report</h2><ul>'+fields.map(pos=>{const n=club.squad.filter(p=>p.position===pos).length;return '<li>'+esc(positions[pos])+'s <strong style="float:right">'+n+'</strong></li>';}).join("")+'</ul></section></div>'+roster(club,known,true);
}
function reportPanel() {
  const r=model.result;
  const stats=[['possession','Possession','%'],['shots','Shots',''],['onTarget','On target','']].map(([k,label,unit])=>{const [a,b]=r.stats[k];return '<div class="statrow"><b>'+esc(a)+unit+'</b><span>'+label+'</span><b>'+esc(b)+unit+'</b></div><div class="stat-track"><i style="flex:'+Number(a)+'"></i><b style="flex:'+Number(b)+'"></b></div>';}).join("");
  return '<div class="layout report"><section class="card"><h2>Match timeline</h2><ol class="events">'+r.events.map(ev=>'<li class="event '+esc(ev.type)+'"><time>'+esc(ev.minute)+'′</time><div>'+esc(ev.text)+'</div></li>').join("")+'</ol></section><section class="card"><h2>Match stats</h2><div class="statrow">'+model.clubs.map(c=>'<b>'+esc(c.shortName)+'</b>').join("")+'</div>'+stats+'<h3>Manager’s report</h3><p class="analysis">'+esc(r.analysis[side()])+'</p></section></div>';
}
function render() {
  if(!model)return;
  const inviteBox=invitation?'<div class="card invite-box"><label for="invite-url">Away manager’s invite</label><input id="invite-url" readonly value="'+esc(invitation)+'">'+button("copy","Copy link","secondary")+button("close-invite","Close","plain")+'</div>':'';
  app.innerHTML=heading()+inviteBox+scoreboard()+tabBar()+(currentTab==="opposition"?opponentPanel():currentTab==="report"&&model.result?reportPanel():teamPanel());
}
function gate(title,message,action="",label="") {
  app.innerHTML='<section class="gate"><div class="eyebrow">Matchday 01</div><h1>'+esc(title)+'</h1><p>'+esc(message)+'</p>'+(action?button(action,label):'')+' <a class="plain" href="/">Match centre</a></section>';
}
function changeFormation(formation) {
  const squad=model.clubs[side()].squad, ordered=[...draft.xi.map(id=>squad.find(p=>p.id===id)),...squad.filter(p=>!draft.xi.includes(p.id))];
  draft.xi=fields.flatMap((pos,i)=>ordered.filter(p=>p.position===pos).slice(0,shapes[formation][i]).map(p=>p.id));
  draft.formation=formation;picked=null;
}
async function copyInvite() {
  try {await navigator.clipboard.writeText(invitation);toast("Invite link copied");}
  catch {const input=document.querySelector("#invite-url");input?.focus();input?.select();toast("Select and copy the invite link.");}
}
app.addEventListener("click",async event=>{
  const b=event.target.closest("button");
  if(!b || b.disabled || busy)return;
  if(b.dataset.tab){currentTab=b.dataset.tab;picked=null;render();return;}
  if(b.dataset.pick){picked=picked===b.dataset.pick?null:b.dataset.pick;render();return;}
  if(!locked() && (b.dataset.swap||b.dataset.formation||b.dataset.tactic)){
    if(b.dataset.swap){draft.xi=draft.xi.map(id=>id===picked?b.dataset.swap:id);picked=null;}
    if(b.dataset.formation)changeFormation(b.dataset.formation);
    if(b.dataset.tactic)draft.tactic=b.dataset.tactic;
    persistDraft();render();return;
  }
  const action=b.dataset.action;
  if(action==="dismiss"){picked=null;render();return;}
  if(action==="close-invite"){invitation="";render();return;}
  if(action==="invite"){
    const url=new URL(location.href);url.search="?fixture="+encodeURIComponent(id);url.hash="invite="+encodeURIComponent(model.invite);
    invitation=url.href;render();await copyInvite();return;
  }
  if(action==="copy"){await copyInvite();return;}
  busy=true;b.disabled=true;revision++;
  try {
    if(action==="create")await enterSession(await api("/api/fixtures",{method:"POST"}),true);
    if(action==="join"){
      await enterSession(await api(fixturePath()+"/join",{method:"POST",token:inviteToken,idempotencyKey:joinAttemptKey()}));
      try {sessionStorage.removeItem("ballerz.join."+id);} catch { /* Session storage is optional. */ }
    }
    if(action==="ready"){picked=null;applyModel(await api(fixturePath()+"/ready",{method:"POST",token:key,body:draft}));}
  } catch(error){toast(error.message,8000);}
  finally{busy=false;b.disabled=false;}
});
async function init() {
  try {
    if(id && inviteToken){
      const existing=getStored(sessionStorage,memoryKey(id)) || getStored(localStorage,memoryKey(id));
      if(existing){
        const state=await api(fixturePath(),{token:existing}).catch(()=>null);
        if(state?.side===1){key=existing;newLocation(id);applyModel(state,true);startPolling();return;}
        if(state?.side===0){gate("Invite the away manager","You manage Northbank in this browser. Send the original invite link to your opponent, or open it in a private window to play the away side.");return;}
      }
      gate("Manage Eastport Rovers","Northbank Athletic have invited you to a friendly. Claim the away dugout, pick your eleven and submit your match plan.","join","Take the away dugout");return;
    }
    if(id){
      key=getStored(sessionStorage,memoryKey(id)) || getStored(localStorage,memoryKey(id));
      if(!key){gate("Manager session needed","Reopen this fixture in the browser where you claimed your club, or use the away manager’s invite link.");return;}
      applyModel(await api(fixturePath(),{token:key}),true);startPolling();return;
    }
    applyModel(await api("/api/clubs"),true);
  }catch(error){gate("Match centre unavailable",error.message);}
}
init();
