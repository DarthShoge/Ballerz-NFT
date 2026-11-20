import { animatePitch } from './live-pitch.js';
import {phaseSlot, phases, roleEditor, starterSelector, targetValue, validRoles} from './role-selection.js';

const app = document.querySelector("#app");
const notice = document.querySelector("#notice");
const fields = ["GK", "DF", "MF", "FW"];
const positions = {GK:"Goalkeeper",DF:"Defender",MF:"Midfielder",FW:"Forward"};
const slots = {...positions, LB:"Left-back", RB:"Right-back", CB:"Centre-back", LCB:"Left centre-back",
  RCB:"Right centre-back", LM:"Left midfield", RM:"Right midfield", CM:"Central midfield",
  LCM:"Left central midfield", RCM:"Right central midfield", LS:"Left striker", RS:"Right striker",
  ST:"Striker", LW:"Left wing", RW:"Right wing", DM:"Defensive midfield", LDM:"Left defensive midfield",
  RDM:"Right defensive midfield", AM:"Attacking midfield", LAM:"Left attacking midfield",
  RAM:"Right attacking midfield", LWB:"Left wing-back", RWB:"Right wing-back"};
const attributeGroups = {
  technical: {label: "Technical", attributes: {
    passing: "Passing", firstTouch: "First touch", dribbling: "Dribbling",
    finishing: "Finishing", tackling: "Tackling", crossing: "Crossing", aerial: "Aerial ability"
  }},
  mental: {label: "Mental", attributes: {
    vision: "Vision", decisions: "Decisions", composure: "Composure",
    offBall: "Off the ball", positioning: "Positioning", workRate: "Work rate"
  }},
  physical: {label: "Physical", attributes: {pace: "Pace", stamina: "Stamina"}},
  goalkeeper: {label: "Goalkeeping", attributes: {
    handling: "Handling", reflexes: "Reflexes", oneOnOnes: "One on ones"
  }}
};
const matchInstructions = [
  {id: "mentality", phase: "Match approach", label: "Mentality"},
  {id: "buildUp", phase: "In possession", label: "Passing"},
  {id: "tempo", phase: "In possession", label: "Tempo"},
  {id: "width", phase: "In possession", label: "Attacking width"},
  {id: "attackingFocus", phase: "In possession", label: "Attacking focus"},
  {id: "crossing", phase: "In possession", label: "Cross delivery"},
  {id: "distribution", phase: "In possession", label: "Keeper distribution"},
  {id: "finalThird", phase: "In possession", label: "Final third"},
  {id: "transition", phase: "In transition", label: "After winning the ball"},
  {id: "afterLoss", phase: "In transition", label: "After losing the ball"},
  {id: "pressing", phase: "Out of possession", label: "Pressing"},
  {id: "defensiveLine", phase: "Out of possession", label: "Defensive line"}
];
const query = new URLSearchParams(location.search);
const inviteToken = new URLSearchParams(location.hash.slice(1)).get("invite");
let id = query.get("fixture");
let model, draft, key, currentTab = "team", invitation = "", busy = false;
let poll = null, deadline = null, revision = 0;
let rosterGroup = "technical", reportSide = null;
let reportFilter = "highlights", reportTeam = "both", selectedShot = null, reportStatsExpanded = false;
let possessionExpanded = false;
let kickoffDraft = null, serverClockObservedAt = 0;
let livePitch = null, liveCursor = -1, liveTacticsDirty = false;
let liveSelectedShot = null;
let tacticsCatalog, selectedRolePlayer = null, shapePhase = "inPossession";
let pendingRoles = {};
let pendingPlayerInstructions = {};
let pendingMarkingTargets = {};
let previewOn = false, previewZone = "midfield";
let previewState = {key: "", result: null, error: ""};
const MINUTE_MS = 60_000;
let profileTrigger;
const profile = document.createElement("dialog");
profile.className = "player-profile";
profile.setAttribute("aria-labelledby", "player-profile-title");
document.body.append(profile);
profile.addEventListener("close", () => {
  if (profileTrigger) {
    const fallback = app.querySelector('[data-player="'+CSS.escape(profileTrigger.dataset.player)+'"]');
    (profileTrigger.isConnected ? profileTrigger : fallback)?.focus({preventScroll: true});
  }
});
const memoryKey = fixture => "ballerz.fixture." + fixture;
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const side = () => model?.side ?? 0;
const active = () => Boolean(id && key && model?.id);
const locked = () => active() && (model.teamSheetLocked ?? model.ready[side()]);
const localTime = new Intl.DateTimeFormat(undefined, {dateStyle:"medium", timeStyle:"short"});
function timeLabel(timestamp) {
  const date = new Date(timestamp);
  return '<time datetime="'+date.toISOString()+'">'+esc(localTime.format(date))+'</time>';
}
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
  const data = await response.json().catch(() => null);
  if (response.ok && data) return data;
  const message = typeof data?.error === "string" ? data.error :
    "The match server returned an unexpected response (HTTP "+response.status+").";
  const error = new Error(message);
  error.status = response.status;
  throw error;
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
function orderedLineup(club, xi) {
  const registered = new Map(club.squad.map(p => [p.id, p.position]));
  return fields.flatMap(position => xi.filter(id => registered.get(id) === position));
}
function clonePlan(plan) {
  const copy = {formation: plan.formation, tactic: plan.tactic, xi: orderedLineup(model.clubs[side()], plan.xi)};
  if (plan.defensiveFormation && Object.hasOwn(tacticsCatalog.formations, plan.defensiveFormation)) copy.defensiveFormation = plan.defensiveFormation;
  if (plan.playerRoles) copy.playerRoles = validRoles(tacticsCatalog, copy.formation, copy.defensiveFormation, sheetPlayers(copy), plan.playerRoles);
  if (plan.markingTargets) copy.markingTargets = Object.fromEntries(Object.entries(plan.markingTargets).filter(([id, target]) =>
    copy.xi.includes(id) && validMarkingTarget(target)));
  if (plan.playerInstructions) copy.playerInstructions = sheetInstructions(copy, plan.playerInstructions);
  for (const {id} of matchInstructions) {
    const options = model.instructions?.[id];
    if (options && typeof plan[id] === "string" && Object.hasOwn(options, plan[id])) copy[id] = plan[id];
  }
  if (plan.duties) {
    const duties = plan.xi.filter(id => Object.hasOwn(model.playerDuties, plan.duties[id]) && plan.duties[id] !== "support");
    if (duties.length) copy.duties = Object.fromEntries(duties.map(id => [id, plan.duties[id]]));
  }
  return copy;
}
function validMarkingTarget(target) {
  if (target?.kind === 'position') return tacticsCatalog.markingPositions?.includes(target.slot);
  return target?.kind === 'player' && model.clubs[1-side()].squad.some(p => p.id === target.id && p.position !== 'GK');
}
function instructionValue(plan, id) {
  return plan[id] ?? model.tactics[plan.tactic][id];
}
function sheetPlayers(plan) {
  return plan.xi.map((id, slotIndex) => ({...model.clubs[side()].squad.find(p => p.id === id), slotIndex}));
}
function sheetInstructions(plan, assignments) {
  const result = {};
  for (const {id, position} of sheetPlayers(plan)) {
    if (position === 'GK') continue;
    for (const [key, choices] of Object.entries(tacticsCatalog.individualInstructions ?? {})) {
      const value = assignments?.[id]?.[key];
      if (value && value !== 'standard' && Object.hasOwn(choices, value)) (result[id] ??= {})[key] = value;
    }
  }
  return result;
}
function roleAssignmentsChanged(plan, submitted) {
  return plan.xi.some((id,index) => Object.keys(phases).some(phase => {
    const slot = phaseSlot(tacticsCatalog, plan.formation, plan.defensiveFormation, index, phase);
    const fallback = tacticsCatalog.roleOptions[slot.formation][slot.index][phase][0].id;
    return (plan.playerRoles?.[id]?.[phase] ?? fallback) !== (submitted.playerRoles?.[id]?.[phase] ?? fallback);
  }));
}
function sheetChanged() {
  const submitted = model.plans?.[side()];
  return submitted && (draft.formation !== submitted.formation || draft.tactic !== submitted.tactic ||
    (draft.defensiveFormation ?? 'same') !== (submitted.defensiveFormation ?? 'same') || roleAssignmentsChanged(draft, submitted) ||
    draft.xi.some(id => targetValue(draft.markingTargets?.[id]) !== targetValue(submitted.markingTargets?.[id])) ||
    draft.xi.some(id => Object.keys(tacticsCatalog.individualInstructions ?? {}).some(key =>
      (draft.playerInstructions?.[id]?.[key] ?? 'standard') !== (submitted.playerInstructions?.[id]?.[key] ?? 'standard'))) ||
    draft.xi.join(",") !== orderedLineup(model.clubs[side()], submitted.xi).join(",") || draft.xi.some(id => (draft.duties?.[id] ?? "support") !== (submitted.duties?.[id] ?? "support")) ||
    matchInstructions.some(({id}) => instructionValue(draft, id) !== instructionValue(submitted, id)));
}
function draftKey() {return "ballerz.draft." + id + "." + side();}
function restoreDraft(base) {
  if (!active() || locked()) return clonePlan(base);
  try {
    const saved = JSON.parse(getStored(localStorage,draftKey()));
    const squad = model.clubs[side()].squad;
    if (saved && Object.hasOwn(tacticsCatalog.formations,saved.formation) && Object.hasOwn(model.tactics,saved.tactic) && Array.isArray(saved.xi) &&
        new Set(saved.xi).size === 11 && saved.xi.length === 11 && fields.every(pos => squad.filter(p=>saved.xi.includes(p.id)&&p.position===pos).length===tacticsCatalog.formations[saved.formation][pos])) return clonePlan(saved);
  } catch { /* A missing or old draft can use the default squad. */ }
  return clonePlan(base);
}
function persistDraft() { if (active()) saveStored(localStorage,draftKey(),JSON.stringify(draft)); }
function applyModel(next,initial=false) {
  const wasResult=Boolean(model?.result);
  const wasLive=Boolean(model?.live);
  if (next.roleOptions) tacticsCatalog = {roleOptions: next.roleOptions, formations: next.formations, formationSlots: next.formationSlots,
    defensiveSlotMap: next.defensiveSlotMap, formationCoordinates: next.formationCoordinates, markingPositions:next.markingPositions, individualInstructions:next.individualInstructions};
  model=next;
  liveCursor=next.live?.frames.at(-1)?.seq ?? -1;
  if (Number.isFinite(next.serverTime)) serverClockObservedAt = performance.now();
  if (initial || !draft || locked()) draft=restoreDraft(model.plans?.[side()] || model.defaults[side()]);
  if (model.result && (!wasResult || initial)) {
    currentTab = "report";
    reportSide = null;
    reportFilter = "highlights";
    reportTeam = "both";
    selectedShot = null;
    reportStatsExpanded = false;
    possessionExpanded = false;
  }
  if (model.live && (!wasLive || initial)) {
    currentTab = "live";
    liveTacticsDirty = false;
    pendingRoles = {};
    pendingPlayerInstructions = {};
    pendingMarkingTargets = {};
    liveSelectedShot = null;
  } else if (model.live && currentTab === "live" && livePitch) {
    updateLivePanel();
    return;
  }
  render();
}
function newLocation(fixture) {history.replaceState(null,"","?fixture="+encodeURIComponent(fixture));}
async function enterSession(session,fromLanding=false) {
  const previousDraft=fromLanding && draft ? clonePlan(draft) : null;
  id=session.id;key=session.key;remember(id,key);newLocation(id);
  const next=await api(fixturePath(),{token:key});
  currentTab="team";selectedRolePlayer=null;invitation="";rosterGroup="technical";reportSide=null;
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
      const next=await api(fixturePath()+"?after="+liveCursor,{token:key});
      if(!busy && revision===start && JSON.stringify(next)!==JSON.stringify(model)) applyModel(next);
      if(model.result) clearInterval(poll);
    } catch { /* The next poll retries after a connection interruption. */ }
    finally {reading=false;}
  },2000);
}
function crest(i) {const c=model.clubs[i];return '<span class="crest '+(i?'away':'home')+'" aria-hidden="true">'+esc(c.shortName)+'</span>';}
function button(action,label,style="primary") {return '<button type="button" class="'+style+'" data-action="'+action+'">'+label+'</button>';}
function scoreboard() {
  const result=model.result, real=active(), schedule=model.schedule;
  let status = "Fixture preview";
  if (result) {
    status = {
      "double-forfeit": "Double forfeit",
      forfeit: "Forfeit",
      abandoned: "Abandoned",
      "double-abandonment": "Abandoned"
    }[result.kind] ?? "Full time";
  } else if (model.live) {
    status = model.live.phase === "half-time" ? "Half-time" : "Live";
  } else if (schedule && locked()) {
    status = "Team sheets closed";
  } else if (real) {
    status = model.joined ? "Team selection" : "Awaiting away manager";
  }
  const scheduleLabel = schedule
    ? schedule.playtestKickoffAt !== undefined
      ? '<span>Playtest kickoff '+timeLabel(schedule.playtestKickoffAt)+'</span>'
      : '<span>Kickoff '+timeLabel(schedule.kickoffAt)+'</span><span>Team-sheet deadline '+timeLabel(schedule.deadlineAt)+'</span>'
    : '';
  const fixtureLabel = schedule
    ? 'Scheduled playtest · Year '+schedule.gameDate.year+' / Week '+schedule.gameDate.week+' / Day '+schedule.gameDate.day
    : 'Friendly';
  const teams=model.clubs.map((club,i)=>{
    const info='<div><span class="team-sub">'+(i && model.computerAway?'Away · Computer':i?'Away':'Home')+'</span><div class="team-name">'+esc(club.name)+'</div></div>';
    return '<div class="team '+(i?'away':'home')+'">'+(i?crest(i)+info:info+crest(i))+'</div>';
  });
  const played = result ?? model.live;
  const score = played ? played.score?.map(esc).join(' – ') ?? '—' : 'VS';
  return '<section class="board" aria-label="Fixture"><div class="board-top"><span class="micro">'+esc(fixtureLabel)+'</span><span class="status"><i></i>'+status+'</span></div><div class="teams">'+teams[0]+'<span class="versus '+(played?'final':'')+'">'+score+'</span>'+teams[1]+'</div><div class="board-bottom">'+(real?'You manage '+esc(model.clubs[side()].name):'Two managers · 90 minutes')+'</div>'+
    (scheduleLabel ? '<div class="fixture-times">'+scheduleLabel+'</div>' : '')+'</section>';
}
function heading() {
  let action="";
  if(!active()) action=button("computer-friendly","Play AI")+' '+button("create","Invite a manager","secondary");
  else if(model.invite && !model.joined && side()===0) action=button("invite",'Invite opponent <span aria-hidden="true">↗</span>',"secondary");
  else if (model.playtestControls && model.live && currentTab === "live") {
    action = button("fast-forward", "Fast-forward 10 min", "secondary");
  } else if (model.playtestControls && model.schedule && !model.live && !model.result && model.ready.every(Boolean)) {
    action = button("kickoff-now", "Kick off now");
  }
  const recent=getStored(localStorage,"ballerz.last");
  return '<div class="page-heading"><div><div class="eyebrow">Ballerz football</div><h1>Match centre</h1></div><div>'+action+'</div></div>'+
    (!active() && recent?'<p class="hint" style="margin:-5px 0 12px;text-align:right"><a href="?fixture='+encodeURIComponent(recent)+'">Reopen last fixture</a></p>':'');
}
function scheduleTiming() {
  const now = Number.isFinite(model.serverTime)
    ? model.serverTime + (performance.now() - serverClockObservedAt)
    : Date.now();
  const lock = model.teamSheetLockMs ?? 30 * MINUTE_MS;
  const earliest = Math.ceil(Math.max(now + lock + 1, model.worldStart) / MINUTE_MS) * MINUTE_MS;
  return {earliest, lockMinutes: lock / MINUTE_MS};
}
function localInputValue(timestamp) {
  const date = new Date(timestamp);
  return new Date(timestamp - date.getTimezoneOffset() * MINUTE_MS).toISOString().slice(0, 16);
}
function scheduleHint(earliest, lockMinutes) {
  return "Team sheets lock "+lockMinutes+" minutes before kickoff. Choose "+localTime.format(earliest)+" or later.";
}
function refreshScheduleTiming(form) {
  const {earliest, lockMinutes} = scheduleTiming();
  form.elements.kickoff.min = localInputValue(earliest);
  form.querySelector("#kickoff-help").textContent = scheduleHint(earliest, lockMinutes);
  return earliest;
}
function scheduleError(form, message, invalid = false) {
  form.querySelector("#kickoff-error").textContent = message;
  if (invalid) {
    form.elements.kickoff.setAttribute("aria-invalid", "true");
    form.elements.kickoff.focus();
  } else {
    form.elements.kickoff.removeAttribute("aria-invalid");
  }
}
function scheduledFixtureForm() {
  if (active() || model.worldStart == null) return "";
  const {earliest, lockMinutes} = scheduleTiming();
  const defaultKickoff = localInputValue(earliest + 5 * MINUTE_MS);
  return '<details class="schedule-options"><summary>Schedule a fixture</summary><form id="schedule-fixture" class="card schedule-form" novalidate>'+
    '<label for="kickoff-local">Scheduled playtest kickoff (local time)</label>'+
    '<input id="kickoff-local" type="datetime-local" name="kickoff" min="'+localInputValue(earliest)+
    '" value="'+esc(kickoffDraft ?? defaultKickoff)+'" aria-describedby="kickoff-help kickoff-error" required>'+
    '<label for="scheduled-opponent">Opponent</label><select id="scheduled-opponent" name="opponent"><option value="human">Human manager</option><option value="computer">Computer manager</option></select>'+
    '<button class="secondary" type="submit">Schedule fixture</button>'+
    '<p id="kickoff-help" class="hint">'+esc(scheduleHint(earliest, lockMinutes))+'</p>'+
    '<p id="kickoff-error" class="schedule-error" role="alert"></p></form></details>';
}
function tabBar() {
  const tabs=[["team","Team sheet"],["opposition","Opposition"]];
  if(model.live) tabs.unshift(["live","Live match"]);
  if(model.result) tabs.unshift(["report","Match report"]);
  return '<nav class="tabs" aria-label="Fixture views">'+tabs.map(([id,label])=>'<button type="button" data-tab="'+id+'" class="'+(currentTab===id?'selected':'')+'" aria-current="'+(currentTab===id?'page':'false')+'">'+label+'</button>').join("")+'</nav>';
}
function pitch(club,plan,editable,phase = "inPossession",preview = false) {
  const shape = phaseSlot(tacticsCatalog, plan.formation, plan.defensiveFormation, 0, phase).formation;
  const coordinates = tacticsCatalog.formationCoordinates[shape];
  const depths = coordinates.map(p => p.x), minDepth = Math.min(...depths), maxDepth = Math.max(...depths);
  const players = orderedLineup(club, plan.xi).map((id,index) => {
    const p = club.squad.find(player => player.id === id);
    const slot = phaseSlot(tacticsCatalog, plan.formation, plan.defensiveFormation, index, phase);
    const position = tacticsCatalog.formationSlots[shape][slot.index];
    const {x,y} = coordinates[slot.index];
    const left = preview ? previewLeft(y) : 9 + (y / 68) * 82;
    const bottom = preview ? previewBottom(x) : 10 + (x - minDepth) / (maxDepth - minDepth) * 80;
    const options = tacticsCatalog.roleOptions[shape][slot.index][phase];
    const role = options.find(r => r.id === plan.playerRoles?.[id]?.[phase]) ?? options[0];
    const marker = editable ? "button" : "span";
    return `<${marker} class="footballer${editable ? ' editable' : ''}${p.position === 'GK' ? ' keeper' : ''}${editable && selectedRolePlayer === id ? ' selected-player' : ''}"
      style="left:${left}%;bottom:${bottom}%" title="${esc(p.name)} · ${esc(role.label)}" data-pitch-player="${esc(id)}"
      ${editable ? `type="button" data-pick="${esc(id)}" aria-controls="team-selection" aria-pressed="${selectedRolePlayer === id}" aria-label="Select ${esc(p.name)}, ${esc(position)}, ${esc(role.label)}"` : ''}>
      <span class="shirt">${esc(p.number)}</span><span class="surname">${esc(position)} · ${esc(p.name.split(" ").at(-1))}</span></${marker}>`;
  }).join('');
  return '<div class="pitch formation-pitch side-'+model.clubs.indexOf(club)+'"'+(preview ? ' id="shape-preview"' : '')+'><div class="pitch-art" aria-hidden="true"><i class="box top"></i><i class="box bottom"></i></div>'+players+(preview ? '<i class="preview-ball" aria-label="Ball" role="img" hidden></i>' : '')+'</div>';
}
const previewLeft = y => 6 + y / 68 * 88;
const previewBottom = x => 7 + x / 105 * 86;
function previewControls() {
  if (model.live || model.result) return '';
  return `<div class="preview-controls"><button type="button" data-action="toggle-preview" aria-pressed="${previewOn}" class="option ${previewOn ? 'selected' : ''}">Preview movement</button>
    ${previewOn ? `<label for="preview-zone">Ball in <select id="preview-zone">
      ${Object.entries({defence:"Defensive third",midfield:"Middle third",attack:"Attacking third"}).map(([value,label]) => `<option value="${value}"${previewZone === value ? ' selected' : ''}>${label}</option>`).join('')}
    </select></label>` : ''}</div>`;
}
function syncShapePreview() {
  const target = document.getElementById("shape-preview");
  if (!target) return;
  const body = {plan:draft, side:side(), phase:shapePhase, zone:previewZone};
  const key = JSON.stringify(body);
  if (previewState.key !== key) {
    const request = {key, result:null, error:""};
    previewState = request;
    api("/api/tactics/preview", {method:"POST",body}).then(result => {
      if (previewState !== request) return;
      request.result = result;
      syncShapePreview();
    }).catch(error => {
      if (previewState !== request) return;
      request.error = error.message;
      syncShapePreview();
    });
  }
  const {result,error} = previewState;
  const status = document.getElementById("preview-status");
  status.textContent = error || (result ? "Settled shape with the ball in the selected third." : "Calculating movement…");
  document.getElementById("preview-retry").hidden = !error;
  if (!result) return;
  for (const p of result.players) {
    const marker = target.querySelector('[data-pitch-player="'+CSS.escape(p.id)+'"]');
    if (marker) {
      marker.style.left = previewLeft(p.y) + "%";
      marker.style.bottom = previewBottom(p.x) + "%";
    }
  }
  const ball = target.querySelector(".preview-ball");
  ball.style.left = previewLeft(result.ball.y) + "%";
  ball.style.bottom = previewBottom(result.ball.x) + "%";
  ball.hidden = false;
}
function replacementOptions(club, players, current) {
  const bench = club.squad.filter(p => p.position === current.position && !draft.xi.includes(p.id));
  const comparisons = {
    GK: [["handling", "Handling"], ["reflexes", "Reflexes"]],
    DF: [["tackling", "Tackling"], ["positioning", "Positioning"]],
    MF: [["passing", "Passing"], ["decisions", "Decisions"]],
    FW: [["finishing", "Finishing"], ["offBall", "Off the ball"]]
  }[current.position];
  const benchRatings = player => comparisons.map(([attribute, label]) => {
    const value = attributeValue(player, attribute);
    return Number.isFinite(value) ? `${label} ${value}` : "";
  }).filter(Boolean).join(" · ");
  const currentRatings = '<p class="selected-attributes hint">'+esc(positions[current.position])+' · '+esc(benchRatings(current))+'</p>';
  if (locked()) return currentRatings;
  const buttonFor = (player, action, position) => `<button type="button" class="selection-option" data-swap="${esc(player.id)}"
    aria-label="${esc(action)} ${esc(player.name)} ${action === 'Start' ? 'in place of' : 'with'} ${esc(current.name)}">
    <span class="selection-number">${esc(player.number)}</span>
    <span class="selection-name"><b>${esc(player.name)}</b><small>${esc(position)} · ${esc(benchRatings(player))}</small></span>
    <span class="selection-action">${action} <span aria-hidden="true">↔</span></span></button>`;
  const sameLine = players.filter(p => p.position === current.position && p.id !== current.id);
  return `${currentRatings}<div class="selection-reserves"><h3>Available replacements</h3>
    ${bench.length ? `<div class="selection-options">${bench.map(p=>buttonFor(p,'Start',p.position)).join('')}</div>`
      : `<p class="hint">Every ${esc(positions[current.position].toLowerCase())} is in your starting XI.</p>`}
    ${sameLine.length ? `<details class="starter-swaps"><summary>Swap positions with a starter</summary>
      <div class="selection-options">${sameLine.map(p=>buttonFor(p,'Swap',tacticsCatalog.formationSlots[draft.formation][p.slotIndex])).join('')}</div></details>` : ''}
    </div>`;
}
function playerSelection(club, players, current) {
  const editor = roleEditor({catalog:tacticsCatalog, formation:draft.formation, defensiveFormation:draft.defensiveFormation,
    players, opponents:model.clubs[1-side()].squad, markingTargets:draft.markingTargets, assignments:draft.playerRoles, playerInstructions:draft.playerInstructions, selectedId:current.id, disabled:locked(), showSelector:false, esc});
  return `<section id="team-selection" class="card selection-card" aria-labelledby="selection-title">
    <div class="card-head"><h2 id="selection-title">Player selection</h2>
      <button type="button" id="selection-profile" data-player="${esc(current.id)}" aria-haspopup="dialog" class="secondary">View profile</button></div>
    <div class="selection-body"><div class="selection-field">${starterSelector(tacticsCatalog,draft.formation,players,current.id,'Starting player',esc)}</div>
    ${replacementOptions(club,players,current)}${editor}${dutyPanel()}</div></section>`;
}
function instructionFields(live = false) {
  const team = live ? model.live.teams[side()] : draft;
  const prefix = live ? "live" : "instruction";
  const groups = new Map();
  for (const {id, phase, label} of matchInstructions) {
    const choices = model.instructions[id];
    if (!choices) continue;
    const selected = live ? team[id] : instructionValue(team, id);
    const field = `<div class="tactic-field"><label for="${prefix}-${id}">${label}</label>
      <select id="${prefix}-${id}" name="${id}" ${live ? "data-live-instruction" : 'data-instruction="' + id + '"'}
        aria-describedby="${prefix}-${id}-help"${!live && locked() ? " disabled" : ""}>
        ${Object.entries(choices).map(([value, option]) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(option.label)}</option>`).join("")}
      </select><small class="hint" id="${prefix}-${id}-help">${esc(choices[selected]?.description)}</small></div>`;
    groups.set(phase, (groups.get(phase) ?? "") + field);
  }
  return [...groups].map(([phase, fields]) => `<fieldset class="phase-card"><legend>${phase}</legend>${fields}</fieldset>`).join("");
}
function dutyFields(players, disabled = false) {
  return players.filter(p => p.position !== "GK").map(p => `<label class="duty-field">
    <span>${esc(slots[p.slot ?? p.position])} · ${esc(p.name)}</span>
    <select data-player-duty="${esc(p.id)}"${disabled ? " disabled" : ""}>
      ${Object.entries(model.playerDuties).map(([value, label]) => `<option value="${value}"${value === (p.duty ?? "support") ? " selected" : ""}>${esc(label)}</option>`).join("")}
    </select></label>`).join("");
}
function dutyPanel(live = false) {
  const squad = model.clubs[side()].squad;
  const fields = live ? "" : dutyFields(draft.xi.map(id => ({...squad.find(p => p.id === id), duty: draft.duties?.[id]})), locked());
  return `<details class="duty-panel"><summary>Individual player duties</summary>
    <p class="hint">Choose who holds position and who joins the attack. A substitute inherits the outgoing player’s duty.</p>
    <div class="duty-grid"${live ? ' id="live-duties"' : ""}>${fields}</div></details>`;
}
function formationOptions(selected, allowSame = false) {
  const formations = Object.keys(tacticsCatalog.formations);
  if (allowSame) formations.unshift("same");
  return formations.map(id => `<option value="${esc(id)}"${id === selected ? " selected" : ""}>${esc(id === "same" ? "Match attacking shape" : id)}</option>`).join("");
}
function defensiveShapeField(selected,live) {
  const id = live ? 'live-defensive-formation' : 'defensive-formation';
  return `<div class="tactic-field"><label for="${id}">Out of possession shape</label>
    <select id="${id}" name="defensiveFormation"${live || !locked() ? "" : " disabled"}>${formationOptions(selected ?? "same",true)}</select></div>`;
}
function presetField(plan,live) {
  const id = live ? "live-preset" : "sheet-preset";
  const matching = Object.entries(model.tactics).find(([,preset]) =>
    matchInstructions.every(({id}) => (live ? plan[id] : instructionValue(plan,id)) === preset[id]));
  return `<div class="tactic-field preset-field"><label for="${id}">Playing style</label>
    <select id="${id}"${live || !locked() ? "" : " disabled"} aria-describedby="${id}-help">
      <option value="" disabled${matching ? "" : " selected"}>Custom instructions</option>
      ${Object.entries(model.tactics).map(([id,preset]) => `<option value="${esc(id)}"${matching?.[0] === id ? " selected" : ""}>${esc(preset.label)}</option>`).join("")}
    </select><small class="hint" id="${id}-help">${esc(matching?.[1].description ?? "Using your individual team instructions.")}</small></div>`;
}
function tacticsCard() {
  const disable=locked()?' disabled':'';
  let footer;
  if(!active()) footer='<p class="hint">Manage Northbank against a friend or the computer.</p>';
  else if(model.result) footer='<div class="statusline">Final team sheet</div>';
  else if(model.live) footer='<div class="statusline">Starting team sheet. Make changes from Live match.</div>';
  else if(model.schedule) {
    if (locked()) footer='<div class="statusline">Team sheet locked. The server plays the match at kickoff.</div>';
    else if (model.ready[side()] && sheetChanged()) {
      footer = button("ready", "Submit changes") + '<p class="hint">Your edits are saved on this device. Submit them to update your team sheet.</p>';
    } else if (model.ready[side()]) {
      footer = '<div class="statusline">Team sheet submitted. You can make changes until the deadline.</div>';
    } else {
      footer = button("ready", "Submit team sheet") + '<p class="hint">Submit before the deadline to avoid a forfeit.</p>';
    }
  }
  else if(locked()) footer='<div class="statusline">Team sheet locked. Waiting for '+esc(model.clubs[1-side()].name)+'.</div>';
  else footer=button("ready",'Lock team sheet <span aria-hidden="true">→</span>')+'<p class="hint">Kickoff follows once both teams lock in.</p>';
  return `<section class="card tactics"><div class="headrow"><h2>Match plan</h2></div>
    <div class="shape-fields"><div class="tactic-field"><label for="sheet-formation">In possession shape</label>
    <select id="sheet-formation"${disable}>${formationOptions(draft.formation)}</select></div>
    ${defensiveShapeField(draft.defensiveFormation,false)}</div>${presetField(draft,false)}
    ${instructionFields()}<div class="actions">${footer}</div></section>`;
}
function attributeValue(player, key) {
  if (player.attributes) return player.attributes[key];
  const legacyKey = key === "handling" || key === "tackling" ? "defending" : key;
  if ((key === "handling" && player.position !== "GK") || (key === "tackling" && player.position === "GK")) return undefined;
  if (Number.isFinite(player[legacyKey])) return Math.max(1, Math.round(player[legacyKey] / 5));
}
function attributeCell(value) {
  if (!Number.isFinite(value)) return '<span class="unrated" aria-label="Not rated">—</span>';
  const emphasis = value >= 15 ? " strong-attribute" : "";
  return '<span class="attribute-value'+emphasis+'">'+esc(value)+'</span>';
}
function playerLink(player) {
  return '<button type="button" class="player-link" data-player="'+esc(player.id)+'" aria-haspopup="dialog">'+esc(player.name)+'</button>';
}
function openProfile(trigger) {
  profileTrigger = trigger;
  const id = trigger.dataset.player;
  const club = model.clubs.find(team => team.squad.some(player => player.id === id));
  const player = club?.squad.find(candidate => candidate.id === id);
  if (!player || profile.open) return;
  profile.innerHTML = `<div class="profile-head">
    <div class="profile-identity"><span class="profile-number">${esc(player.number)}</span><div>
      <h2 id="player-profile-title">${esc(player.name)}</h2>
      <p class="hint">${esc(positions[player.position])} · ${esc(club.name)}</p>
    </div></div>
    <form method="dialog"><button type="submit" class="secondary" autofocus>Close</button></form>
  </div>
  <p class="profile-scale hint">Attributes rated from 1 to 20.</p>
  <div class="profile-grid">${Object.entries(attributeGroups).filter(([id]) =>
    id !== "goalkeeper" || player.position === "GK").map(([, group]) =>
    `<section><h3>${group.label}</h3><dl>${Object.entries(group.attributes).map(([key, label]) =>
      `<div><dt>${label}</dt><dd>${attributeCell(attributeValue(player, key))}</dd></div>`).join("")}</dl></section>`).join("")}
  </div>`;
  profile.showModal();
}
function roster(club, plan, scout = false) {
  const group = attributeGroups[rosterGroup];
  const attributes = Object.entries(group.attributes);
  const comparison = Object.entries(attributeGroups).map(([key, category]) =>
    `<button type="button" class="option${rosterGroup === key ? " selected" : ""}" data-attributes="${key}"
      aria-pressed="${rosterGroup === key}">${category.label}</button>`).join("");
  const rows = club.squad.map(player => {
    const selected = plan?.xi.includes(player.id);
    const selection = scout || !plan ? "" :
      `<td class="${selected ? "" : "bench"}">${selected ? "Starting XI" : "Bench"}</td>`;
    return `<tr><td>${esc(player.number)}</td><td><span class="position ${esc(player.position)}"
      title="${esc(positions[player.position])}">${esc(player.position)}</span></td>
      <th scope="row">${playerLink(player)}</th>
      ${attributes.map(([key]) => `<td>${attributeCell(attributeValue(player, key))}</td>`).join("")}${selection}</tr>`;
  }).join("");
  return `<section class="card roster">
    <div class="card-head"><h2>${scout ? "Opposition squad" : "Squad list"}</h2><span class="label">Attributes 1–20</span></div>
    <div class="attribute-controls" role="group" aria-label="Compare squad attributes">${comparison}</div>
    <div class="roster-scroll" tabindex="0" role="region" aria-label="${group.label} squad attributes">
      <table><thead><tr><th scope="col">No.</th><th scope="col">Pos.</th><th scope="col">Player</th>
      ${attributes.map(([, label]) => `<th scope="col">${label}</th>`).join("")}${scout || !plan ? "" : '<th scope="col">Selection</th>'}</tr></thead>
      <tbody>${rows}</tbody></table>
    </div>
  </section>`;
}
function teamPanel() {
  const club=model.clubs[side()];
  if (model.schedule && locked() && !model.ready[side()]) {
    return '<section class="card result-summary"><h2>Team sheet</h2><p>No team sheet was submitted before the deadline.</p></section>'+roster(club, null);
  }
  const shape = phaseSlot(tacticsCatalog, draft.formation, draft.defensiveFormation, 0, shapePhase).formation;
  const switcher = Object.entries(phases).map(([phase,label]) => `<button type="button" class="option ${shapePhase === phase ? 'selected' : ''}" data-shape-phase="${phase}" aria-pressed="${shapePhase === phase}">${label}</button>`).join('');
  const preview = previewOn && !model.live && !model.result;
  const players = sheetPlayers(draft);
  const current = players.find(p => p.id === selectedRolePlayer) ?? players.find(p => p.position === 'FW') ?? players[0];
  selectedRolePlayer = current.id;
  const lineup = `<section class="card lineup-card"><div class="card-head"><div><h2>Starting XI</h2>
    <p class="hint">${locked() ? 'Confirmed lineup' : 'Select a shirt to change a player or edit their role.'}</p></div><span class="label">${esc(shape)}</span></div>
    <div class="pitch-wrap"><div class="shape-switch" role="group" aria-label="Show formation">${switcher}</div>
    ${previewControls()}${pitch(club,draft,true,shapePhase,preview)}
    ${preview ? '<div class="preview-status"><small id="preview-status" role="status"></small><button type="button" class="plain" id="preview-retry" data-action="retry-preview" hidden>Retry preview</button></div>' : ''}</div></section>`;
  return `<div class="layout team-sheet"><div class="selection-column">${lineup}${playerSelection(club,players,current)}${roster(club,draft)}</div>
    ${tacticsCard()}</div>`;
}
function opponentPanel() {
  const i = 1 - side(), club = model.clubs[i];
  const players = [["finishing", "Finishing"], ["vision", "Vision"], ["tackling", "Tackling"]].map(([attribute, label]) => {
    const player = club.squad.reduce((best, candidate) =>
      (attributeValue(candidate, attribute) ?? -1) > (attributeValue(best, attribute) ?? -1) ? candidate : best);
    const value = attributeValue(player, attribute);
    if (!Number.isFinite(value)) return "";
    return `<li>${playerLink(player)}<span>${esc(positions[player.position])} · ${label} ${esc(value)}/20</span></li>`;
  }).join("");
  const known=model.result && model.plans?.[i];
  return '<div class="layout scout"><section class="card"><h2>'+esc(club.name)+'</h2><p class="hint">'+(known?'Final team sheet':'Players to watch')+'</p>'+(known?pitch(club,known,false):'<ul>'+players+'</ul>')+'</section><section class="card"><h2>Scouting report</h2><ul>'+fields.map(pos=>{const n=club.squad.filter(p=>p.position===pos).length;return '<li>'+esc(positions[pos])+'s <strong style="float:right">'+n+'</strong></li>';}).join("")+'</ul></section></div>'+roster(club,known,true);
}
function matchStatTable(stats, metrics, label) {
  const rows = metrics.filter(([key]) => Array.isArray(stats[key])).map(([key, name, format = String]) => {
    const values = stats[key].map((value, i) => esc(format(value, i)));
    return `<tr><td>${values[0]}</td><th scope="row">${name}</th><td>${values[1]}</td></tr>`;
  }).join("");
  if (!rows) return "";
  const clubHeader = club => `<th scope="col" title="${esc(club.name)}">${esc(club.shortName)}</th>`;
  return `<table class="match-stats" aria-label="${label}">
    <thead><tr>${clubHeader(model.clubs[0])}<th scope="col">Metric</th>${clubHeader(model.clubs[1])}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}
