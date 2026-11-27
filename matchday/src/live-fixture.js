import { fixtureClubs, instructions, matchTeams } from './football.js';
import { advanceMatch, atHalfTime, checkpointMatch, liveMatchReport, matchResult, pitchFrame,
  restoreMatch, startMatch } from './match-engine.js';
import { dutyProblem, instructionProblem, instructionValues, playerDuties } from './match-tactics.js';
import { isActive } from './match-decisions.js';
import { setDefensiveSlot } from './match-formations.js';
import { markingProblem, markingTarget } from './marking-targets.js';
import { individualInstructions, individualInstructionProblem, individualValues } from './player-instructions.js';
import { optionsFor, roleProblem, selectedRoles, shapeProblem } from './role-selection.js';
import { substitutionProblem, swapPositions } from './match-rules.js';
import { manageComputerTeam } from './computer-manager.js';

const MATCH_SECONDS_PER_SECOND = 9;
const HALF_TIME_MS = 60_000;
const LEGACY_TIMING = {matchSpeed: 18, halfTimeMs: 20_000};
const UPDATE_MS = 2_000;
const FRAME_LIMIT = 36;
const FAST_FORWARD_SECONDS = 10 * 60;

function matchRandom(live) {
  return () => {
    live.seed = (Math.imul(live.seed, 1664525) + 1013904223) >>> 0;
    return live.seed / 4294967296;
  };
}

export function startLiveFixture(state, time) {
  const live = {startedAt: time, nextAt: time, seed: state.matchSeed, sequence: 0, halfTimeUntil: null,
    timing: {matchSpeed: MATCH_SECONDS_PER_SECOND, halfTimeMs: HALF_TIME_MS}};
  const game = startMatch(matchTeams(state.plans,fixtureClubs(state.registrations)), matchRandom(live));
  if (state.computerAway) game.teams[1].manualSubstitutions = true;
  live.checkpoint = checkpointMatch(game);
  live.frames = [pitchFrame(game, 0)];
  state.live = live;
}

export function advanceLiveFixture(state, time, {fastForward = false} = {}) {
  const live = state.live;
  const {matchSpeed, halfTimeMs} = live.timing ?? LEGACY_TIMING;
  const game = restoreMatch(live.checkpoint, matchRandom(live));
  let elapsed = Math.max(0, time - live.startedAt + (live.skippedMs ?? 0));
  const seconds = milliseconds => milliseconds * matchSpeed / 1000;
  const wallTime = matchSeconds => matchSeconds * 1000 / matchSpeed;
  if (fastForward) {
    if (atHalfTime(game) && time <= live.halfTimeUntil) {
      elapsed = wallTime(game.second) + halfTimeMs + 1;
      live.halfTimeUntil = time - 1;
    } else {
      const completedBreak = live.halfTimeUntil === null ? 0 : halfTimeMs;
      elapsed = Math.max(elapsed, wallTime(game.second) + completedBreak) + wallTime(FAST_FORWARD_SECONDS);
    }
  }
  let lastAction, lastIncident;
  const onAction = (current, firstAction, firstIncident) => {
    if (state.computerAway) manageComputerTeam(current, 1);
    ++live.sequence;
    lastAction = firstAction;
    lastIncident = firstIncident;
    if (fastForward) return;
    live.frames.push(pitchFrame(current, live.sequence, firstAction, firstIncident));
    if (live.frames.length > FRAME_LIMIT) live.frames.shift();
  };
  let complete = false;
  if (game.period === 1 && live.halfTimeUntil === null) {
    complete = advanceMatch(game, seconds(elapsed), {stopAtHalfTime: true, onAction});
    if (atHalfTime(game)) {
      if (fastForward) elapsed = wallTime(game.second);
      live.halfTimeUntil = time - elapsed + wallTime(game.second) + halfTimeMs;
    }
  }
  if (live.halfTimeUntil !== null && time > live.halfTimeUntil) {
    complete = advanceMatch(game, seconds(elapsed - halfTimeMs), {onAction});
  }
  if (complete) {
    state.result = matchResult(game);
    delete state.live;
  } else {
    if (fastForward) {
      live.skippedMs = elapsed - (time - live.startedAt);
      if (lastAction !== undefined) live.frames = [{...pitchFrame(game, live.sequence, lastAction, lastIncident), cut: true}];
    }
    live.checkpoint = checkpointMatch(game);
    live.nextAt = time + UPDATE_MS;
  }
}

