import { PITCH, attackingX, counterOutlet, movePlayers, passLane, runningSpeed, setPlayerPositions, shotGeometry } from './match-pitch.js';
import { choosePlay, closestPlayer, distanceBetween, goalArea, isActive } from './match-decisions.js';
import { breakawayFinish, expectedGoals, reportShotGeometry, resolveShotAttempt, shotDetails } from './match-shot.js';
import { judgeChallenge } from './match-discipline.js';
import { matchStatistics } from './match-statistics.js';
import { instructionValues } from './match-tactics.js';
import {roleEffects} from './match-roles.js';
import {restoreTeamShape} from './match-formations.js';
import {chaseClearance, chooseCornerDelivery, contestCornerClearance, cornerDefender, runForCorner} from './match-set-pieces.js';
import {approachRestart, planRestart, restartSpeed, timeRestartRuns} from './restart-shape.js';
import { defensiveExit, defendDelivery, misplayedBallExit } from './match-deliveries.js';
import {
  abandonment, applyRequestedSubstitutions, dismissPlayer, injurePlayer, makeFatigueSubstitutions, matchRating, playerPerformance,
  prepareTeam, replaceUnavailablePlayers
} from './match-rules.js';

const HALF = 45 * 60;
const ENGINE_VERSION = 13;
const restartDelay = {kickoff: 17, 'goal-kick': 16, 'throw-in': 13, corner: 19, 'free-kick': 18, offside: 11, penalty: 33};
const cornerCauseText = {
  'misplayed-ball': 'An overhit ball runs behind the defending team’s own goal. ',
  'deflected-cross': 'A defender deflects a cross behind. ',
  'deflected-pass': 'A defender blocks a pass behind. ',
  clearance: 'A defender clears the ball behind. ',
  challenge: 'A defender puts the ball behind in a challenge. ',
  'punched-delivery': 'The goalkeeper punches a delivery behind. ',
  'deflected-shot': 'A defender deflects a shot behind. ',
  'parried-shot': 'The goalkeeper parries a shot behind. '
};
const statNames = [
  'shots', 'onTarget', 'xg', 'passes', 'completedPasses', 'lineBreaks', 'turnovers', 'pressRegains',
  'carries', 'interceptions', 'blocks', 'woodwork', 'corners', 'fouls', 'offsides', 'penalties',
  'freeKicks', 'yellowCards', 'redCards', 'substitutions', 'advantages',
  'cornersTaken', 'cornersWithShot', 'cornerClaims', 'cornerClearances', 'crosses', 'completedCrosses',
  'cornerSecondBallsWon', 'quickCornerSecondBallShots'
];
const sideName = side => side === 0 ? 'home' : 'away';
const round = value => Math.round(value * 1_000) / 1_000;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const goalX = side => side === 0 ? PITCH.length : 0;
const ownDepth = (side, metres) => side === 0 ? metres : PITCH.length - metres;
const point = player => ({x: Math.round(player.x * 10) / 10, y: Math.round(player.y * 10) / 10});

function matchRuntime(state, rng) {
  return Object.assign(state, {
    rng,
    incident(side, type, player, text, details = {}) {
      if (type === 'substitution') {
        this.stats.substitutions[side]++;
        this.stoppageDelay += 10;
      }
      if (type === 'injury') this.stoppageDelay += 32;
      this.timeline.push({...timestamp(this, side), type, text, playerId: player?.id, ...details});
    }
  });
}

export function startMatch(sides, rng, {onMovement} = {}) {
  const game = matchRuntime({
    teams: sides.map(prepareTeam), second: 0, period: 1, periodStart: 0, halfEnd: HALF,
    nominalEnd: HALF, stoppageDelay: 0,
    possession: 0, possessionTime: [0, 0], score: [0, 0], recordsEscapedChallenges: true,
    stats: Object.fromEntries(statNames.map(stat => [stat, [0, 0]])),
    events: [], timeline: [], actions: [], carrier: null, restart: null, firstKick: rng() < 0.5 ? 0 : 1
  }, rng);
  // The calibration observer sees actual movement before an action transfers
  // possession. It is deliberately excluded from serialised match checkpoints.
  if (onMovement) Object.defineProperty(game, 'onMovement', {value: onMovement});
  setPlayerPositions(game.teams);
  kickoff(game, game.firstKick);
  return game;
}

function timestamp(game, side) {
  const minute = Math.min(game.period * 45, (game.period - 1) * 45 + Math.max(1, Math.ceil((game.second - game.periodStart) / 60)));
  const addedMinute = Math.max(0, Math.ceil((game.second - game.nominalEnd) / 60));
  return {
    second: round(game.second), minute, period: game.period, side: sideName(side),
    ...(addedMinute > 0 ? {addedMinute} : {})
  };
}

function action(game, type, player, fields = {}, side = game.side) {
  game.actions.push({...timestamp(game, side), possession: game.possession, type, playerId: player.id, ...fields});
}

