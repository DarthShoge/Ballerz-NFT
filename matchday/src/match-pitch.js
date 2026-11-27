import {roleEffects} from './match-roles.js';
import {slotLine} from './match-formations.js';

export const PITCH = Object.freeze({length: 105, width: 68, goalWidth: 7.32});

const centre = PITCH.width / 2;
const startingDepths = {GK: 6, DF: 24, MF: 41, FW: 65};
const shapeWidths = {DF: 50, MF: 54, FW: 46};
const attackingOffsets = {DF: -22, MF: -2, FW: 13};
const defendingOffsets = {DF: -17, MF: -4, FW: 7};
const pressShapes = {
  high: {depth: 88, reach: 16.5, advance: 3, width: 0.86},
  standard: {depth: 64, reach: 15, advance: 0, width: 0.79},
  compact: {depth: 43, reach: 10, advance: -7, width: 0.68}
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function attackingX(x, side) {
  return side === 0 ? x : PITCH.length - x;
}

export function fieldPosition({x, y}) {
  return {x: clamp(x, 0, PITCH.length), y: clamp(y, 0, PITCH.width)};
}

export function offsideLine(ball, side, opponents) {
  let last = -Infinity, secondLast = -Infinity;
  for (const player of opponents) {
    if (player.dismissed || player.replaced || player.injured) continue;
    const depth = attackingX(player.x, side);
    if (depth >= last) {
      secondLast = last;
      last = depth;
    } else if (depth > secondLast) {
      secondLast = depth;
    }
  }
  return Math.max(PITCH.length / 2, attackingX(ball.x, side), secondLast);
}

function channelRunner(attack, carrierId, ball, side, line) {
  let runner = null;
  let best = -Infinity;
  for (const player of attack.players) {
    const run = roleEffects(player, true).run ?? 0;
    if (((slotLine(player.slot) ?? player.position) !== 'FW' && run < 4) || run < 0 || player.duty === 'hold' || player.id === carrierId || player.dismissed || player.replaced || player.injured) continue;
    const gap = line - attackingX(player.x, side);
    if (gap < -1 || gap > 15 || Math.abs(player.y - ball.y) > 26) continue;
    const score = player.attributes.offBall + player.attributes.pace * 0.35 - gap * 0.65 + run;
    if (score > best) {
      best = score;
      runner = player;
    }
  }
  return runner;
}

// Is an outfield opponent already in position to cover the run to goal?
// Project onto the striker's path, including cover just behind the ball.
export function clearRunAtGoal(ball, side, opponents) {
  const depth = attackingX(ball.x, side);
  const remaining = PITCH.length - depth;
  const across = centre - ball.y;
  const distance = Math.hypot(remaining, across);
  if (distance < 0.1 || distance > 30 || Math.abs(across) > 13 || remaining < Math.abs(across) * 0.5) return false;
  return !opponents.some(player => {
    if (player.position === 'GK' || player.dismissed || player.replaced || player.injured) return false;
    const dx = attackingX(player.x, side) - depth;
    const dy = player.y - ball.y;
    const along = (dx * remaining + dy * across) / distance;
    const lateral = Math.abs(dx * across - dy * remaining) / distance;
    // A centre-back on the striker's shoulder or covering from a few metres
    // to the side can meet them before they get a shot away.
    return along > -2.2 && along < distance && lateral < 4.8 + Math.max(0, along) * 0.3;
  });
}

export function setPlayerPositions(teams) {
  for (const [side, team] of teams.entries()) {
    for (const position of Object.keys(startingDepths)) {
      const line = team.players.filter(player => player.position === position);
      const width = position === 'FW' && line.length === 2 ? 22 : shapeWidths[position];
      for (const [index, player] of line.entries()) {
        if (player.dismissed) continue;
        const slot = line.length === 1 ? 0 : index / (line.length - 1) - 0.5;
        const stagger = position === 'DF' ? 6 * Math.abs(slot) : 0;
        const depth = startingDepths[position] + stagger;
        player.anchorX ??= attackingX(depth, side);
        player.anchorY ??= centre + slot * (width ?? 0);
        player.x = attackingX(Math.min(attackingX(player.anchorX, side), PITCH.length / 2 - 1), side);
        player.y = player.anchorY;
      }
    }
  }
}

export function runningSpeed(player) {
  const pace = clamp(player.attributes.pace, 1, 20);
  const condition = clamp(player.condition ?? 100, 0, 100) / 100;
  return (3.8 + 3.4 * (pace - 1) / 19) * (0.64 + 0.36 * condition);
}

export function counterOutlet(team) {
  const teamCounter = team.pressing === 'compact' && team.buildUp === 'direct';
  let outlet = null;
  let best = -Infinity;
  for (const player of team.players) {
    if (player.dismissed || player.injured || player.replaced) continue;
    const role = roleEffects(player, false);
    const defaultForward = teamCounter && (slotLine(player.defensiveSlot ?? player.slot) ?? player.position) === 'FW'
      && role.press === undefined && role.depth === undefined;
    if (!role.outlet && !defaultForward) continue;
    const suitability = player.attributes.pace + player.attributes.offBall + (role.outlet ? 40 : 0);
    if (suitability > best) {
      outlet = player;
      best = suitability;
    }
  }
  return outlet;
}

function pressingPlayer(players, ball, reach, preferred, outlet, assignments, carrierId) {
  let selected = null;
  let bestTime = Infinity;
  for (const player of players) {
    if (player.dismissed || player.injured || player.replaced || player.position === 'GK' || player === outlet) continue;
    const role = roleEffects(player, false);
    const assignment = assignments.get(player);
    if (assignment ? assignment.id !== carrierId : role.outlet) continue;
    const trigger = player.instructions?.pressing;
    const frequency = trigger === 'more' ? 1.32 : trigger === 'less' ? 0.70 : 1;
    const willingness = (role.press ?? 1) * frequency;
    const distance = Math.hypot(player.x - ball.x, player.y - ball.y);
    if (distance > reach * willingness * (0.72 + 0.28 * (player.condition ?? 100) / 100)) continue;
    const position = slotLine(player.defensiveSlot ?? player.slot) ?? player.position;
    const cover = preferred && position !== preferred ? 0.8 : 0;
    const arrival = distance / (runningSpeed(player) * willingness) + (20 - player.attributes.workRate) * 0.045 + cover;
    if (arrival < bestTime) {
      selected = player;
      bestTime = arrival;
    }
  }
  return selected;
}

// Pick receivers using their actual locations at the beginning of the move.
// Matching the cheapest pairs first avoids sending two trackers after one run.
function defensiveAssignments(defenders, opponents, side, ball, carrierId, presser, outlet, assignments) {
  const pairs = [];
  const jobs = new Map();
  const taken = new Set();
  for (const [player, target] of assignments) {
    const tight = player.instructions?.marking === 'tighter';
    jobs.set(player, {kind:'mark', id:target.id, depth:attackingX(target.x, side) - (tight ? 1.5 : 2.4),
      y:target.y + (centre - target.y) * (tight ? 0.025 : 0.05)});
    taken.add(target.id);
  }
  const ballDepth = attackingX(ball.x, side);
  for (const player of defenders) {
    if (jobs.has(player) || player === presser || player.dismissed || player.injured || player.replaced) continue;
    const role = roleEffects(player, false);
    const tight = player.instructions?.marking === 'tighter' && player.position !== 'GK' && !role.outlet;
    if (!role.mark && !role.screen && !tight) continue;
    if (player === outlet || (role.dropIntoLine && ballDepth < 50) || canCover(player, role, presser, ball)) continue;
    const homeY = player.defensiveAnchorY ?? player.anchorY;
    const wide = role.mark === 'flank' || role.mark === 'channel';
    const zonal = !role.mark && !role.screen;
    const position = slotLine(player.defensiveSlot ?? player.slot) ?? player.position;
    const lineDepth = 0.35 * attackingX(player.defensiveAnchorX ?? player.anchorX, side)
      + 0.65 * (ballDepth + defendingOffsets[position]);
    const laneY = centre + (homeY - centre) * 0.79 + (ball.y - centre) * 0.28;
    for (const target of opponents) {
      if (target.id === carrierId || target.position === 'GK' || target.injured || target.replaced || target.dismissed) continue;
      const depth = attackingX(target.x, side);
      const depthGap = ballDepth - depth;
      // Close a receiver threatening this shirt's own zone. Without a
      // tracking role a defender does not chase sideways circulation all game.
      if (zonal && (depthGap < 4 || depthGap > 22 || Math.abs(depth - lineDepth) > 6
          || Math.abs(target.y - laneY) > 8 || ballDepth > 67)) continue;
      if (role.screen && (depthGap < 5 || depthGap > 35 || Math.abs(target.y - centre) > 22)) continue;
      if (wide && ((target.y - centre) * (homeY - centre) <= 0 || Math.abs(target.y - centre) < 7)) continue;
      if (role.mark === 'pivot' && (slotLine(target.slot) ?? target.position) !== 'MF') continue;
      const distance = Math.hypot(player.x - target.x, player.y - target.y);
      // A shirt with a tight-marking instruction picks up a local receiver.
      // A specialist tracker can follow a run beyond that initial zone.
      const reach = role.screen ? 25 : role.mark ? 22 : 11;
      if (distance > reach || Math.abs(target.y - homeY) > (wide ? 19 : 25)) continue;
      const retained = target.id === player.defensiveTargetId ? (tight ? 4 : 2.5) : 0;
      const cost = distance + Math.abs(target.y - homeY) * 0.32 - retained;
      const kind = role.screen ? 'screen' : 'mark';
      pairs.push({player, target, cost, kind});
    }
  }
  pairs.sort((a,b) => a.cost - b.cost);
  for (const {player, target, kind} of pairs) {
    if (jobs.has(player) || taken.has(target.id)) continue;
    const depth = attackingX(target.x, side);
    const tight = player.instructions?.marking === 'tighter';
    const laneFraction = tight ? 0.16 : 0.30;
    const targetDepth = kind === 'mark' ? depth - (tight ? 1.5 : 2.4) : depth + (ballDepth - depth) * laneFraction;
    const y = kind === 'mark' ? target.y + (centre - target.y) * (tight ? 0.025 : 0.05) : target.y + (ball.y - target.y) * laneFraction;
    jobs.set(player, {kind, id: target.id, depth: targetDepth, y});
    taken.add(target.id);
  }
  return jobs;
}

function canCover(player, role, presser, ball) {
  if (!role.cover || !presser || presser === player) return false;
  const homeY = player.defensiveAnchorY ?? player.anchorY;
  const distance = Math.hypot(player.x - ball.x, player.y - ball.y);
  return distance <= 34 && Math.abs(homeY - ball.y) <= 28 && (role.cover !== 'flank' || Math.abs(ball.y - centre) >= 10);
}

function coveringPosition(player, role, presser, side, ball, baseDepth) {
  if (!canCover(player, role, presser, ball)) return null;
  // Protect the path to goal on the inside of the challenge. The centre-back
  // stays deeper than a midfielder doubling up with the full-back.
  const depth = attackingX(ball.x, side);
  const gap = role.cover === 'flank' ? 4.5 : 8;
  return {kind: 'cover', id: presser.id, depth: Math.min(baseDepth + 5, depth - gap),
    y: ball.y + (centre - ball.y) * (role.cover === 'flank' ? 0.22 : 0.34)};
}

export function advancePlayer(player, target, seconds, speed) {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return;
  const step = Math.min(1, seconds * speed / distance);
  player.x += dx * step;
  player.y += dy * step;
}

export function movePlayers(teams, {ball, pressTarget = ball, possessionSide, carrierId, seconds, pressTriggered = false, recentLoss = false, openPlay = true}) {
  if (seconds <= 0) return;
  const attackDepth = attackingX(ball.x, possessionSide);
  // As a forward delivery travels into midfield, one striker runs beyond the
  // line. The next passer may find them onside, late, or already tracked.
  const forwardDelivery = attackDepth - attackingX(pressTarget.x, possessionSide);
  const line = offsideLine(ball, possessionSide, teams[1 - possessionSide].players);
  const runner = forwardDelivery >= 3 && attackDepth > 43 && attackDepth < 76
    ? channelRunner(teams[possessionSide], carrierId, ball, possessionSide, line) : null;
  // Both teams read the same snapshot, whichever end they attack.
  const defence = teams[1 - possessionSide];
  const tracksReceivers = defence.players.some(p => {
    const role = roleEffects(p, false);
    return (openPlay && p.markingTarget) || role.mark || role.screen || p.instructions?.marking === 'tighter';
  });
  const runners = tracksReceivers ? teams[possessionSide].players
    .filter(p => !p.dismissed && !p.injured && !p.replaced)
    .map(({id, position, slot, x, y}) => ({id, position, slot, x, y})) : [];
  const assignments = new Map();
  for (const player of defence.players) {
    const choice = player.markingTarget;
    if (!openPlay || !choice || player.position === 'GK' || player.dismissed || player.injured || player.replaced) continue;
    const target = runners.find(p => p.position !== 'GK' && (choice.kind === 'player' ? p.id === choice.id : p.slot === choice.slot));
    if (target) assignments.set(player, target);
  }
  for (const [side, team] of teams.entries()) {
    const inPossession = side === possessionSide;
    const react = !inPossession && recentLoss ? team.afterLoss : null;
    const pressing = react === 'regroup' ? 'compact' : react === 'counterpress' ? 'high' : team.pressing;
    const shape = pressShapes[pressing];
    const ballDepth = attackingX(ball.x, side);
    const high = pressing === 'high';
    const trigger = high && (pressTriggered || react === 'counterpress');
    const outlet = !inPossession && ballDepth < 48 ? counterOutlet(team) : null;
    const preferred = !high ? null : ballDepth < 27 ? 'DF' : ballDepth < 58 ? 'MF' : 'FW';
    const presser = !inPossession && ballDepth <= shape.depth
      ? pressingPlayer(team.players, pressTarget, shape.reach + (trigger ? 5.5 : 0), preferred, assignments.has(outlet) ? null : outlet, assignments, carrierId)
      : null;
    const jobs = !inPossession && runners.length ? defensiveAssignments(team.players, runners, side, ball, carrierId, presser, outlet, assignments) : null;
    const backLine = !inPossession && team.players.some(p => roleEffects(p, false).dropIntoLine)
      ? team.players.filter(p => !p.dismissed && !p.replaced && !p.injured && p !== presser && (slotLine(p.defensiveSlot ?? p.slot) ?? p.position) === 'DF')
        .map(({x}) => attackingX(x, side)).sort((a,b) => a-b) : [];
    for (const player of team.players) {
      player.defensiveTask = inPossession ? null : 'block';
      player.defensiveTargetId = null;
      if (player.id === carrierId || player.dismissed || player.injured || player.replaced) continue;
      const slot = inPossession ? player.slot : player.defensiveSlot ?? player.slot;
      const position = slotLine(slot) ?? player.position;
      const anchorX = (!inPossession ? player.defensiveAnchorX : null) ?? player.anchorX;
      const anchorY = (!inPossession ? player.defensiveAnchorY : null) ?? player.anchorY;
      const role = roleEffects(player, inPossession);
      let depth;
      let width;
      let speed = runningSpeed(player) * 0.58;
      if (position === 'GK') {
        depth = inPossession ? 5 + 0.07 * ballDepth : clamp(0.18 * ballDepth, 1.8, 11);
        depth += (role.depth ?? 0) + (role.sweep ?? 0) * Math.max(0, ballDepth - 8);
        width = centre + (ball.y - centre) * (inPossession ? 0.13 : 0.22);
        if (!inPossession && clearRunAtGoal(ball, possessionSide, team.players)) {
          // Come down the line between ball and goal to narrow the angle.
          depth = clamp(ballDepth * 0.46, 1.2, 9);
          width = centre + (ball.y - centre) * depth / Math.max(1, ballDepth);
          speed = runningSpeed(player);
        }
      } else if (!inPossession && !assignments.has(player) && (player === outlet || role.outlet) && ballDepth < 48) {
        player.defensiveTask = 'outlet';
        depth = Math.max(50, ballDepth + 10);
        width = anchorY + (ball.y - centre) * 0.10;
        const flank = Math.sign(anchorY - centre) || Math.sign(player.y - centre) || (side ? 1 : -1);
        if (role.outlet === 'wide') width = centre + flank * 27;
        if (role.outlet === 'inside') width = centre + flank * 7;
        if (role.outlet === 'central') width = centre + (anchorY - centre) * 0.22;
        if (role.outlet === 'split') width = centre + flank * 19;
      } else if (player === presser) {
        player.defensiveTask = 'press';
        player.defensiveTargetId = carrierId;
        // One player engages. The others cover the passing lanes behind them.
        const dx = player.x - pressTarget.x;
        const dy = player.y - pressTarget.y;
        const gap = Math.hypot(dx, dy);
        if (gap <= 1.35) continue;
        depth = attackingX(pressTarget.x + dx * 1.35 / gap, side);
        width = pressTarget.y + dy * 1.35 / gap;
        speed = runningSpeed(player);
      } else {
        const origin = attackingX(anchorX, side);
        const lateral = anchorY - centre;
        if (inPossession) {
          const run = (player.attributes.offBall - 12) * (position === 'DF' ? 0.22 : 0.65);
          depth = 0.35 * origin + 0.65 * (ballDepth + attackingOffsets[position] + run);
          // Wide midfielders push up as an outlet when the attack gets into the final third.
          if (position === 'MF' && Math.abs(lateral) > 20) depth += clamp((ballDepth - 63) * 0.56, 0, 14);
          const spread = team.width === 'wide' ? 1.24 : team.width === 'narrow' ? 0.72 : 1;
          width = centre + lateral * spread + (ball.y - centre) * 0.18;
          depth += team.mentality === 'attacking' ? 4 : team.mentality === 'cautious' ? -4 : 0;
          if (player === runner) {
            depth = Math.min(94, line + 1.8);
            speed = runningSpeed(player) * 0.90;
          }
          if (position === 'FW' && ballDepth >= 66 && Math.abs(ball.y - centre) > 12) {
            // Split the two runs when a wide teammate has the ball: the near
            // runner attacks the delivery while the far runner holds a square option.
            const near = (ball.y - centre) * lateral >= 0;
            const run = clamp((ballDepth - 66) / 22, 0, 1);
            const post = centre + Math.sign(ball.y - centre) * (near ? 5 : -7);
            width += (post - width) * run;
            depth += (near ? 4 : 1) * run;
          }
          if (player.duty === 'hold') depth = Math.min(depth - 4, origin + Math.max(0, ballDepth - 52.5) * 0.35);
          if (player.duty === 'attack') depth += position === 'DF' ? 10 : 6;
          // Inversion, overlaps and late runs develop as possession travels upfield.
          const progression = clamp((ballDepth - 18) / 52, 0, 1);
          depth += (role.depth ?? 0) + progression * (role.advance ?? 0);
          // An attacking role can initiate the run earlier. The defensive line
          // still determines where a runner aims when timing the release.
          if (player === runner) depth = Math.min(depth, line + 1.8);
          const flank = Math.sign(lateral) || Math.sign(ball.y - centre) || (side === 0 ? -1 : 1);
          width += progression * ((role.flank ?? 0) * flank - lateral * (role.narrow ?? 0));
          if (role.attackFarPost && ballDepth > 74 && (ball.y - centre) * lateral < 0 && Math.abs(ball.y - centre) > 12) {
            const farPost = centre + flank * 4;
            width += (farPost - width) * role.attackFarPost * clamp((ballDepth - 74) / 18, 0, 1);
          }
          width += (ball.y - width) * (role.roam ?? 0);
        } else {
          depth = 0.35 * origin + 0.65 * (ballDepth + defendingOffsets[position]) + shape.advance + (trigger ? 2.5 : 0);
          const lineShift = team.defensiveLine === 'high' ? 6 : team.defensiveLine === 'deep' ? -6 : 0;
          depth += lineShift * (position === 'DF' ? 1 : 0.5);
          width = centre + lateral * shape.width + (ball.y - centre) * 0.28;
          if (position === 'DF' && ballDepth < 40) {
            const cover = clamp((40 - ballDepth) / 24, 0, 1);
            // Tuck the line towards goal as the opposition enters the box.
            depth -= cover * 1.8;
            width += (centre + lateral * 0.64 + (ball.y - centre) * 0.22 - width) * cover;
          }
          depth += role.depth ?? 0;
          width += (ball.y - centre) * (role.followBall ?? 0) - lateral * (role.narrow ?? 0);
          if (role.dropIntoLine && backLine.length) {
            const danger = clamp((67 - ballDepth) / 27, 0, 1);
            depth += (backLine[Math.floor((backLine.length - 1) / 2)] - depth) * danger;
            width += (centre + lateral * 0.45 - width) * danger;
          }
          const job = jobs?.get(player) ?? coveringPosition(player, role, presser, side, ball, depth);
          if (job) {
            player.defensiveTask = job.kind;
            player.defensiveTargetId = job.id;
            depth = job.depth;
            width = job.y;
            speed = runningSpeed(player) * 0.82;
          }
        }
      }
      const target = {x: attackingX(clamp(depth, 1, PITCH.length - 1), side),
        y: clamp(width, 2, PITCH.width - 2)};
      advancePlayer(player, target, seconds, speed);
    }
  }
}

export function passLane(start, end, opponents, speed = 16) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const time = length / speed;
  if (length === 0) return {risk: 0, interceptor: null, time};
  const directionX = dx / length;
  const directionY = dy / length;
  let risk = 0;
  let interceptor = null;
  let contact = null;

  for (const player of opponents) {
    if (player.dismissed) continue;
    const defenderSpeed = runningSpeed(player);
    const reach = player.position === 'GK' ? 1.35 : 0.8;
    const reaction = 0.14 + (20 - player.attributes.positioning) * 0.024;
    const relativeX = player.x - start.x;
    const relativeY = player.y - start.y;
    const along = relativeX * directionX + relativeY * directionY;
    const across = Math.abs(relativeX * directionY - relativeY * directionX);
    if (across > time * defenderSpeed + reach) continue;

    // The best meeting point lies beyond the closest point when the ball outruns
    // the defender. Its offset comes from the arrival-time difference along the lane.
    const offset = speed > defenderSpeed
      ? across * defenderSpeed / Math.sqrt(speed * speed - defenderSpeed * defenderSpeed)
      : length;
    const crossing = clamp(along + offset, length * 0.08, length);
    const separation = Math.hypot(across, crossing - along);
    const arrival = reaction + Math.max(0, separation - reach) / defenderSpeed;
    const exposure = clamp(0.25 + (crossing / speed - arrival) * 0.69, 0, 0.97);
    if (exposure > risk) {
      risk = exposure;
      interceptor = player;
      contact = {x: start.x + crossing * directionX, y: start.y + crossing * directionY};
    }
  }
  return {risk, interceptor, time, contact};
}

