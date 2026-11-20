import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { clubs, defaultPlan, simulate } from '../src/football.js';

const sideNames = ['home', 'away'];
const scenarios = [
  {name: 'Balanced vs balanced', home: {}, away: {}},
  {name: 'Short build-up vs balanced', home: {buildUp: 'short'}, away: {}},
  {name: 'Direct build-up vs balanced', home: {buildUp: 'direct'}, away: {}},
  {name: 'High press vs balanced', home: {pressing: 'high'}, away: {}},
  {name: 'Low block vs balanced', home: {pressing: 'compact'}, away: {}},
  {name: 'High press vs counter', home: {pressing: 'high'}, away: {buildUp: 'direct', pressing: 'compact'}},
  {name: 'Counter vs high press', home: {buildUp: 'direct', pressing: 'compact'}, away: {pressing: 'high'}},
];

const coreStats = ['possession', 'passes', 'completedPasses', 'lineBreaks', 'turnovers', 'pressRegains',
  'shots', 'onTarget', 'xg', 'goals'];
const incidentStats = ['carries', 'interceptions', 'blocks', 'woodwork', 'corners', 'fouls', 'offsides',
  'penalties', 'freeKicks', 'yellowCards', 'redCards', 'advantages', 'cornersTaken', 'cornerClaims', 'cornerClearances',
  'crosses', 'completedCrosses', 'cornerSecondBallsWon', 'quickCornerSecondBallShots'];
const statNames = [...coreStats, ...incidentStats];

