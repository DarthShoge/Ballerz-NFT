import test from 'node:test';
import assert from 'node:assert/strict';
import {clubs, defaultPlan, matchTeams, validatePlan} from '../src/football.js';
import {formationSlots} from '../src/match-formations.js';
import {tacticalPreview} from '../src/tactical-preview.js';
import {advanceMatch, checkpointMatch, liveMatchReport, restoreMatch, startMatch} from '../src/match-engine.js';

test('the eight additional attacking jobs are selectable in the correct formation slots', () => {
  const jobs = [
    ['3-5-2','LWB','advanced-wing-back'], ['4-3-3 DM','DM','box-to-box-playmaker'],
    ['4-4-2','LB','inside-full-back'], ['4-3-3','CM','midfield-playmaker'],
    ['4-4-2','RCB','no-nonsense-centre-back'], ['4-3-3','LCM','wide-central-midfielder'],
    ['3-5-2','LCB','wide-centre-back'], ['4-3-3','LW','wide-forward']
  ];
  for (const [shape, slot, role] of jobs) {
    const plan = defaultPlan(clubs[0], shape);
    const id = plan.xi[formationSlots[shape].indexOf(slot)];
    plan.playerRoles = {[id]: {inPossession:role}};
    assert.equal(validatePlan(clubs[0], plan), null, role);
    const team = matchTeams([plan, defaultPlan(clubs[1])])[0];
    assert.equal(team.players.find(p => p.id === id).roles.inPossession, role);
  }
  const four = defaultPlan(clubs[0]);
  assert.ok(validatePlan(clubs[0], {...four, playerRoles:{[four.xi[2]]:{inPossession:'wide-centre-back'}}}));
});

test('an inside full-back stays behind an inside wing-back, and a wide centre-back stays behind an overlapping one', () => {
  function watch(shape, slot, role) {
    const plan = defaultPlan(clubs[0], shape);
    const id = plan.xi[formationSlots[shape].indexOf(slot)];
    plan.playerRoles = {[id]:{inPossession:role}};
    return tacticalPreview({side:0, phase:'inPossession', zone:'attack', plan}).players.find(p => p.id === id);
  }
  const inside = watch('4-4-2','LB','inside-full-back');
  const advancing = watch('4-4-2','LB','inside-wing-back');
  assert.ok(inside.x + 7 < advancing.x);
  assert.ok(inside.y > watch('4-4-2','LB','full-back').y + 8);
  const wide = watch('3-5-2','LCB','wide-centre-back');
  assert.ok(wide.x + 8 < watch('3-5-2','LCB','overlapping-centre-back').x);
  assert.ok(wide.y < watch('3-5-2','LCB','centre-back').y - 4);
});

test('live defensive jobs survive a checkpoint and clear when possession turns over', () => {
  const plans = clubs.map(c => defaultPlan(c));
  plans[0].playerRoles = {[plans[0].xi[5]]:{outOfPossession:'tracking-winger'}};
  let seed = 99175;
  const rng = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
  const game = startMatch(matchTeams(plans), rng);
  let displayed = false, cleared = false;
  for (let i = 0; i < 300 && !(displayed && cleared); i++) {
    const oldPossession = game.possession;
    advanceMatch(game, game.second + 0.01);
    const report = liveMatchReport(game);
    if (game.side === undefined) continue;
    assert.ok(report.teams[game.side].players.every(p => !p.defensiveJob));
    const defenders = report.teams[1 - game.side].players;
    if (game.possession !== oldPossession) {
      if (displayed && game.lastMovementPossession !== game.possession) {
        assert.ok(defenders.every(p => !p.defensiveJob));
        cleared = true;
      }
    } else if (defenders.some(p => p.defensiveJob?.label === 'Pressing')) {
      displayed = true;
      const restored = restoreMatch(JSON.parse(JSON.stringify(checkpointMatch(game))));
      assert.deepEqual(liveMatchReport(restored).teams, report.teams);
    }
  }
  assert.ok(displayed && cleared);
});
