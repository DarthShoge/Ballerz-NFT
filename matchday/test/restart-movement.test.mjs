import assert from 'node:assert/strict';
import test from 'node:test';
import {clubs, defaultPlan, matchTeams} from '../src/football.js';
import {advanceMatch, checkpointMatch, pitchFrame, restoreMatch, startMatch} from '../src/match-engine.js';
import {attackingX} from '../src/match-pitch.js';
import {restartSpeed} from '../src/restart-shape.js';
import {sampleBall} from '../public/live-pitch.js';

const plans = clubs.map(club => defaultPlan(club));
const locations = {kickoff:[52.5,34], 'goal-kick':[5.5,34], 'throw-in':[66,0],
  'free-kick':[82,36], offside:[35,17], penalty:[94,34], corner:[105,0]};
const point = player => ({x:player.x, y:player.y});
const distance = (a,b) => Math.hypot(a.x - b.x, a.y - b.y);
function restartGame(kind, side = 0) {
  const g = startMatch(matchTeams(plans), () => 0.5);
  g.second = 320;
  if (kind === 'kickoff') {
    // A goal has just gone in, with most outfield players still upfield.
    for (const team of g.teams) for (const p of team.players) {
      if (p.position !== 'GK') p.x = attackingX(Math.min(99, attackingX(p.x, side) + 24), side);
    }
  }
  const [x,y] = locations[kind];
  g.restart = {kind, side, location:{x:attackingX(x, side), y:side ? 68-y : y}};
  return g;
}
function step(g) {
  const first = g.actions.length;
  advanceMatch(g, g.second + 0.01);
  return pitchFrame(g, 1, first);
}

test('all seven restart types move both sides in timed steps while the ball remains at the spot', () => {
  for (const kind of Object.keys(locations)) for (const side of [0,1]) {
    const g = restartGame(kind, side), spot = g.restart.location;
    const sidesMoving = [new Set(),new Set()];
    let lateMovement = false, readyAt;
    let last = pitchFrame(g,0), frames = 0;
    while (g.restart) {
      assert.ok(++frames < 40);
      const before = g.teams.map(t => t.players.map(point));
      const start = g.second;
      const frame = step(g);
      readyAt ??= g.restart?.setup?.readyAt;
      const moving = [0,0];
      for (const team of g.teams) team.players.forEach((p,i) => {
        const moved = distance(p,before[team.side][i]);
        assert.ok(moved <= restartSpeed(p) * (g.second-start) + 0.001, kind + ' ' + p.id);
        if (moved > 0.5) {
          sidesMoving[team.side].add(p.id);
          moving[team.side]++;
        }
      });
      if (g.second >= (320 + readyAt)/2 && moving.every(n => n > 0)) lateMovement = true;
      assert.equal(frame.restartSetup,kind);
      for (const t of [0,0.5,1]) assert.deepEqual(sampleBall(last,frame,t,320,9).at,spot);
      assert.equal(g.possessionTime[0]+g.possessionTime[1],0);
      last = frame;
    }
    assert.ok(sidesMoving.every(s => s.size >= 2), kind);
    assert.ok(lateMovement, kind + ' should still be organising in the second half of the wait');
    assert.equal(g.openingRestart,kind);
    assert.ok(distance(g.carrier,spot)<0.001);
    assert.equal(g.actions.length,1);
    for (const p of g.teams[1-side].players) {
      const gap = distance(p,spot), depth = attackingX(p.x,side);
      if (['offside','free-kick','corner','kickoff'].includes(kind)) assert.ok(gap >= 9.15-0.001,kind);
      if (kind === 'kickoff') assert.ok(depth >= 52.5);
      if (kind === 'throw-in') assert.ok(gap >= 2);
      if (kind === 'goal-kick') assert.ok(depth > 16.5 || Math.abs(p.y-34) > 20.16);
    }
    if (kind === 'penalty') {
      for (const team of g.teams) for (const p of team.players) {
        if (p === g.carrier) continue;
        if (team.side !== side && p.position === 'GK') assert.equal(attackingX(p.x,side),105);
        else {
          assert.ok(attackingX(p.x,side) <= 88.5 + 0.001);
          assert.ok(distance(p,spot) >= 9.15);
        }
      }
    }
  }
});

test('restoring a moving corner routine retains participants, timings and runs on delivery', () => {
  const g = restartGame('corner');
  step(g);
  const copy = restoreMatch(JSON.parse(JSON.stringify(checkpointMatch(g))), () => 0.5);
  for (const game of [g, copy]) {
    const team = game.teams[0];
    const outgoing = team.players.find(p => p.position === 'MF');
    const reserve = team.bench.find(p => p.position === 'MF');
    team.pendingSubstitution = {incomingId:reserve.id,outgoingId:outgoing.id};
    while (game.restart) step(game);
    assert.ok(team.pendingSubstitution);
    const before = game.teams.map(t => t.players.map(point));
    const routine = game.corner.routine;
    const frame = step(game);
    assert.ok(frame.motion.some(m => m.kind === 'cross'));
    assert.ok(game.teams.every(t => t.players.filter((p,i) => distance(p,before[t.side][i]) > 1).length >= 3));
    assert.ok(routine.routes.some(route => route.runTo && distance(route.receiver, route.runTo) < 0.1));
    assert.ok(team.pendingSubstitution);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(checkpointMatch(copy))), JSON.parse(JSON.stringify(checkpointMatch(g))));
});