function matchStatSections(stats) {
  const overview = matchStatTable(stats, [
    ["xg", "Expected goals (xG)", value => value.toFixed(2)],
    ["possession", "Possession", value => `${value}%`],
    ["shots", "Shots"],
    ["onTarget", "Shots on target"],
    ["passes", "Passes attempted"],
    ["completedPasses", "Pass completion", (value, i) => {
      const attempts = stats.passes?.[i];
      return attempts ? `${Math.round(100 * value / attempts)}%` : "—";
    }],
    ["challengesWon", "Challenges won"], ["corners", "Corners awarded"],
    ["lineBreaks", "Line-breaking passes"],
    ["pressRegains", "Press regains"],
    ["turnovers", "Turnovers"]
  ], "Match totals");
  const groups = [
    ["Attacking", [["boxShots", "Shots inside the box"], ["oneOnOnes", "One-on-one shots"], ["woodwork", "Woodwork"],
      ["carries", "Carries"], ["crosses", "Crosses attempted"], ["completedCrosses", "Crosses completed"]]],
    ["Defending & discipline", [["challenges", "Challenges attempted"], ["interceptions", "Interceptions"],
      ["blocks", "Shot blocks"], ["saves", "Saves"], ["fouls", "Fouls"], ["advantages", "Advantages won"],
      ["yellowCards", "Yellow cards"], ["redCards", "Red cards"], ["substitutions", "Substitutions"]]],
    ["Set pieces", [["freeKicks", "Free kicks"], ["offsides", "Offsides"], ["penalties", "Penalties"],
      ["cornersTaken", "Corners taken"], ["cornersWithShot", "Corners leading to a shot"], ["cornerClaims", "Corners claimed"],
      ["cornerClearances", "Corner clearances"], ["cornerSecondBallsWon", "Second balls won after a corner"],
      ["quickCornerSecondBallShots", "Quick shots after a corner clearance"]]]
  ];
  const breakdown = groups.map(([name, metrics]) => {
    const table = matchStatTable(stats, metrics, name);
    return table ? '<section><h3>' + esc(name) + '</h3>' + table + '</section>' : "";
  }).join("");
  return {overview, breakdown};
}
function matchStats(stats) {
  const {overview, breakdown} = matchStatSections(stats);
  return overview + (breakdown ? `<details class="report-stat-details"${reportStatsExpanded ? " open" : ""}>
    <summary id="report-stat-summary">Detailed stats</summary>${breakdown}
  </details>` : "");
}
const sideNames = ["home", "away"];
const shotZones = {box: "Inside the box", edge: "Edge of the box", wide: "Wide angle"};
const eventLabels = {
  goal: "Goal", save: "Saved", miss: "Off target", blocked: "Blocked", woodwork: "Woodwork",
  foul: "Foul", "yellow-card": "Yellow card", "red-card": "Red card", offside: "Offside",
  penalty: "Penalty", corner: "Corner", "corner-second-ball": "Second ball",
  injury: "Injury", substitution: "Substitution", abandoned: "Abandoned",
  tactics: "Tactical change", "substitution-cancelled": "Substitution cancelled"
};
const keyIncidents = new Set(["yellow-card", "red-card", "penalty", "corner", "corner-second-ball",
  "injury", "substitution", "abandoned"]);