function advance(game, duration, live, holdShape = false, ball = game.carrier) {
  const seconds = Math.min(duration, game.halfEnd - game.second);
  game.second += seconds;
  if (!live || seconds <= 0) return;
  game.possessionTime[game.side] += seconds;
  const active = game.teams.map(team => ({...team, players: team.players.filter(isActive)}));
  if (!holdShape) {
    movePlayers(active, {
      ball, pressTarget: game.carrier, possessionSide: game.side, carrierId: game.carrier.id, seconds,
      pressTriggered: game.second - seconds < game.pressUntil,
      openPlay: !game.openingRestart,
      recentLoss: game.regainedAt !== undefined && game.second - seconds - game.regainedAt < 8
    });
    game.lastMovementPossession = game.possession;
    game.onMovement?.(game, seconds);
  }
  for (const team of active) {
    for (const player of team.players) {
      const roleLoad = player.position === 'GK' ? 0.16 : team.side !== game.side && team.pressing === 'high' ? 1.56 : 1;
      const extraPress = !holdShape && team.side !== game.side && player.defensiveTask === 'press' && player.instructions?.pressing === 'more';
      const exertion = roleLoad * (player.id === game.carrier.id ? 1.18 : extraPress ? 1.22 : 1);
      const drop = 0.0048 + (14 - player.attributes.stamina) * 0.00043;
      player.condition = Math.max(35, player.condition - seconds * drop * exertion);
    }
  }
}

function gainControl(game, side, player, transition = 'build') {
  game.side = side;
  game.carrier = player;
  game.possession++;
  game.chainLength = 0;
  game.controlStarted = game.second;
  delete game.regainedAt;
  game.controlLocation = attackingX(player.x, side);
  game.lastPass = null;
  game.openingRestart = null;
  game.corner = null;
  game.transition = transition;
  game.pressUntil = game.second;
}

function queueRestart(game, side, kind, location, cause) {
  game.restart = {side, kind, location, cause};
  if (kind === 'corner') game.stats.corners[side]++;
}

function kickoff(game, side) {
  queueRestart(game, side, 'kickoff', {x: PITCH.length / 2, y: PITCH.width / 2});
}

function beginRestart(game) {
  const {kind} = game.restart;
  const openingKick = kind === 'kickoff' && game.second === game.periodStart;
  if (!openingKick || game.period === 2) applyRequestedSubstitutions(game);
  if (!openingKick) makeFatigueSubstitutions(game);
  const {targets, taker, routine} = planRestart(game.teams, game.restart);
  let delay = (openingKick ? 1 : restartDelay[kind]) * (0.85 + game.rng() * 0.3);
  // The taker must reach the spot, and set-piece participants must reach
  // their legal starting positions. A quick throw needn't wait for a winger
  // at the far end of the pitch to reach their supporting position.
  for (const team of game.teams) {
    for (const player of team.players.filter(isActive)) {
      const waitingForShape = ['kickoff', 'penalty', 'corner'].includes(kind);
      const opponent = team.side !== game.restart.side;
      const exclusion = kind === 'throw-in' ? 2 : 9.15;
      const mustRetreat = opponent && (kind === 'goal-kick'
        ? goalArea(player, team.side)
        : distanceBetween(player, game.restart.location) < exclusion);
      if (player === taker || waitingForShape || mustRetreat) {
        delay = Math.max(delay, distanceBetween(player, targets[player.id]) / restartSpeed(player));
      }
    }
  }
  const exceptionalDelay = game.stoppageDelay;
  game.stoppageDelay = 0;
  if (game.second < game.nominalEnd) {
    const restartAllowance = kind === 'penalty' || (kind === 'kickoff' && !openingKick) ? delay : 0;
    game.halfEnd += exceptionalDelay + restartAllowance;
  }
  if (kind === 'penalty') {
    // Preserve an awarded kick if regulation or added time would otherwise expire.
    game.halfEnd = Math.max(game.halfEnd, game.second + delay + exceptionalDelay + 1);
  }
  timeRestartRuns(game.teams, targets, taker, game.second, delay + exceptionalDelay);
  game.restart.setup = {targets, takerId:taker.id, readyAt:game.second + delay + exceptionalDelay,
    ...(routine ? {corner:mapCornerPlayers({routine}, player => player?.id ?? null)} : {})};
}

function takeRestart(game) {
  if (!game.restart.setup) beginRestart(game);
  const {side, kind, location, cause, setup} = game.restart;
  // Emit periodic pitch frames as the players jog. Fixed simulation steps
  // give live, fast-forwarded and restored matches identical outcomes.
  const seconds = Math.min(3, setup.readyAt - game.second, game.halfEnd - game.second);
  approachRestart(game.teams, setup.targets, seconds, game.second);
  advance(game, seconds, false);
  if (game.second < setup.readyAt || game.second >= game.halfEnd) return;
  const team = game.teams[side];
  const taker = team.players.find(p => p.id === setup.takerId);
  const corner = setup.corner && mapCornerPlayers(setup.corner, id =>
    game.teams[0].players.find(p => p.id === id) ?? game.teams[1].players.find(p => p.id === id) ?? null);
  game.restart = null;
  gainControl(game, side, taker);
  game.openingRestart = kind;
  if (corner) game.corner = {...corner, cause, attempted:false, producedShot:false};
  action(game, 'restart', taker, {outcome: kind, location: point(taker), ...(cause ? {cause} : {})});
}

function regainingPlayer(game, winningSide, challenger) {
  const formerSide = game.side;
  if (formerSide === winningSide) return;
  game.stats.turnovers[formerSide]++;
  challenger.regains++;
  const depth = attackingX(challenger.x, winningSide);
  const pressing = game.teams[winningSide].pressing;
  const high = pressing === 'high' && depth >= 56;
  if (high) game.stats.pressRegains[winningSide]++;
  gainControl(game, winningSide, challenger, high ? 'press' : depth < 61 ? 'break' : 'build');
  game.regainedAt = game.second;
}

function goalKick(game, side, y) {
  queueRestart(game, side, 'goal-kick', {x: ownDepth(side, 5.5), y: clamp(y, 29, 39)});
}

