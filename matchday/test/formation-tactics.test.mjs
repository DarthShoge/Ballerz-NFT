import test from 'node:test';
import assert from 'node:assert/strict';
import {clubs, defaultPlan, matchTeams, validatePlan} from '../src/football.js';
import {defensiveSlotMap, formationSlots, mirrorLineup} from '../src/match-formations.js';
import {roleOptions} from '../src/role-selection.js';
import {startLiveFixture, liveFixtureView, orderTouchline} from '../src/live-fixture.js';
import {crossType} from '../src/match-deliveries.js';
import {tacticalPreview} from '../src/tactical-preview.js';
import {applyRequestedSubstitutions} from '../src/match-rules.js';
import {fixtureApi} from '../src/fixtures.js';
import {openStore} from '../src/local-store.js';

const plans = clubs.map(club => defaultPlan(club));

test('every combination of shapes assigns one defensive slot per shirt and keeps the keeper in goal', () => {
  for (const [formation, targets] of Object.entries(defensiveSlotMap)) {
    assert.equal(roleOptions[formation].length, 11);
    for (const [defence, map] of Object.entries(targets)) {
      assert.equal(map[0], 0);
      assert.equal(new Set(map).size, 11);
      for (const i of map) assert.ok(formationSlots[defence][i]);
    }
    const sheet = defaultPlan(clubs[1], formation);
    assert.deepEqual(mirrorLineup(formation, mirrorLineup(formation, sheet.xi)), sheet.xi);
  }
});

test('phase-specific touchline changes merge atomically, survive reload and follow the substitute', () => {
  const plan = defaultPlan(clubs[0], '4-3-3 DM');
  const id = plan.xi[5];
  plan.playerRoles = {[id]: {inPossession:'half-back', outOfPossession:'screening-midfielder'}};
  const state = {matchSeed: 7, plans: [plan, plans[1]]};
  startLiveFixture(state, 0);
  const read = () => liveFixtureView(JSON.parse(JSON.stringify(state.live)), -1).teams[0];
  const edit = order => orderTouchline(state.live, 0, {kind:'tactics', ...order});
  assert.equal(edit({playerRoles:{[id]:{outOfPossession:'pressing-midfielder'}}}), null);
  assert.deepEqual(read().playerRoles[id], {inPossession:'half-back', outOfPossession:'pressing-midfielder'});
  const previous = read();
  for (const invalid of [{playerRoles:{[id]:{outOfPossession:'poacher'}}}, {defensiveFormation:'4-18-1'},
    {playerRoles:{[plans[1].xi[0]]:{inPossession:'goalkeeper'}}}]) {
    assert.ok(edit({tempo:'quick', ...invalid}));
    assert.deepEqual(read(), previous);
  }
  assert.equal(edit({defensiveFormation:'5-3-2'}), null);
  assert.equal(read().playerRoles[id].inPossession, 'half-back');
  const team = state.live.checkpoint.teams[0], starter = team.players.find(p => p.id === id);
  const sub = team.bench.find(p => p.position === starter.position);
  assert.equal(orderTouchline(state.live, 0, {kind:'substitution', outgoingId:id, incomingId:sub.id}), null);
  applyRequestedSubstitutions({teams:[team], second:100, incident() {}});
  const substitute = team.players.find(p => p.id === sub.id);
  assert.deepEqual(substitute.roles, starter.roles);
  assert.equal(substitute.defensiveSlot, starter.defensiveSlot);
  assert.equal(substitute.slotIndex, starter.slotIndex);
});

test('the rehearsal uses phase movement and is mirrored to the manager’s view for either side', () => {
  for (const side of [0,1]) {
    const plan = plans[side], id = plan.xi[1];
    const preview = (role, phase, zone) => tacticalPreview({side, phase, zone,
      plan:{...plan, playerRoles:{[id]: {inPossession:role}}}});
    const player = run => run.players.find(p => p.id === id);
    const wide = preview('wing-back','inPossession','attack');
    const inverted = preview('inside-wing-back','inPossession','attack');
    assert.equal(wide.players.length, 11);
    assert.ok(player(inverted).y > player(wide).y + 8);
    assert.deepEqual(preview('wing-back','outOfPossession','defence'), preview('inside-wing-back','outOfPossession','defence'));
    assert.ok(tacticalPreview({side, plan, phase:'invalid', zone:'attack'}).error);
    assert.ok(validatePlan(clubs[side], {...plan, playerRoles:{[id]:{inPossession:'false-nine'}}}));
    assert.equal(matchTeams(plans)[side].players.find(p=>p.id===id).slot, 'LB');
  }
});

test('cross delivery preference affects eligible crosses while preserving byline cutbacks', () => {
  assert.equal(crossType({x:86,y:6}, {x:93,y:33}, 0, 'low'), 'low-cross');
  assert.equal(crossType({x:86,y:6}, {x:93,y:33}, 0, 'floated'), 'high-cross');
  assert.equal(crossType({x:96,y:6}, {x:89,y:33}, 0, 'floated'), 'cutback');
  assert.equal(crossType({x:52,y:6}, {x:62,y:33}, 0, 'floated'), null);
});

test('a legacy away sheet keeps its actual left and right backs through migration, retry and kickoff', async () => {
  const db = openStore(':memory:');
  async function api(path, method, key, body) {
    const response = await fixtureApi(new Request('http://test/api/fixtures' + path, {
      method, headers: key ? {Authorization:'Bearer ' + key} : {}, body:JSON.stringify(body)
    }), db);
    assert.ok(response.ok, 'Fixture request returned ' + response.status);
    return response.json();
  }
  try {
    const home = await api('', 'POST');
    const path = '/' + home.id;
    const initial = await api(path, 'GET', home.key);
    const away = await api(path + '/join', 'POST', initial.invite);
    const oldAway = {...plans[1], xi:mirrorLineup('4-4-2', plans[1].xi)};
    const row = db.read(home.id);
    const old = JSON.parse(row.state);
    delete old.formationVersion;
    old.plans[1] = oldAway;
    db.update(home.id, row.version, old);
    const retry = await api(path + '/ready', 'POST', away.key, oldAway);
    assert.deepEqual(retry.plans[1], plans[1]);
    const kicked = await api(path + '/ready', 'POST', home.key, plans[0]);
    const shirts = kicked.live.teams[1].players;
    assert.equal(shirts.find(p => p.id === oldAway.xi[1]).slot, 'RB');
    assert.equal(shirts.find(p => p.id === oldAway.xi[4]).slot, 'LB');
    assert.ok((await api(path + '/ready', 'POST', away.key, oldAway)).live);
    assert.equal((await api(path + '?after=-1', 'GET', away.key)).roleOptions, undefined);
  } finally { db.close(); }
});
