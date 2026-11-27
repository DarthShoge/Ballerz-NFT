import assert from 'node:assert/strict';
import test from 'node:test';
import {clubs, defaultPlan} from '../src/football.js';
import {orderTouchline, startLiveFixture} from '../src/live-fixture.js';

test('a live swap changes both phase slots without teleporting, and is safe to retry', () => {
  const state = {matchSeed: 123, plans: clubs.map(club => defaultPlan(club))};
  startLiveFixture(state, 0);
  const players = () => state.live.checkpoint.teams[0].players;
  const [keeper, first, second] = structuredClone(players());
  const order = {kind: 'swap-positions', firstId: first.id, secondId: second.id,
    firstDestination: second.slot, secondDestination: first.slot};
  assert.equal(orderTouchline(state.live, 0, order), null);
  const [, moved, other] = structuredClone(players());
  assert.deepEqual([moved.x, moved.y, moved.slot, moved.defensiveSlot, moved.anchorX, moved.slotIndex],
    [first.x, first.y, second.slot, second.defensiveSlot, second.anchorX, second.slotIndex]);
  assert.equal(other.slot, first.slot);
  const after = structuredClone(state.live.checkpoint);
  assert.equal(orderTouchline(state.live, 0, order), null);
  for (const invalid of [{firstId:keeper.id}, {firstId:'absent'}, {secondId:first.id}, {secondDestination:'invalid'}]) {
    assert.ok(orderTouchline(state.live, 0, {...order, ...invalid}));
  }
  assert.deepEqual(state.live.checkpoint, after);
});