function corner(game, side, exitY, cause) {
  queueRestart(game, side, 'corner', {x: goalX(side), y: exitY < PITCH.width / 2 ? 0 : PITCH.width}, cause);
}

function restartAfterDeflection(game, exit, cause) {
  if (exit.boundary === 'goal-line') corner(game, game.side, exit.y, cause);
  else queueRestart(game, game.side, 'throw-in', {x: exit.x, y: exit.y}, cause);
}

function advantageReceiver(attack, defence, victim) {
  const depth = attackingX(victim.x, attack.side);
  if (depth < 41) return null;
  let receiver = null;
  let bestOpenSpace = 4.5;
  const opponents = defence.players.filter(isActive);
  for (const player of attack.players) {
    if (!isActive(player) || player === victim || player.position === 'GK') continue;
    if (attackingX(player.x, attack.side) - depth < 3 || distanceBetween(player, victim) > 16) continue;
    const nearest = closestPlayer(opponents, player);
    const space = nearest ? distanceBetween(nearest, player) : PITCH.width;
    if (space > bestOpenSpace && passLane(victim, player, opponents, 11).risk < 0.44) {
      bestOpenSpace = space;
      receiver = player;
    }
  }
  return receiver;
}

function foul(game, defender, decision) {
  const attackingSide = game.side;
  const offenderSide = 1 - attackingSide;
  const attack = game.teams[attackingSide];
  const defence = game.teams[offenderSide];
  const victim = game.carrier;
  const spot = point(victim);
  const penalty = goalArea(victim, attackingSide);
  const injuries = [
    [attack, victim, 0.026 + (100 - victim.condition) * 0.0008 + (decision.card ? 0.025 : 0)],
    [defence, defender, decision.card === 'red' ? 0 : 0.008]
  ].filter(([, , risk]) => risk > 0 && game.rng() < risk);
  // A teammate already has a clear continuation. Record the foul without a stoppage.
  const receiver = !penalty && !decision.card && injuries.length === 0
    ? advantageReceiver(attack, defence, victim) : null;
  action(game, 'duel', victim, {
    outcome: receiver ? 'advantage' : 'foul', defenderId: defender.id, location: spot,
    ...(receiver ? {targetId: receiver.id, to: point(receiver)} : {})
  });
  advance(game, 1.2, true);
  game.stats.fouls[offenderSide]++;
  game.incident(offenderSide, 'foul', defender, defender.name + ' fouls ' + victim.name +
    (receiver ? '. The referee plays advantage.' : '.'), {reason: decision.reason, advantage: Boolean(receiver)});
  if (receiver) {
    game.stats.advantages[attackingSide]++;
    game.carrier = receiver;
    game.chainLength++;
    game.lastPass = null;
    return;
  }
  const removed = [];
  if (decision.card === 'red') {
    dismissPlayer(defender, game.second);
    game.stats.redCards[offenderSide]++;
    game.incident(offenderSide, 'red-card', defender, defender.name + ' is sent off for excessive force.');
    removed.push({team: defence, player: defender});
  } else if (decision.card === 'yellow') {
    defender.cautions++;
    game.stats.yellowCards[offenderSide]++;
    game.incident(offenderSide, 'yellow-card', defender, defender.name + ' is booked for a reckless challenge.');
    if (defender.cautions === 2) {
      dismissPlayer(defender, game.second);
      game.stats.redCards[offenderSide]++;
      game.incident(offenderSide, 'red-card', defender, defender.name + ' is sent off after a second booking.');
      removed.push({team: defence, player: defender});
    }
  }

  for (const [team, player] of injuries) {
    if (!isActive(player)) continue;
    injurePlayer(player, game.second);
    game.incident(team.side, 'injury', player, player.name + ' cannot continue after the challenge.');
    removed.push({team, player});
  }
  replaceUnavailablePlayers(game, removed);
  game.abandoned = abandonment(game.teams, game.score);
  if (game.abandoned) return;
  if (penalty) {
    game.stats.penalties[attackingSide]++;
    game.incident(attackingSide, 'penalty', victim, 'A penalty is awarded.');
    queueRestart(game, attackingSide, 'penalty', {x: ownDepth(attackingSide, PITCH.length - 11), y: PITCH.width / 2});
  } else {
    game.stats.freeKicks[attackingSide]++;
    queueRestart(game, attackingSide, 'free-kick', spot);
  }
}

function challenge(game, opponents) {
  if (game.openingRestart) return false;
  const carrier = game.carrier;
  const defending = game.teams[1 - game.side];
  const ballDepth = attackingX(carrier.x, defending.side);
  const outlet = ballDepth < 48 ? counterOutlet(defending) : null;
  const defender = closestPlayer(opponents, carrier, player => player !== outlet);
  if (!defender) return false;
  const gap = distanceBetween(defender, carrier);
  const intensity = defending.pressing === 'high' ? (game.second < game.pressUntil ? 0.45 : 0.34)
    : defending.pressing === 'standard' ? 0.31 : 0.28;
  const willingness = roleEffects(defender, false).press ?? 1;
  const tackle = defender.instructions?.tackling;
  const commitment = tackle === 'harder' ? 1.48 : tackle === 'easier' ? 0.60 : 1;
  const canEngage = (1 - gap / 5.8) * willingness * commitment;
  if (canEngage <= 0 || game.rng() >= intensity * canEngage * (defender.condition / 100)) return false;

  const ruling = judgeChallenge(carrier, defender, game.side, goalArea(carrier, game.side), game.rng);
  if (ruling.kind === 'foul') {
    foul(game, defender, ruling);
    return true;
  }
  if (ruling.kind === 'won') {
    action(game, 'duel', carrier, {outcome: 'tackled', defenderId: defender.id, location: point(carrier)});
    advance(game, 1.2 + game.rng() * 0.9, true);
    regainingPlayer(game, 1 - game.side, defender);
    return true;
  }
  action(game, 'duel', carrier, {outcome: 'escaped', defenderId: defender.id, location: point(carrier)});
  return false;
}

