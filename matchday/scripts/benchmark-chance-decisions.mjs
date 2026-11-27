import { clubs, defaultPlan, matchTeams } from '../src/football.js';
import { advanceMatch, startMatch } from '../src/match-engine.js';
import { attackingX, PITCH } from '../src/match-pitch.js';

const centre = PITCH.width / 2;

function geometryClass(game) {
  if (!game.carrier || game.restart || game.openingRestart || game.corner) return null;
  const {carrier, side} = game;
  const goalDx = PITCH.length - attackingX(carrier.x, side);
  const goalDy = centre - carrier.y;
  const distance = Math.hypot(goalDx, goalDy);
  if (distance <= 0 || distance > 18 || Math.abs(goalDy) > 11) return null;

  const opponents = game.teams[1 - side].players.filter(p => !p.dismissed && !p.replaced && !p.injured);
  if (!opponents.some(p => p.position === 'GK')) return null;
  const screened = opponents.some(p => {
    if (p.position === 'GK') return false;
    const dx = attackingX(p.x, side) - attackingX(carrier.x, side);
    const dy = p.y - carrier.y;
    const along = (dx * goalDx + dy * goalDy) / distance;
    return along > 0 && along < distance && Math.abs(dx * goalDy - dy * goalDx) / distance <= 3;
  });
  return screened ? 'screened' : 'clear';
}

function register(table, key, action) {
  table[key][action.type]++;
  if (action.type === 'pass' && Math.abs(action.to.y - centre) - Math.abs(action.location.y - centre) > 8) {
    table[key].widerPass++;
  }
}

const count = Number(process.argv[2] ?? 240);
const base = Number(process.argv[3] ?? 20261201);
if (!Number.isSafeInteger(count) || count < 1 || !Number.isInteger(base) || base < 0 || base > 0xffffffff) {
  throw new Error('Usage: node scripts/benchmark-chance-decisions.mjs [matches] [uint32 seed]');
}
const plans = clubs.map(c => defaultPlan(c));
const makeTable = () => Object.fromEntries(['clear', 'screened'].map(k => [k, {shot: 0, pass: 0, carry: 0, widerPass: 0}]));
const decisions = makeTable();
const deliveries = makeTable();
for (let i = 1; i <= count; i++) {
  let seed = (base + Math.imul(i, 7919)) >>> 0;
  const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const g = startMatch(matchTeams(plans), rng);
  const firstDecision = new Set();
  const firstDelivery = new Set();
  let complete = false;
  while (!complete) {
    const key = geometryClass(g);
    const possession = g.possession;
    const logStart = g.actions.length;
    const eventStart = g.events.length;
    complete = advanceMatch(g, g.second + 0.001);
    if (!key) continue;
    const first = g.actions[logStart];
    const action = first?.type === 'duel' && first.outcome === 'escaped' ? g.actions[logStart + 1] : first;
    if (action?.possession !== possession || !['pass', 'carry', 'shot'].includes(action.type)) continue;
    if (action.type === 'shot' && g.events[eventStart]?.bodyPart !== 'foot') continue;
    const id = possession + '/' + key;
    if (!firstDecision.has(id)) {
      register(decisions, key, action);
      firstDecision.add(id);
    }
    if (action.type !== 'carry' && !firstDelivery.has(id)) {
      register(deliveries, key, action);
      firstDelivery.add(id);
    }
  }
}
console.log(count + ' balanced matches, base seed ' + base + ', step 7919.');
console.log('First eligible open-play action per possession and lane class (all Ballerz carries included)');
console.table(decisions);
console.log('First eligible pass or shot per possession and lane class (carries excluded)');
console.table(deliveries);
