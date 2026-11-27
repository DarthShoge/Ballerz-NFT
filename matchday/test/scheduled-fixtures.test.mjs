import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureApi, playDueFixtures } from '../src/fixtures.js';
import { openStore } from '../src/local-store.js';
import { TEAM_SHEET_LOCK_MS, worldDate } from '../src/world-clock.js';

const start = Date.parse('2027-01-01T00:00:00Z');
const day = 24 * 60 * 60 * 1000;
const kickoffAt = start + 7 * day;
const deadlineAt = kickoffAt - TEAM_SHEET_LOCK_MS;

async function call(db, path, {method = 'GET', token, body, time = start, playtest = false} = {}) {
  const request = new Request('http://local/api/' + path, {
    method,
    headers: token ? {Authorization: 'Bearer ' + token} : {},
    body: JSON.stringify(body)
  });
  const response = await fixtureApi(request, db, {worldStart: start, receivedAt: time, playtest});
  return {status: response.status, data: await response.json()};
}

async function scheduleFixture(db) {
  const created = await call(db, 'fixtures', {method: 'POST', body: {kickoffAt}});
  assert.equal(created.status, 201);
  const {id, key: home} = created.data;
  const path = 'fixtures/' + id;
  const {data: view} = await call(db, path, {token: home});
  const joined = await call(db, path + '/join', {method: 'POST', token: view.invite});
  assert.equal(joined.status, 200);
  return {path, home, away: joined.data.key, view};
}

function submit(db, path, token, body, time) {
  return call(db, path + '/ready', {method: 'POST', token, body, time});
}

test('the shared calendar advances a week per real day and rolls over at day 52', () => {
  assert.equal(worldDate(start, start - 1), null);
  assert.deepEqual(worldDate(start, start), {year: 1, week: 1, day: 1});
  const secondGameDay = start + Math.ceil(day / 7);
  assert.deepEqual(worldDate(start, secondGameDay - 1), {year: 1, week: 1, day: 1});
  assert.deepEqual(worldDate(start, secondGameDay), {year: 1, week: 1, day: 2});
  assert.deepEqual(worldDate(start, start + day), {year: 1, week: 2, day: 1});
  assert.deepEqual(worldDate(start, start + 52 * day - 1), {year: 1, week: 52, day: 7});
  assert.deepEqual(worldDate(start, start + 52 * day), {year: 2, week: 1, day: 1});
});

test('schedule creation publishes the cutoff and rejects a kickoff exactly 30 minutes away', async () => {
  const db = openStore(':memory:');
  try {
    const {data: catalog} = await call(db, 'clubs');
    assert.equal(catalog.serverTime, start);
    assert.equal(catalog.teamSheetLockMs, TEAM_SHEET_LOCK_MS);
    const earlyKickoff = start + TEAM_SHEET_LOCK_MS;
    const create = kickoffAt => call(db, 'fixtures', {method: 'POST', body: {kickoffAt}});
    assert.deepEqual(await create(earlyKickoff), {
      status: 400, data: {error: 'Choose a kickoff more than 30 minutes away.'}
    });
    assert.equal((await create(earlyKickoff + 1)).status, 201);
  } finally {
    db.close();
  }
});

