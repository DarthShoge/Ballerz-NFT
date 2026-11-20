import test from 'node:test';
import assert from 'node:assert/strict';
import { clubs, defaultPlan } from '../src/football.js';
import { isActive } from '../src/match-decisions.js';
import { judgeChallenge } from '../src/match-discipline.js';
import { chooseCornerDelivery, contestCornerClearance, cornerDefender, stageCorner } from '../src/match-set-pieces.js';
import { ballExit, crossType, defendDelivery } from '../src/match-deliveries.js';
import { abandonment, dismissPlayer, injurePlayer, prepareTeam, replaceUnavailablePlayers } from '../src/match-rules.js';
import { counterOutlet, movePlayers, passLane, setPlayerPositions, shotGeometry } from '../src/match-pitch.js';

function teamsWithoutReserves() {
  const teams = clubs.map((club, side) => {
    const {xi} = defaultPlan(club);
    return prepareTeam({players: club.squad.filter(player => xi.includes(player.id)), pressing: 'standard'}, side);
  });
  setPlayerPositions(teams);
  return teams;
}

test('an emergency keeper replaces an injury and a red card still costs a player', () => {
  const teams = teamsWithoutReserves();
  const team = teams[0];
  const game = {teams, second: 700, incident() {}};
  const firstKeeper = team.players.find(player => player.position === 'GK');
  injurePlayer(firstKeeper, game.second);
  replaceUnavailablePlayers(game, [{team, player: firstKeeper}]);
  assert.equal(team.players.filter(isActive).length, 11);
  const standIn = team.players.find(player => isActive(player) && player.position === 'GK');
  assert.equal(standIn.name, 'AI goalkeeper 1');
  assert.equal(standIn.attributes.reflexes, 4);

  game.second += 70;
  dismissPlayer(standIn, game.second);
  replaceUnavailablePlayers(game, [{team, player: standIn}]);
  assert.equal(team.players.filter(isActive).length, 10);
  assert.equal(team.players.find(player => isActive(player) && player.position === 'GK').name, 'AI goalkeeper 2');
  assert.equal(team.substitutions, 2);

  game.second += 70;
  team.windows = 3;
  const replacement = team.players.find(player => isActive(player) && player.position === 'GK');
  injurePlayer(replacement, game.second);
  replaceUnavailablePlayers(game, [{team, player: replacement}]);
  assert.equal(team.players.filter(isActive).length, 9);
  assert.equal(team.players.filter(player => isActive(player) && player.position === 'GK').length, 1);
  assert.equal(team.substitutions, 2);
});

test('abandonment preserves match statistics and applies the agreed administrative score', () => {
  const teams = teamsWithoutReserves();
  for (const player of teams[0].players.slice(0, 5)) dismissPlayer(player, 1200);
  assert.deepEqual(abandonment(teams, [1, 2]), {
    kind: 'abandoned', score: [0, 3], playedScore: [1, 2]
  });
  assert.deepEqual(abandonment(teams, [2, 6]), {
    kind: 'abandoned', score: [2, 6], playedScore: [2, 6]
  });
  for (const player of teams[1].players.slice(0, 5)) injurePlayer(player, 1200);
  assert.deepEqual(abandonment(teams, [1, 2]), {
    kind: 'double-abandonment', score: null, playedScore: [1, 2]
  });
});

test('a defender can close a pass lane and obscure the goal from the same shot spot', () => {
  const [home, away] = teamsWithoutReserves();
  const defender = away.players.find(player => player.position === 'DF');
  const ball = {x: 58, y: 32}, target = {x: 80, y: 32};
  const near = {...defender, x: 70, y: 32};
  const wide = {...defender, x: 70, y: 52};
  assert.ok(passLane(ball, target, [near]).risk > passLane(ball, target, [wide]).risk);
  const shooter = {x: 87, y: 34};
  const clear = shotGeometry(shooter, home.side, [{...near, x: 95, y: 51}]);
  const covered = shotGeometry(shooter, home.side, [{...near, x: 95, y: 34}]);
  assert.equal(covered.distance, clear.distance);
  assert.ok(covered.visibleAngle < clear.visibleAngle);
  assert.equal(clear.blockers, 0);
  assert.equal(covered.blockers, 1);
});

test('counterattack keeps one forward available while the other players drop back', () => {
  const [home, away] = teamsWithoutReserves();
  home.buildUp = 'direct';
  home.pressing = 'compact';
  const outlet = counterOutlet(home);
  const otherForward = home.players.find(player => player.position === 'FW' && player !== outlet);
  assert.equal(outlet.position, 'FW');
  movePlayers([home, away], {ball: {x: 21, y: 34}, possessionSide: 1, seconds: 12});
  assert.ok(outlet.x >= 50 && outlet.x < 52);
  assert.ok(otherForward.x < 40);
  dismissPlayer(outlet, 60);
  assert.equal(counterOutlet(home), otherForward);
  home.buildUp = 'short';
  assert.equal(counterOutlet(home), null);
});

test('a high press closes a newly triggered lane from beyond its normal reach', () => {
  const [home, away] = teamsWithoutReserves();
  home.pressing = 'high';
  const player = home.players.find(player => player.position === 'MF');
  home.players = [{...player, x: 32, y: 34, anchorX: 41, anchorY: 34}];
  const ball = {x: 50, y: 34};
  const normal = {...home, players: home.players.map(player => ({...player}))};
  movePlayers([normal, away], {ball, possessionSide: 1, seconds: 1});
  movePlayers([home, away], {ball, possessionSide: 1, seconds: 1, pressTriggered: true});
  assert.ok(home.players[0].x > normal.players[0].x + 1);
});

