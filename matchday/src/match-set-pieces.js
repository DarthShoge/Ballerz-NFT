import { PITCH, advancePlayer, attackingX, runningSpeed } from './match-pitch.js';
import { closestPlayer, distanceBetween, isActive } from './match-decisions.js';

const centre = PITCH.width / 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const byAerialAbility = (a, b) => aerialAbility(b) - aerialAbility(a);
const aerialAbility = player => (player.attributes.aerial ?? player.attributes.positioning) * 0.74
  + player.attributes.offBall * 0.18 + player.condition * 0.08;
const deliveryAbility = player => (player.attributes.crossing ?? player.attributes.passing) * 0.65
  + player.attributes.vision * 0.27 + player.condition * 0.08;
const supportAbility = player => player.attributes.firstTouch + player.attributes.decisions;

export function stageCorner(attack, defence, side, flag, position = Object.assign) {
  const place = (player, depth, y) => position(player, {x:attackingX(depth, side), y});
  const attackers = attack.players.filter(player => isActive(player) && player.position !== 'GK');
  const defenders = defence.players.filter(player => isActive(player) && player.position !== 'GK').sort(byAerialAbility);
  const keeper = defence.players.find(player => isActive(player) && player.position === 'GK');
  const taker = attackers.reduce((best, player) =>
    deliveryAbility(player) > deliveryAbility(best) ? player : best);
  const queue = attackers.filter(player => player !== taker).sort(byAerialAbility);
  const signs = flag.y < centre ? 1 : -1;
  const routes = [
    {name: 'near-post', depth: 95, y: centre - signs * 6},
    {name: 'central', depth: 93, y: centre},
    {name: 'far-post', depth: 94, y: centre + signs * 7},
    {name: 'edge', depth: 85.5, y: centre - signs * 5}
  ];
  const guard = defenders.shift();
  if (guard) place(guard, 103.4, centre - signs * (PITCH.goalWidth / 2 + 0.4));
  if (keeper) place(keeper, 103.9, centre - signs * 0.9);

  for (const route of routes) {
    route.receiver = route.name === 'edge'
      ? queue.reduce((best, player) => !best || supportAbility(player) > supportAbility(best) ? player : best, null)
      : queue[0];
    if (route.receiver) queue.splice(queue.indexOf(route.receiver), 1);
    route.runTo = {x: attackingX(route.depth, side), y: route.y};
    if (route.receiver) place(route.receiver, route.depth - 3.2, route.y - signs * 1.2);
    route.marker = defenders.shift() ?? null;
    route.trackTo = {x: attackingX(route.depth + 1.5, side), y: route.y + signs * 2.7};
    if (route.marker) place(route.marker, route.depth - 1.4, route.y + signs * 2.2);
  }
  const support = queue.reduce((best, player) =>
    !best || supportAbility(player) > supportAbility(best) ? player : best, null);
  if (support) {
    place(support, 98, flag.y + signs * 7);
    routes.push({name: 'short', receiver: support, marker: null});
  }

  // Keep the remaining outfielders outside the box for second balls and counters.
  queue.filter(player => player !== support).forEach((player, index) =>
    place(player, index < 2 ? 79 - index * 4 : 61, centre + (index % 2 ? 1 : -1) * 13));
  defenders.forEach((player, index) =>
    place(player, index < 2 ? 91 : 75, centre + (index % 2 ? 1 : -1) * (12 + index % 3 * 3)));

  position(taker, {...flag});
  return {taker, routes: routes.filter(route => route.receiver), guard, keeper};
}