export function liveFixtureView(live, after) {
  if (!live) return null;
  const game = restoreMatch(live.checkpoint);
  const frames = live.frames.filter(frame => frame.seq > after);
  return {
    ...liveMatchReport(game),
    matchSpeed: (live.timing ?? LEGACY_TIMING).matchSpeed,
    phase: atHalfTime(game) ? 'half-time' : 'playing',
    halfTimeUntil: live.halfTimeUntil,
    frames: frames.length ? frames : live.frames.slice(-1)
  };
}

export function orderTouchline(live, side, order) {
  const game = restoreMatch(live.checkpoint);
  const team = game.teams[side];
  if (order?.kind === 'tactics') {
    const keys = Object.keys(instructions).filter(key => Object.hasOwn(order, key));
    const eligible = team.players.filter(isActive);
    const defence = order.defensiveFormation ?? team.defensiveFormation ?? 'same';
    const opponents = game.teams[1-side];
    const roster = [...opponents.players, ...opponents.bench];
    const problem = markingProblem(order.markingTargets, eligible, roster) ?? instructionProblem(order) ?? dutyProblem(order.duties, eligible)
      ?? shapeProblem(order.defensiveFormation) ?? roleProblem(order.playerRoles, team.formation, defence, eligible)
      ?? individualInstructionProblem(order.playerInstructions, eligible);
    if (problem) return problem;
    const duties = Object.entries(order.duties ?? {});
    const playerEdits = Object.entries(order.playerInstructions ?? {});
    const markingEdits = Object.entries(order.markingTargets ?? {});
    if (!markingEdits.length && !keys.length && !duties.length && !Object.keys(order.playerRoles ?? {}).length && !order.defensiveFormation && !playerEdits.length) return 'Choose a tactical instruction.';
    const current = instructionValues(team);
    const changed = keys.filter(key => current[key] !== order[key]);
    const changes = changed.map(key => instructions[key][order[key]].label);
    for (const [id, target] of markingEdits) {
      const player = eligible.find(p => p.id === id);
      const next = markingTarget(target);
      if (JSON.stringify(player.markingTarget ?? null) === JSON.stringify(next)) continue;
      player.markingTarget = next;
      const label = next?.slot ?? roster.find(p => p.id === next?.id)?.name;
      changes.push(player.name + (label ? ' marks ' + label : ' resumes role marking'));
    }
    for (const [id, edits] of playerEdits) {
      const player = eligible.find(p => p.id === id);
      const previous = player.instructions ?? {};
      for (const [key, value] of Object.entries(edits)) {
        if ((previous[key] ?? 'standard') !== value) changes.push(player.name + ' · ' + individualInstructions[key][value].label);
      }
      player.instructions = individualValues(previous, edits);
    }
    const shapeChanged = defence !== (team.defensiveFormation ?? 'same');
    if (shapeChanged) {
      team.defensiveFormation = defence;
      changes.push('Defend in ' + (defence === 'same' ? team.formation : defence));
    }
    for (const player of eligible) {
      const patch = order.playerRoles?.[player.id];
      if (!shapeChanged && !patch) continue;
      const options = optionsFor(team.formation, defence, player.slotIndex);
      const previous = player.roles ?? {};
      const next = selectedRoles(previous, patch, options);
      for (const phase of Object.keys(options)) {
        const label = options[phase].find(role => role.id === next[phase]) ?? options[phase][0];
        if ((previous[phase] ?? options[phase][0].id) !== label.id) changes.push(player.name + ' · ' + label.label);
      }
      player.roles = next;
      if (shapeChanged) setDefensiveSlot(player, team);
    }
    for (const [id, duty] of duties) {
      const player = eligible.find(p => p.id === id);
      if ((player.duty ?? 'support') === duty) continue;
      player.duty = duty;
      changes.push(player.name + ' · ' + playerDuties[duty]);
    }
    if (!changes.length) return null;
    for (const key of changed) team[key] = order[key];
    game.incident(side, 'tactics', null, changes.join(' · ') + '.');
  } else if (order?.kind === 'swap-positions') {
    const problem = swapPositions(game, team, order);
    if (problem) return problem;
  } else if (order?.kind === 'substitution') {
    const {outgoingId, incomingId} = order;
    if (team.pendingSubstitution?.outgoingId === outgoingId && team.pendingSubstitution?.incomingId === incomingId) return null;
    if (team.pendingSubstitution) return 'You already have a substitution queued.';
    const problem = substitutionProblem(team, outgoingId, incomingId, game.second);
    if (problem) return problem;
    team.pendingSubstitution = {outgoingId, incomingId};
  } else {
    return 'Choose a tactical change or substitution.';
  }
  live.checkpoint = checkpointMatch(game);
  return null;
}