test('the same challenge from behind is more likely to foul and severity determines the card', () => {
  const [home, away] = teamsWithoutReserves();
  const carrier = {...home.players[7], x: 47, y: 34};
  const tackler = {...away.players[3], x: 45, y: 34, condition: 95,
    attributes: {...away.players[3].attributes, tackling: 13, decisions: 13}};
  const random = (...values) => () => values.shift();
  for (const [severity, expected] of [[0.9, null], [0.08, 'yellow'], [0.001, 'red']]) {
    const ruling = judgeChallenge(carrier, tackler, 0, false, random(0.5, severity));
    assert.equal(ruling.kind, 'foul');
    assert.equal(ruling.card, expected);
  }
  assert.equal(judgeChallenge(carrier, {...tackler, x: 49}, 0, false, random(0.5)).kind, 'won');
  assert.notEqual(judgeChallenge(carrier, tackler, 0, true, random(0.5)).kind, 'foul');
  assert.notEqual(judgeChallenge(carrier, {...tackler, cautions: 1}, 0, false, random(0.5)).kind, 'foul');
});

test('corner routines place a near-post marker and give short or contested delivery options', () => {
  const [attack, defence] = teamsWithoutReserves();
  const flag = {x: 105, y: 0};
  const setup = stageCorner(attack, defence, 0, flag);
  assert.ok(setup.guard.y < 34);
  assert.ok(setup.guard.x > 102);
  assert.deepEqual({x: setup.taker.x, y: setup.taker.y}, flag);
  assert.ok(defence.players.every(player => Math.hypot(player.x - flag.x, player.y - flag.y) >= 9.15));

  const short = chooseCornerDelivery(setup, 'short', () => 0);
  const near = setup.routes.find(route => route.name === 'near-post');
  const cross = chooseCornerDelivery({...setup, routes: [near]}, 'mixed', () => 0.5);
  assert.equal(short.cornerRoute, 'short');
  assert.equal(short.airborne, false);
  assert.equal(cross.cornerRoute, 'near-post');
  assert.equal(cross.airborne, true);
  assert.ok(short.control > cross.control);
  assert.deepEqual(cornerDefender(cross, defence.players, () => 0), {player: setup.keeper, claimed: true});
  assert.deepEqual(cornerDefender(cross, defence.players, () => 0.99), {player: setup.guard, claimed: false});

  const otherFlag = {x: 0, y: 68};
  const mirrored = stageCorner(defence, attack, 1, otherFlag);
  assert.ok(mirrored.guard.y > 34);
  assert.ok(mirrored.guard.x < 3);
});

test('wide deliveries distinguish high crosses, low crosses and byline cutbacks', () => {
  assert.equal(crossType({x: 80, y: 5}, {x: 88, y: 34}, 0), 'high-cross');
  assert.equal(crossType({x: 89, y: 53}, {x: 92, y: 38}, 0), 'low-cross');
  assert.equal(crossType({x: 3, y: 57}, {x: 16, y: 31}, 1), 'cutback');
  assert.equal(crossType({x: 91, y: 30}, {x: 96, y: 37}, 0), null);
});

test('a short clearance and a clean clearance can be won by different sides', () => {
  const [attack, defence] = teamsWithoutReserves();
  const [runner, receiver] = attack.players.filter(player => player.position !== 'GK');
  const [defender, cover] = defence.players.filter(player => player.position !== 'GK');
  Object.assign(runner, {x: 85, y: 34});
  Object.assign(receiver, {x: 95, y: 34});
  Object.assign(defender, {x: 96, y: 35});
  Object.assign(cover, {x: 75, y: 34});
  const play = {end: {x: 95, y: 34}, recipient: receiver};
  const race = firstDraw => {
    const draws = [firstDraw, 0.5, 0.5];
    return contestCornerClearance(play, defender, [runner, receiver], [defender, cover], 0, () => draws.shift());
  };
  const short = race(0.99);
  assert.equal(short.won, true);
  assert.equal(short.winner, runner);
  assert.ok(short.seconds > 0);
  const long = race(0);
  assert.equal(long.won, false);
  assert.equal(long.winner, cover);
  assert.ok(short.target.x > long.target.x);
});

test('the first boundary and last defender touch determine a corner or throw-in', () => {
  assert.deepEqual(ballExit({x: 100, y: 52}, {x: 110, y: 64}, 0),
    {boundary: 'goal-line', x: 105, y: 58});
  assert.deepEqual(ballExit({x: 5, y: 52}, {x: -5, y: 64}, 1),
    {boundary: 'goal-line', x: 0, y: 58});
  assert.deepEqual(ballExit({x: 100, y: 64}, {x: 110, y: 74}, 0),
    {boundary: 'touchline', x: 104, y: 68});
  assert.equal(ballExit({x: 100, y: 50}, {x: 103, y: 60}, 0), null);
  assert.equal(ballExit({x: 100, y: 34}, {x: 110, y: 34}, 0), null);

  const carrier = {x: 93, y: 10};
  const contact = {x: 96, y: 18};
  const play = {cross: 'low-cross', end: {x: 96, y: 31}, lane: {contact, risk: 0.34, interceptor: null}};
  assert.equal(defendDelivery(play, carrier, 0, () => 0), null);
  const defender = {position: 'DF'};
  play.lane.interceptor = defender;
  const deflection = defendDelivery(play, carrier, 0, () => 0);
  assert.equal(deflection.defender, defender);
  assert.equal(deflection.exit.boundary, 'goal-line');
  assert.equal(defendDelivery(play, carrier, 0, () => 0.99).exit.boundary, 'touchline');
});
