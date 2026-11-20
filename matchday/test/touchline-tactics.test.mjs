import assert from 'node:assert/strict';
import test from 'node:test';
import {clubs, defaultPlan, matchTeams, validatePlan} from '../src/football.js';
import {liveFixtureView, orderTouchline, startLiveFixture} from '../src/live-fixture.js';
import {movePlayers} from '../src/match-pitch.js';
import {startMatch} from '../src/match-engine.js';
import {applyRequestedSubstitutions} from '../src/match-rules.js';

const plans = clubs.map(club => defaultPlan(club));
const fullback = plans[0].xi[1];

test('team instructions and individual duties survive a touchline order and reload', () => {
  const state = {matchSeed: 17, plans: [{...plans[0], tempo: 'patient', duties: {[fullback]: 'hold'}}, plans[1]]};
  startLiveFixture(state, 0);
  const order = {kind: 'tactics', transition: 'counter', defensiveLine: 'high', duties: {[fullback]: 'attack'}};
  assert.equal(orderTouchline(state.live, 0, order), null);
  const read = () => liveFixtureView(JSON.parse(JSON.stringify(state.live)), -1);
  const team = read().teams[0];
  assert.equal(team.tempo, 'patient');
  assert.equal(team.transition, 'counter');
  assert.equal(team.defensiveLine, 'high');
  assert.equal(team.players.find(p => p.id === fullback).duty, 'attack');
  const before = read();
  assert.equal(orderTouchline(state.live, 0, order), null);
  assert.deepEqual(read(), before);
  assert.ok(orderTouchline(state.live, 0, {...order, duties: {[plans[1].xi[1]]: 'hold'}}));
  assert.ok(orderTouchline(state.live, 0, {...order, tempo: 'illegal'}));
  assert.deepEqual(read(), before);
  assert.ok(validatePlan(clubs[0], {...plans[0], duties: {[plans[0].xi[0]]: 'attack'}}));
  delete state.live.checkpoint.teams[0].width;
  assert.equal(read().teams[0].width, 'standard');
});

test('width, mentality, defensive line and one full-back’s duty change the on-pitch shape', () => {
  function shape(home = {}, away = {}) {
    const game = startMatch(matchTeams([{...plans[0], ...home}, {...plans[1], ...away}]), () => 0.5);
    movePlayers(game.teams, {ball: {x: 67, y: 34}, possessionSide: 0, carrierId: plans[0].xi[7], seconds: 25});
    return game.teams;
  }
  const [base, defence] = shape();
  const [narrow] = shape({width: 'narrow'});
  const [attacking, high] = shape({mentality: 'attacking'}, {defensiveLine: 'high'});
  const [overlap] = shape({duties: {[fullback]: 'attack'}});
  assert.ok(narrow.players[1].y > base.players[1].y + 4);
  assert.ok(attacking.players[2].x > base.players[2].x + 3);
  assert.ok(high.players[1].x < defence.players[1].x - 4);
  assert.ok(overlap.players[1].x > base.players[1].x + 8);
  assert.equal(overlap.players[4].x, base.players[4].x);
  const reserve = overlap.bench.find(p => p.position === 'DF');
  overlap.pendingSubstitution = {outgoingId: fullback, incomingId: reserve.id};
  applyRequestedSubstitutions({teams: [overlap], second: 300, incident() {}});
  assert.equal(overlap.players.find(p => p.id === reserve.id).duty, 'attack');
});
