// Usage: node scripts/evaluate-xg.mjs <2018 event directory> <2022 event directory>
// Each directory contains the 64 men's World Cup events-<match ID>.json files from
// StatsBomb Open Data, competition 43, seasons 3 and 106 respectively.
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {PITCH, shotGeometry} from '../src/match-pitch.js';
import {expectedGoals, shotDetails} from '../src/match-shot.js';

const logistic = value => 1 / (1 + Math.exp(-value));
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const metres = ([x, y]) => ({x: x * PITCH.length / 120, y: y * PITCH.width / 80});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const opening = chance => chance.visibleAngle / Math.max(0.001, chance.angle);
const featureNames = ['log1pDistance', 'angleRadians', 'visibleFraction', 'blockers',
  'keeperCoverage', 'pressure', 'header', 'directFreeKick'];
const features = c => [Math.log1p(c.distance), c.angle, opening(c), c.blockers,
  c.keeperCoverage, c.pressure, Number(c.bodyPart === 'head'), Number(c.situation === 'free-kick')];

function readTournament(directory) {
  const files = readdirSync(directory).filter(file => /^events-\d+\.json$/.test(file)).sort();
  if (files.length !== 64) throw new Error('Expected 64 match event files in ' + directory);
  const counts = {matches: files.length, total: 0, shootout: 0, penalty: 0,
    missingFrame: 0, missingKeeper: 0, nonFootOrHead: 0, scored: 0};
  const rows = [];
  for (const file of files) {
    for (const {shot, location, period} of JSON.parse(readFileSync(join(directory, file), 'utf8'))) {
      if (!shot) continue;
      counts.total++;
      if (period === 5) { counts.shootout++; continue; }
      if (shot.type.name === 'Penalty') { counts.penalty++; continue; }
      if (!location || !shot.freeze_frame?.length) { counts.missingFrame++; continue; }
      const start = metres(location);
      const opponents = shot.freeze_frame.filter(person => !person.teammate && person.location)
        .map(person => ({...metres(person.location), position: person.position.id === 1 ? 'GK' : 'DF'}));
      const geometry = shotGeometry(start, 0, opponents);
      if (!geometry.keeper) { counts.missingKeeper++; continue; }
      if (!['Head', 'Left Foot', 'Right Foot'].includes(shot.body_part.name)) counts.nonFootOrHead++;
      const nearest = Math.min(...opponents.map(player => distance(start, player)));
      const chance = shotDetails(geometry, clamp(1 - nearest / 11, 0, 1),
        shot.body_part.name === 'Head' ? 'head' : 'foot', shot.type.name === 'Free Kick' ? 'free-kick' : 'open-play');
      const closeCover = opponents.filter(player => player.position !== 'GK' && player.x > start.x
        && Math.abs(player.y - start.y) < 4.5 && distance(player, start) < 7.5);
      const cover = geometry.blocker ?? closeCover.sort((a, b) => distance(a, start) - distance(b, start))[0];
      chance.intervention = cover ? clamp((8 - distance(cover, start)) * 0.029, 0, 0.19) : 0;
      const goal = Number(shot.outcome.name === 'Goal');
      counts.scored += goal;
      rows.push({file, goal, chance});
    }
  }
  return {counts: {...counts, eligible: rows.length}, rows};
}

function legacyXg(c) {
  return clamp(logistic(-1.35 - (c.distance - 12) * 0.076 + (c.angle - 0.47) * 1.75
    + (opening(c) - 0.72) * 1.15 - c.blockers * 0.20 - c.pressure * 0.52
    - (c.bodyPart === 'head' ? 0.42 : 0) - (c.situation === 'free-kick' ? 0.50 : 0)), 0.006, 0.85);
}

// Archived calibration trial with neutral finishing/composure 14, keeper 15,
// condition 90. Kept here to reproduce the rejected estimator.
function neutralStagesTrial(c) {
  const head = c.bodyPart === 'head';
  const block = c.blockers || c.intervention ? clamp(c.blockers * 0.12 + c.pressure * 0.13
    + (1 - opening(c) - c.keeperCoverage) * 0.19 + c.intervention, 0, 0.62) : 0;
  const target = clamp(0.56 - (c.distance - 12) * 0.008 + (c.angle - 0.47) * 0.13
    + 0.021 + 0.009 - 0.021 - c.pressure * 0.09 - (head ? 0.08 : 0), 0.13, 0.89);
  const conversion = clamp(0.457 - (c.distance - 12) * 0.014 + (c.angle - 0.47) * 0.47 + 0.009
    - 0.010 - c.keeperCoverage * 0.42 - 0.038 - (c.situation === 'free-kick' ? 0.07 : 0)
    - (head ? 0.085 + c.pressure * 0.055 : 0), 0.035, 0.96);
  return (1 - block) * target * (c.unguardedGoal ? 1 : conversion);
}