function recoverCornerClearance(game, play, defender, opponents) {
  const {side, teams, rng} = game;
  const {target, winner, won, seconds, pressure, controlled} =
    contestCornerClearance(play, defender, teams[side].players, opponents, side, rng);
  action(game, 'clearance', defender, {
    outcome: 'loose-ball', contact: controlled ? 'clean' : 'under-pressure', location: point(play.end), to: point(target)
  }, 1 - side);
  chaseClearance(teams, side, target, winner, Math.min(seconds, game.halfEnd - game.second));
  advance(game, seconds, true, true);
  if (game.second >= game.halfEnd) return;

  Object.assign(winner, target);
  if (won) {
    game.carrier = winner;
    game.lastPass = null;
    game.chainLength++;
    game.corner.recovery = {second: game.second, pressure};
    game.stats.cornerSecondBallsWon[side]++;
  } else {
    regainingPlayer(game, 1 - side, winner);
  }
  action(game, 'recovery', winner, {outcome: 'second-ball', location: point(target)});
  game.incident(game.side, 'corner-second-ball', winner, winner.name + ' wins the second ball after the clearance.');
}

function firstTouch(game, play, opponents) {
  const {carrier, side, rng} = game;
  const passer = play.type === 'pass';
  const ready = game.openingRestart;
  const {end, lane} = play;
  if (passer) {
    game.stats.passes[side]++;
    carrier.passes++;
    if (play.cross) game.stats.crosses[side]++;
  } else {
    game.stats.carries[side]++;
  }

  // A defender who cuts the ball out well before an offside runner can
  // play it keeps possession. Position alone does not stop play.
  const interceptedBeforeRunner = play.offside && lane.interceptor && lane.contact
    && distanceBetween(lane.contact, play.recipient) > 4 && distanceBetween(lane.contact, end) > 4
    && rng() < lane.risk;
  const offsideOffence = play.offside && !interceptedBeforeRunner;
  const delivery = play.offside ? 1 : rng();
  const success = delivery < play.control;
  const recipient = passer ? play.recipient : carrier;
  const contact = !success && !play.offside && !play.cornerRoute && defendDelivery(play, carrier, side, rng);
  const exit = contact?.exit;
  const misplayedExit = !success && !play.offside && !play.cornerRoute && !contact
    && rng() >= (lane.risk ?? 0) ? misplayedBallExit(carrier, play, side, rng) : null;
  let cornerContact = null;
  let turnover = null;
  if (!success && !offsideOffence && !misplayedExit) {
    if (play.cornerRoute) cornerContact = cornerDefender(play, opponents, rng);
    turnover = cornerContact?.player ?? contact?.defender ?? lane.interceptor ?? closestPlayer(opponents, end);
  }
  const looseClearance = cornerContact && !cornerContact.claimed && play.airborne;
  const outcome = success ? 'complete' : offsideOffence ? 'offside' : exit ? (exit.boundary === 'goal-line' ? 'deflected-corner' : 'deflected-throw')
    : misplayedExit ? 'out' : cornerContact?.claimed || contact?.cause === 'claimed-delivery' ? 'claimed'
      : play.cornerRoute && play.cornerRoute !== 'short' ? 'cleared' : passer ? 'intercepted' : 'tackled';
  if (play.cornerRoute) {
    game.corner.attempted = true;
    game.corner.route = play.cornerRoute;
    game.corner.takenAt = round(game.second);
    game.stats.cornersTaken[side]++;
    if (outcome === 'cleared') game.stats.cornerClearances[1 - side]++;
    const deliveryText = play.cornerRoute === 'short' ? 'takes the corner short'
      : play.cornerRoute === 'edge' ? 'delivers the corner to the edge of the box'
        : 'delivers the corner to the ' + (play.cornerRoute === 'central' ? 'middle' : play.cornerRoute.replace('-', ' '));
    const contactText = cornerContact?.claimed ? '. ' + turnover.name + ' claims it.'
      : outcome === 'cleared' ? '. ' + turnover.name + ' clears the delivery.' : '.';
    const cause = game.corner.cause;
    game.incident(side, 'corner', carrier, (cornerCauseText[cause] ?? '') + carrier.name + ' ' + deliveryText + contactText,
      {route: play.cornerRoute, cause});
  }
  action(game, play.type, carrier, {
    outcome, location: point(carrier), to: point(end), ...(passer ? {targetId: recipient.id} : {}),
    ...(turnover ? {defenderId: turnover.id} : {}), ...(play.airborne ? {airborne: true} : {}),
    ...(success && play.breaksLine ? {lineBreak: true} : {}), ...(ready ? {restart: ready} : {}),
    ...(play.cornerRoute ? {cornerRoute: play.cornerRoute} : {}),
    ...(play.cross ? {cross: play.cross} : {}),
    ...(play.offside ? {receiverDepthAtKick: attackingX(recipient.x, side), offsideLineDepth: play.offsideLine} : {}),
    ...(misplayedExit ? {exit: point(misplayedExit)} : {}),
    ...(!success && lane.contact && (contact || (['intercepted', 'tackled'].includes(outcome) && turnover === lane.interceptor))
      ? {contactLocation: point(lane.contact)} : {}),
    ...(contact ? {defensiveTouch: contact.cause} : {}), ...(exit ? {exit: point(exit)} : {})
  });
  const settling = passer && !play.cornerRoute && !game.openingRestart
    ? clamp((distanceBetween(carrier, closestPlayer(opponents, carrier)) - 2) * 0.16, 0, 1.55) : 0;
  const tempo = game.teams[side].tempo;
  const tempoFactor = ready ? 1 : tempo === 'quick' ? 0.73 : tempo === 'patient' ? 1.32 : 1;
  const controlTime = ((passer ? 1.22 : 1.68) + settling + (14 - carrier.attributes.decisions) * 0.026 + rng() * 1.15) * tempoFactor;
  const meetingPoint = turnover === lane.interceptor && lane.contact ? lane.contact : end;
  const destination = misplayedExit ?? exit ?? meetingPoint;
  const collectTime = turnover && !exit
    ? distanceBetween(turnover, meetingPoint) / runningSpeed(turnover) : 0;
  const cornerRuns = play.cornerRoute && play.cornerRoute !== 'short';
  // The shape can follow the delivery while the original presser closes
  // the passer. Nobody knows its final destination before the release.
  const movingBall = {x: carrier.x + (destination.x - carrier.x) * 0.32,
    y: carrier.y + (destination.y - carrier.y) * 0.32};
  const travel = controlTime + Math.max(lane.time, collectTime);
  if (cornerRuns) runForCorner(play, turnover, Math.min(travel, game.halfEnd - game.second));
  advance(game, travel, true, Boolean(cornerRuns), movingBall);
  game.openingRestart = null;

  if (success) {
    if (passer) {
      game.stats.completedPasses[side]++;
      carrier.completedPasses++;
      if (play.cross) game.stats.completedCrosses[side]++;
      if (play.breaksLine) game.stats.lineBreaks[side]++;
      game.lastPass = {player: carrier, airborne: play.airborne, second: game.second, cornerRoute: play.cornerRoute};
      const backwards = attackingX(end.x, side) < attackingX(carrier.x, side) - 4;
      const touchMargin = 0.075 + (14 - recipient.attributes.firstTouch) * 0.004;
      if (backwards || play.control - delivery < touchMargin) game.pressUntil = game.second + 6;
    } else if (distanceBetween(carrier, end) > 5) {
      game.lastPass = null;
    }
    Object.assign(recipient, end);
    game.carrier = recipient;
    game.chainLength++;
  } else if (looseClearance) {
    if (game.second < game.halfEnd) recoverCornerClearance(game, play, turnover, opponents);
  } else if (offsideOffence) {
    game.stats.offsides[side]++;
    game.incident(side, 'offside', recipient, recipient.name + ' is flagged offside.');
    queueRestart(game, 1 - side, 'offside', end);
  } else if (exit) {
    restartAfterDeflection(game, exit, contact.cause);
  } else if (misplayedExit) {
    if (misplayedExit.ownGoalLine) {
      corner(game, 1 - side, misplayedExit.y, 'misplayed-ball');
    } else if (misplayedExit.boundary === 'goal-line') {
      goalKick(game, 1 - side, misplayedExit.y);
    } else {
      queueRestart(game, 1 - side, 'throw-in', point(misplayedExit));
    }
  } else if (turnover) {
    if (cornerContact?.claimed) game.stats.cornerClaims[1 - side]++;
    else if (outcome === 'intercepted') game.stats.interceptions[1 - side]++;
    Object.assign(turnover, meetingPoint);
    regainingPlayer(game, 1 - side, turnover);
  }
}

