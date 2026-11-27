import { clubs, defaultPlan, fixtureClubs, tactics, instructions, orderedXI, validatePlan } from './football.js';
import { defensiveSlotMap, formationCoordinates, formations, formationSlots, mirrorLineup } from './match-formations.js';
import { optionsFor, roleOptions, selectedRoles } from './role-selection.js';
import { advanceLiveFixture, liveFixtureView, orderTouchline, startLiveFixture } from './live-fixture.js';
import { TEAM_SHEET_LOCK_MS, worldDate } from './world-clock.js';
import { recordedMatchReport } from './match-statistics.js';
import { playerDuties } from './match-tactics.js';
import { tacticalPreview } from './tactical-preview.js';
import { computerPlan } from './computer-manager.js';
import { markingPositions, markingTarget } from './marking-targets.js';
import { individualInstructions, individualValues } from './player-instructions.js';

const defaults = clubs.map(club => defaultPlan(club));
const catalog = { clubs, defaults, tactics, instructions, playerDuties };
const tacticCatalog = {formations, formationSlots, formationCoordinates, defensiveSlotMap, roleOptions, individualInstructions, markingPositions};
const encode = value => Array.from(value, x => x.toString(16).padStart(2, '0')).join('');
const newKey = () => encode(crypto.getRandomValues(new Uint8Array(32)));
const digest = async key => encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))));
const json = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
const error = (message, status) => json({error: message}, status);

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

function readFixture(raw) {
  const state = JSON.parse(raw);
  if (state.formationVersion === undefined) {
    const away = state.plans[1];
    if (away) {
      if (!state.schedule) state.legacyAwayXI = away.xi;
      away.xi = mirrorLineup(away.formation, orderedXI(clubs[1], away).map(player => player.id));
    }
    state.formationVersion = 2;
  }
  return state;
}

function view(id, state, side, time, after, playtest, includeTactics) {
  const schedule = state.schedule;
  const teamSheetLocked = Boolean(schedule
    ? time >= schedule.deadlineAt || state.live || state.result
    : state.plans[side]);
  const rosters=fixtureClubs(state.registrations);
  return {
    ...catalog, clubs:rosters, defaults:rosters===clubs ? defaults : rosters.map(club=>defaultPlan(club)),
    ...(includeTactics ? tacticCatalog : {}), id, side, joined: Boolean(state.computerAway || state.managers[1]),
    computerAway: Boolean(state.computerAway),
    ready: state.plans.map(Boolean), result: recordedMatchReport(state.result), teamSheetLocked,
    ...(state.appearanceReceipt ? {appearanceReceipt:state.appearanceReceipt} : {}),
    schedule: schedule ?? null, live: liveFixtureView(state.live, after),
    ...(state.registrations && {fixtureLoans:Object.entries(state.registrations)
      .filter(([,entry])=>entry.loan || entry.returnPending)
      .map(([player,entry])=>({player,name:clubs.flatMap(club=>club.squad).find(p=>p.id===player)?.name,
        club:entry.club,returnPending:!!entry.returnPending,withdrawn:state.withdrawnLoanReserves?.includes(player) ?? false}))}),
    ...(playtest && side === 0 ? {playtestControls: true} : {}),
    plans: state.plans.map((plan, i) => i === side || state.result ? plan : null),
    invite: side === 0 ? state.invite : null
  };
}

export async function playDueFixtures(store, time = Date.now()) {
  store.registration?.advance(time);
  for (const row of await store.due(time)) {
    const state = readFixture(row.state);
    const [home, away] = state.plans;
    if (home && away) {
      state.matchSeed ??= newSeed();
      startLiveFixture(state, state.schedule.kickoffAt);
    } else if (home || away) {
      state.result = {kind: 'forfeit', score: home ? [3, 0] : [0, 3]};
    } else {
      state.result = {kind: 'double-forfeit', score: null};
    }
    // Retry a competing write on the next tick before advancing to a later kickoff.
    if (!(await store.update(row.id, row.version, state,time))) break;
  }
  for (const row of await store.liveDue(time)) {
    const state = readFixture(row.state);
    advanceLiveFixture(state, time);
    await store.update(row.id, row.version, state,time);
  }
}