export function chooseCornerDelivery(setup, buildUp, rng) {
  const {taker, routes, keeper, guard} = setup;
  const short = routes.find(route => route.name === 'short');
  const shortChance = {short: 0.28, mixed: 0.085, direct: 0.035}[buildUp];
  let choice = short && rng() < shortChance ? short : null;
  if (!choice) {
    let best = -Infinity;
    for (const route of routes) {
      if (route.name === 'short') continue;
      const aerialContest = aerialAbility(route.receiver) - (route.marker ? aerialAbility(route.marker) : 16);
      const nearGuard = route.name === 'near-post' && guard ? 0.11 : 0;
      const preference = (buildUp === 'direct' && route.name === 'far-post' ? 0.07 : 0)
        - (route.name === 'edge' ? 0.11 : 0);
      const value = aerialContest * 0.035 - nearGuard + preference + rng() * 0.48;
      if (value > best) {
        best = value;
        choice = route;
      }
    }
  }
  const recipient = choice.receiver;
  const isShort = choice.name === 'short';
  const aerial = !isShort && choice.name !== 'edge';
  const end = choice.runTo ?? {x: recipient.x, y: recipient.y};
  const length = distanceBetween(taker, end);
  const execution = (taker.attributes.crossing ?? taker.attributes.passing) * 0.025;
  const interception = choice.name === 'near-post' ? guard ?? choice.marker : choice.marker;
  const receiverEdge = aerialAbility(recipient) - (interception ? aerialAbility(interception) : 16);
  const control = isShort
    ? clamp(0.80 + (taker.attributes.passing - 12) * 0.012 + (recipient.attributes.firstTouch - 12) * 0.014, 0.72, 0.96)
    : clamp(0.105 + execution + receiverEdge * 0.024 - (choice.name === 'near-post' && guard ? 0.065 : 0), 0.28, 0.68);
  return {
    type: 'pass', recipient, end, length, control, airborne: aerial, cornerRoute: choice.name, routes,
    lane: {time: length / (aerial ? 17 : 14), interceptor: interception,
      keeper: aerial ? keeper : null}
  };
}

export function runForCorner(play, winner, seconds) {
  for (const route of play.routes) {
    if (route.runTo) advancePlayer(route.receiver, route.runTo, seconds, runningSpeed(route.receiver));
    if (route.marker && route.trackTo) advancePlayer(route.marker, route.trackTo, seconds, runningSpeed(route.marker));
  }
  if (winner) advancePlayer(winner, play.end, seconds, runningSpeed(winner));
}

export function chaseClearance(teams, attackingSide, target, winner, seconds) {
  for (const team of teams) {
    const players = team.players.filter(p => isActive(p) && p.position !== 'GK');
    const nearest = closestPlayer(players, target);
    const stepOut = team.side === attackingSide ? 2.8 : 4.5;
    for (const player of players) {
      const chase = player === winner || player === nearest;
      // Defenders step away from goal and attackers follow the ball out. The
      // players closest to the landing spot break ranks to contest first touch.
      const dest = chase ? target : {
        x: attackingX(clamp(attackingX(player.x, attackingSide) - stepOut, 1,104), attackingSide),
        y: player.y + (target.y - player.y) * 0.12
      };
      advancePlayer(player, dest, seconds, runningSpeed(player) * (chase ? 1 : 0.55));
    }
  }
}

export function cornerDefender(play, opponents, rng) {
  const {keeper, interceptor} = play.lane;
  if (keeper && rng() < clamp(0.19 + (keeper.attributes.handling - 13) * 0.026, 0.10, 0.43)) {
    return {player: keeper, claimed: true};
  }
  return {player: interceptor ?? closestPlayer(opponents, play.end), claimed: false};
}

function firstToClearance(players, target, clearingPlayer) {
  let first = null;
  for (const player of players) {
    if (!isActive(player) || player.position === 'GK') continue;
    const {decisions, firstTouch} = player.attributes;
    const recovery = player === clearingPlayer ? 0.6 : 0;
    const time = 0.18 + (20 - decisions) * 0.035 + (20 - firstTouch) * 0.022 + recovery
      + distanceBetween(player, target) / runningSpeed(player);
    if (!first || time < first.time) first = {player, time};
  }
  return first;
}

export function contestCornerClearance(play, defender, attackers, defenders, side, rng) {
  const {aerial, composure} = defender.attributes;
  const pressure = clamp(1 - distanceBetween(defender, play.recipient) / 7, 0, 1);
  const controlled = rng() < clamp(0.46 + (aerial - 13) * 0.038 + (composure - 13) * 0.025
    - pressure * 0.30, 0.12, 0.82);
  const metres = controlled ? 17 + rng() * 13 : 7 + rng() * 8.5;
  const depth = attackingX(play.end.x, side) - metres;
  const spread = controlled ? 40 : 25;
  const target = {x: attackingX(depth, side), y: play.end.y + (rng() - 0.5) * spread};
  const attacker = firstToClearance(attackers, target, null);
  const opponent = firstToClearance(defenders, target, defender);
  const won = attacker && (!opponent || attacker.time < opponent.time);
  const winner = won ? attacker : opponent;
  const flight = 0.68 + distanceBetween(play.end, target) / (controlled ? 17 : 12);
  return {
    target, winner: winner?.player ?? defender, won: Boolean(won),
    seconds: Math.max(flight, winner?.time ?? 0),
    pressure: won && opponent ? clamp(1 - (opponent.time - Math.max(flight, attacker.time)) / 1.3, 0, 1) : 0,
    controlled
  };
}
