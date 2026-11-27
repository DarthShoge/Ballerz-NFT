import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureApi} from '../src/fixtures.js';
import {openStore} from '../src/local-store.js';
import {applyRequestedSubstitutions} from '../src/match-rules.js';
import {liveFixtureView} from '../src/live-fixture.js';

test('individual orders merge, reset, survive reload and follow the position on substitution', async () => {
  const db = openStore(':memory:');
  const time = Date.parse('2027-01-01T14:00:00Z');
  const api = async (path, key, method = 'GET', body, status = 200) => {
    const response = await fixtureApi(new Request('http://test/api/' + path, {
      method, headers:key ? {Authorization:'Bearer ' + key} : {}, body:JSON.stringify(body)
    }), db, {receivedAt:time});
    const data = await response.json();
    assert.equal(response.status, status, data.error);
    return data;
  };
  try {
    const home = await api('fixtures', null, 'POST', undefined, 201);
    const path = 'fixtures/' + home.id;
    const initial = await api(path, home.key);
    const away = await api(path + '/join', initial.invite, 'POST');
    const [homePlan,awayPlan] = initial.defaults;
    const [keeper, defender] = homePlan.xi;
    const reserve = initial.clubs[0].squad.find(p => !homePlan.xi.includes(p.id) && p.position === 'DF').id;
    assert.ok(initial.individualInstructions.tackling.easier);
    const namedTarget = {kind:'player', id:awayPlan.xi.at(-1)};
    const plan = {...homePlan, markingTargets:{[defender]:namedTarget}, playerInstructions: {
      [defender]: {pressing:'more', marking:'tighter', tackling:'standard'}
    }};
    const sheet = await api(path + '/ready', home.key, 'POST', plan);
    assert.deepEqual(sheet.plans[0].markingTargets, {[defender]:namedTarget});
    const confirmed = {pressing:'more', marking:'tighter'};
    assert.deepEqual(sheet.plans[0].playerInstructions[defender], confirmed);
    await api(path + '/ready', home.key, 'POST', plan);
    await api(path + '/ready', away.key, 'POST', awayPlan);
    const touch = (edits, status) => api(path + '/touchline', home.key, 'POST', {kind:'tactics', playerInstructions:edits}, status);
    await touch({[defender]:{tackling:'harder'}});
    await touch({[defender]:{pressing:'standard'}});
    const publicTeam = async () => (await api(path, away.key)).live.teams[0];
    const snapshot = await publicTeam();
    const amended = {marking:'tighter',tackling:'harder'};
    assert.deepEqual(snapshot.playerInstructions[defender], amended);
    assert.deepEqual(snapshot.markingTargets, {[defender]:namedTarget});
    for (const edits of [{[defender]:{pressing:'typo'}}, {[keeper]:{marking:'tighter'}},
      {[reserve]:{tackling:'harder'}}, {[awayPlan.xi[1]]:{pressing:'less'}}, {[defender]:null}]) {
      await touch(edits, 400);
    }
    assert.deepEqual(await publicTeam(), snapshot);
    await api(path + '/touchline', home.key, 'POST', {kind:'substitution', outgoingId:defender, incomingId:reserve});
    const {live} = JSON.parse(db.read(home.id).state);
    applyRequestedSubstitutions({teams:live.checkpoint.teams, second:200, incident() {}});
    const reloaded = liveFixtureView(JSON.parse(JSON.stringify(live)), -1);
    assert.deepEqual(reloaded.teams[0].markingTargets, {[reserve]:namedTarget});
    assert.deepEqual(reloaded.teams[0].playerInstructions, {[reserve]:amended});
    assert.deepEqual(reloaded.teams[0].players.find(p=>p.id===reserve).instructions, amended);
    for (const p of live.checkpoint.teams[0].players) delete p.instructions;
    assert.deepEqual(liveFixtureView(live,-1).teams[0].playerInstructions, {});
  } finally { db.close(); }
});
