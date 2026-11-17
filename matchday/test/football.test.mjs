import { test } from 'node:test';
import assert from 'node:assert/strict';
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
    { ...plan, tactic: 'attack' },
  ]) assert.equal(typeof validatePlan(home, invalid), 'string');
});

test('reports reconcile with events and only selected players appear', () => {
  const [home, away] = clubs;
  const a = defaultPlan(home, '3-5-2', 'press'), b = defaultPlan(away, '4-3-3', 'counter');
  const selected = new Set([...a.xi, ...b.xi]);
  const bench = [...home.squad, ...away.squad].filter(player => !selected.has(player.id));
  for (let seed = 1; seed <= 80; seed++) {
    const result = simulate(a, b, randomFrom(seed));
    assert.deepEqual(result, simulate(a, b, randomFrom(seed)));
    assert.equal(result.stats.possession[0] + result.stats.possession[1], 100);
    for (const [i, side] of ['home', 'away'].entries()) {
      const chances = result.events.filter(event => event.side === side);
      assert.equal(chances.length, result.stats.shots[i]);
      assert.equal(chances.filter(e => e.type === 'goal').length, result.score[i]);
      assert.equal(chances.filter(e => e.type !== 'miss').length, result.stats.onTarget[i]);
    }
    assert.ok(result.events.every((event, i, list) =>
      event.minute >= 1 && event.minute <= 90 && (i === 0 || list[i - 1].minute < event.minute) &&
      bench.every(player => !event.text.includes(player.name))));
  }
});

test('press and counter produce distinctly different match patterns', () => {
  const [home, away] = clubs;
  let pressingPossession = 0, counterPossession = 0, breaks = 0, turnovers = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const homePress = simulate(defaultPlan(home, '4-4-2', 'press'), defaultPlan(away, '4-4-2', 'counter'), randomFrom(seed));
    const homeCounter = simulate(defaultPlan(home, '4-4-2', 'counter'), defaultPlan(away, '4-4-2', 'press'), randomFrom(seed));
    pressingPossession += homePress.stats.possession[0];
    counterPossession += homeCounter.stats.possession[0];
    breaks += homeCounter.events.filter(e => e.side === 'home' && e.move === 'break').length;
    turnovers += homePress.events.filter(e => e.side === 'home' && e.move === 'press').length;
  }
  assert.ok(pressingPossession - counterPossession > 150 * 10);
  assert.ok(breaks > 150);
  assert.ok(turnovers > 150);
});
