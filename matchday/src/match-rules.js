import { isActive } from './match-decisions.js';

const SUBSTITUTION_LIMIT = 5;
const SUBSTITUTION_WINDOWS = 3;
const MINIMUM_PLAYERS = 7;

export function keepsAppearanceOnAbandonment(team) {
  const active = team.players.filter(isActive).length;
  const dismissals = team.players.filter(player => player.dismissed).length;
  return active >= MINIMUM_PLAYERS || active + dismissals < MINIMUM_PLAYERS;
}
const minimumKeeperAttributes = Object.fromEntries([
  'passing', 'firstTouch', 'dribbling', 'finishing', 'tackling', 'vision', 'decisions', 'composure',
  'offBall', 'positioning', 'workRate', 'pace', 'stamina', 'handling', 'reflexes', 'oneOnOnes', 'crossing', 'aerial'
].map(key => [key, 4]));

function participant(player, second) {
  return {
    ...player, condition: 100, enteredAt: second, exitedAt: null, cautions: 0,
    passes: 0, completedPasses: 0, chancesCreated: 0, shots: 0, goals: 0, assists: 0,
    saves: 0, regains: 0, goalsConceded: 0
  };
}

export function prepareTeam(team, side) {
  // Slot order follows the pitch from top to bottom. The away team attacks left.
  const lines = {
    GK: {1: ['GK']},
    DF: {3: ['LCB', 'CB', 'RCB'], 4: ['LB', 'LCB', 'RCB', 'RB']},
    MF: {3: ['LCM', 'CM', 'RCM'], 4: ['LM', 'LCM', 'RCM', 'RM'], 5: ['LM', 'LCM', 'CM', 'RCM', 'RM']},
    FW: {2: ['LS', 'RS'], 3: ['LW', 'ST', 'RW']}
  };
  const players = team.players.map(player => participant(player, 0));
  for (const [position, shapes] of Object.entries(lines)) {
    const line = players.filter(player => player.position === position);
    const slots = shapes[line.length];
    line.forEach((player, i) => { player.slot ??= slots?.[side === 0 ? i : line.length - 1 - i] ?? position; });
  }
  return {
    ...team, side, players,
    bench: [...(team.bench ?? [])], substitutions: 0, windows: 0,
    lastSubstitutionAt: null, aiKeepers: 0
  };
}

export function dismissPlayer(player, second) {
  player.dismissed = true;
  player.exitedAt = second;
}

export function injurePlayer(player, second) {
  player.injured = true;
  player.exitedAt = second;
}

function substitutionAllowed(team, second) {
  return team.substitutions < SUBSTITUTION_LIMIT &&
    (team.windows < SUBSTITUTION_WINDOWS || team.lastSubstitutionAt === second);
}

function availableReserve(team, position) {
  return team.bench.find(player => player.position === position) ??
    (position === 'GK' ? null : team.bench.find(player => player.position !== 'GK'));
}

export function substitutionProblem(team, outgoingId, incomingId, second) {
  if (!substitutionAllowed(team, second)) return 'No substitution windows remaining.';
  const outgoing = team.players.find(player => player.id === outgoingId && isActive(player));
  const incoming = team.bench.find(player => player.id === incomingId);
  if (!outgoing || !incoming || outgoing.position !== incoming.position) {
    return 'Choose an active player and an unused substitute in the same position.';
  }
  return null;
}

export function applyRequestedSubstitutions(game) {
  for (const team of game.teams) {
    const request = team.pendingSubstitution;
    if (!request) continue;
    team.pendingSubstitution = null;
    const {outgoingId, incomingId} = request;
    const problem = substitutionProblem(team, outgoingId, incomingId, game.second);
    if (problem) {
      game.incident(team.side, 'substitution-cancelled', null, problem);
      continue;
    }
    const outgoing = team.players.find(player => player.id === outgoingId);
    const incoming = team.bench.find(player => player.id === incomingId);
    substitute(game, team, outgoing, incoming, outgoing.position);
    team.manualSubstitutions = true;
  }
}

function substitute(game, team, outgoing, incoming, position, placement = outgoing) {
  if (!substitutionAllowed(team, game.second)) return false;
  if (team.lastSubstitutionAt !== game.second) {
    team.windows++;
    team.lastSubstitutionAt = game.second;
  }
  team.substitutions++;
  team.bench = team.bench.filter(player => player.id !== incoming.id);
  outgoing.replaced = true;
  outgoing.exitedAt ??= game.second;
  const player = participant(incoming, game.second);
  Object.assign(player, tacticalPlacement(placement), {position, slot: placement.slot ?? position});
  team.players.push(player);
  game.incident(team.side, 'substitution', player, player.name + ' replaces ' + outgoing.name + ' (' + player.slot + ').', {
    outgoingId: outgoing.id, position, slot: player.slot
  });
  return true;
}

