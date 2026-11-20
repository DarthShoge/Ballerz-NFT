import test from 'node:test';
import assert from 'node:assert/strict';
import {clubs} from '../src/football.js';
import {movePlayers} from '../src/match-pitch.js';
import {judgeChallenge} from '../src/match-discipline.js';

function phase(side, depth, role, instructions) {
  const teams = [0, 1].map(() => ({players:[], pressing:'standard', buildUp:'mixed'}));
  function shirt(team, number, slot, x, y) {
    const p = {...clubs[team].squad.find(p => p.number === number), slot,
      x:side ? 105 - x : x, y:side ? 68 - y : y, condition:100};
    Object.assign(p, {anchorX:p.x, anchorY:p.y});
    teams[team].players.push(p);
    return p;
  }
  const carrier = shirt(1 - side, 8, 'CM', depth, 34);
  const runner = shirt(1 - side, 10, 'ST', 37, 31);
  const defender = shirt(side, 6, 'DM', 38, 34);
  defender.roles = {outOfPossession:role};
  defender.instructions = instructions;
  const runnerOrigin = {x:runner.x, y:runner.y};
  movePlayers(teams, {ball:{x:carrier.x,y:carrier.y}, carrierId:carrier.id, possessionSide:1-side, seconds:10});
  return {task:defender.defensiveTask, target:defender.defensiveTargetId,
    gap:Math.hypot(defender.x - runnerOrigin.x, defender.y - runnerOrigin.y)};
}

test('individual press instructions change the trigger distance within the defensive block', () => {
  for (const side of [0,1]) {
    assert.equal(phase(side,55,'central-cover',{pressing:'more'}).task, 'press');
    assert.equal(phase(side,55,'central-cover',{}).task, 'block');
    assert.equal(phase(side,52,'central-cover',{pressing:'less'}).task, 'block');
    assert.equal(phase(side,52,'central-cover',{}).task, 'press');
    assert.equal(phase(side,72,'central-cover',{pressing:'more'}).task, 'block');
    assert.deepEqual(phase(side,52,'central-cover',{pressing:'standard', marking:'standard'}),
      phase(side,52,'central-cover',undefined));
  }
});

test('tighter marking closes space at the receiver and preserves a screening assignment', () => {
  for (const side of [0,1]) {
    assert.equal(phase(side,62,'central-cover',{marking:'tighter'}).task, 'block');
    assert.equal(phase(side,49,'central-cover',{pressing:'less'}).task, 'block');
    const marked = phase(side,49,'central-cover',{marking:'tighter',pressing:'less'});
    assert.equal(marked.task, 'mark');
    assert.ok(marked.gap < 1.7);
    const base = phase(side,62,'screening-midfielder',{});
    const tight = phase(side,62,'screening-midfielder',{marking:'tighter'});
    assert.equal(base.task,'screen');
    assert.equal(tight.task,'screen');
    assert.equal(tight.target,base.target);
    assert.ok(tight.gap < base.gap - 2);
  }
});

test('challenge instructions vary the foul risk at equal skill and retain caution restraint', () => {
  const defender = {...clubs[0].squad[2], x:41, y:34, condition:84};
  const carrier = {...clubs[1].squad[8], x:42, y:34, condition:84};
  const foulCount = (tackling, cautions) => {
    let fouls = 0;
    for (let roll = 0; roll < 1000; roll++) {
      const result = judgeChallenge(carrier, {...defender, instructions:{tackling}, cautions}, 1, false, () => (roll + 0.5) / 1000);
      if (result.kind === 'foul') fouls++;
    }
    return fouls;
  };
  assert.equal(foulCount(undefined, 0),foulCount('standard', 0));
  assert.ok(foulCount('harder', 0) > foulCount('standard', 0));
  assert.ok(foulCount('easier', 0) < foulCount('standard', 0));
  assert.ok(foulCount('harder', 1) < foulCount('harder', 0));
});