export async function fixtureApi(request, store, {worldStart = null, receivedAt = Date.now(), playtest = false} = {}) {
  const url = new URL(request.url);
  const path = url.pathname;
  const after = Number(url.searchParams.get('after') ?? -1);
  const method = request.method;
  if (method === 'GET' && path === '/api/clubs') {
    return json({...catalog, ...tacticCatalog, worldStart, serverTime: receivedAt, teamSheetLockMs: TEAM_SHEET_LOCK_MS});
  }
  if (method === 'POST' && path === '/api/tactics/preview') {
    let input;
    try { input = await request.json(); } catch { return error('Invalid tactic preview.', 400); }
    const result = tacticalPreview(input);
    return json(result, result.error ? 400 : 200);
  }

  if (method === 'POST' && path === '/api/fixtures') {
    let schedule;
    let computerAway = false;
    if (request.body) {
      let options;
      try { options = await request.json(); } catch { return error('Invalid fixture settings.', 400); }
      if (options?.opponent !== undefined && !['human', 'computer'].includes(options.opponent)) return error('Choose a human or computer opponent.', 400);
      computerAway = options?.opponent === 'computer';
      if (!options?.opponent || Object.hasOwn(options, 'kickoffAt')) {
        const kickoffAt = options?.kickoffAt;
        if (!Number.isSafeInteger(kickoffAt) || !Number.isFinite(new Date(kickoffAt).getTime())) {
          return error('Choose a valid kickoff.', 400);
        }
        if (worldStart === null) return error('The scheduled playtest is unavailable.', 409);
        const deadlineAt = kickoffAt - TEAM_SHEET_LOCK_MS;
        if (kickoffAt < worldStart) return error('Choose a kickoff on or after the world starts.', 400);
        if (deadlineAt <= receivedAt) return error('Choose a kickoff more than 30 minutes away.', 400);
        schedule = {kickoffAt, deadlineAt, gameDate: worldDate(worldStart, kickoffAt)};
      }
    }
    const id = crypto.randomUUID();
    const key = newKey();
    const state = { managers: [await digest(key), null], invite: newKey(), plans: [null, null], result: null, matchSeed: newSeed(), formationVersion: 2 };
    if (computerAway) {
      state.computerAway = true;
      state.invite = null;
      state.plans[1] = computerPlan(clubs[1]);
    }
    if (schedule) state.schedule = schedule;
    await store.create(id, state,receivedAt);
    return json({id, key}, 201);
  }

  const match = /^\/api\/fixtures\/([a-f0-9-]{36})(?:\/(join|ready|preview|touchline|kickoff-now|fast-forward))?$/.exec(path);
  if (!match) return error('Fixture not found.', 404);
  const [, id, action] = match;
  const playtestAction = action === 'kickoff-now' || action === 'fast-forward';
  if (method !== (action ? 'POST' : 'GET')) return error('Unsupported method.', 405);
  const auth = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization') || '');
  if (!auth) return error('A manager key or invitation is required.', 401);
  const token = auth[1];
  const hash = await digest(token);
  store.registration?.advance(receivedAt);
  const response = (state, side) => {
    const data=view(id, state, side, receivedAt, after, playtest, !url.searchParams.has('after'));
    if (state.schedule && !state.result && store.registration) data.transfers=store.registration.status();
    return json(data);
  };
  let submitted;
  if (action === 'ready' || action === 'touchline' || action === 'preview') {
    try { submitted = await request.json(); } catch {
      return error(action === 'ready' ? 'Invalid team sheet.' : 'Invalid touchline order.', 400);
    }
  }

  // Re-read after competing updates. Only the successful version is visible to either manager.
  for (let retry = 0; retry < 5; retry++) {
    const row = await store.read(id);
    if (!row) return error('Fixture not found.', 404);
    const state = readFixture(row.state);
    if (action === 'join') {
      // An invite alone is single-use. The original client can recover a lost claim response.
      const nonce = request.headers.get('Idempotency-Key');
      const claimKey = nonce && /^[a-f0-9-]{32,64}$/i.test(nonce) ? await digest(token + ':' + nonce) : null;
      if (!state.invite && claimKey && state.managers[1] === await digest(claimKey)) return json({id, key:claimKey});
      if (!state.invite || state.invite !== token) return error('This invitation is invalid or already claimed.', 403);
      const key = claimKey || newKey();
      state.managers[1] = await digest(key);
      state.invite = null;
      if (await store.update(id, row.version, state)) return json({id, key});
      continue;
    }

    const side = state.managers.indexOf(hash);
    if (side < 0) return error('This manager key does not match the fixture.', 403);
    if (!action) return response(state, side);
    const rosters=fixtureClubs(state.registrations);
    if (action==='preview') {
      const result=tacticalPreview({...submitted,side},rosters);
      return json(result,result.error ? 400 : 200);
    }
    if (playtestAction) {
      if (!playtest || side !== 0) return error('Playtest controls are available to the home manager in playtest mode.', 403);
      if (action === 'kickoff-now') {
        if (!state.schedule || receivedAt >= state.schedule.kickoffAt || state.result || state.live || !state.plans.every(Boolean)) {
          return error('An upcoming scheduled fixture needs both submitted team sheets to kick off now.', 409);
        }
        if (store.registration && !store.registration.canKickoffEarly(state,receivedAt))
          return error('Loan eligibility changes before the scheduled deadline. Keep the scheduled kickoff.',409);
        state.schedule.playtestKickoffAt = receivedAt;
        state.matchSeed ??= newSeed();
        startLiveFixture(state, receivedAt);
      } else {
        if (!state.live) return error('Fast-forward is available during the match.', 409);
        if (receivedAt >= state.live.nextAt) advanceLiveFixture(state, receivedAt);
        if (state.live) advanceLiveFixture(state, receivedAt, {fastForward: true});
      }
      if (await store.update(id, row.version, state,receivedAt)) return response(state, side);
      continue;
    }
    if (action === 'touchline') {
      if (!state.live) return error('Touchline changes are available during the match.', 409);
      if (receivedAt >= state.live.nextAt) advanceLiveFixture(state, receivedAt);
      if (!state.live) {
        if (await store.update(id, row.version, state,receivedAt)) return error('The match has finished.', 409);
        continue;
      }
      const problem = orderTouchline(state.live, side, submitted);
      if (problem) return error(problem, 400);
      if (await store.update(id, row.version, state)) return response(state, side);
      continue;
    }
    if (state.schedule && (receivedAt >= state.schedule.deadlineAt || state.live || state.result)) {
      return error('The team-sheet deadline has passed.', 409);
    }
    const problem = validatePlan(rosters[side], submitted,rosters[1-side]);
    if (problem) return error(problem, 400);
    const plan = {formation: submitted.formation, tactic: submitted.tactic, xi: submitted.xi};
    if (submitted.defensiveFormation && submitted.defensiveFormation !== 'same') plan.defensiveFormation = submitted.defensiveFormation;
    if (submitted.playerRoles) {
      const roles = {};
      for (const [index, player] of orderedXI(rosters[side], plan).entries()) {
        const pair = selectedRoles(null, submitted.playerRoles[player.id], optionsFor(plan.formation, plan.defensiveFormation, index));
        if (Object.keys(pair).length) roles[player.id] = pair;
      }
      if (Object.keys(roles).length) plan.playerRoles = roles;
    }
    if (submitted.duties) {
      const duties = submitted.xi.filter(id => submitted.duties[id] && submitted.duties[id] !== 'support');
      if (duties.length) plan.duties = Object.fromEntries(duties.map(id => [id, submitted.duties[id]]));
    }
    if (submitted.markingTargets) {
      const marked = plan.xi.filter(id => submitted.markingTargets[id]);
      if (marked.length) plan.markingTargets = Object.fromEntries(marked.map(id => [id, markingTarget(submitted.markingTargets[id])]));
    }
    if (submitted.playerInstructions) {
      const assignments = {};
      for (const id of plan.xi) {
        const values = individualValues(null, submitted.playerInstructions[id]);
        if (Object.keys(values).length) assignments[id] = values;
      }
      if (Object.keys(assignments).length) plan.playerInstructions = assignments;
    }
    for (const key of Object.keys(instructions)) {
      if (Object.hasOwn(submitted, key)) plan[key] = submitted[key];
    }
    if (!state.schedule && state.plans[side]) {
      const locked = state.plans[side];
      const serialized = JSON.stringify(plan);
      if (serialized === JSON.stringify(locked) || (side === 1 && state.legacyAwayXI
          && serialized === JSON.stringify({...locked, xi:state.legacyAwayXI}))) return response(state, side);
      return error('Your team sheet is locked for this fixture.', 409);
    }
    if (state.schedule) {
      state.receivedAt ??= [null, null];
      if (receivedAt < state.receivedAt[side]) {
        return error('A newer team sheet is already submitted.', 409);
      }
      state.receivedAt[side] = receivedAt;
    }
    state.plans[side] = plan;
    if (!state.schedule && state.plans.every(Boolean)) {
      state.matchSeed ??= newSeed();
      startLiveFixture(state, receivedAt);
    }
    if (await store.update(id, row.version, state)) return response(state, side);
  }
  return error('The fixture was updated. Please try again.', 409);
}
