import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectedGoals, resolveShot } from '../src/match-shot.js';
import { clubs, formations, defaultPlan, validatePlan, simulate } from '../src/football.js';

function randomFrom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test('every club can field a legal XI in every formation', () => {
  for (const club of clubs) {
    for (const formation of Object.keys(formations)) {
      const plan = defaultPlan(club, formation);
      assert.equal(validatePlan(club, plan), null);
      assert.equal(plan.xi.length, 11);
    }
  }
});

test('rejects malformed plans, foreign players, repeated players, and incorrect shapes', () => {
  const [home, away] = clubs;
  const plan = defaultPlan(home);
  for (const invalid of [
    undefined, { ...plan, formation: 'toString' }, { ...plan, tactic: ['press'] },
    { ...plan, xi: [] }, { ...plan, xi: [...plan.xi.slice(0, 10), plan.xi[0]] },
    { ...plan, xi: defaultPlan(away).xi }, { ...plan, formation: '4-3-3' },
    { ...plan, tactic: 'attack' }, { ...plan, buildUp: 'toString' },
    { ...plan, pressing: ['high'] }, { ...plan, buildUp: null },
  ]) assert.equal(typeof validatePlan(home, invalid), 'string');
});

test('the action log, player totals and report agree across a full match', () => {
  const [home, away] = clubs;
  const a = defaultPlan(home, '3-5-2', 'press'), b = defaultPlan(away, '4-3-3', 'counter');
  for (let seed = 1; seed <= 20; seed++) {
    const result = simulate(a, b, randomFrom(seed * 7919));
    assert.deepEqual(result, simulate(a, b, randomFrom(seed * 7919)));
    assert.equal(result.stats.possession[0] + result.stats.possession[1], 100);
    assert.ok(result.ballInPlaySeconds > 0 && result.ballInPlaySeconds < result.durationSeconds);
    for (const [i, side] of ['home', 'away'].entries()) {
      const actions = result.actions.filter(action => action.side === side);
      const attempts = actions.filter(action => action.type === 'pass');
      const flagged = attempts.filter(action => action.outcome === 'offside');
      assert.equal(flagged.length, result.stats.offsides[i]);
      assert.ok(flagged.every(action => action.receiverDepthAtKick > action.offsideLineDepth
        && action.offsideLineDepth >= 52.5 && !['throw-in', 'goal-kick', 'corner'].includes(action.restart)));
      const chances = result.events.filter(event => event.side === side);
      const playedScore = (result.playedScore ?? result.score)[i];
      assert.equal(chances.length, result.stats.shots[i]);
      assert.equal(actions.filter(action => action.type === 'shot').length, chances.length);
      assert.equal(chances.filter(e => e.type === 'goal').length, playedScore);
      assert.equal(chances.filter(e => e.type === 'goal' || e.type === 'save').length, result.stats.onTarget[i]);
      assert.equal(chances.filter(e => e.type === 'blocked').length, result.stats.blocks[1 - i]);
      assert.equal(chances.filter(e => e.type === 'woodwork').length, result.stats.woodwork[i]);
      assert.equal(Math.round(chances.reduce((total, e) => total + e.xg, 0) * 1000), Math.round(result.stats.xg[i] * 1000));
      assert.equal(attempts.length, result.stats.passes[i]);
      assert.equal(attempts.filter(action => action.outcome === 'complete').length, result.stats.completedPasses[i]);
      assert.equal(attempts.filter(action => action.lineBreak).length, result.stats.lineBreaks[i]);
      assert.equal(attempts.filter(action => action.cross).length, result.stats.crosses[i]);
      assert.equal(attempts.filter(action => action.cross && action.outcome === 'complete').length, result.stats.completedCrosses[i]);
      const corners = attempts.filter(action => action.restart === 'corner');
      assert.equal(corners.length, result.stats.cornersTaken[i]);
      assert.ok(result.stats.corners[i] >= corners.length);
      assert.equal(new Set(chances.filter(event => event.situation === 'corner').map(event => event.possession)).size,
        result.stats.cornersWithShot[i]);
      assert.equal(corners.filter(action => action.outcome === 'claimed').length, result.stats.cornerClaims[1 - i]);
      assert.equal(corners.filter(action => action.outcome.startsWith('cleared')).length, result.stats.cornerClearances[1 - i]);
      const cornerTimes = new Map(corners.map(action => [action.possession, action.second]));
      const recoveries = actions.filter(action => action.type === 'recovery' && cornerTimes.has(action.possession));
      assert.equal(recoveries.length, result.stats.cornerSecondBallsWon[i]);
      const secondBallShots = chances.filter(event => event.secondBall);
      assert.ok(secondBallShots.every(event => recoveries.some(recovery =>
        recovery.possession === event.possession && recovery.second <= event.second)));
      assert.equal(secondBallShots.filter(event => event.second - cornerTimes.get(event.possession) <= 10).length,
        result.stats.quickCornerSecondBallShots[i]);
      assert.ok(chances.every(event => !event.rushed || event.secondBall));
      const fouls = result.timeline.filter(event => event.type === 'foul' && event.side === side);
      assert.equal(fouls.length, result.stats.fouls[i]);
      assert.equal(fouls.filter(event => event.advantage).length, result.stats.advantages[1 - i]);
      const players = result.performances[i];
      const picked = new Set([...(i === 0 ? a.xi : b.xi), ...result.timeline
        .filter(event => event.side === side && event.type === 'substitution').map(event => event.playerId)]);
      const sum = key => players.reduce((total, player) => total + player[key], 0);
      assert.equal(players.length, picked.size);
      assert.ok(players.every(player => picked.has(player.playerId) && player.minutes >= 0 && player.minutes <= Math.ceil(result.durationSeconds / 60)));
      assert.ok(actions.every(action => picked.has(action.playerId)));
      assert.ok(chances.every(event => picked.has(event.playerId) && event.goalAngle >= event.visibleAngle));
      assert.equal(sum('goals'), playedScore);
      assert.equal(sum('assists'), chances.filter(event => event.assistId).length);
      assert.equal(sum('shots'), result.stats.shots[i]);
      assert.equal(sum('passes'), result.stats.passes[i]);
      assert.equal(sum('completedPasses'), result.stats.completedPasses[i]);
      assert.equal(sum('regains'), result.stats.turnovers[1 - i]);
      assert.equal(sum('saves'), result.stats.onTarget[1 - i] - (result.playedScore ?? result.score)[1 - i]);
      assert.ok(result.stats.substitutions[i] <= 5);
      const exits = result.timeline.filter(event => event.side === side && event.type === 'red-card');
      assert.ok(exits.every(event => actions.every(action => action.playerId !== event.playerId || action.second <= event.second)));
    }
    assert.ok(result.actions.every((event, i, list) =>
      event.second <= result.durationSeconds && (i === 0 || list[i - 1].second <= event.second)));
    assert.ok(result.actions.some(action => action.period === 1));
    assert.ok(result.actions.some(action => action.period === 2));
    assert.ok(result.durationSeconds > 5400);
    assert.ok(result.actions.some(action => action.addedMinute > 0));
    for (const [index, restart] of result.actions.entries()) {
      if (restart.type !== 'restart' || restart.outcome !== 'corner') continue;
      const touch = result.actions[index - 1];
      if (restart.cause === 'misplayed-ball') {
        assert.notEqual(touch.side, restart.side);
        assert.equal(touch.outcome, 'out');
        assert.equal(touch.exit.x, restart.location.x);
        continue;
      }
      assert.equal(touch.side, restart.side);
      assert.equal(touch.defensiveTouch, restart.cause);
      assert.ok(touch.defenderId);
      assert.equal(touch.exit.x, restart.location.x);
      assert.equal(touch.exit.y < 34 ? 0 : 68, restart.location.y);
    }
    assert.ok(result.actions.every((event, i, list) => event.outcome !== 'advantage' ||
      !list[i + 1] || list[i + 1].period !== event.period || list[i + 1].possession === event.possession));
    assert.ok(result.actions.some((event, i, list) => event.type === 'pass' && event.outcome === 'complete'
      && list[i + 1]?.possession === event.possession && list[i + 1]?.side === event.side));
  }
});

