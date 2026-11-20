import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureApi, playDueFixtures } from '../src/fixtures.js';
import { computerPlan, manageComputerTeam } from '../src/computer-manager.js';
import { clubs, defaultPlan, matchTeams } from '../src/football.js';
import { startMatch } from '../src/match-engine.js';
import { openStore } from '../src/local-store.js';

test('the computer reacts to the score and requests a legal change for a tired player', () => {
  const game = startMatch(matchTeams([defaultPlan(clubs[0]), computerPlan(clubs[1])]), () => 0.42);
  const away = game.teams[1];
  const tired = away.players.find(p => p.position === 'DF');
  tired.condition = 60;
  game.second = 55 * 60;
  game.score = [1, 0];
  manageComputerTeam(game, 1);
  assert.equal(away.mentality, 'attacking');
  assert.equal(away.pendingSubstitution.outgoingId, tired.id);
  assert.equal(away.bench.find(p => p.id === away.pendingSubstitution.incomingId).position, 'DF');
  manageComputerTeam(game, 1);
  assert.equal(away.computerReviews, 1);
  game.second = 69 * 60;
  game.score = [1, 2];
  manageComputerTeam(game, 1);
  assert.equal(away.mentality, 'cautious');
  assert.equal(game.teams[0].mentality, 'balanced');
});

test('a computer away manager is ready immediately in friendly and scheduled play', async () => {
  const db = openStore(':memory:');
  const call = async (path, method, key, body) => fixtureApi(new Request('http://local/api/fixtures' + path, {
    method, headers: key ? {Authorization: 'Bearer ' + key} : {}, body: JSON.stringify(body)
  }), db, {worldStart: 0, receivedAt: 1000});
  try {
    for (const scheduled of [false, true]) {
      const kickoffAt = 3600000;
      const settings = {opponent: 'computer', ...(scheduled ? {kickoffAt} : {})};
      const created = await call('', 'POST', null, settings);
      assert.equal(created.status, 201);
      const {id, key} = await created.json();
      const row = db.read(id);
      db.update(id, row.version, {...JSON.parse(row.state), matchSeed: 20261201});
      const path = '/' + id;
      const fixture = await (await call(path, 'GET', key)).json();
      assert.equal(fixture.invite, null);
      assert.deepEqual(fixture.ready, [false, true]);
      assert.equal((await call(path + '/join', 'POST', key)).status, 403);
      const ready = await call(path + '/ready', 'POST', key, defaultPlan(clubs[0]));
      assert.equal(ready.status, 200);
      assert.equal(Boolean((await ready.json()).live), !scheduled);
      if (scheduled) await playDueFixtures(db, kickoffAt);
      const started = scheduled ? kickoffAt : 1000;
      await playDueFixtures(db, started + 720000);
      const completed = await (await call(path, 'GET', key)).json();
      assert.ok(completed.result.timeline.some(event => event.type === 'tactics' && event.side === 'away'));
      assert.ok(completed.result.timeline.some(event => event.type === 'substitution' && event.side === 'away'));
    }
  } finally {
    db.close();
  }
});