// Fit against observed 0/1 goal labels, with fixed L2 penalty on standardized
// slopes. Neither model selection nor scaling uses the held-out tournament.
function fit(train, predictors, names, ridgePenalty) {
  const n = train.length;
  const raw = train.map(r => predictors(r.chance));
  const means = names.map((_, i) => raw.reduce((sum, r) => sum + r[i], 0) / n);
  const deviations = means.map((mean, i) =>
    Math.sqrt(raw.reduce((sum, r) => sum + (r[i] - mean) ** 2, 0) / n) || 1);
  const samples = raw.map(row => [1, ...row.map((v, i) => (v - means[i]) / deviations[i])]);
  const beta = Array(samples[0].length).fill(0);
  const penalty = ridgePenalty / n;
  const step = 1 / (beta.length / 4 + penalty);
  for (let iteration = 0; iteration < 10000; iteration++) {
    const gradient = beta.map((b, j) => j === 0 ? 0 : b * penalty);
    for (let i = 0; i < n; i++) {
      const vector = samples[i];
      const error = (logistic(vector.reduce((sum, x, j) => sum + x * beta[j], 0)) - train[i].goal) / n;
      for (let j = 0; j < gradient.length; j++) gradient[j] += error * vector[j];
    }
    if (Math.max(...gradient.map(Math.abs)) < 1e-8) break;
    if (iteration === 9999) throw new Error('xG model fit failed to converge');
    for (let j = 0; j < beta.length; j++) beta[j] -= step * gradient[j];
  }
  const slopes = beta.slice(1).map((b, i) => b / deviations[i]);
  const intercept = beta[0] - slopes.reduce((sum, b, i) => sum + b * means[i], 0);
  return {coefficients: Object.fromEntries([['intercept', intercept], ...names.map((name, i) => [name, slopes[i]])]),
    predict: chance => logistic(predictors(chance).reduce((sum, x, i) => sum + x * slopes[i], intercept))};
}

function metrics(rows, predict) {
  let xg = 0, brier = 0, logLoss = 0;
  for (const {goal, chance} of rows) {
    const p = clamp(predict(chance), 1e-8, 1 - 1e-8);
    xg += p;
    brier += (p - goal) ** 2;
    logLoss -= goal ? Math.log(p) : Math.log(1 - p);
  }
  return {xg, brier: brier / rows.length, logLoss: logLoss / rows.length};
}

// Sample whole matches with replacement to keep the two predictions paired
// and retain within-match clustering. Negative differences favor the fitted model.
function pairedInterval(rows, predict, reference) {
  const matches = new Map();
  for (const row of rows) {
    const parts = matches.get(row.file) ?? {count: 0, brier: 0, logLoss: 0};
    const model = metrics([row], predict), baseline = metrics([row], reference);
    parts.count++;
    parts.brier += model.brier - baseline.brier;
    parts.logLoss += model.logLoss - baseline.logLoss;
    matches.set(row.file, parts);
  }
  const groups = [...matches.values()];
  let seed = 5418;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const samples = [];
  for (let rep = 0; rep < 2000; rep++) {
    let count = 0, brier = 0, logLoss = 0;
    for (let j = 0; j < groups.length; j++) {
      const match = groups[Math.floor(random() * groups.length)];
      count += match.count;
      brier += match.brier;
      logLoss += match.logLoss;
    }
    samples.push({brier: brier / count, logLoss: logLoss / count});
  }
  return Object.fromEntries(['brier', 'logLoss'].map(key => {
    const sorted = samples.map(sample => sample[key]).sort((a, b) => a - b);
    return [key, [sorted[49], sorted[1949]]];
  }));
}

if (process.argv.length !== 4) throw new Error('Usage: node scripts/evaluate-xg.mjs <2018 event directory> <2022 event directory>');
const train = readTournament(process.argv[2]), holdout = readTournament(process.argv[3]);
const fitted = fit(train.rows, features, featureNames, 4);
const logitV7 = chance => {
  const p = legacyXg(chance);
  return [Math.log(p / (1 - p))];
};
const recalibrated = fit(train.rows, logitV7, ['v7LogOdds'], 0);
const models = {v7: legacyXg, neutralStagesTrial, engine: expectedGoals, fitted: fitted.predict,
  recalibratedV7: recalibrated.predict};
const evaluate = rows => Object.fromEntries(Object.entries(models).map(([name, predict]) => [name, metrics(rows, predict)]));
const distanceBands = [[0, 8], [8, 16], [16, 24], [24, Infinity]].map(([min, max]) => {
  const shots = holdout.rows.filter(({chance}) => chance.distance >= min && chance.distance < max);
  return {minMetres: min, shots: shots.length, goals: shots.reduce((sum, row) => sum + row.goal, 0),
    xg: Object.fromEntries(Object.entries(evaluate(shots)).map(([model, scores]) => [model, scores.xg]))};
});
const output = {training: train.counts, holdout: holdout.counts, coefficients: fitted.coefficients,
  recalibration: recalibrated.coefficients, trainingScores: evaluate(train.rows), evaluation: evaluate(holdout.rows), distanceBands,
  fittedMinusEngine95: pairedInterval(holdout.rows, fitted.predict, expectedGoals),
  recalibratedMinusV7_95: pairedInterval(holdout.rows, recalibrated.predict, legacyXg),
  engineMinusV7_95: pairedInterval(holdout.rows, expectedGoals, legacyXg)};
console.log(JSON.stringify(output, (_, v) => typeof v === 'number' ? Number(v.toFixed(6)) : v, 2));