test('identical lineups change their pass choices with build-up and pressing instructions', () => {
  const [home, away] = clubs.map(club => defaultPlan(club));
  const short = {distance: 0, attempts: 0, complete: 0, lineBreaks: 0};
  const direct = {distance: 0, attempts: 0, complete: 0};
  let highRegains = 0, shortCondition = 0, highCondition = 0;
  function accumulate(team, match) {
    team.attempts += match.stats.passes[0];
    team.complete += match.stats.completedPasses[0];
    team.distance += match.actions.filter(a => a.side === 'home' && a.type === 'pass')
      .reduce((total, a) => total + Math.hypot(a.to.x - a.location.x, a.to.y - a.location.y), 0);
  }
  const samples = 45;
  for (let seed = 1; seed <= samples; seed++) {
    const rng = () => randomFrom(seed * 7919);
    const patient = simulate({...home, buildUp: 'short'}, away, rng());
    const vertical = simulate({...home, buildUp: 'direct'}, away, rng());
    const press = simulate({...home, buildUp: 'short', pressing: 'high'}, away, rng());
    accumulate(short, patient);
    accumulate(direct, vertical);
    short.lineBreaks += patient.stats.lineBreaks[0];
    highRegains += press.stats.pressRegains[0];
    assert.equal(patient.stats.pressRegains[0], 0);
    assert.equal(vertical.stats.pressRegains[0], 0);
    const starterCondition = data => data.performances[0].filter(player => home.xi.includes(player.playerId))
      .reduce((total, player) => total + player.condition, 0);
    shortCondition += starterCondition(patient);
    highCondition += starterCondition(press);
  }
  assert.ok(short.attempts / samples > 300);
  assert.ok(short.lineBreaks > samples);
  assert.ok(direct.distance / direct.attempts > short.distance / short.attempts + 2);
  assert.ok(short.complete / short.attempts > direct.complete / direct.attempts + 0.03);
  assert.ok(highRegains > samples * 5);
  assert.ok(highCondition < shortCondition);
});

