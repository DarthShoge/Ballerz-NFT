import {clubs, defaultPlan, matchTeams} from '../src/football.js';
import {advanceMatch, startMatch} from '../src/match-engine.js';
import {formationSlots} from '../src/match-formations.js';

const matches = Number(process.argv[2] ?? 160);
const baseSeed = Number(process.argv[3] ?? 20261201);
const slot = process.argv[4] ?? 'DM';
if (!Number.isSafeInteger(matches) || matches < 2 || !Number.isInteger(baseSeed) || baseSeed < 0 || baseSeed > 0xffffffff) {
  throw new Error('Usage: node scripts/benchmark-player-instructions.mjs [matches >= 2] [uint32 seed] [outfield slot]');
}
const home = defaultPlan(clubs[0], '4-3-3 DM'), away = defaultPlan(clubs[1]);
const index = formationSlots[home.formation].indexOf(slot);
if (index < 1) throw new Error('Choose an outfield slot from ' + formationSlots[home.formation].slice(1).join(', ') + '.');
const id = home.xi[index];
const choices = {
  standard: {}, tighter: {marking:'tighter'}, more: {pressing:'more'}, less: {pressing:'less'},
  harder: {tackling:'harder'}, easier: {tackling:'easier'},
  combined: {marking:'tighter', pressing:'more', tackling:'harder'}
};
const series = {};
function fullMatch(settings, seed) {
  const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const plan = settings ? {...home, playerInstructions:{[id]:settings}} : home;
  const game = startMatch(matchTeams([plan, away]), rng);
  advanceMatch(game, Infinity);
  const players = game.teams[0].players.filter(p => p.slotIndex === index);
  const shirtIds = new Set(players.map(p => p.id));
  return {
    regains: players.reduce((sum, p) => sum + p.regains, 0),
    fouls: game.timeline.filter(e => e.type === 'foul' && shirtIds.has(e.playerId)).length,
    shotsAgainst: game.stats.shots[1], xgAgainst: game.stats.xg[1]
  };
}
for (const [label, settings] of Object.entries(choices)) {
  // Omit the neutral map to match an unedited team sheet.
  series[label] = Array.from({length:matches}, (_, i) => {
    const seed = (baseSeed + Math.imul(i + 1, 7919)) >>> 0;
    return fullMatch(Object.keys(settings).length ? settings : undefined, seed);
  });
}
const mean = values => values.reduce((a,b) => a+b,0) / values.length;
const results = [], differences = [];
for (const [label, runs] of Object.entries(series)) {
  const averages = {setting:label}, changes = {setting:label};
  for (const metric of Object.keys(runs[0])) {
    averages[metric] = +mean(runs.map(r => r[metric])).toFixed(3);
    const delta = runs.map((r,i) => r[metric] - series.standard[i][metric]);
    const avg = mean(delta);
    const half = 1.96 * Math.sqrt(delta.reduce((ss, n) => ss + (n - avg) ** 2, 0) / ((matches - 1) * matches));
    changes[metric] = avg.toFixed(3) + ' [' + (avg - half).toFixed(3) + ', ' + (avg + half).toFixed(3) + ']';
  }
  results.push(averages);
  if (label !== 'standard') differences.push(changes);
}
console.log(matches + ' seeded matches per setting for the same ' + slot + ' slot. Seed ' + baseSeed + '.');
console.table(results);
console.log('Paired differences from standard with approximate 95% intervals across match seeds.');
console.table(differences);