function takeShot(game, play, opponents) {
  const {side, carrier, lastPass, openingRestart, rng} = game;
  const origin = point(carrier);
  const geometry = play.geometry ?? shotGeometry(carrier, side, opponents);
  const fromCorner = game.corner?.attempted;
  const secondBall = game.corner?.recovery !== undefined;
  const quickSecondBall = secondBall && round(game.second) - game.corner.takenAt <= 10;
  const situation = openingRestart === 'penalty' ? 'penalty' :
    openingRestart === 'free-kick' ? 'free-kick' : fromCorner ? 'corner' : 'open-play';
  const blockCandidate = geometry.blocker ?? closestPlayer(opponents, carrier, player =>
    player.position !== 'GK' && attackingX(player.x, side) > attackingX(carrier.x, side) &&
    Math.abs(player.y - carrier.y) < 4.5 && distanceBetween(player, carrier) < 7.5);
  const chance = shotDetails(geometry, play.pressure ?? 0, play.bodyPart ?? 'foot', situation, play.rushed);
  chance.intervention = blockCandidate ? clamp((8 - distanceBetween(blockCandidate, carrier)) * 0.029, 0, 0.19) : 0;
  const xg = round(expectedGoals(chance));
  if (play.oneOnOne && situation === 'open-play') chance.finish = breakawayFinish(carrier, geometry, goalX(side), rng);
  const {outcome: type, offset} = resolveShotAttempt(chance, carrier, geometry.keeper, rng);
  const shotSide = game.stats;
  const creator = lastPass && game.second - lastPass.second <= 7 ? lastPass.player : null;
  const depth = attackingX(origin.x, side);
  const move = situation !== 'open-play' ? 'set-piece'
    : game.transition === 'press' && game.second - game.controlStarted < 24 ? 'press'
      : game.transition === 'break' && game.second - game.controlStarted < 22 && depth - game.controlLocation > 17 ? 'break' : 'build';
  const zone = depth < 88.5 ? 'edge' : Math.abs(origin.y - 34) > 11 ? 'wide' : 'box';
  const verb = {goal: 'scores', save: 'has a shot saved', blocked: 'has a shot blocked', woodwork: 'hits the woodwork', miss: 'shoots off target'}[type];
  shotSide.shots[side]++;
  shotSide.xg[side] += xg;
  carrier.shots++;
  if (fromCorner && !game.corner.producedShot) {
    game.corner.producedShot = true;
    shotSide.cornersWithShot[side]++;
  }
  if (quickSecondBall) shotSide.quickCornerSecondBallShots[side]++;
  if (creator) creator.chancesCreated++;
  if (type === 'goal' || type === 'save') shotSide.onTarget[side]++;
  if (type === 'blocked') shotSide.blocks[1 - side]++;
  if (type === 'woodwork') shotSide.woodwork[side]++;
  if (type === 'save' && geometry.keeper) geometry.keeper.saves++;
  if (type === 'goal') {
    game.score[side]++;
    carrier.goals++;
    if (geometry.keeper) geometry.keeper.goalsConceded++;
    if (creator) creator.assists++;
  }
  game.events.push({
    ...timestamp(game, side), possession: game.possession, type, move, zone, xg, playerId: carrier.id, location: origin,
    bodyPart: chance.bodyPart, situation, ...reportShotGeometry(chance),
    ...(play.oneOnOne ? {oneOnOne: true} : {}), ...(chance.finish ? {finish: chance.finish} : {}),
    ...(chance.unguardedGoal ? {unguardedGoal: true} : {}),
    ...(fromCorner ? {cornerRoute: game.corner.route} : {}),
    ...(secondBall ? {secondBall: true} : {}), ...(play.rushed ? {rushed: true} : {}),
    text: carrier.name + ' ' + verb + (situation === 'penalty' ? ' from the penalty spot.'
      : play.oneOnOne ? ' after breaking through on goal.' : '.'),
    ...(creator && type === 'goal' ? {assistId: creator.id} : {})
  });
  const caught = type === 'save' && geometry.keeper && rng() < 0.63;
  const deflector = type === 'blocked' ? blockCandidate : type === 'save' && !caught ? geometry.keeper : null;
  const direction = side === 0 ? 1 : -1;
  const target = {x: goalX(side) + (type === 'goal' || type === 'miss' ? direction * 1.3 : 0),
    y: PITCH.width / 2 + (offset ?? 0)};
  let impact = target;
  if (type === 'blocked' && blockCandidate) impact = point(blockCandidate);
  if (type === 'save' && geometry.keeper) {
    const keeper = geometry.keeper;
    const fraction = clamp((keeper.x - origin.x) / (target.x - origin.x || direction), 0, 1);
    const shotY = origin.y + (target.y - origin.y) * fraction;
    impact = {x: keeper.x, y: keeper.y + clamp(shotY - keeper.y, -1.65, 1.65)};
  }
  const exit = deflector ? defensiveExit(impact, origin, side, type === 'blocked' ? 0.48 : 0.58, rng) : null;
  const cause = type === 'blocked' ? 'deflected-shot' : 'parried-shot';
  action(game, 'shot', carrier, {
    outcome: type, location: origin, to: point(impact),
    ...(chance.finish ? {finish: chance.finish, oneOnOne: true} : {}),
    ...(type === 'save' && geometry.keeper ? {keeperId: geometry.keeper.id} : {}),
    ...(deflector ? {defenderId: deflector.id, defensiveTouch: cause} : {}), ...(exit ? {exit: point(exit)} : {})
  });
  advance(game, 2.4 + rng() * 2.1, true);
  if (type === 'save' && geometry.keeper) Object.assign(geometry.keeper, impact);
  game.lastPass = null;
  game.openingRestart = null;

  if (type === 'goal') kickoff(game, 1 - side);
  else if (caught) {
    gainControl(game, 1 - side, geometry.keeper);
    game.regainedAt = game.second;
  } else if (exit) {
    restartAfterDeflection(game, exit, cause);
  } else if (deflector) {
    regainingPlayer(game, 1 - side, deflector);
  } else if (type === 'woodwork' && rng() < 0.42) {
    const rebound = closestPlayer(game.teams[side].players, {x: ownDepth(side, 96), y: 34});
    game.carrier = rebound;
    game.chainLength++;
  } else {
    goalKick(game, 1 - side, origin.y);
  }
}

