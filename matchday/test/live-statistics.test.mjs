import assert from 'node:assert/strict';
import test from 'node:test';
import {clubs, defaultPlan, matchTeams} from '../src/football.js';
import {advanceMatch, checkpointMatch, liveMatchReport, matchResult, restoreMatch, startMatch} from '../src/match-engine.js';
import {applyRequestedSubstitutions} from '../src/match-rules.js';
import {shotGeometry} from '../src/match-pitch.js';
import {breakawayFinish, expectedGoals, resolveShot, shotDetails} from '../src/match-shot.js';
import {recordedMatchReport} from '../src/match-statistics.js';

function generator(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test('the live totals, shot map and individual contributions reconcile before and after a restart', () => {
  const rng = generator(921434);
  const clubsInMatch = matchTeams(clubs.map(club => defaultPlan(club)));
  let game = startMatch(clubsInMatch, rng);
  for (const time of [0, 1200, 2650, 4200, Infinity]) {
    advanceMatch(game, time);
    const checkpoint = JSON.stringify(checkpointMatch(game));
    const report = liveMatchReport(game);
    assert.equal(JSON.stringify(checkpointMatch(game)), checkpoint, 'reading live stats changed the simulation');
    for (const [i, side] of ['home', 'away'].entries()) {
      const players = report.teams[i].players;
      const sum = key => players.reduce((total, player) => total + player[key], 0);
      assert.equal(sum('shots'), report.stats.shots[i]);
      assert.equal(sum('onTarget'), report.stats.onTarget[i]);
      assert.equal(sum('challengesWon'), report.stats.challengesWon[i]);
      assert.equal(sum('fouls'), report.stats.fouls[i]);
      assert.equal(sum('regains'), report.stats.turnovers[1-i]);
      assert.equal(sum('saves'), report.stats.saves[i]);
      assert.equal(Math.round(sum('xg') * 1000), Math.round(report.stats.xg[i] * 1000));
      assert.equal(report.shots.filter(shot => shot.side === side).length, report.stats.shots[i]);
      const tackles = game.actions.filter(play => play.side !== side && play.outcome === 'tackled' && play.defenderId);
      assert.equal(report.stats.challengesWon[i], tackles.length);
      assert.ok(report.stats.challenges[i] >= tackles.length);
    }
    game = restoreMatch(JSON.parse(checkpoint), rng);
    assert.deepEqual(liveMatchReport(game), JSON.parse(JSON.stringify(report)));
  }
  const live = liveMatchReport(game);
  const final = matchResult(game);
  assert.deepEqual(live.stats, final.stats);
  assert.deepEqual(live.shots, final.events);
  const old = checkpointMatch(game);
  delete old.recordsEscapedChallenges;
  const legacy = liveMatchReport(restoreMatch(old));
  assert.deepEqual(legacy.stats.challengesWon, live.stats.challengesWon);
  assert.equal(legacy.stats.challenges, undefined);
});

test('the submitted slot survives selection order, substitutions and the next kickoff', () => {
  const plans = clubs.map(club => defaultPlan(club));
  const swap = clubs[0].squad.find(p => p.number === 14);
  const original = plans[0].xi[1];
  plans[0].xi[1] = swap.id;
  const game = startMatch(matchTeams(plans), generator(997));
  const team = game.teams[0];
  const starter = team.players.find(p => p.id === swap.id);
  assert.equal(starter.slot, 'LB');
  assert.equal(game.teams[1].players[1].slot, 'RB');
  team.pendingSubstitution = {incomingId: original, outgoingId: swap.id};
  applyRequestedSubstitutions(game);
  advanceMatch(game, 0.1);
  const replacement = liveMatchReport(game).teams[0].players.find(p => p.id === original);
  assert.equal(replacement.slot, 'LB');
  assert.equal(team.players.find(p => p.id === original).anchorY, starter.anchorY);
  assert.ok(liveMatchReport(game).teams[0].bench.every(p => p.position && p.number));
});

test('a goalkeeper who has been rounded cannot save an on-target shot from behind the shooter', () => {
  const shooter = {...clubs[0].squad.find(p => p.position === 'FW'), condition: 92, x: 95, y: 34};
  for (const side of [0, 1]) {
    const start = {...shooter, x: side ? 10 : 95};
    const keeper = {...clubs[1].squad[0], x: side ? 15 : 90, y: 34};
    const geometry = shotGeometry(start, side, [keeper]);
    const chance = shotDetails(geometry, 0, 'foot', 'open-play');
    assert.equal(geometry.unguardedGoal, true);
    const rolls = [0.99, 0.1, 0.999];
    assert.equal(resolveShot(chance, start, keeper, () => rolls.shift()), 'goal');
    keeper.x = side ? 1 : 104;
    const guarded = shotDetails(shotGeometry(start, side, [keeper]), 0, 'foot', 'open-play');
    assert.equal(guarded.unguardedGoal, false);
    assert.ok(expectedGoals(chance) > expectedGoals(guarded));
  }
});

test('a chip is available over an advancing keeper and costs accuracy', () => {
  const shooter = {...clubs[0].squad.find(p => p.position === 'FW'), condition: 90, x: 90, y: 34};
  const keeper = {...clubs[1].squad[0], x: 97, y: 34};
  const geometry = shotGeometry(shooter, 0, [keeper]);
  assert.equal(breakawayFinish(shooter, geometry, 105, () => 0), 'chip');
  assert.equal(breakawayFinish(shooter, geometry, 105, () => 0.999), 'placed');
  const chance = shotDetails(geometry, 0, 'foot', 'open-play');
  const outcomes = (finish, placement) => {
    const rolls = [0.5, placement, 0.5];
    return resolveShot({...chance, finish}, shooter, keeper, () => rolls.shift());
  };
  const onTarget = type => type === 'save' || type === 'goal';
  assert.ok(Array.from({length: 99}, (_, i) => (i + 1) / 100)
    .some(p => onTarget(outcomes('placed', p)) && !onTarget(outcomes('chip', p))));
  assert.equal(breakawayFinish(shooter, {...geometry, keeper: {...keeper, x: 104}}, 105, () => 0), 'placed');
});

test('a saved v7 report exposes reconstructable stats without changing the recorded fixture', () => {
  const report = {engineVersion: 7, stats: {shots: [1, 0]}, performances: [[{playerId: 'a'}], [{playerId: 'b'}]],
    events: [{type: 'save', side: 'home', playerId: 'a', xg: 0.15}],
    actions: [{type: 'duel', outcome: 'tackled', defenderId: 'b', side: 'home'}]};
  const view = recordedMatchReport(report);
  assert.deepEqual(view.stats.challengesWon, [0, 1]);
  assert.deepEqual(view.stats.saves, [0, 1]);
  assert.equal(view.performances[0][0].xg, 0.15);
  assert.equal(view.stats.challenges, undefined);
  assert.equal(report.stats.saves, undefined);
  const forfeit = {kind: 'forfeit', score: [0, 3]};
  assert.equal(recordedMatchReport(forfeit), forfeit);
});