const shotSituations = {
  "open-play": "Open play", corner: "Corner", "free-kick": "Free kick", penalty: "Penalty",
  head: "Header", foot: "Foot"
};
const cornerRoutes = {
  "near-post": "Near-post corner", central: "Central corner", "far-post": "Far-post corner",
  edge: "Corner to the edge of the box", short: "Short corner"
};
function eventTime(event) {
  if (typeof event.minute === "string" && event.minute.includes("+")) return `${event.minute}′`;
  if (Number.isInteger(event.period) && Number.isFinite(event.minute)) {
    return event.addedMinute ? `${event.minute}+${event.addedMinute}′` : `${event.minute}′`;
  }
  if (!Number.isFinite(event.second)) return event.minute == null ? "" : `${event.minute}′`;
  const second = Math.floor(event.second);
  return `${Math.floor(second / 60)}:${String(second % 60).padStart(2, "0")}`;
}
function eventOrder(event) {
  return Number.isFinite(event.second) ? event.second : 60 * (Number(event.minute) || 0);
}
function shotLocation(shot) {
  const {x, y} = shot.location ?? {};
  return Number.isFinite(x) && x >= 0 && x <= 105 && Number.isFinite(y) && y >= 0 && y <= 68 ? {x, y} : null;
}
function shotDescription(shot) {
  const team = model.clubs[sideNames.indexOf(shot.side)];
  const scorer = team?.squad.find(player => player.id === shot.playerId)?.name ?? shot.playerName;
  return [scorer ?? team?.shortName, eventLabels[shot.type]].filter(Boolean).join(" · ");
}
function shotFacts(shot) {
  const distance = Number.isFinite(shot.distance) ? `${shot.distance.toFixed(1)} m` : shotZones[shot.zone];
  const quality = Number.isFinite(shot.xg) ? `${shot.xg.toFixed(2)} xG` : null;
  const goalAngle = Number.isFinite(shot.goalAngle) ? `${shot.goalAngle.toFixed(1)}° goal angle` : null;
  const visibleAngle = Number.isFinite(shot.visibleAngle) ? `${shot.visibleAngle.toFixed(1)}° visible` : null;
  return [cornerRoutes[shot.cornerRoute] ?? shotSituations[shot.situation],
    shot.unguardedGoal ? "Unguarded goal" : shot.oneOnOne ? "One-on-one" : null,
    shot.finish === "chip" ? "Chip" : shot.finish === "placed" ? "Placed finish" : null,
    shot.secondBall ? "Second ball" : null, shot.rushed ? "First-time shot" : shotSituations[shot.bodyPart],
    distance, quality, goalAngle, visibleAngle]
    .filter(Boolean).join(" · ");
}
function shotMap(shots, selection) {
  const mapped = shots.filter(({event}) => shotLocation(event));
  if (!mapped.length) return "";
  const markers = mapped.map(({event, shotIndex}) => {
    const {x, y} = shotLocation(event);
    const description = [eventTime(event), shotDescription(event), Number.isFinite(event.xg) ? `${event.xg.toFixed(2)} xG` : ""]
      .filter(Boolean).join(", ");
    const size = Math.round(8 + 10 * Math.min(1, Math.max(event.xg || 0, 0)));
    return `<button type="button" class="shot-marker ${event.side === "away" ? "away" : "home"}${event.type === "goal" ? " scored" : ""}"
      data-map-shot="${shotIndex}" aria-pressed="${selection?.shotIndex === shotIndex}" aria-label="${esc(description)}"
      style="left:${100 * (x + 4) / 113}%;top:${100 * (y + 4) / 76}%;--dot-size:${size}px"></button>`;
  }).join("");
  return `<figure class="shot-map">
    <figcaption><h3>Shot map</h3><p class="hint">Home attack right · Away attack left · Filled marks are goals</p></figcaption>
    <div class="report-pitch" role="group" aria-label="Shots on the pitch">
      <svg viewBox="0 0 113 76" preserveAspectRatio="none" aria-hidden="true">
        <path d="M4 4h105v68H4z M56.5 4v68 M4 17.84h16.5v40.32H4 M109 17.84H92.5v40.32H109
          M4 28.84h5.5v18.32H4 M109 28.84h-5.5v18.32H109 M4 34.34H1v7.32h3 M109 34.34h3v7.32h-3"/>
        <circle cx="56.5" cy="38" r="9.15"/><circle cx="56.5" cy="38" r=".5"/>
      </svg>
      ${markers}
    </div>
  </figure>`;
}
function shotDetail(selection) {
  if (!selection) return "";
  const {event} = selection;
  return `<div class="shot-detail" role="status">
    <b>${esc(eventTime(event))} · ${esc(shotDescription(event))}</b>
    <span>${esc(shotFacts(event))}</span>
  </div>`;
}
function possessionBeforeShot(selection, result) {
  if (!Number.isInteger(selection?.event.possession) || !Array.isArray(result.actions)) return "";
  const shot = selection.event;
  const actions = result.actions.filter(action => action.possession === shot.possession && action.side === shot.side
    && action.second <= shot.second && ["pass", "carry", "recovery"].includes(action.type));
  if (!actions.length) return "";
  const side = sideNames.indexOf(shot.side);
  const players = new Map([
    ...model.clubs[side].squad.map(player => [player.id, player.name]),
    ...(result.performances?.[side] ?? []).map(player => [player.playerId, player.name])
  ].filter(([, name]) => name));
  const recent = actions.slice(-10);
  const rows = recent.map(action => {
    const name = players.get(action.playerId) ?? "Unknown player";
    const target = players.get(action.targetId) ?? "a teammate";
    const play = action.type === "recovery" ? name + " wins the second ball"
      : action.type === "carry" ? name + " carries the ball" : name + " passes to " + target;
    return '<li><span>'+esc(eventTime(action))+'</span>'+esc(play)+'</li>';
  }).join("");
  const label = actions.length > recent.length ? "Last "+recent.length+" actions before the shot" : "Build-up to this shot";
  return '<details class="shot-possession"'+(possessionExpanded ? ' open' : '')+'>'+
    '<summary id="shot-build-up">'+label+'</summary><ol>'+rows+'</ol></details>';
}
function matchTimeline(result) {
  const matchesTeam = event => reportTeam === "both" || reportTeam === event.side;
  const shots = result.events.map((event, shotIndex) => ({event, shotIndex})).filter(({event}) => matchesTeam(event));
  const preferredShot = shots.find(shot => shot.event.type === "goal") ?? shots[0];
  const selection = shots.find(shot => shot.shotIndex === selectedShot) ?? preferredShot;
  const incidents = (result.timeline ?? []).filter(matchesTeam).map(event => ({event, shotIndex: null}));
  const entries = [...shots, ...incidents].sort((a, b) => eventOrder(a.event) - eventOrder(b.event)).filter(row => {
    if (reportFilter === "shots") return row.shotIndex !== null;
    if (reportFilter === "highlights") return row === selection || row.event.type === "goal" || row.event.advantage || keyIncidents.has(row.event.type);
    return true;
  });
  const filterButton = (value, label) => `<button type="button" class="option${reportFilter === value ? " selected" : ""}"
    data-report-filter="${value}" aria-pressed="${reportFilter === value}">${label}</button>`;
  const teamOptions = ["both", ...sideNames].map((name, index) =>
    `<option value="${name}"${name === reportTeam ? " selected" : ""}>${index === 0 ? "Both teams" : esc(model.clubs[index - 1].name)}</option>`).join("");
  const timeline = entries.length ? `<ol class="events">${entries.map(({event, shotIndex}) => {
    const side = model.clubs[sideNames.indexOf(event.side)];
    const details = [side?.shortName, eventLabels[event.type], Number.isFinite(event.xg) ? `${event.xg.toFixed(2)} xG` : ""].filter(Boolean).join(" · ");
    const text = `<span>${esc(event.text)}</span>${details ? `<small class="event-details">${esc(details)}</small>` : ""}`;
    return `<li class="event ${esc(event.type)}"><span class="event-minute">${esc(eventTime(event))}</span>
      ${shotIndex === null ? `<div>${text}</div>` : `<button type="button" class="timeline-shot" data-timeline-shot="${shotIndex}"
        aria-pressed="${selection?.shotIndex === shotIndex}">${text}</button>`}
    </li>`;
  }).join("")}</ol>` : '<p class="analysis">No events match these filters.</p>';
  return `<h2>Match timeline</h2>
    <div class="report-timeline-controls">
      <div class="timeline-filters" role="group" aria-label="Filter match events">
        ${filterButton("highlights", "Key events")}${filterButton("shots", "Shots")}${filterButton("all", "Shots and incidents")}
      </div>
      <label for="report-team-filter">Team</label>
      <select id="report-team-filter">${teamOptions}</select>
    </div>
    ${shotMap(shots, selection)}${shotDetail(selection)}${possessionBeforeShot(selection, result)}${timeline}`;
}
function chanceChart(events) {
  const chances = events.filter(event => Number.isFinite(event.xg) && Number.isFinite(event.minute));
  if (!chances.length) return "";
  const lanes = sideNames.map((name, index) => {
    const markers = chances.filter(event => event.side === name).map(event => {
      const minute = Math.max(0, Math.min(100, event.minute / 90 * 100));
      const height = Math.max(8, Math.min(100, event.xg * 100));
      return `<i class="chance-mark${event.type === "goal" ? " scored" : ""}" style="--minute:${minute}%;--chance:${height}%"></i>`;
    }).join("");
    return `<div class="chance-lane ${name}"><b>${esc(model.clubs[index].shortName)}</b><div class="chance-track">${markers}</div></div>`;
  }).join("");
  return `<div class="chance-chart" aria-hidden="true">
    <h3>Chances by minute</h3>
    ${lanes}
    <div class="chance-time"><span>0′</span><span>30′</span><span>60′</span><span>90′</span></div>
    <p class="hint">Taller bars indicate better chances. Filled bars indicate goals.</p>
  </div>`;
}
function shotTimeline(events) {
  if (!events.length) return '<p class="analysis">No shots were recorded.</p>';
  return '<ol class="events">'+events.map(event => {
    const team = model.clubs[sideNames.indexOf(event.side)];
    const quality = Number.isFinite(event.xg) ? `${event.xg.toFixed(2)} xG` : "";
    const details = [team?.shortName, shotZones[event.zone], quality].filter(Boolean).join(" · ");
    return `<li class="event ${esc(event.type)}">
      <span class="event-minute">${esc(event.minute)}′</span><div>${esc(event.text)}
      ${details ? '<small class="event-details">'+esc(details)+'</small>' : ""}</div>
    </li>`;
  }).join("")+'</ol>';
}
function performancePanel(performances) {
  if (!Array.isArray(performances)) return "";
  const index = reportSide ?? side();
  const squad = model.clubs[index].squad;
  const selectors = model.clubs.map((club, i) =>
    `<button type="button" class="option${index === i ? " selected" : ""}" data-performance-side="${i}"
      aria-pressed="${index === i}">${esc(club.name)}</button>`).join("");
  const columns = [
    ...(performances[index].some(player => Number.isFinite(player.rating))
      ? [["Rating", "Match rating from 1 to 10", player => player.rating?.toFixed(1) ?? "—"]] : []),
    ["Min", "Minutes", player => player.minutes],
    ["Goals", "Goals", player => player.goals],
    ["Assists", "Assists", player => player.assists],
    ["Shots", "Shots", player => player.shots],
    ...(performances[index].some(player => Number.isFinite(player.xg)) ? [
      ["On target", "Shots on target", player => player.onTarget],
      ["xG", "Expected goals", player => player.xg.toFixed(2)],
      ["Challenges won", "Defensive challenges won against a ball carrier", player => player.challengesWon]
    ] : []),
    ["Passes", "Completed passes / attempted passes", player => `${player.completedPasses}/${player.passes}`],
    ["Chances created", "Chances created", player => player.chancesCreated],
    ["Regains", "Possession regains", player => player.regains ?? "—"],
    ...(performances[index].some(player => Number.isFinite(player.fouls))
      ? [["Fouls", "Fouls committed", player => player.fouls ?? "—"]] : []),
    ["Saves", "Saves", player => player.saves],
    ["Final condition", "Final condition", player => `${player.condition}%`]
  ];
  const rows = performances[index].map(line => {
    const player = squad.find(p => p.id === line.playerId);
    const name = player ? playerLink(player) : esc(line.name ?? line.playerId);
    return `<tr><th scope="row">${name}</th>${columns.map(([, , value]) => `<td>${esc(value(line))}</td>`).join("")}</tr>`;
  }).join("");
  return `<section class="card roster performances">
    <div class="card-head"><h2>Player performances</h2></div>
    <div class="attribute-controls performance-controls" role="group" aria-label="Choose a team">${selectors}</div>
    <div class="roster-scroll" tabindex="0" role="region" aria-label="${esc(model.clubs[index].name)} player performances">
      <table><thead><tr><th scope="col">Player</th>${columns.map(([label, title]) =>
        `<th scope="col" title="${title}">${label}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
    </div>
  </section>`;
}

function livePanel() {
  const sides = model.clubs.map((club, index) =>
    `<span class="live-team ${sideNames[index]}"><i aria-hidden="true"></i><span>${esc(club.name)}</span><b id="live-score-${index}">0</b></span>`);
  return `<div class="live-layout">
      <section class="live-pitch-card" aria-label="Live match">
        <div class="live-board">${sides[0]}<span id="live-clock"></span>${sides[1]}</div>
        <canvas id="live-pitch" role="img" aria-label="Animated pitch with numbered players and surnames. The ball carrier is highlighted in lime.">
          Follow the score and events in the match commentary.
        </canvas>
        <div class="pitch-commentary" id="pitch-commentary" aria-label="Live commentary">
          <span id="commentary-stamp">Kickoff</span><strong id="commentary-text">The teams are ready.</strong>
        </div>
      </section>
    <aside class="card live-stats" id="live-stats" aria-label="Live match statistics">
      <h2>Match stats</h2><div id="live-stat-tables"></div><div id="live-shot-map"></div>
    </aside>
    <div class="live-rail">
      <div class="live-rail-switch" role="group" aria-label="Live match panel">
        <button type="button" class="option selected" data-live-panel="touchline" aria-controls="live-touchline" aria-pressed="true">Touchline</button>
        <button type="button" class="option" data-live-panel="ratings" aria-controls="live-ratings" aria-pressed="false">Ratings</button>
      </div>
      <section class="card live-touchline" id="live-touchline">
        <div class="live-panel-heading"><h2>Touchline</h2><p class="hint">${esc(model.clubs[side()].name)}</p></div>
        <form id="live-tactics" class="live-form">${defensiveShapeField(model.live.teams[side()].defensiveFormation,true)}${presetField(model.live.teams[side()],true)}
          <div id="live-role-editor"></div><div class="tactic-groups">${instructionFields(true)}</div>${dutyPanel(true)}<button class="primary" type="submit">Apply tactics</button></form>
        <form id="live-substitution" class="live-form">
          <h3>Substitution</h3>
          <label for="live-outgoing">Player off</label><select id="live-outgoing" name="outgoingId"></select>
          <label for="live-incoming">Player on</label><select id="live-incoming" name="incomingId"></select>
          <button class="secondary" type="submit">Queue substitution</button>
          <p class="hint" id="live-sub-status"></p>
        </form>
        <form id="live-swap" class="live-form"><h3>Swap positions</h3>
          <label for="live-swap-first">First outfielder</label><select id="live-swap-first" name="firstId"></select>
          <label for="live-swap-second">Switch with</label><select id="live-swap-second" name="secondId"></select>
          <button class="secondary" type="submit">Swap positions</button></form>
        <details class="live-bench"><summary>Bench</summary><ul id="live-bench-list"></ul></details>
      </section>
      <section class="card live-ratings" id="live-ratings" hidden>
        <div class="live-panel-heading"><h2>Player ratings</h2>
          <select id="live-ratings-team" aria-label="Team for player ratings">${model.clubs.map((club, index) =>
            `<option value="${index}"${index === side() ? " selected" : ""}>${esc(club.name)}</option>`).join("")}</select>
        </div>
        <label class="live-ratings-view">Show <select id="live-ratings-view">
          <option value="fitness">Condition</option><option value="shooting">Shooting</option>
          <option value="defending">Defending</option><option value="roles">Player roles</option></select></label>
        <div class="ratings-scroll" tabindex="0" role="region" aria-label="Live player ratings"><table><thead><tr id="live-rating-head"></tr></thead>
          <tbody id="live-rating-rows"></tbody></table></div>
      </section>
    </div>
    <section class="card live-breakdown"><h2>Detailed match stats</h2><div id="live-stat-breakdown"></div></section>
    <section class="card live-commentary"><h2>Match events</h2><ol class="events" id="live-events"></ol></section>
  </div>`;
}

function fillLiveOptions(select, players, emptyLabel) {
  const previous = select.value;
  const html = players.length ? players.map(player =>
    `<option value="${esc(player.id)}">${esc(slots[player.slot ?? player.position])} · ${esc(player.name)}</option>`).join("") : `<option value="">${emptyLabel}</option>`;
  if (select.dataset.options === html) return;
  select.dataset.options = html;
  select.innerHTML = html;
  if (players.some(player => player.id === previous)) select.value = previous;
}

function updateLiveStats(live) {
  const stats = live.stats;
  const tables = document.getElementById("live-stat-tables");
  const snapshot = JSON.stringify(stats);
  if (tables.dataset.previous !== snapshot) {
    tables.dataset.previous = snapshot;
    const {overview, breakdown} = matchStatSections(stats);
    tables.innerHTML = overview;
    document.getElementById("live-stat-breakdown").innerHTML = breakdown;
  }
  const map = document.getElementById("live-shot-map");
  const shots = live.shots.map((event, shotIndex) => ({event, shotIndex}));
  const selection = shots[liveSelectedShot] ?? shots.at(-1);
  const version = shots.length + "/" + selection?.shotIndex;
  if (map.dataset.version !== version) {
    const focused = map.contains(document.activeElement) ? document.activeElement.dataset.mapShot : undefined;
    map.dataset.version = version;
    map.innerHTML = shots.length ? shotMap(shots, selection) + shotDetail(selection) : '<p class="hint">No shots yet.</p>';
    if (focused !== undefined) map.querySelector('[data-map-shot="' + CSS.escape(focused) + '"]')?.focus({preventScroll: true});
  }
}

function pitchCommentator() {
  const bar = document.getElementById("pitch-commentary");
  let holdUntil = 0, priority = 0;
  return (line, cut = false) => {
    if (model?.live?.phase === "half-time") return;
    if (cut) {
      holdUntil = 0;
      line ??= model?.live?.incidents[0];
    }
    if (!line || (performance.now() < holdUntil && (line.priority ?? 2) <= priority)) return;
    priority = line.priority ?? 2;
    holdUntil = performance.now() + (priority === 3 ? 3200 : priority === 2 ? 2200 : 1350);
    bar.dataset.side = line.side;
    document.getElementById("commentary-stamp").textContent = eventTime(line) + " · " + model.clubs[sideNames.indexOf(line.side)].shortName;
    document.getElementById("commentary-text").textContent = line.text;
  };
}

function updateLiveRoles(team, defensiveFormation) {
  const formation = team.formation ?? draft.formation;
  const players = team.players.filter(p => p.active && Number.isInteger(p.slotIndex)).sort((a,b) => a.slotIndex - b.slotIndex);
  const assignments = {};
  const playerInstructions = {};
  for (const id of Object.keys(pendingPlayerInstructions)) {
    if (!players.some(p => p.id === id && p.position !== 'GK')) delete pendingPlayerInstructions[id];
  }
  pendingRoles = validRoles(tacticsCatalog, formation, defensiveFormation, players, pendingRoles);
  for (const p of players) {
    const saved = team.playerRoles?.[p.id] ?? p.roles ?? {};
    for (const phase of Object.keys(pendingRoles[p.id] ?? {})) {
      const slot = phaseSlot(tacticsCatalog, formation, defensiveFormation, p.slotIndex, phase);
      const choices = tacticsCatalog.roleOptions[slot.formation][slot.index][phase];
      const current = choices.find(r => r.id === saved[phase]) ?? choices[0];
      if (pendingRoles[p.id][phase] === current.id) delete pendingRoles[p.id][phase];
    }
    if (!Object.keys(pendingRoles[p.id] ?? {}).length) delete pendingRoles[p.id];
    assignments[p.id] = {...saved, ...pendingRoles[p.id]};
    const current = team.playerInstructions?.[p.id] ?? p.instructions ?? {};
    const pending = pendingPlayerInstructions[p.id];
    if (pending) {
      for (const key of Object.keys(pending)) {
        if (pending[key] === (current[key] ?? 'standard')) delete pending[key];
      }
      if (!Object.keys(pending).length) delete pendingPlayerInstructions[p.id];
    }
    playerInstructions[p.id] = {...current, ...pending};
  }
  const opposition = model.live.teams[1-side()];
  for (const [id, assignment] of Object.entries(pendingMarkingTargets)) {
    if (!players.some(p => p.id === id) || targetValue(team.markingTargets?.[id]) === targetValue(assignment)) delete pendingMarkingTargets[id];
  }
  const markingTargets = {...team.markingTargets, ...pendingMarkingTargets};
  const target = document.getElementById("live-role-editor");
  const html = roleEditor({catalog:tacticsCatalog, formation, defensiveFormation, players, assignments, playerInstructions,
    markingTargets, opponents:[...opposition.players.map(p => ({...p, unavailable:!p.active})), ...opposition.bench.map(p => ({...p, active:false}))], selectedId:selectedRolePlayer, disabled:busy, esc});
  if (target.dataset.previous === html) return;
  const control = target.contains(document.activeElement) && document.activeElement.id;
  const overview = target.querySelector(".role-overview")?.open;
  target.innerHTML = html;
  target.dataset.previous = html;
  if (overview && target.querySelector(".role-overview")) target.querySelector(".role-overview").open = true;
  if (control) document.getElementById(control)?.focus({preventScroll:true});
}

function updateLivePanel() {
  const live = model.live;
  livePitch.update(live.frames, live.teams, live.matchSpeed);
  const get = id => document.getElementById(id);
  const elapsed = (live.period - 1) * 45 * 60 + live.elapsed;
  const clock = Math.floor(elapsed / 60) + ":" + String(elapsed % 60).padStart(2, "0");
  get("live-clock").textContent = live.phase === "half-time" ? "Half-time" : clock + (live.added ? " +" + live.added : "");
  if (live.phase === "half-time") {
    get("pitch-commentary").dataset.side = "";
    get("commentary-stamp").textContent = "HT";
    get("commentary-text").textContent = "The referee blows for half-time.";
  } else if (get("commentary-stamp").textContent === "HT") {
    get("commentary-stamp").textContent = "Second half";
    get("commentary-text").textContent = "The teams return for the restart.";
  }
  const fastForward = app.querySelector('[data-action="fast-forward"]');
  if (fastForward) fastForward.textContent = live.phase === "half-time" ? "Resume second half" : "Fast-forward 10 min";
  live.score.forEach((value, index) => { get("live-score-" + index).textContent = value; });
  updateLiveStats(live);

  const team = live.teams[side()];
  const tactics = get("live-tactics");
  const defensiveFormation = get("live-defensive-formation");
  const savedShape = team.defensiveFormation ?? "same";
  if (!liveTacticsDirty || !defensiveFormation.dataset.instructionEdited) defensiveFormation.value = savedShape;
  if (defensiveFormation.value === savedShape) delete defensiveFormation.dataset.instructionEdited;
  defensiveFormation.disabled = busy;
  updateLiveRoles(team, defensiveFormation.value);
  for (const {id} of matchInstructions) {
    const select = tactics.elements[id];
    if (!liveTacticsDirty || !select.dataset.instructionEdited) select.value = team[id];
    if (select.value === team[id]) delete select.dataset.instructionEdited;
    select.disabled = busy;
    get("live-" + id + "-help").textContent = model.instructions[id][select.value]?.description ?? "";
  }
  const style = Object.entries(model.tactics).find(([,preset]) => matchInstructions.every(({id}) => tactics.elements[id].value === preset[id]));
  get("live-preset").value = style?.[0] ?? "";
  get("live-preset").disabled = busy;
  get("live-preset-help").textContent = style?.[1].description ?? "Using your individual team instructions.";
  const duties = get("live-duties");
  const outfield = team.players.filter(p => p.active && p.position !== "GK");
  const roster = outfield.map(p => p.id + "/" + p.position + "/" + p.slot).join(",");
  if (duties.dataset.roster !== roster) {
    const pending = Object.fromEntries([...duties.querySelectorAll("select[data-edited]")].map(el => [el.dataset.playerDuty, el.value]));
    duties.innerHTML = dutyFields(outfield);
    duties.dataset.roster = roster;
    for (const el of duties.querySelectorAll("select")) {
      if (liveTacticsDirty && pending[el.dataset.playerDuty]) {
        el.value = pending[el.dataset.playerDuty];
        el.dataset.edited = "true";
      }
    }
  }
  for (const el of duties.querySelectorAll("select")) {
    const duty = outfield.find(p => p.id === el.dataset.playerDuty).duty;
    if (!liveTacticsDirty || duty === el.value) delete el.dataset.edited;
    if (!el.dataset.edited) el.value = duty;
    el.disabled = busy;
  }
  liveTacticsDirty = Boolean(Object.keys(pendingMarkingTargets).length || Object.keys(pendingRoles).length || Object.keys(pendingPlayerInstructions).length ||
    tactics.querySelector("[data-edited], [data-instruction-edited]"));
  tactics.querySelector('button[type="submit"]').disabled = busy || !liveTacticsDirty;
  const outgoing = get("live-outgoing"), incoming = get("live-incoming");
  const first = get("live-swap-first"), second = get("live-swap-second");
  const onPitch = team.players.filter(p => p.active && p.position !== "GK");
  fillLiveOptions(first, onPitch, "No outfielder");
  fillLiveOptions(second, onPitch.filter(p => p.id !== first.value), "No other outfielder");
  get("live-swap").querySelector("button").disabled = busy || !first.value || !second.value;
  const available = team.players.filter(player => player.active && team.bench.some(reserve => reserve.position === player.position));
  fillLiveOptions(outgoing, available, "No eligible player");
  const position = available.find(player => player.id === outgoing.value)?.position;
  fillLiveOptions(incoming, team.bench.filter(player => player.position === position), "No eligible substitute");
  const pending = team.pendingSubstitution;
  const disabled = busy || Boolean(pending) || team.substitutions >= 5 || team.windows >= 3;
  outgoing.disabled = incoming.disabled = disabled;
  get("live-substitution").querySelector("button").disabled = disabled || !outgoing.value || !incoming.value;
  const queuedPlayer = pending && team.bench.find(player => player.id === pending.incomingId);
  const outgoingPlayer = team.players.find(player => player.id === (pending?.outgoingId ?? outgoing.value));
  const slotLabel = slots[outgoingPlayer?.slot ?? outgoingPlayer?.position];
  get("live-sub-status").textContent = pending
    ? "Queued for the next stoppage" + (queuedPlayer ? " · " + queuedPlayer.name + " at " + slotLabel : "")
    : [slotLabel && "Player on takes over at " + slotLabel.toLowerCase(), `${team.substitutions}/5 used · ${team.windows}/3 stoppages`].filter(Boolean).join(". ");
  get("live-bench-list").innerHTML = team.bench.map(player =>
    `<li><span>${esc(positions[player.position])}</span> ${esc(player.name)}</li>`).join("") || "<li>No unused substitutes.</li>";

  const viewTeam = live.teams[Number(get("live-ratings-team").value)];
  const playerRole = (player,phase) => {
    if (!viewTeam.formation || !Number.isInteger(player.slotIndex)) return '—';
    const slot = phaseSlot(tacticsCatalog, viewTeam.formation, viewTeam.defensiveFormation, player.slotIndex, phase);
    const choices = tacticsCatalog.roleOptions[slot.formation][slot.index][phase];
    return (choices.find(r => r.id === player.roles?.[phase]) ?? choices[0]).label;
  };
  const ratingsView = get("live-ratings-view").value;
  const columns = {
    fitness: [["Condition", p => p.condition + "%"]],
    shooting: [["Shots", p => p.shots], ["On target", p => p.onTarget], ["xG", p => p.xg.toFixed(2)]],
    defending: [["Challenges won", p => p.challengesWon ?? "—"], ["Regains", p => p.regains ?? "—"],
      ["Fouls", p => p.fouls ?? "—"], ["Saves", p => p.saves ?? "—"]],
    roles: Object.entries(phases).map(([phase,label]) => [label, p => playerRole(p,phase)])
  }[ratingsView];
  const jobNote = (player, label) => {
    const job = player.defensiveJob;
    if (ratingsView !== "roles" || label !== phases.outOfPossession || !player.active || !job?.label) return "";
    return '<small class="defensive-assignment">'+esc(job.label)+(job.targetName ? ' · '+esc(job.targetName) : '')+'</small>';
  };
  get("live-rating-head").innerHTML = ["Player", ...columns.map(([name]) => name), "Rating"]
    .map(label => '<th scope="col">' + label + '</th>').join("");
  get("live-rating-rows").innerHTML = viewTeam.players.map(player => `<tr${player.active ? "" : ' class="player-off"'}>
    <th scope="row"><span class="live-shirt">${esc(player.number ?? "–")}</span>
      ${esc(player.name)}<small class="live-player-slot">${esc(slots[player.slot ?? player.position])}</small>${player.goals ? `<span class="live-player-note">${player.goals} G</span>` : ""}
      ${player.dismissed ? '<span class="live-player-note">Red card</span>' : player.cautions
        ? '<span class="live-player-note">Booked</span>' : player.active ? "" : '<span class="live-player-note">Off</span>'}</th>
    ${columns.map(([label, value]) => '<td>' + esc(value(player)) + jobNote(player,label) + '</td>').join("")}<td><b class="live-rating ${player.rating >= 7.5 ? "strong" : player.rating < 6 ? "low" : ""}">
      ${player.rating.toFixed(1)}</b></td></tr>`).join("");
  get("live-events").innerHTML = live.incidents.map(event => `<li class="event ${esc(event.type)}">
    <span class="event-minute">${esc(eventTime(event))}</span><div>${esc(event.text)}
    <small>${esc(model.clubs[sideNames.indexOf(event.side)]?.shortName)} · ${esc(eventLabels[event.type] ?? "Match event")}</small></div>
  </li>`).join("") || '<li class="hint">Waiting for the first match event.</li>';
}
function reportPanel() {
  const result = model.result;
  if (result.kind === "double-forfeit") {
    return '<section class="card result-summary"><h2>Double forfeit</h2><p>Neither team submitted a team sheet by the deadline.</p></section>';
  }
  if (result.kind === "forfeit") {
    const losingClub = model.clubs[result.score[0] === 0 ? 0 : 1];
    return '<section class="card result-summary"><h2>Forfeit</h2><p>'+esc(losingClub.name)+' missed the team-sheet deadline. The other team was awarded a 3–0 win.</p></section>';
  }
  const abandoned = result.kind === "abandoned" || result.kind === "double-abandonment";
  const stoppage = abandoned ? `<section class="card result-summary report-abandoned" aria-label="Abandonment ruling">
    <h2>Match abandoned</h2>
    <p>${result.playedScore ? `Score at stoppage ${esc(result.playedScore.join(" – "))}. ` : ""}
      ${result.score ? `Official result ${esc(result.score.join(" – "))}.` : "Recorded as a double abandonment."}</p>
  </section>` : "";
  const timeline = Array.isArray(result.timeline) || result.events.some(shotLocation)
    ? matchTimeline(result)
    : `<h2>Shot timeline</h2>${chanceChart(result.events)}${shotTimeline(result.events)}`;
  return `${stoppage}<div class="layout report">
    <section class="card report-stats"><h2>Match stats</h2>${matchStats(result.stats)}
      <h3>Manager’s report</h3><p class="analysis">${esc(result.analysis[side()])}</p>
    </section>
    <section class="card report-timeline">${timeline}</section>
  </div>${performancePanel(result.performances)}`;
}
function focusedControl() {
  const focused = document.activeElement;
  if (!app.contains(focused)) return null;
  if (focused.id) return "#" + CSS.escape(focused.id);
  const attribute = focused.getAttributeNames().find(name => name.startsWith("data-"));
  return attribute ? '['+attribute+'="'+CSS.escape(focused.getAttribute(attribute))+'"]' : null;
}
function render() {
  if(!model)return;
  const inviteBox=invitation?'<div class="card invite-box"><label for="invite-url">Away manager’s invite</label><input id="invite-url" readonly value="'+esc(invitation)+'">'+button("copy","Copy link","secondary")+button("close-invite","Close","plain")+'</div>':'';
  const scheduleOpen = app.querySelector(".schedule-options")?.open;
  const control = focusedControl();
  const dutiesOpen = app.querySelector(".duty-panel")?.open;
  const rolesOpen = app.querySelector(".role-overview")?.open;
  const swapsOpen = app.querySelector(".starter-swaps")?.open;
  const statsDetails = app.querySelector(".report-stat-details");
  if (statsDetails) reportStatsExpanded = statsDetails.open;
  const possession = app.querySelector(".shot-possession");
  if (possession) possessionExpanded = possession.open;
  livePitch?.close();
  livePitch = null;
  const watching = currentTab === "live" && model.live;
  app.innerHTML=heading()+inviteBox+scheduledFixtureForm()+(watching?"":scoreboard())+tabBar()+
    (watching?livePanel():currentTab==="opposition"?opponentPanel():currentTab==="report"&&model.result?reportPanel():teamPanel());
  if (watching) {
    livePitch = animatePitch(document.getElementById("live-pitch"), pitchCommentator());
    liveTacticsDirty = false;
    updateLivePanel();
  }
  if (scheduleOpen && app.querySelector(".schedule-options")) app.querySelector(".schedule-options").open = true;
  if (dutiesOpen && app.querySelector(".duty-panel")) app.querySelector(".duty-panel").open = true;
  if (rolesOpen && app.querySelector(".role-overview")) app.querySelector(".role-overview").open = true;
  if (swapsOpen && app.querySelector(".starter-swaps")) app.querySelector(".starter-swaps").open = true;
  syncShapePreview();
  if (control) app.querySelector(control)?.focus({preventScroll: true});
}
function gate(title,message,action="",label="") {
  app.innerHTML='<section class="gate"><div class="eyebrow">Matchday 01</div><h1>'+esc(title)+'</h1><p>'+esc(message)+'</p>'+(action?button(action,label):'')+' <a class="plain" href="/">Match centre</a></section>';
}
function changeFormation(formation) {
  const squad=model.clubs[side()].squad, ordered=[...draft.xi.map(id=>squad.find(p=>p.id===id)),...squad.filter(p=>!draft.xi.includes(p.id))];
  draft.xi=fields.flatMap(pos=>ordered.filter(p=>p.position===pos).slice(0,tacticsCatalog.formations[formation][pos]).map(p=>p.id));
  if (draft.markingTargets) draft.markingTargets = Object.fromEntries(Object.entries(draft.markingTargets).filter(([id]) => draft.xi.includes(id)));
  if (draft.duties) draft.duties = Object.fromEntries(Object.entries(draft.duties).filter(([id]) => draft.xi.includes(id)));
  draft.formation=formation;
  draft.playerRoles = validRoles(tacticsCatalog, formation, draft.defensiveFormation, sheetPlayers(draft), draft.playerRoles);
  if (draft.playerInstructions) draft.playerInstructions = sheetInstructions(draft, draft.playerInstructions);
}
async function copyInvite() {
  try {await navigator.clipboard.writeText(invitation);toast("Invite link copied");}
  catch {const input=document.querySelector("#invite-url");input?.focus();input?.select();toast("Select and copy the invite link.");}
}
app.addEventListener("focusin", event => {
  const form = event.target.closest("#schedule-fixture");
  if (form) refreshScheduleTiming(form);
});
app.addEventListener("input", event => {
  if (event.target.id !== "kickoff-local") return;
  const form = event.target.form;
  kickoffDraft = event.target.value;
  scheduleError(form, "");
});
app.addEventListener("submit", async event => {
  if (["live-tactics", "live-substitution", "live-swap"].includes(event.target.id)) {
    event.preventDefault();
    if (busy || !model.live) return;
    const kind = {"live-tactics":"tactics", "live-substitution":"substitution", "live-swap":"swap-positions"}[event.target.id];
    const body = {kind};
    if (kind === "tactics") {
      for (const el of event.target.querySelectorAll("[data-instruction-edited]")) body[el.name] = el.value;
      body.duties = Object.fromEntries([...event.target.querySelectorAll("select[data-edited]")].map(el => [el.dataset.playerDuty, el.value]));
      if (Object.keys(pendingMarkingTargets).length) body.markingTargets = pendingMarkingTargets;
      if (Object.keys(pendingRoles).length) body.playerRoles = pendingRoles;
      if (Object.keys(pendingPlayerInstructions).length) body.playerInstructions = pendingPlayerInstructions;
    } else {
      Object.assign(body, Object.fromEntries(new FormData(event.target)));
      if (kind === "swap-positions") {
        const players = model.live.teams[side()].players;
        body.firstDestination = players.find(p=>p.id===body.secondId)?.slot;
        body.secondDestination = players.find(p=>p.id===body.firstId)?.slot;
      }
    }
    busy = true;
    revision++;
    updateLivePanel();
    try {
      const next = await api(fixturePath()+"/touchline?after="+liveCursor, {method:"POST",token:key,body});
      if (kind === "tactics") {
        liveTacticsDirty = false;
        pendingRoles = {};
        pendingPlayerInstructions = {};
        pendingMarkingTargets = {};
      }
      applyModel(next);
      toast({"tactics":"Tactics applied.", "substitution":"Substitution queued.", "swap-positions":"Positions swapped."}[kind]);
    } catch (error) {
      toast(error.message);
    } finally {
      busy = false;
      if (livePitch && model.live) updateLivePanel();
    }
    return;
  }
  if (event.target.id !== "schedule-fixture") return;
  event.preventDefault();
  if (busy) return;
  const form = event.target;
  const submit = form.querySelector("button");
  const earliest = refreshScheduleTiming(form);
  const selected = form.elements.kickoff.value;
  const kickoffAt = Date.parse(selected);
  if (!Number.isFinite(kickoffAt) || localInputValue(kickoffAt) !== selected) {
    scheduleError(form, "Choose a valid local date and time for kickoff.", true);
    return;
  }
  if (kickoffAt < earliest) {
    scheduleError(form, "Kickoff is too soon. Choose "+localTime.format(earliest)+" or later.", true);
    return;
  }
  scheduleError(form, "");
  busy = true;
  submit.disabled = true;
  try {
    const session = await api("/api/fixtures", {method:"POST", body:{kickoffAt, opponent:form.elements.opponent.value}});
    await enterSession(session, true);
  } catch (error) {
    refreshScheduleTiming(form);
    scheduleError(form, error.message, error.status === 400);
  } finally {
    busy = false;
    submit.disabled = false;
  }
});
app.addEventListener("change", event => {
  const control = event.target;
  if (control.id === "preview-zone") {
    previewZone = control.value;
    syncShapePreview();
    return;
  }
  if (control.id === "role-player") {
    selectedRolePlayer = control.value;
    if (livePitch) updateLivePanel();
    else render();
    return;
  }
  if (control.dataset.markingPlayer) {
    if (busy) return;
    const defender = control.dataset.markingPlayer;
    const [kind, value] = control.value.split(':');
    const target = kind === 'player' ? {kind, id:value} : kind === 'position' ? {kind, slot:value} : null;
    if (livePitch) {
      pendingMarkingTargets[defender] = target;
      liveTacticsDirty = true;
      updateLivePanel();
    } else if (!locked()) {
      if (target) (draft.markingTargets ??= {})[defender] = target;
      else if (draft.markingTargets) delete draft.markingTargets[defender];
      persistDraft();
      render();
    }
    return;
  }
  if (control.dataset.individual) {
    const {playerId, individual} = control.dataset;
    if (livePitch && !busy) {
      (pendingPlayerInstructions[playerId] ??= {})[individual] = control.value;
      liveTacticsDirty = true;
      updateLivePanel();
    } else if (!locked() && !busy) {
      const assignments = draft.playerInstructions ??= {};
      (assignments[playerId] ??= {})[individual] = control.value;
      draft.playerInstructions = sheetInstructions(draft, assignments);
      persistDraft();
      render();
    }
    return;
  }
  if (control.dataset.rolePhase) {
    const {rolePlayer, rolePhase} = control.dataset;
    if (livePitch && !busy) {
      (pendingRoles[rolePlayer] ??= {})[rolePhase] = control.value;
      liveTacticsDirty = true;
      updateLivePanel();
    } else if (!locked() && !busy) {
      draft.playerRoles ??= {};
      (draft.playerRoles[rolePlayer] ??= {})[rolePhase] = control.value;
      persistDraft();
      render();
    }
    return;
  }
  if (control.id === "live-defensive-formation") {
    control.dataset.instructionEdited = "true";
    liveTacticsDirty = true;
    updateLivePanel();
    return;
  }
  if (control.id === "live-preset") {
    const preset = model.tactics[control.value];
    for (const {id} of matchInstructions) {
      const field = control.form.elements[id];
      field.value = preset[id];
      field.dataset.instructionEdited = "true";
    }
    liveTacticsDirty = true;
    updateLivePanel();
    return;
  }
  if (["sheet-formation","defensive-formation","sheet-preset"].includes(control.id) && !locked() && !busy) {
    if (control.id === "sheet-formation") {
      changeFormation(control.value);
      shapePhase = "inPossession";
    }
    if (control.id === "defensive-formation") {
      draft.defensiveFormation = control.value;
      draft.playerRoles = validRoles(tacticsCatalog, draft.formation, draft.defensiveFormation, sheetPlayers(draft), draft.playerRoles);
      shapePhase = "outOfPossession";
    }
    if (control.id === "sheet-preset") {
      draft.tactic = control.value;
      for (const {id} of matchInstructions) delete draft[id];
    }
    persistDraft();
    render();
    return;
  }
  if (control.dataset.playerDuty) {
    if (livePitch && control.closest("#live-tactics")) {
      control.dataset.edited = "true";
      liveTacticsDirty = true;
      updateLivePanel();
    } else if (!locked() && !busy) {
      draft.duties ??= {};
      draft.duties[control.dataset.playerDuty] = control.value;
      persistDraft();
      render();
    }
    return;
  }
  if (livePitch && (control.hasAttribute("data-live-instruction") ||
      ["live-outgoing", "live-swap-first", "live-ratings-team", "live-ratings-view"].includes(control.id))) {
    if (control.hasAttribute("data-live-instruction")) {
      control.dataset.instructionEdited = "true";
      liveTacticsDirty = true;
    }
    updateLivePanel();
    return;
  }
  if (control.id === "report-team-filter") {
    reportTeam = control.value;
    selectedShot = null;
    render();
    return;
  }
  const instruction = control.dataset.instruction;
  if (!instruction || locked() || busy) return;
  draft[instruction] = control.value;
  persistDraft();
  render();
});
app.addEventListener("click",async event=>{
  const b=event.target.closest("button");
  if(!b || b.disabled || busy)return;
  if(b.dataset.tab){currentTab=b.dataset.tab;render();return;}
  if (b.dataset.livePanel) {
    for (const control of app.querySelectorAll("[data-live-panel]")) {
      const selected = control === b;
      control.classList.toggle("selected", selected);
      control.setAttribute("aria-pressed", selected);
      document.getElementById(control.getAttribute("aria-controls")).hidden = !selected;
    }
    return;
  }
  if(b.dataset.player){openProfile(b);return;}
  if(b.dataset.attributes){rosterGroup=b.dataset.attributes;render();return;}
  if(b.dataset.performanceSide){reportSide=Number(b.dataset.performanceSide);render();return;}
  if (b.dataset.reportFilter) {
    reportFilter = b.dataset.reportFilter;
    render();
    return;
  }
  const shot = b.dataset.mapShot ?? b.dataset.timelineShot;
  if (shot !== undefined) {
    if (model.live && currentTab === "live") {
      liveSelectedShot = Number(shot);
      updateLiveStats(model.live);
      return;
    }
    selectedShot = Number(shot);
    render();
    return;
  }
  if (b.dataset.shapePhase) {shapePhase = b.dataset.shapePhase; render(); return;}
  if(b.dataset.pick){selectedRolePlayer=b.dataset.pick;render();return;}
  if(!locked() && b.dataset.swap){
    const current = selectedRolePlayer, replacement = b.dataset.swap;
    const squad = model.clubs[side()].squad;
    const incoming = squad.find(p => p.id === replacement), outgoing = squad.find(p => p.id === current);
    if (!incoming || !outgoing || outgoing.position !== incoming.position || !draft.xi.includes(current)) return;
    const switchesSlots = draft.xi.includes(replacement);
    for (const assignments of [draft.duties,draft.playerRoles,draft.playerInstructions,draft.markingTargets]) {
      if (!assignments) continue;
      const from = assignments[current], to = assignments[replacement];
      delete assignments[current];
      delete assignments[replacement];
      if (from) assignments[replacement] = from;
      if (switchesSlots && to) assignments[current] = to;
    }
    draft.xi = draft.xi.map(id => id === current ? replacement : id === replacement ? current : id);
    selectedRolePlayer = replacement;
    persistDraft();
    render();
    document.getElementById('role-player')?.focus({preventScroll:true});
    toast(switchesSlots ? incoming.name+' and '+outgoing.name+' swapped positions.' : incoming.name+' replaces '+outgoing.name+'.');
    return;
  }
  const action=b.dataset.action;
  if(action==="toggle-preview"){previewOn=!previewOn;render();return;}
  if(action==="retry-preview"){previewState.key="";syncShapePreview();return;}
  if(action==="close-invite"){invitation="";render();return;}
  if(action==="invite"){
    const url=new URL(location.href);url.search="?fixture="+encodeURIComponent(id);url.hash="invite="+encodeURIComponent(model.invite);
    invitation=url.href;render();await copyInvite();return;
  }
  if(action==="copy"){await copyInvite();return;}
  busy=true;b.disabled=true;revision++;
  try {
    if(action==="create")await enterSession(await api("/api/fixtures",{method:"POST"}),true);
    if(action==="computer-friendly"){
      await enterSession(await api("/api/fixtures",{method:"POST",body:{opponent:"computer"}}),true);
      applyModel(await api(fixturePath()+"/ready",{method:"POST",token:key,body:draft}));
    }
    if(action==="join"){
      await enterSession(await api(fixturePath()+"/join",{method:"POST",token:inviteToken,idempotencyKey:joinAttemptKey()}));
      try {sessionStorage.removeItem("ballerz.join."+id);} catch { /* Session storage is optional. */ }
    }
    if(action==="ready"){applyModel(await api(fixturePath()+"/ready",{method:"POST",token:key,body:draft}));}
    if(action==="kickoff-now" || action==="fast-forward"){
      applyModel(await api(fixturePath()+"/"+action+"?after="+liveCursor,{method:"POST",token:key}));
    }
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
      gate("Manage Eastport Rovers","Northbank Athletic have invited you to a match. Claim the away dugout, pick your eleven and submit your match plan.","join","Take the away dugout");return;
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