function playAction(game) {
  const rivals = game.teams[1 - game.side].players.filter(isActive);
  if (challenge(game, rivals)) return;
  if (game.openingRestart === 'penalty') {
    takeShot(game, {}, rivals);
    return;
  }
  if (game.openingRestart === 'corner') {
    const routine = game.corner.routine;
    delete game.corner.routine;
    firstTouch(game, chooseCornerDelivery(routine, game.teams[game.side].buildUp, game.rng), rivals);
    return;
  }
  const play = choosePlay(game.carrier, game.teams[game.side], rivals,
    {side: game.side, chainLength: game.chainLength, restart: game.openingRestart, lastPass: game.lastPass,
      fromCorner: Boolean(game.corner?.attempted),
      recentRegain: game.regainedAt !== undefined && game.second - game.regainedAt <= 12,
      recovery: game.corner?.recovery?.second === game.second ? game.corner.recovery : null,
      countering: game.transition === 'break' && game.second - game.controlStarted <= 12}, game.rng);
  if (play.type === 'shot') takeShot(game, play, rivals);
  else if (play.type === 'pass' || play.type === 'carry') firstTouch(game, play, rivals);
  else {
    action(game, 'clearance', game.carrier, {outcome: 'out', location: point(game.carrier)});
    advance(game, 3.5, true);
    queueRestart(game, 1 - game.side, 'throw-in', {x: game.carrier.x, y: game.carrier.y < 34 ? 0 : PITCH.width});
  }
}

