import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureApi, playDueFixtures } from '../src/fixtures.js';
import { advanceLiveFixture, startLiveFixture } from '../src/live-fixture.js';
import { clubs, defaultPlan, simulate } from '../src/football.js';
import { openStore } from '../src/local-store.js';

test('two managers can complete one durable fixture, even with concurrent team sheets', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ballerz-'));
  const file = join(dir, 'match.db');
  let db = openStore(file);
  const kickoff = Date.now();
  let time = kickoff;
  async function call(path, method = 'GET', key, body) {
    const response = await fixtureApi(new Request('http://local/api/' + path, {
      method, headers: key ? {Authorization:'Bearer ' + key} : {}, body: JSON.stringify(body)
    }), db, {receivedAt: time});
    return {status: response.status, data: await response.json()};
  }
  try {
    const {data:home} = await call('fixtures', 'POST');
    const created = db.read(home.id);
    assert.ok(db.update(home.id, created.version, {...JSON.parse(created.state), matchSeed: 20261201}));
    const path = 'fixtures/' + home.id;
    assert.equal((await call(path)).status, 401);
    const {data:first} = await call(path, 'GET', home.key);
    const claims = await Promise.all([1,2].map(() => call(path + '/join','POST',first.invite)));
    assert.deepEqual(claims.map(x => x.status).sort(), [200,403]);
    const away = claims.find(x => x.status === 200).data;
    assert.equal((await call(path,'GET',away.key)).data.side, 1);
    assert.equal((await call(path + '/ready','POST',home.key,first.defaults[1])).status, 400);
    const ready = await Promise.all([home,away].map((manager, i) =>
      call(path + '/ready','POST',manager.key,first.defaults[i])));
    assert.ok(ready.every(x => x.status === 200));
    const pending = ready.find(x => !x.data.live).data;
    assert.equal(pending.plans[1-pending.side], null);
    const live = ready.find(x => x.data.live).data.live;
    assert.deepEqual(live.score, [0, 0]);
    assert.equal(live.elapsed, 0);
    assert.ok(live.teams.every(team => team.players.every(player => player.rating === 6.6)));
    assert.equal((await call(path + '/touchline','POST',first.invite,{kind: 'tactics'})).status, 403);
    assert.equal((await call(path + '/touchline','POST',home.key,{kind: 'tactics', buildUp: 'invalid', pressing: 'high'})).status, 400);
    const order = await call(path + '/touchline','POST',home.key,{kind: 'tactics', buildUp: 'direct', pressing: 'high'});
    assert.equal(order.status, 200);
    assert.equal(order.data.live.teams[0].pressing, 'high');

    time += 8_000;
    await playDueFixtures(db, time);
    const homeView = (await call(path, 'GET', home.key)).data;
    const awayView = (await call(path, 'GET', away.key)).data;
    assert.deepEqual(homeView.live, awayView.live);
    assert.ok(homeView.live.elapsed > 0);
    assert.equal(homeView.result, null);
    assert.ok(homeView.live.frames.at(-1).seq > 0);
    assert.ok(homeView.live.frames.some(frame => frame.ball.x !== 52.5));
    db.close();
    db = openStore(file);
    assert.deepEqual((await call(path,'GET',home.key)).data.live, homeView.live);

    let breakView;
    for (time = kickoff + 300_000; time <= kickoff + 360_000; time += 5_000) {
      await playDueFixtures(db, time);
      breakView = (await call(path, 'GET', home.key)).data.live;
      if (breakView.phase === 'half-time') break;
    }
    assert.equal(breakView.phase, 'half-time');
    assert.equal(breakView.matchSpeed, 9);
    const firstHalfEnd = kickoff + breakView.frames.at(-1).second * 1000 / breakView.matchSpeed;
    assert.ok(Math.abs(breakView.halfTimeUntil - firstHalfEnd - 60_000) < 1);
    const outgoing = breakView.teams[0].players.find(player => player.active && player.position === 'MF');
    const incoming = breakView.teams[0].bench.find(player => player.position === 'MF');
    const opponent = breakView.teams[1].bench.find(player => player.position === 'MF');
    assert.equal((await call(path + '/touchline', 'POST', home.key,
      {kind: 'substitution', outgoingId: outgoing.id, incomingId: opponent.id})).status, 400);
    const change = await call(path + '/touchline', 'POST', home.key,
      {kind: 'substitution', outgoingId: outgoing.id, incomingId: incoming.id});
    assert.equal(change.status, 200);
    assert.equal(change.data.live.teams[0].pendingSubstitution.incomingId, incoming.id);
    assert.equal(change.data.live.teams[0].substitutions, breakView.teams[0].substitutions);

    time = Math.floor(breakView.halfTimeUntil) - 1;
    await playDueFixtures(db, time);
    assert.equal((await call(path, 'GET', away.key)).data.live.phase, 'half-time');
    time = Math.ceil(breakView.halfTimeUntil) + 3_000;
    await playDueFixtures(db, time);
    const secondHalf = (await call(path, 'GET', away.key)).data.live;
    assert.equal(secondHalf.period, 2);
    assert.equal(secondHalf.teams[0].pendingSubstitution, null);
    assert.ok(secondHalf.teams[0].players.some(player => player.active && player.id === incoming.id));

    time = kickoff + 650_000;
    await playDueFixtures(db, time);
    assert.equal((await call(path, 'GET', home.key)).data.result, null);
    time = kickoff + 720_000;
    await playDueFixtures(db, time);
    const result = (await call(path, 'GET', home.key)).data.result;
    assert.ok(result.timeline.some(event => event.type === 'tactics'));
    assert.ok(result.timeline.some(event => event.type === 'substitution' && event.playerId === incoming.id));
    assert.ok(result.performances.flat().every(player => player.rating >= 1 && player.rating <= 10));
    for (const [i,manager] of [home,away].entries()) {
      assert.deepEqual((await call(path,'GET',manager.key)).data.result, result);
      assert.deepEqual((await call(path + '/ready','POST',manager.key,first.defaults[i])).data.result, result);
    }
    assert.equal((await call(path + '/ready','POST',home.key,{...first.defaults[0], tactic:'press'})).status,409);
    assert.equal((await call(path + '/touchline','POST',home.key,{kind: 'tactics'})).status,409);
  } finally { db.close(); rmSync(dir, {recursive:true, force:true}); }
});

test('interrupted live simulation produces the same report as a single simulation', () => {
  const plans = clubs.map(club => defaultPlan(club));
  const state = {plans, matchSeed: 20261201};
  startLiveFixture(state, 0);
  for (let time = 2_000; state.live && time <= 720_000; time += 2_000) {
    state.live = JSON.parse(JSON.stringify(state.live));
    advanceLiveFixture(state, time);
  }
  let seed = state.matchSeed;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  assert.ok(state.result);
  assert.deepEqual(JSON.parse(JSON.stringify(state.result)), JSON.parse(JSON.stringify(simulate(...plans, random))));
});
