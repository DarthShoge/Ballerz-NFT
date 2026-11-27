import {clubs, defaultPlan, matchTeams} from '../src/football.js';
import {advanceMatch, startMatch} from '../src/match-engine.js';
import {distanceBetween, isActive} from '../src/match-decisions.js';

const count = Number(process.argv[2] ?? 40);
const base = Number(process.argv[3] ?? 20261201);
if (!Number.isSafeInteger(count) || count < 1 || !Number.isInteger(base) || base < 0 || base > 0xffffffff) {
  throw new Error('Usage: node scripts/benchmark-defending.mjs [matches] [uint32 seed]');
}

const scenarios = [
  {shape:'4-3-3 DM', slot:'DM', roles:['screening-midfielder','pressing-midfielder'],
    metric:'within 3 m of carrier (%)', sample(g, p) {
      return {job:'press', value:distanceBetween(p, g.carrier) <= 3 ? 100 : 0};
    }},
  {shape:'4-4-2', slot:'LM', roles:['wide-defender','tracking-winger'],
    metric:'nearest wide runner (m)', sample(g, p) {
      if (g.carrier.y >= 34) return;
      const runners = g.teams[1].players.filter(a => isActive(a) && a !== g.carrier
        && a.position !== 'GK' && a.y < 24 && a.x < 65);
      if (runners.length) return {job:'mark', value:Math.min(...runners.map(a => distanceBetween(p, a)))};
    }},
  {shape:'3-5-2', slot:'LCB', roles:['stopping-wide-centre-back','covering-wide-centre-back'],
    metric:'behind pressing teammate (m)', sample(g, p) {
      const pressing = g.teams[0].players.find(a => a !== p && isActive(a) && a.defensiveTask === 'press');
      if (pressing) return {job:'cover', value:pressing.x - p.x};
    }}
];

const away = defaultPlan(clubs[1]);
const output = [];
for (const {shape, slot, roles, metric, sample} of scenarios) {
  for (const role of roles) {
    let used = 0, seconds = 0, sumMetric = 0, sumJob = 0;
    for (let i = 1; i <= count; i++) {
      let seed = (base + Math.imul(i, 7919)) >>> 0;
      const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      const home = defaultPlan(clubs[0], shape);
      const id = matchTeams([home, away])[0].players.find(p => p.slot === slot).id;
      home.playerRoles = {[id]:{outOfPossession:role}};
      let exposure = 0, weighted = 0, jobSeconds = 0;
      const g = startMatch(matchTeams([home, away]), rng, {onMovement(game, duration) {
        if (game.side !== 1 || game.carrier.position === 'GK' || game.carrier.x > 65
            || game.restart || game.openingRestart || game.corner) return;
        const p = game.teams[0].players.find(a => a.id === id);
        if (!isActive(p)) return;
        const observation = sample(game, p);
        if (!observation) return;
        exposure += duration;
        weighted += duration * observation.value;
        if (p.defensiveTask === observation.job) jobSeconds += duration;
      }});
      advanceMatch(g, Infinity);
      if (!exposure) continue;
      used++;
      seconds += exposure;
      sumMetric += weighted / exposure;
      sumJob += jobSeconds / exposure;
    }
    output.push({slot, role, matches:used, 'eligible minutes':(seconds / 60).toFixed(1),
      metric, value:used ? (sumMetric / used).toFixed(2) : null,
      'assigned job %':used ? (100 * sumJob / used).toFixed(1) : null});
  }
}
console.log('Same players and seeds in each pair. Open-play movement weighted by duration within match; matches weighted equally. Seed ' + base);
console.table(output);
