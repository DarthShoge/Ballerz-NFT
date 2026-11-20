import test from 'node:test';
import assert from 'node:assert/strict';
import {clubs, defaultPlan, matchTeams, validatePlan} from '../src/football.js';
import {startMatch} from '../src/match-engine.js';
import {movePlayers} from '../src/match-pitch.js';
import {applyRequestedSubstitutions, swapPositions} from '../src/match-rules.js';
import {startLiveFixture, orderTouchline, liveFixtureView} from '../src/live-fixture.js';

for (const side of [0, 1]) {
  test('named and position markers respond to swaps and substitutions on side ' + side, () => {
    const plans = clubs.map(c => defaultPlan(c));
    const [defending, attacking] = [side, 1-side];
    const [namedId, roleId] = plans[side].xi.slice(1, 3);
    const firstId = matchTeams(plans)[attacking].players.find(p => p.slot === 'LS').id;
    plans[side].markingTargets = {[namedId]:{kind:'player', id:firstId}, [roleId]:{kind:'position', slot:'LS'}};
    const game = startMatch(matchTeams(plans), () => 0.5);
    const defenders = game.teams[defending].players;
    const named = defenders.find(p => p.id === namedId);
    const positional = defenders.find(p => p.id === roleId);
    const team = game.teams[attacking];
    const first = team.players.find(p => p.id === firstId);
    const second = team.players.find(p => p.slot === 'RS');
    const carrier = team.players.find(p => p.position === 'GK');
    function step(openPlay = true) {
      movePlayers(game.teams, {ball:{x:carrier.x,y:carrier.y}, carrierId:carrier.id, possessionSide:attacking, seconds:1, openPlay});
      return [named.defensiveTargetId, positional.defensiveTargetId];
    }
    // Both markers are pulled toward the runner, including across the usual defensive lane.
    const distanceToFirst = p => Math.hypot(p.x-first.x, p.y-first.y);
    assert.deepEqual(step(false), [null, null]);
    const before = distanceToFirst(named);
    const runnerPoint = {x:first.x, y:first.y};
    assert.deepEqual(step(), [first.id, first.id]);
    assert.ok(Math.hypot(named.x-runnerPoint.x, named.y-runnerPoint.y) < before);
    assert.equal(swapPositions(game, team, {firstId:first.id, secondId:second.id,
      firstDestination:'RS',secondDestination:'LS'}), null);
    assert.deepEqual(step(), [first.id, second.id]);

    const sub = team.bench.find(p => p.position === second.position);
    team.pendingSubstitution = {outgoingId:second.id, incomingId:sub.id};
    applyRequestedSubstitutions(game);
    assert.deepEqual(step(), [first.id, sub.id]);
    first.dismissed = true;
    assert.deepEqual(step(), [null, sub.id]);
    const entered = team.players.find(p => p.id === sub.id);
    entered.injured = true;
    assert.deepEqual(step(), [null, null]);
  });
}

test('a named assignment becomes active when the named substitute enters, then ends when they leave', () => {
  const plans = clubs.map(c => defaultPlan(c));
  const team = matchTeams(plans)[1];
  const reserve = team.bench.find(p => p.position === 'MF');
  const markerId = plans[0].xi[1];
  plans[0].markingTargets = {[markerId]:{kind:'player',id:reserve.id}};
  const game = startMatch(matchTeams(plans), () => 0.5);
  const marker = game.teams[0].players.find(p => p.id === markerId);
  const carrier = game.teams[1].players.find(p => p.position === 'GK');
  const move = () => movePlayers(game.teams, {ball:carrier, carrierId:carrier.id, possessionSide:1, seconds:1});
  move();
  assert.equal(marker.defensiveTargetId, null);
  const outgoing = game.teams[1].players.find(p => p.slot === 'RCM');
  game.teams[1].pendingSubstitution = {outgoingId:outgoing.id,incomingId:reserve.id};
  applyRequestedSubstitutions(game);
  move();
  assert.equal(marker.defensiveTargetId, reserve.id);
  // Replacing the named player must clear the resolved target, even if another player fills the slot.
  const next = game.teams[1].bench.find(p => p.position === 'MF');
  assert.ok(next);
  game.teams[1].pendingSubstitution = {outgoingId:reserve.id,incomingId:next.id};
  applyRequestedSubstitutions(game);
  move();
  assert.equal(marker.defensiveTargetId, null);
});

test('invalid targets are rejected, and live edits persist and clear', () => {
  const plans = clubs.map(c => defaultPlan(c));
  const id = plans[0].xi[1];
  const target = {kind:'player',id:plans[1].xi[1]};
  const state = {plans};
  startLiveFixture(state, 2000);
  for (const choice of [{kind:'player',id}, {kind:'player',id:plans[1].xi[0]}, {kind:'position',slot:'typo'}, {kind:'position',slot:'GK'}]) {
    const change = {markingTargets:{[id]:choice}};
    assert.ok(validatePlan(clubs[0], {...plans[0], ...change}));
    assert.ok(orderTouchline(state.live, 0, {kind:'tactics', ...change}));
  }
  assert.equal(orderTouchline(state.live, 0, {kind:'tactics',markingTargets:{[id]:target}}),null);
  const reloaded = structuredClone(state.live);
  assert.deepEqual(liveFixtureView(reloaded,-1).teams[0].markingTargets, {[id]:target});
  assert.equal(orderTouchline(reloaded, 0, {kind:'tactics',markingTargets:{[id]:null}}),null);
  assert.deepEqual(liveFixtureView(reloaded,-1).teams[0].markingTargets, {});
});
