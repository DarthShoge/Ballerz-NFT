import test from 'node:test';
import assert from 'node:assert/strict';
import {clubs} from '../src/football.js';
import {attackingX, movePlayers} from '../src/match-pitch.js';
import {choosePlay} from '../src/match-decisions.js';
import {formationSlots} from '../src/match-formations.js';
import {roleChoices} from '../src/match-roles.js';

function player(number, x, y, side, slot, roles = {}) {
  const point = {x: attackingX(x, side), y: side ? 68 - y : y};
  return {...clubs[side].squad.find(p => p.number === number), slot, roles, ...point,
    anchorX: point.x, anchorY: point.y, condition: 100};
}

test('every formation slot offers distinct choices with and without the ball', () => {
  for (const slot of new Set(Object.values(formationSlots).flat())) {
    const {inPossession, outOfPossession} = roleChoices(slot);
    assert.ok(Object.keys(inPossession).length >= 3, slot);
    assert.ok(Object.keys(outOfPossession).length >= 3, slot);
    assert.ok(Object.values({...inPossession, ...outOfPossession}).every(r => r.label && r.description));
  }
  assert.equal(roleChoices('LWB').inPossession['false-nine'], undefined);
  assert.equal(roleChoices('ST').outOfPossession['sweeper-keeper'], undefined);
});

function settledShape(side, slot, number, origin, role, possession = true, depth = 70) {
  const p = player(number, ...origin, side, slot, role);
  const teams = [{players: [], pressing: 'standard'}, {players: [], pressing: 'standard'}];
  teams[side].players.push(p);
  movePlayers(teams, {ball: {x: attackingX(depth, side), y: 34}, carrierId: 'other',
    possessionSide: possession ? side : 1 - side, seconds: 35});
  return {depth: attackingX(p.x, side), lateral: Math.abs(34 - p.y)};
}

test('role movement depends on the phase, zone of the ball and direction of attack', () => {
  for (const side of [0, 1]) {
    const back = (role, depth, possession = true) => settledShape(side, 'LB', 2, [26,9], {inPossession: role}, possession, depth);
    assert.ok(back('wing-back', 75).depth > back('full-back', 75).depth + 10);
    assert.ok(back('inside-wing-back', 75).lateral < back('wing-back', 75).lateral - 14);
    assert.ok(Math.abs(back('inside-wing-back', 20).lateral - back('full-back', 20).lateral) < 2);
    assert.deepEqual(back('inside-wing-back', 65, false), back('wing-back', 65, false));
    const nine = role => settledShape(side, 'ST', 9, [65,34], {inPossession: role});
    assert.ok(nine('poacher').depth > nine('false-nine').depth + 15);
    const defend = role => settledShape(side, 'ST', 9, [65,34], {outOfPossession: role}, false, 24);
    assert.ok(defend('outlet').depth > defend('tracking-forward').depth + 10);
    const midfield = role => settledShape(side, 'CM', 8, [41,34], {outOfPossession: role}, false, 58);
    assert.ok(midfield('pressing-midfielder').depth > midfield('screening-midfielder').depth + 8);
    const keeper = role => settledShape(side, 'GK', 1, [6,34], {outOfPossession: role}, false, 65);
    assert.ok(keeper('sweeper-keeper').depth > keeper('stay-home-keeper').depth + 9);
  }
});

test('the goal kick decision changes receiver when the keeper changes distribution role', () => {
  for (const side of [0, 1]) {
    const keeper = player(1,5,34,side,'GK');
    const near = player(4,13,27,side,'LCB');
    const far = player(9,45,40,side,'ST');
    const attack = {players: [keeper, near, far], buildUp: 'mixed', pressing: 'standard'};
    const restart = {side, chainLength: 0, restart: 'goal-kick'};
    const choose = role => {
      keeper.roles = {inPossession: role};
      return choosePlay(keeper, attack, [], restart, () => 0.5);
    };
    assert.equal(choose('ball-playing-keeper').recipient.id, near.id);
    assert.equal(choose('direct-keeper').recipient.id, far.id);
  }
});