const periodEnded = game => game.second >= game.halfEnd && game.restart?.kind !== 'penalty';
export const atHalfTime = game => game.period === 1 && periodEnded(game) && !game.abandoned;

export function advanceMatch(game, through, {stopAtHalfTime = false, onAction} = {}) {
  while (game.second < through && !game.abandoned) {
    if (periodEnded(game)) {
      if (game.period === 2 || stopAtHalfTime) break;
      game.period = 2;
      game.periodStart = game.second;
      game.nominalEnd = game.periodStart + HALF;
      game.halfEnd = game.nominalEnd;
      game.stoppageDelay = 0;
      kickoff(game, 1 - game.firstKick);
    }
    const firstAction = game.actions.length;
    const firstIncident = game.timeline.length;
    if (game.restart) takeRestart(game);
    else playAction(game);
    onAction?.(game, firstAction, firstIncident);
  }
  return Boolean(game.abandoned || (game.period === 2 && periodEnded(game)));
}

function mapCornerPlayers(corner, map) {
  if (!corner?.routine) return corner;
  const {taker, guard, keeper, routes} = corner.routine;
  return {...corner, routine: {
    taker: map(taker), guard: map(guard), keeper: map(keeper),
    routes: routes.map(route => ({...route, receiver: map(route.receiver), marker: map(route.marker)}))
  }};
}

export function checkpointMatch(game) {
  const id = player => player?.id ?? null;
  return {...game, rng: undefined, incident: undefined, carrier: id(game.carrier),
    lastPass: game.lastPass ? {...game.lastPass, player: id(game.lastPass.player)} : null,
    corner: mapCornerPlayers(game.corner, id)};
}

export function restoreMatch(state, rng) {
  for (const team of state.teams) restoreTeamShape(team);
  const players = new Map(state.teams.flatMap(team => team.players.map(player => [player.id, player])));
  const get = id => players.get(id) ?? null;
  return matchRuntime({...state, carrier: get(state.carrier),
    lastPass: state.lastPass ? {...state.lastPass, player: get(state.lastPass.player)} : null,
    corner: mapCornerPlayers(state.corner, get)}, rng);
}

function pitchMovement(entry, endSecond, game) {
  const {type, side, outcome, location, second} = entry;
  const kind = entry.cross === 'cutback' ? 'cutback' : entry.cross ? 'cross' :
    entry.cornerRoute && entry.airborne ? 'cross' : type;
  const end = entry.contactLocation ?? (type === 'shot' ? entry.to : entry.exit) ?? entry.to ??
    (outcome === 'out' ? game.restart?.location : null) ?? location;
  const contactId = type === 'shot' ? entry.keeperId ?? entry.defenderId :
    outcome === 'complete' ? entry.targetId ?? entry.playerId : entry.defenderId;
  return {kind, side, outcome, playerId: entry.playerId, start: location, end, duration: round(Math.max(0, endSecond - second)),
    ...(contactId ? {contactId} : {}),
    ...(entry.exit && (entry.contactLocation || type === 'shot') ? {deflection: entry.exit} : {}),
    ...(entry.airborne || entry.finish === 'chip' ? {lofted: true} : {})};
}

function frameCommentary(game, entries, firstIncident) {
  const entry = entries.at(-1);
  const shot = entries.some(play => play.type === 'shot') && game.events.at(-1);
  const incident = shot || game.timeline.slice(firstIncident).at(-1);
  if (incident) {
    const {minute, addedMinute, side, text} = incident;
    return {minute, addedMinute, side, text, priority: incident.type === 'goal' ? 3 : 2};
  }
  if (!entry) return null;
  const {minute, addedMinute, side, outcome} = entry;
  const team = game.teams[side === 'home' ? 0 : 1];
  const name = team.players.find(player => player.id === entry.playerId)?.name;
  if (!name) return null;
  let text;
  if (entry.type === 'restart') {
    const verb = {kickoff: 'kicks off', 'goal-kick': 'takes the goal kick', 'throw-in': 'takes the throw-in',
      'free-kick': 'stands over the free kick', corner: 'prepares to take the corner',
      penalty: 'steps up to the penalty spot', offside: 'restarts after the offside'};
    text = name + ' ' + (verb[outcome] ?? 'restarts play') + '.';
  } else if (outcome === 'deflected-throw' || outcome === 'deflected-corner') {
    text = name + ' wins a ' + (outcome === 'deflected-throw' ? 'throw-in.' : 'corner.');
  } else if (outcome === 'out') {
    text = name + ' plays the ball out.';
  } else if (entry.type === 'pass' && outcome === 'complete') {
    const receiver = team.players.find(player => player.id === entry.targetId);
    if (receiver) text = name + (entry.cross ? ' crosses to ' : ' finds ') + receiver.name + '.';
  } else if (outcome === 'intercepted' || outcome === 'tackled') {
    const defender = game.teams[1 - team.side].players.find(player => player.id === entry.defenderId);
    if (defender) text = defender.name + (outcome === 'intercepted' ? ' cuts out the pass.' : ' takes the ball from ' + name + '.');
    if (text) return {minute, addedMinute, side: sideName(1 - team.side), text, priority: 1};
  } else if (entry.type === 'carry' && outcome === 'complete') {
    text = name + ' carries the ball forward.';
  }
  return text ? {minute, addedMinute, side, text, priority: 1} : null;
}

