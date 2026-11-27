import {clubs, defaultPlan, matchTeams} from '../src/football.js';
import {advanceMatch, startMatch} from '../src/match-engine.js';
import {isActive} from '../src/match-decisions.js';

const matches = Number(process.argv[2] ?? 20);
const baseSeed = Number(process.argv[3] ?? 20261201);
if (!Number.isSafeInteger(matches) || matches < 1 || !Number.isInteger(baseSeed) || baseSeed < 0 || baseSeed > 0xffffffff) {
  throw new Error('Usage: node scripts/benchmark-roles.mjs [matches] [uint32 seed]');
}
const [home, away] = clubs.map(club => defaultPlan(club));
const runs = [
  {role:'wing-back', slot:1}, {role:'inside-wing-back', slot:1},
  {role:'poacher', slot:9}, {role:'false-nine', slot:9}
];
const results = [];
for (const {role, slot} of runs) {
  const id = home.xi[slot];
  const plan = {...home, playerRoles:{[id]:{inPossession:role}}};
  let matchesSampled = 0, observations = 0, width = 0, depth = 0;
  for (let i = 1; i <= matches; i++) {
    let seed = (baseSeed + Math.imul(i, 7919)) >>> 0;
    const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const game = startMatch(matchTeams([plan, away]), rng);
    const player = game.teams[0].players.find(p => p.id === id);
    let samples = 0, matchWidth = 0, matchDepth = 0;
    advanceMatch(game, Infinity, {onAction(g) {
      if (g.side !== 0 || !g.carrier || g.carrier.x < 65 || g.restart || g.openingRestart || g.corner || !isActive(player)) return;
      samples++;
      matchWidth += Math.abs(player.y - 34);
      matchDepth += player.x;
    }});
    if (!samples) continue;
    matchesSampled++;
    observations += samples;
    width += matchWidth / samples;
    depth += matchDepth / samples;
  }
  results.push({role, matches:matchesSampled, observations,
    'metres from centre':(width / matchesSampled).toFixed(1), 'metres upfield':(depth / matchesSampled).toFixed(1)});
}
console.log('Open-play positions in advanced home possessions, equal weight per match. Base seed ' + baseSeed);
console.table(results);