function generator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function mean(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function prepareTeamTotals() {
  return {
    stats: Object.fromEntries(statNames.map(name => [name, []])),
    chainLengths: [],
    passIntervals: [],
    ownHalfRegains: 0,
    quickProgressions: 0,
    cornerSequences: [],
  };
}

function collectPassChains(actions, teams) {
  const chainsBySide = [new Map(), new Map()];
  for (const action of actions) {
    if (action.type !== 'pass' || !Number.isInteger(action.possession) || !Number.isFinite(action.second)) continue;
    const side = sideNames.indexOf(action.side);
    if (side < 0) continue;
    const key = (action.period ?? action.half ?? '') + ':' + action.possession;
    const chain = chainsBySide[side].get(key) ?? [];
    chain.push(action.second);
    chainsBySide[side].set(key, chain);
  }
  for (const [side, chains] of chainsBySide.entries()) {
    for (const times of chains.values()) {
      teams[side].chainLengths.push(times.length);
      for (let index = 1; index < times.length; index++) {
        assert.ok(times[index] >= times[index - 1], 'Pass times must be ordered within a possession');
        teams[side].passIntervals.push(times[index] - times[index - 1]);
      }
    }
  }
}

function collectBreaks(actions, teams) {
  let previous;
  let transition;
  for (const action of actions) {
    if (action.possession !== previous?.possession) {
      transition = null;
      const side = sideNames.indexOf(action.side);
      const depth = side === 0 ? action.location?.x : 105 - action.location?.x;
      const liveTurnover = previous?.period === action.period && previous.side !== action.side
        && ['intercepted', 'tackled'].includes(previous.outcome);
      if (side >= 0 && depth < 52.5 && action.type !== 'restart' && liveTurnover) {
        teams[side].ownHalfRegains++;
        transition = {side, second: action.second};
      }
    }
    if (transition && action.second - transition.second <= 15 && action.type === 'pass'
      && action.outcome === 'complete') {
      const destination = transition.side === 0 ? action.to?.x : 105 - action.to?.x;
      if (destination >= 70) {
        teams[transition.side].quickProgressions++;
        transition = null;
      }
    }
    previous = action;
  }
}

function collectCorners(actions, events, teams) {
  const restarts = new Map(actions.filter(action => action.type === 'restart' && action.outcome === 'corner')
    .map(action => [action.possession, action.cause]));
  const kicks = new Map(actions.filter(action => action.type === 'pass' && action.restart === 'corner')
    .map(action => [action.possession, {action, shots: []}]));
  for (const event of events) {
    const kick = kicks.get(event.possession);
    if (kick && kick.action.side === event.side) kick.shots.push(event);
  }
  for (const {action, shots} of kicks.values()) {
    const side = sideNames.indexOf(action.side);
    if (side < 0) continue;
    const quickShots = shots.filter(shot => shot.second - action.second <= 10);
    const secondBallShots = quickShots.filter(shot => shot.secondBall || action.secondBallId);
    teams[side].cornerSequences.push({
      complete: action.outcome === 'complete',
      shot: shots.length > 0,
      quick: quickShots.length > 0,
      quickAfterClearance: secondBallShots.length > 0,
      quickAfterClearanceXg: secondBallShots.reduce((total, shot) => total + shot.xg, 0),
      quickAfterClearanceShots: secondBallShots.length,
      goal: shots.some(shot => shot.type === 'goal'),
      shots: shots.length,
      headers: shots.filter(shot => shot.bodyPart === 'head').length,
      xg: shots.reduce((sum, shot) => sum + shot.xg, 0),
      cause: restarts.get(action.possession),
    });
  }
}

function runScenario(scenario, matches, baseSeed) {
  const plans = clubs.map((club, side) => ({...defaultPlan(club), ...scenario[sideNames[side]]}));
  const teams = sideNames.map(() => prepareTeamTotals());
  const resultCounts = {homeWin: 0, draw: 0, awayWin: 0, scoreless: 0, abandoned: 0};
  const totalGoals = [];
  const logSizes = [];
  for (let match = 0; match < matches; match++) {
    const seed = (baseSeed + Math.imul(match + 1, 7919)) >>> 0;
    const result = simulate(...plans, generator(seed));
    if (match === 0) {
      assert.deepEqual(result, simulate(...plans, generator(seed)), 'A replay with the same seed must match');
    }
    const [home, away] = result.playedScore ?? result.score;
    if (result.playedScore) resultCounts.abandoned++;
    totalGoals.push(home + away);
    if (home === away) resultCounts.draw++;
    else if (home > away) resultCounts.homeWin++;
    else resultCounts.awayWin++;
    if (home + away === 0) resultCounts.scoreless++;
    for (const [side, team] of teams.entries()) {
      for (const name of statNames) {
        const value = name === 'goals' ? [home, away][side] : result.stats[name]?.[side];
        if (Number.isFinite(value)) team.stats[name].push(value);
      }
    }
    if (Array.isArray(result.actions)) {
      logSizes.push(result.actions.length);
      collectPassChains(result.actions, teams);
      collectBreaks(result.actions, teams);
      collectCorners(result.actions, result.events, teams);
    }
  }
  return {name: scenario.name, resultCounts, totalGoals, teams, logSizes};
}

function percentile(sorted, fraction) {
  const rank = (sorted.length - 1) * fraction;
  const index = Math.floor(rank);
  const next = sorted[Math.ceil(rank)];
  return sorted[index] + (next - sorted[index]) * (rank - index);
}

function distribution(values, fractions, digits = 1) {
  if (!values.length) return '–';
  const sorted = values.slice().sort((a, b) => a - b);
  return fractions.map(fraction => round(percentile(sorted, fraction), digits)).join(' / ');
}

function round(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : '–';
}

function ratio(numerator, denominator) {
  const num = mean(numerator);
  const den = mean(denominator);
  return num !== null && den ? round(100 * num / den) + '%' : '–';
}

function rate(count, matches) {
  return matches ? round(count * 100 / matches) + '%' : '–';
}

function teamRow(result, side, summarize) {
  return {
    Setup: result.name,
    Team: sideNames[side],
    ...summarize(result.teams[side]),
  };
}

function printBenchmarks(results, matches, baseSeed, elapsedMs) {
  console.log('Ballerz match-engine benchmark');
  console.log(matches + ' matches per setup with base seed ' + baseSeed + '. Ran in ' + round(elapsedMs / 1000, 2) + ' s.');
  console.log('The same seed sequence and starting elevens are used in every setup.');

  console.table(results.map(({name, resultCounts, totalGoals, logSizes}) => ({
    Setup: name,
    'Home win': rate(resultCounts.homeWin, matches),
    Draw: rate(resultCounts.draw, matches),
    'Away win': rate(resultCounts.awayWin, matches),
    '0–0': rate(resultCounts.scoreless, matches),
    Abandoned: rate(resultCounts.abandoned, matches),
    'Goals / match': round(mean(totalGoals), 2),
    'Goals p10 / 50 / 90': distribution(totalGoals, [0.1, 0.5, 0.9]),
    'Actions / match': round(mean(logSizes)),
  })));

  console.log('Per team and match averages, with p10 / median / p90 for counts');
  console.table(results.flatMap(result => sideNames.map((_, side) => teamRow(result, side, ({stats}) => ({
    'Possession %': round(mean(stats.possession)),
    Passes: round(mean(stats.passes)),
    'Passes p10 / 50 / 90': distribution(stats.passes, [0.1, 0.5, 0.9]),
    Completion: ratio(stats.completedPasses, stats.passes),
    'Line breaks': round(mean(stats.lineBreaks)),
    Turnovers: round(mean(stats.turnovers)),
    'Press regains': round(mean(stats.pressRegains)),
    Shots: round(mean(stats.shots)),
    'Shots p10 / 50 / 90': distribution(stats.shots, [0.1, 0.5, 0.9]),
    'On target': ratio(stats.onTarget, stats.shots),
    Goals: round(mean(stats.goals), 2),
    xG: round(mean(stats.xg), 2),
  })))));

  const availableStats = incidentStats.filter(name =>
    results.some(result => result.teams.some(team => team.stats[name].length)));
  if (availableStats.length) {
    console.log('Recorded incidents per team and match');
    console.table(results.flatMap(result => sideNames.map((_, side) => teamRow(result, side, ({stats}) =>
      Object.fromEntries(availableStats.map(name => [name, round(mean(stats[name]), 2)]))))));
  }

  if (results.some(result => result.teams.some(team => team.cornerSequences.length))) {
    console.log('Recorded corner passes and shots in the same possession');
    console.table(results.flatMap(result => sideNames.map((_, side) => teamRow(result, side, ({cornerSequences}) => {
      const n = cornerSequences.length;
      const count = key => cornerSequences.filter(corner => corner[key]).length;
      const shots = cornerSequences.reduce((sum, corner) => sum + corner.shots, 0);
      const headers = cornerSequences.reduce((sum, corner) => sum + corner.headers, 0);
      const xg = cornerSequences.reduce((sum, corner) => sum + corner.xg, 0);
      const secondBallShots = cornerSequences.reduce((sum, corner) => sum + corner.quickAfterClearanceShots, 0);
      const secondBallXg = cornerSequences.reduce((sum, corner) => sum + corner.quickAfterClearanceXg, 0);
      const shotExits = cornerSequences.filter(corner => ['deflected-shot', 'parried-shot'].includes(corner.cause)).length;
      return {
        Kicks: n,
        Completion: rate(count('complete'), n),
        'Any shot': rate(count('shot'), n),
        'Shot within 10 s': rate(count('quick'), n),
        'Quick after clearance': rate(count('quickAfterClearance'), n),
        'xG per quick clearance shot': secondBallShots ? round(secondBallXg / secondBallShots, 3) : null,
        'Header share': rate(headers, shots),
        'Goal rate': rate(count('goal'), n),
        'xG per 100 kicks': n ? round(100 * xg / n, 2) : null,
        'Awarded from shots': rate(shotExits, n),
      };
    }))));
  }

  if (results.some(result => result.teams.some(team => team.chainLengths.length))) {
    console.log('Live own-half regains with a successful pass released into the final third within 15 seconds');
    console.table(results.flatMap(result => sideNames.map((_, side) => teamRow(result, side, team => ({
      'Own-half regains': team.ownHalfRegains,
      'Quick progressions': team.quickProgressions,
      Rate: rate(team.quickProgressions, team.ownHalfRegains),
    })))));
    console.log('Consecutive passes with the same team, period and possession ID');
    console.table(results.flatMap(result => sideNames.map((_, side) => teamRow(result, side, team => ({
      Possessions: team.chainLengths.length,
      'Passes / possession p50 / 90': distribution(team.chainLengths, [0.5, 0.9]),
      'Pass intervals': team.passIntervals.length,
      'Seconds between passes p50 / 90': distribution(team.passIntervals, [0.5, 0.9], 2),
    })))));
  } else {
    console.log('This engine did not provide timestamped pass actions with possession IDs.');
  }
}

const [count = '100', seed = '0', ...extra] = process.argv.slice(2);
const matches = Number(count);
const baseSeed = Number(seed);
if (extra.length || !/^\d+$/.test(count) || !Number.isSafeInteger(matches) || matches < 1 ||
    !/^\d+$/.test(seed) || !Number.isInteger(baseSeed) || baseSeed > 0xffffffff) {
  console.error('Usage: node matchday/scripts/benchmark.mjs [matches-per-setup] [uint32-seed]');
  process.exitCode = 2;
} else {
  const start = performance.now();
  const results = scenarios.map(scenario => runScenario(scenario, matches, baseSeed));
  printBenchmarks(results, matches, baseSeed, performance.now() - start);
}