test('scheduled kickoff keeps the last valid pre-deadline sheet and resolves once after a restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ballerz-scheduled-'));
  const file = join(dir, 'world.sqlite');
  let db = openStore(file);
  try {
    assert.equal(db.worldStart(), null);
    assert.equal(db.worldStart(start), start);
    const {path, home, away, view} = await scheduleFixture(db);
    assert.deepEqual(view.schedule, {kickoffAt, deadlineAt, gameDate: {year: 1, week: 8, day: 1}});
    const [homePlan, awayPlan] = view.defaults;
    const submissions = await Promise.all([
      submit(db, path, home, homePlan, start),
      submit(db, path, away, awayPlan, start)
    ]);
    assert.ok(submissions.every(({status, data}) => status === 200 && data.result === null));

    const revised = {...homePlan, tactic: 'press', buildUp: 'short', pressing: 'compact'};
    assert.equal((await submit(db, path, home, revised, deadlineAt - 1)).status, 200);
    assert.equal((await submit(db, path, home, {...revised, xi: []}, deadlineAt - 1)).status, 400);
    assert.equal((await submit(db, path, home, homePlan, deadlineAt - 2)).status, 409);
    assert.equal((await submit(db, path, home, homePlan, deadlineAt)).status, 409);
    await playDueFixtures(db, kickoffAt - 1);
    const {data: locked} = await call(db, path, {token: away, time: kickoffAt - 1});
    assert.equal(locked.teamSheetLocked, true);
    assert.equal(locked.result, null);
    assert.equal(locked.plans[0], null);

    db.close();
    db = openStore(file);
    assert.equal(db.worldStart(), start);
    assert.throws(() => db.worldStart(start + day), /already saved/);
    await Promise.all([playDueFixtures(db, kickoffAt), playDueFixtures(db, kickoffAt)]);
    const {data: live} = await call(db, path, {token: away, time: kickoffAt});
    assert.equal(live.result, null);
    assert.equal(live.live.phase, 'playing');
    await playDueFixtures(db, kickoffAt + 720_000);
    const {data: completed} = await call(db, path, {token: away, time: kickoffAt + 720_000});
    assert.ok(completed.result.events.length > 0);
    assert.deepEqual(completed.plans, [revised, awayPlan]);
    await playDueFixtures(db, kickoffAt + day);
    assert.deepEqual((await call(db, path, {token: home, time: kickoffAt + day})).data.result, completed.result);
  } finally {
    db.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('scheduled fixtures use administrative scores for missing sheets', async () => {
  const db = openStore(':memory:');
  try {
    const onlyAway = await scheduleFixture(db);
    const neither = await scheduleFixture(db);
    assert.equal((await submit(db, onlyAway.path, onlyAway.away, onlyAway.view.defaults[1], start)).status, 200);
    await playDueFixtures(db, kickoffAt);
    assert.deepEqual((await call(db, onlyAway.path, {token: onlyAway.home, time: kickoffAt})).data.result,
      {kind: 'forfeit', score: [0, 3]});
    assert.deepEqual((await call(db, neither.path, {token: neither.home, time: kickoffAt})).data.result,
      {kind: 'double-forfeit', score: null});
  } finally {
    db.close();
  }
});

test('playtest time controls start a prepared fixture early and stop at halftime', async () => {
  const db = openStore(':memory:');
  try {
    const {path, home, away, view} = await scheduleFixture(db);
    const id = path.split('/')[1];
    const row = db.read(id);
    assert.ok(db.update(id, row.version, {...JSON.parse(row.state), matchSeed: 20261201}));
    const time = start + 1000;
    const order = (action, token = home, playtest = true) =>
      call(db, path + '/' + action, {method: 'POST', token, time, playtest});
    assert.equal((await order('kickoff-now', home, false)).status, 403);
    assert.equal((await order('kickoff-now', away)).status, 403);
    assert.equal((await order('kickoff-now')).status, 409);
    await submit(db, path, home, view.defaults[0], time);
    await submit(db, path, away, view.defaults[1], time);

    const starts = await Promise.all([order('kickoff-now'), order('kickoff-now')]);
    assert.deepEqual(starts.map(response => response.status).sort(), [200, 409]);
    const started = starts.find(response => response.status === 200).data;
    assert.equal(started.schedule.kickoffAt, kickoffAt);
    assert.equal(started.schedule.playtestKickoffAt, time);
    assert.equal(started.live.elapsed, 0);
    assert.equal(started.teamSheetLocked, true);
    assert.equal((await submit(db, path, away, view.defaults[1], time)).status, 409);

    assert.equal((await order('fast-forward', away)).status, 403);
    assert.equal((await order('fast-forward', home, false)).status, 403);
    const first = await order('fast-forward');
    assert.equal(first.status, 200);
    assert.ok(first.data.live.elapsed >= 600);
    let live = first.data.live;
    for (let step = 0; step < 5 && live.phase !== 'half-time'; step++) {
      live = (await order('fast-forward')).data.live;
    }
    assert.equal(live.phase, 'half-time');
    assert.equal(live.halfTimeUntil, time + 60_000);
    const guest = await call(db, path, {token: away, time, playtest: true});
    assert.equal(guest.data.playtestControls, undefined);
    assert.deepEqual(guest.data.live, live);
    const resumed = (await order('fast-forward')).data.live;
    assert.equal(resumed.period, 2);
    assert.ok(resumed.elapsed < 60);

    const later = time + 3000;
    await playDueFixtures(db, later);
    const continuing = (await call(db, path, {token: away, time: later})).data.live;
    assert.ok(continuing.elapsed > resumed.elapsed && continuing.elapsed < 60);
    let finish;
    for (let step = 0; step < 6 && !finish; step++) {
      const response = await call(db, path + '/fast-forward', {method: 'POST', token: home, time: later, playtest: true});
      assert.equal(response.status, 200);
      finish = response.data.result;
    }
    assert.ok(finish?.events.length);
    await playDueFixtures(db, kickoffAt);
    assert.deepEqual((await call(db, path, {token: away, time: kickoffAt})).data.result, finish);
  } finally {
    db.close();
  }
});