function tacticalPlacement(player) {
  const {x, y, anchorX, anchorY, slotIndex, defensiveSlot, defensiveAnchorX, defensiveAnchorY} = player;
  return {x, y, anchorX, anchorY, slotIndex, defensiveSlot, defensiveAnchorX, defensiveAnchorY,
    markingTarget: player.markingTarget ?? null, duty: player.duty ?? 'support', roles: {...player.roles}, instructions: {...player.instructions}};
}

export function swapPositions(game, team, order) {
  const a = team.players.find(p => p.id === order.firstId && isActive(p));
  const b = team.players.find(p => p.id === order.secondId && isActive(p));
  if (!a || !b || a === b || a.position === 'GK' || b.position === 'GK') return 'Choose two active outfield players.';
  // The desired destinations make retries safe and detect a stale selection.
  if (a.slot === order.firstDestination && b.slot === order.secondDestination) return null;
  if (b.slot !== order.firstDestination || a.slot !== order.secondDestination) return 'The positions have changed. Select the players again.';
  const destinations = [[a, b.slot, tacticalPlacement(b)], [b, a.slot, tacticalPlacement(a)]];
  for (const [player, slot, placement] of destinations) {
    const {x, y} = player;
    Object.assign(player, placement, {slot, x, y, defensiveTask:null, defensiveTargetId:null});
  }
  game.incident(team.side, 'tactics', null, a.name + ' moves to ' + a.slot + ' and ' + b.name + ' to ' + b.slot + '.');
  return null;
}

function goalkeeperCover(game, team, previousKeeper) {
  const active = team.players.filter(isActive);
  if (active.some(player => player.position === 'GK') || active.length === 0) return;
  const outfielder = active.find(player => player.position === 'FW') ?? active.at(-1);
  const outgoing = previousKeeper.injured && !previousKeeper.replaced ? previousKeeper : outfielder;
  if (substitutionAllowed(team, game.second)) {
    const reserve = availableReserve(team, 'GK') ?? {
      id: 'stand-in-' + team.side + '-' + (++team.aiKeepers),
      name: 'AI goalkeeper ' + team.aiKeepers, attributes: minimumKeeperAttributes
    };
    substitute(game, team, outgoing, reserve, 'GK', previousKeeper);
    return;
  }
  Object.assign(outfielder, tacticalPlacement(previousKeeper), { position: 'GK', slot: 'GK', attributes: {
    ...outfielder.attributes, handling: 4, reflexes: 4, oneOnOnes: 4
  } });
  game.incident(team.side, 'position-change', outfielder, outfielder.name + ' takes over in goal.');
}

export function replaceUnavailablePlayers(game, removed) {
  for (const { team, player } of removed) {
    if (player.position === 'GK') {
      goalkeeperCover(game, team, player);
    } else if (player.injured) {
      const incoming = availableReserve(team, player.position);
      if (incoming) substitute(game, team, player, incoming, player.position);
    }
  }
}

export function makeFatigueSubstitutions(game) {
  for (const team of game.teams) {
    if (team.manualSubstitutions) continue;
    const minute = [62, 75, 83][team.windows];
    if (!minute || game.second < minute * 60 || !substitutionAllowed(team, game.second)) continue;
    let tired = null;
    for (const player of team.players) {
      if (!isActive(player) || player.position === 'GK' || player.condition > 87) continue;
      if (!tired || player.condition < tired.condition) tired = player;
    }
    const reserve = tired && availableReserve(team, tired.position);
    if (reserve) substitute(game, team, tired, reserve, tired.position);
  }
}

export function abandonment(teams, playedScore) {
  const shortHanded = teams.map(team => team.players.filter(isActive).length < MINIMUM_PLAYERS);
  if (shortHanded.every(Boolean)) return {kind: 'double-abandonment', score: null, playedScore};
  if (shortHanded.some(Boolean)) {
    const winner = shortHanded[0] ? 1 : 0;
    const score = playedScore[winner] - playedScore[1 - winner] >= 3
      ? [...playedScore] : winner === 0 ? [3, 0] : [0, 3];
    return {kind: 'abandoned', score, playedScore};
  }
  return null;
}

export function playerPerformance(player, matchEnd) {
  const {id, name, condition, passes, completedPasses, chancesCreated, shots, goals, assists, saves, regains} = player;
  return {
    playerId: id, name, minutes: Math.round(((player.exitedAt ?? matchEnd) - player.enteredAt) / 60),
    condition: Math.round(condition), passes, completedPasses, chancesCreated, shots, goals, assists, saves, regains,
    rating: matchRating(player)
  };
}

export function matchRating(player) {
  const passing = 0.36 * (player.completedPasses - 0.80 * player.passes) / (10 + player.passes) * 5;
  const impact = 0.86 * player.goals + 0.57 * player.assists
    + 0.11 * Math.min(8, player.chancesCreated) + 0.13 * Math.min(8, player.saves)
    + 0.038 * Math.min(14, player.regains) - 0.22 * player.goalsConceded
    - 0.16 * player.cautions - (player.dismissed ? 0.85 : 0);
  return Math.round(10 * Math.max(1, Math.min(10, 6.6 + passing + impact))) / 10;
}
