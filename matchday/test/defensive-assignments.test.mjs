import test from 'node:test';
import assert from 'node:assert/strict';
import {clubs} from '../src/football.js';
import {movePlayers} from '../src/match-pitch.js';
import {roleOptions} from '../src/role-selection.js';
import {formationSlots} from '../src/match-formations.js';

// Input distances are from the defending side's own goal and left touchline.
function situation(side) {
  const teams = [0,1].map(() => ({players:[], pressing:'standard', buildUp:'mixed'}));
  const point = (depth, width) => side ? {x:105-depth, y:68-width} : {x:depth, y:width};
  function add(team, number, slot, depth, width, role) {
    const position = point(depth, width);
    const p = {...clubs[team].squad.find(p => p.number === number), slot, ...position,
      anchorX:position.x, anchorY:position.y, condition:100, roles:{outOfPossession:role}};
    teams[team].players.push(p);
    return p;
  }
  return {defender:(...args) => add(side,...args), attacker:(...args) => add(1-side,...args),
    step:ball => movePlayers(teams, {ball:{x:ball.x,y:ball.y}, carrierId:ball.id, possessionSide:1-side, seconds:10}),
    depth:p=>side ? 105-p.x : p.x, width:p=>side ? 68-p.y : p.y};
}

test('trackers get goal-side of separate living runners and the screening midfielder cuts the pass', () => {
  for (const side of [0,1]) {
    const s = situation(side);
    const carrier = s.attacker(8,'CM',52,26);
    const wide = s.attacker(2,'RB',38,9);
    const nextWide = s.attacker(7,'RW',35,14);
    const inside = s.attacker(10,'AM',37,35);
    const absent = s.attacker(18,'RM',40,12);
    absent.injured = true;
    const tracker = s.defender(7,'LW',43,8,'tracking-winger');
    const second = s.defender(11,'LM',41,17,'tracking-winger');
    const screen = s.defender(6,'DM',38,34,'screening-midfielder');
    s.defender(8,'CM',51,26,'pressing-midfielder');
    s.step(carrier);
    assert.deepEqual([tracker.defensiveTask,second.defensiveTask,screen.defensiveTask], ['mark','mark','screen']);
    assert.deepEqual(new Set([tracker.defensiveTargetId,second.defensiveTargetId]), new Set([wide.id,nextWide.id]));
    // Every target moves concurrently. These checks use the initial positions seen by both teams.
    assert.ok(s.depth(tracker) < 38);
    assert.ok(s.depth(second) < 38);
    assert.equal(screen.defensiveTargetId, inside.id);
    assert.ok(s.depth(screen) > 37 && s.depth(screen) < 52);
    assert.ok(s.width(screen) > 26 && s.width(screen) < 35);
  }
});

test('a wide centre-back protects the route inside a pressing wing-back and a dropping midfielder joins the back line', () => {
  for (const side of [0,1]) {
    const s = situation(side);
    const carrier = s.attacker(7,'RW',35,9);
    const cover = s.defender(4,'LCB',26,19,'covering-wide-centre-back');
    const stopper = s.defender(2,'LWB',37,10,'pressing-wing-back');
    const pivot = s.defender(6,'DM',34,32,'dropping-defensive-midfielder');
    s.defender(5,'RCB',24,42);
    s.step(carrier);
    assert.equal(stopper.defensiveTask, 'press');
    assert.equal(stopper.defensiveTargetId, carrier.id);
    assert.equal(cover.defensiveTask, 'cover');
    assert.equal(cover.defensiveTargetId, stopper.id);
    assert.ok(s.depth(cover) <= 28 && s.width(cover) > 12 && s.width(cover) < 22);
    assert.ok(Math.abs(s.depth(pivot)-24) < 1);
  }
  const choices = shape => roleOptions[shape][formationSlots[shape].indexOf('LCB')].outOfPossession;
  assert.ok(choices('3-5-2').some(r => r.id === 'covering-wide-centre-back'));
  assert.ok(!choices('4-4-2').some(r => r.id === 'covering-wide-centre-back'));
});

test('central, splitting, wide and inside outlets occupy distinct receiving lanes when defending deep', () => {
  for (const side of [0,1]) {
    function lane(role, slot, startY) {
      const s = situation(side);
      const carrier = s.attacker(6,'CM',24,28);
      const forward = s.defender(9,slot,55,startY,role);
      s.step(carrier);
      assert.equal(forward.defensiveTask,'outlet');
      return Math.abs(s.width(forward) - 34);
    }
    assert.ok(lane('splitting-outlet-centre-forward','LS',25) > lane('central-outlet','LS',25) + 12);
    assert.ok(lane('wide-outlet','LW',10) > lane('inverting-outlet-winger','LW',10) + 15);
  }
});
