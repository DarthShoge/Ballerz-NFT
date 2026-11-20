import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sampleBall} from '../public/live-pitch.js';
import {clubs, defaultPlan, matchTeams} from '../src/football.js';
import {advanceMatch, pitchFrame, startMatch} from '../src/match-engine.js';
import {advanceLiveFixture, startLiveFixture} from '../src/live-fixture.js';

const plans = clubs.map(club => defaultPlan(club));
const halfWidth = 68 / 2;

test('the live shot visits its recorded impact before any rebound or restart', () => {
  let seed = 7919;
  const rng = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const outcomes = new Set();
  for (let match = 0; match < 12 && outcomes.size < 5; match++) {
    const game = startMatch(matchTeams(plans), rng);
    let previous = pitchFrame(game, 0);
    advanceMatch(game, Infinity, {onAction(current, first) {
      const frame = pitchFrame(current, previous.seq + 1, first);
      const shot = frame.motion.find(move => move.kind === 'shot');
      if (shot) {
        const source = current.actions.slice(first).find(move => move.type === 'shot');
        assert.deepEqual(shot.end, source.to);
        assert.equal(shot.outcome, source.outcome);
        assert.equal(sampleBall(previous, frame, 0.04, 520, 9).label, 'SHOT');
        assert.deepEqual(sampleBall(previous, frame, 1, 520, 9).impact, shot.end);
        if (shot.outcome === 'goal' || shot.outcome === 'miss') {
          assert.ok(shot.side === 'home' ? shot.end.x > 105 : shot.end.x < 0);
          assert.equal(Math.abs(shot.end.y - halfWidth) < 3.66, shot.outcome === 'goal');
          assert.deepEqual(frame.ball, shot.end);
        }
        if (shot.outcome === 'woodwork') assert.ok(Math.abs(Math.abs(shot.end.y - halfWidth) - 3.66) <= 0.051);
        outcomes.add(shot.outcome);
      }
      if (frame.motion[0]?.kind === 'restart') {
        assert.deepEqual(sampleBall(previous, frame, 0.25, 800, 9).at, previous.ball);
        assert.deepEqual(sampleBall(previous, frame, 1, 800, 9).at, frame.ball);
      }
      previous = frame;
    }});
  }
  assert.deepEqual(outcomes, new Set(['blocked', 'goal', 'save', 'miss', 'woodwork']));
});

test('a lofted clearance reaches the landing spot after the cross, without discarding either flight', () => {
  const corner = {x: 105, y: 0};
  const contact = {x: 99, y: 30};
  const recovery = {x: 82, y: 38};
  const from = {ball: corner};
  const to = {ball: recovery, motion: [
    {kind: 'cross', start: corner, end: contact, duration: 4, lofted: true},
    {kind: 'clearance', start: contact, end: recovery, duration: 2},
    {kind: 'recovery', start: recovery, end: recovery, duration: 0}
  ]};
  assert.ok(sampleBall(from, to, 0.41, 666, 9).lift > 1);
  assert.deepEqual(sampleBall(from, to, 0.65, 666, 9).at, contact);
  assert.equal(sampleBall(from, to, 0.86, 666, 9).kind, 'clearance');
  assert.deepEqual(sampleBall(from, to, 1, 666, 9).at, recovery);
  const legacy = {ball: recovery};
  assert.deepEqual(sampleBall(from, legacy, 0.5, 320, 9).at, {x: 93.5, y: 19});
});

test('an 18-metre shot flies faster than the same-length pass at the live clock speed', () => {
  const start = {x: 80, y: 34}, end = {x: 98, y: 34};
  function observed(kind, frameMs, lofted) {
    const from = {ball: start}, to = {ball: end, motion: [{kind, start, end, duration: 3.2, outcome: 'save', lofted}]};
    const samples = Array.from({length: frameMs}, (_, ms) => sampleBall(from, to, ms / frameMs, frameMs, 9));
    return {flight: samples.filter(sample => sample.flying).length, labels: samples.map(sample => sample.label),
      maxLift: Math.max(...samples.map(sample => sample.lift))};
  }
  const shot = observed('shot', 520, false), pass = observed('pass', 320, false), cross = observed('cross', 320, true);
  assert.ok(Math.abs(shot.flight - 18 / 22 * 1000 / 9) < 2);
  assert.ok(Math.abs(pass.flight - 18 / 12 * 1000 / 9) < 2);
  assert.ok(Math.abs(cross.flight - 18 / 17 * 1000 / 9) < 2);
  assert.ok(shot.labels.filter(label => label === 'SAVED').length > 300);
  assert.ok(cross.maxLift > shot.maxLift && shot.maxLift > pass.maxLift);
});

test('test fast-forward cuts to the new position and resumes a consecutive stream', () => {
  const state = {plans, matchSeed: 2958};
  startLiveFixture(state, 0);
  advanceLiveFixture(state, 5_000, {fastForward: true});
  const [destination] = state.live.frames;
  assert.equal(state.live.frames.length, 1);
  assert.equal(destination.cut, true);
  assert.ok(destination.second >= 600);
  advanceLiveFixture(state, 9_000);
  assert.equal(state.live.frames[1].seq, destination.seq + 1);
  assert.ok(state.live.frames.slice(1).every(frame => !frame.cut));
});

test('carrier highlight follows release, ball flight, and the actual receiver after an interception', () => {
  const start = {x:35,y:24}, end = {x:54,y:32};
  const from = {ball:start, carrierId:'passer'};
  const pass = {kind:'pass', start, end, duration:4, outcome:'intercepted', playerId:'passer', contactId:'defender'};
  const to = {ball:end, carrierId:'defender', motion:[pass]};
  const samples = Array.from({length:101}, (_, i) => sampleBall(from, to, i/100, 450, 9));
  assert.equal(samples[0].carrierId, 'passer');
  const flight = samples.filter(s => s.flying);
  assert.ok(flight.length);
  assert.ok(flight.every(s => s.carrierId === null));
  assert.equal(samples.at(-1).carrierId, 'defender');
  assert.equal(sampleBall(from, {...to, carrierId:null}, 1, 450, 9).carrierId, null);
});