export function pitchFrame(game, seq, firstAction = game.actions.length, firstIncident = game.timeline.length) {
  const entries = game.actions.slice(firstAction);
  const motion = entries.map((entry, index) =>
    pitchMovement(entry, entries[index + 1]?.second ?? game.second, game));
  const last = game.actions.at(-1);
  // A dead ball remains where play stopped. Only the subsequent restart places it
  // on the corner arc, six-yard line or centre spot.
  let ball = game.carrier ?? {x: PITCH.length / 2, y: PITCH.width / 2};
  if (game.restart) ball = game.restart.setup ? game.restart.location : last?.exit ?? last?.to ?? game.restart.location;
  const restartSetup = game.restart?.setup ? game.restart.kind : entries.at(-1)?.type === 'restart' ? game.openingRestart : null;
  return {seq, second: round(game.second), ball: point(ball), carrierId: game.restart ? null : game.carrier?.id ?? null, motion, ...(restartSetup ? {restartSetup} : {}),
    commentary: frameCommentary(game, entries, firstIncident), teams: game.teams.map(team =>
    team.players.filter(isActive).map(player => [player.id, Math.round(player.x * 10) / 10, Math.round(player.y * 10) / 10]))};
}

export function liveMatchReport(game) {
  const {figures, stats} = matchStatistics(game);
  const jobLabels = {press: 'Pressing', mark: 'Marking', screen: 'Screening', cover: 'Covering', outlet: 'Staying up'};
  const playerNames = new Map(game.teams.flatMap(t => t.players.map(p => [p.id, p.name])));
  function defensiveJob(team, player) {
    const label = jobLabels[player.defensiveTask];
    if (!label || !isActive(player) || team.side === game.side || game.restart || game.corner || atHalfTime(game)
        || game.openingRestart || game.lastMovementPossession !== game.possession) return {};
    const targetName = playerNames.get(player.defensiveTargetId);
    return {defensiveJob: {label, ...(targetName ? {targetName} : {})}};
  }
  return {
    stats, shots: game.events,
    period: game.period, elapsed: Math.min(HALF, Math.floor(game.second - game.periodStart)),
    added: Math.max(0, Math.ceil((game.second - game.nominalEnd) / 60)), score: game.score,
    teams: game.teams.map(team => ({
      formation: team.formation, defensiveFormation: team.defensiveFormation ?? team.formation,
      playerRoles: Object.fromEntries(team.players.filter(p => isActive(p) && p.roles).map(p => [p.id, p.roles])),
      markingTargets: Object.fromEntries(team.players.filter(p => isActive(p) && p.markingTarget).map(p => [p.id,p.markingTarget])),
      playerInstructions: Object.fromEntries(team.players.filter(p => isActive(p) && p.instructions && Object.keys(p.instructions).length)
        .map(p => [p.id, p.instructions])),
      ...instructionValues(team), substitutions: team.substitutions, windows: team.windows,
      pendingSubstitution: team.pendingSubstitution ?? null,
      players: team.players.map(player => ({id: player.id, number: player.number, name: player.name,
        position: player.position, slot: player.slot, slotIndex: player.slotIndex, defensiveSlot: player.defensiveSlot ?? player.slot,
        markingTarget: player.markingTarget ?? null, roles: player.roles ?? {}, instructions: player.instructions ?? {}, duty: player.duty ?? 'support', active: isActive(player), rating: matchRating(player),
        ...defensiveJob(team, player),
        shots: player.shots, assists: player.assists, saves: player.saves, regains: player.regains, ...figures.get(player.id),
        condition: Math.round(player.condition), goals: player.goals, cautions: player.cautions, dismissed: Boolean(player.dismissed)})),
      bench: team.bench.map(({id, name, number, position}) => ({id, name, number, position}))
    })),
    incidents: [...game.timeline, ...game.events].sort((a, b) => a.second - b.second).slice(-7).reverse()
  };
}

export function matchResult(game) {
  const {score, events, timeline, actions} = game;
  const {figures, stats, ballInPlay} = matchStatistics(game);
  const analysis = game.teams.map(team => {
    const i = team.side;
    const completion = stats.passes[i] ? Math.round(stats.completedPasses[i] / stats.passes[i] * 100) : 0;
    const summary = completion + '% pass completion and ' + stats.lineBreaks[i] + ' completed line-breaking passes.';
    return summary + (team.pressing === 'high' ? ' Your team won ' + stats.pressRegains[i] + ' balls high up the pitch.' : '');
  });
  const performances = game.teams.map(team => team.players.map(player => ({
    ...playerPerformance(player, game.second), ...figures.get(player.id), position: player.position, slot: player.slot
  })));
  return {
    engineVersion: ENGINE_VERSION, durationSeconds: round(game.second), ballInPlaySeconds: round(ballInPlay),
    score, stats, events, timeline, actions, analysis, performances, ...(game.abandoned ?? {})
  };
}

export function simulateMatch(sides, rng) {
  const game = startMatch(sides, rng);
  advanceMatch(game, Infinity);
  return matchResult(game);
}