test('identical shot context has one xG value and can be saved by a stronger goalkeeper', () => {
  const [home, away] = clubs;
  const shooter = {...home.squad.find(player => player.position === 'FW'), condition: 92};
  const keeper = away.squad.find(player => player.position === 'GK');
  const strong = {...keeper, attributes: {...keeper.attributes, handling: 20, reflexes: 20, oneOnOnes: 20}};
  const chance = {distance: 11, angle: 0.65, visibleAngle: 0.47, blockers: 1, keeperCoverage: 0.2,
    pressure: 0.24, bodyPart: 'foot', situation: 'open-play'};
  const probability = expectedGoals(chance);
  const open = {...chance, visibleAngle: 0.65, blockers: 0};
  assert.ok(expectedGoals(open) > probability);
  assert.ok(expectedGoals({...chance, rushed: true}) < probability);
  let improvedSaves = 0;
  for (let seed = 1; seed <= 250; seed++) {
    const original = resolveShot(chance, shooter, keeper, randomFrom(seed * 5719));
    const upgraded = resolveShot(chance, shooter, strong, randomFrom(seed * 5719));
    if (upgraded === 'goal') assert.equal(original, 'goal');
    if (original === 'goal' && upgraded === 'save') improvedSaves++;
  }
  assert.ok(improvedSaves > 7);
  assert.equal(expectedGoals(chance), probability);
});