function combinedAngle(intervals) {
  intervals.sort((left, right) => left.start - right.start);
  let total = 0;
  let coveredEnd = -Infinity;
  for (const interval of intervals) {
    total += Math.max(0, interval.end - Math.max(interval.start, coveredEnd));
    coveredEnd = Math.max(coveredEnd, interval.end);
  }
  return total;
}

export function shotGeometry(start, side, opponents) {
  const shooterDepth = attackingX(start.x, side);
  const goalDepth = Math.max(0, PITCH.length - shooterDepth);
  const halfGoal = PITCH.goalWidth / 2;
  const upper = Math.atan2(centre + halfGoal - start.y, goalDepth);
  const lower = Math.atan2(centre - halfGoal - start.y, goalDepth);
  const angle = upper - lower;
  const distance = Math.hypot(goalDepth, centre - start.y);
  const intervals = [];
  let keeper = null;
  let keeperCoverage = 0;
  let blockers = 0;
  let blocker = null;
  let largestBlock = 0;

  for (const player of opponents) {
    if (player.dismissed) continue;
    const isKeeper = player.position === 'GK';
    if (isKeeper) keeper = player;
    const depth = attackingX(player.x, side) - shooterDepth;
    if (depth <= 0 || depth > goalDepth) continue;
    const lateral = player.y - start.y;
    const radius = isKeeper ? 1.05 : 0.72;
    const direction = Math.atan2(lateral, depth);
    const scope = Math.asin(Math.min(1, radius / Math.hypot(depth, lateral)));
    const startAngle = Math.max(lower, direction - scope);
    const endAngle = Math.min(upper, direction + scope);
    const blocked = endAngle - startAngle;
    if (blocked <= 0) continue;
    intervals.push({start: startAngle, end: endAngle});
    if (isKeeper) {
      keeperCoverage = blocked / angle;
    } else {
      blockers++;
      if (blocked > largestBlock) {
        blocker = player;
        largestBlock = blocked;
      }
    }
  }
  const visibleAngle = clamp(angle - combinedAngle(intervals), 0, angle);
  // Even the longest trajectory in the goal cone is too fast to chase from
  // behind. In front, allow a dive and movement throughout the entire flight
  // before ruling out a save on *every* on-target placement.
  let unguardedGoal = !keeper;
  if (keeper) {
    const ahead = attackingX(keeper.x, side) - shooterDepth;
    const fraction = clamp(ahead / Math.max(0.01, goalDepth), 0, 1);
    const coneCentre = start.y + (centre - start.y) * fraction;
    const lateralGap = Math.max(0, Math.abs(keeper.y - coneCentre) - halfGoal * fraction);
    const steepest = Math.atan2(Math.abs(centre - start.y) + halfGoal, goalDepth);
    const flightLimit = Math.hypot(goalDepth, Math.abs(centre - start.y) + halfGoal) / 18;
    unguardedGoal = ahead < -2.5 || lateralGap * Math.cos(steepest) > 2.5 + 6.5 * flightLimit;
  }
  return {distance, angle, visibleAngle, blockers, keeper, keeperCoverage, blocker, unguardedGoal};
}
