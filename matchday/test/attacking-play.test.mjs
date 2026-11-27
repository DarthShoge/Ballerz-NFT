import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clubs } from '../src/football.js';
import { choosePlay } from '../src/match-decisions.js';
import { misplayedBallExit } from '../src/match-deliveries.js';
import { attackingX, clearRunAtGoal, movePlayers, offsideLine, setPlayerPositions } from '../src/match-pitch.js';

function place(side, number, depth, y) {
  return {...clubs[0].squad.find(player => player.number === number), x: attackingX(depth, side), y, condition: 95};
}

function decision(side, carrier, teammates, opponents) {
  return choosePlay(carrier, {players: [carrier, ...teammates], buildUp: 'mixed', pressing: 'standard'},
    opponents, {side, chainLength: 2}, () => 0.7);
}

test('an isolated striker advances on goal from distance and finishes inside the box in either direction', () => {
  for (const side of [0, 1]) {
    const keeper = place(side, 1, 101, 34);
    const trailing = place(side, 4, 70, 36);
    const winger = place(side, 7, 95, 6);
    const striker = place(side, 9, 81, 30);
    const run = decision(side, striker, [winger], [keeper, trailing]);
    assert.equal(run.type, 'carry');
    assert.ok(attackingX(run.end.x, side) > 81);
    assert.ok(run.end.y > 30);
    const shot = decision(side, place(side, 9, 93, 32), [winger], [keeper, trailing]);
    assert.equal(shot.type, 'shot');
    assert.equal(shot.oneOnOne, true);
    assert.equal(clearRunAtGoal(striker, side, [keeper, place(side, 4, 82, 31)]), false);
  }
});

test('a striker can square across a stranded keeper for a better onside finish', () => {
  for (const side of [0, 1]) {
    const striker = place(side, 9, 98, 42);
    const keeper = place(side, 1, 101, 39.2);
    const support = place(side, 10, 97.8, 32);
    const rivals = [keeper, place(side, 4, 78, 35)];
    const pass = decision(side, striker, [support], rivals);
    assert.equal(pass.type, 'pass');
    assert.equal(pass.recipient, support);
    assert.equal(decision(side, striker, [place(side, 10, 99.6, 32)], rivals).type, 'shot');
  }
});

test('a heavy touch can leave the field only along its projected path', () => {
  const pass = (x, y) => ({type: 'pass', end: {x, y}});
  assert.equal(misplayedBallExit({x: 50, y: 32}, pass(53, 35), 0, () => 0.5), null);
  const wide = misplayedBallExit({x: 50, y: 15}, pass(52, 1.5), 0, () => 0.5);
  assert.equal(wide.boundary, 'touchline');
  assert.equal(wide.y, 0);
  for (const side of [0, 1]) {
    const back = misplayedBallExit({x: attackingX(12, side), y: 24},
      pass(attackingX(1, side), 24), side, () => 0.5);
    assert.equal(back.ownGoalLine, true);
    assert.equal(back.x, attackingX(0, side));
  }
});

test('kickoff after a substitution preserves the original shirt positions even with a dismissal', () => {
  const players = [place(0, 2, 25, 8), place(0, 4, 25, 24), place(0, 5, 25, 44), place(0, 3, 25, 60)];
  setPlayerPositions([{players}]);
  const [left, centre, , right] = players;
  const replacement = {...place(0, 14, 37, 28), anchorX: left.anchorX, anchorY: left.anchorY};
  setPlayerPositions([{players: [centre, right, replacement]}]);
  assert.equal(replacement.y, left.y);
  assert.equal(right.y, 59);
  assert.ok(centre.y > left.y && centre.y < 34);
});

test('a runner can time a pass beyond the line or stray offside before the kick in either direction', () => {
  for (const side of [0, 1]) {
    const passer = place(side, 8, 60, 33);
    const keeper = place(side, 1, 100, 34);
    const defender = place(side, 4, 76, 42);
    const rivals = [keeper, defender];
    const pick = (receiver, restart) => choosePlay(passer,
      {players: [passer, receiver], buildUp: 'direct', pressing: 'standard'}, rivals,
      {side, chainLength: 2, restart}, () => 0.98);
    const runner = place(side, 9, 75.9, 30);
    assert.equal(offsideLine(passer, side, rivals), 76);
    const onside = pick(runner);
    assert.equal(onside.offside, false);
    runner.x = attackingX(76.2, side);
    assert.equal(pick(runner).offside, true);
    for (const restart of ['corner', 'throw-in', 'goal-kick']) assert.equal(pick(runner, restart).offside, false);
    assert.equal(pick(runner, 'free-kick').offside, true);
    keeper.x = attackingX(70, side);
    assert.equal(offsideLine(passer, side, rivals), 70);
    passer.x = attackingX(77, side);
    assert.equal(pick(runner, 'free-kick').offside, false);
    passer.x = attackingX(40, side);
    keeper.x = attackingX(47, side);
    assert.equal(offsideLine(passer, side, rivals), 52.5);
  }
});

test('a forward run during a buildup moves a real player up to the defensive line', () => {
  const home = {players: [], pressing: 'standard', buildUp: 'mixed'};
  const away = {...home, players: []};
  const passer = {...place(0, 8, 55, 34), anchorX: 41, anchorY: 34};
  const runner = {...place(0, 9, 70, 24), anchorX: 65, anchorY: 23};
  home.players = [passer, runner];
  away.players = [{...place(0, 1, 99, 34), anchorX: 99, anchorY: 34},
    {...place(0, 4, 77, 28), anchorX: 81, anchorY: 26}];
  movePlayers([home, away], {ball: {x: 60, y: 34}, pressTarget: passer,
    carrierId: passer.id, possessionSide: 0, seconds: 2});
  assert.ok(runner.x > 77);
});
