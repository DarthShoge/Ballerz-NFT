import {PITCH, advancePlayer, attackingX, runningSpeed} from './match-pitch.js';
import {isActive, closestPlayer, distanceBetween} from './match-decisions.js';
import {stageCorner} from './match-set-pieces.js';
import {slotLine} from './match-formations.js';

const middle = PITCH.width / 2;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function anchor(player, side, defending) {
  const x = (defending ? player.defensiveAnchorX : null) ?? player.anchorX ?? player.x;
  const y = (defending ? player.defensiveAnchorY : null) ?? player.anchorY ?? player.y;
  return {x: attackingX(x, side), y};
}

// Opponents retreat towards their own goal, including when the spot is near
// a touchline. If the goal line blocks that route, move sideways along it.
function retreat(target, spot, radius, side) {
  if (distanceBetween(target, spot) >= radius) return target;
  const lateral = target.y - spot.y;
  const step = Math.sqrt(Math.max(0, radius ** 2 - lateral ** 2));
  const x = attackingX(Math.max(0.3, attackingX(spot.x, side) - step), side);
  if (Math.abs(x - spot.x) >= step - 0.0001) return {x, y:target.y};
  const sideways = Math.sqrt(Math.max(0, radius ** 2 - (x - spot.x) ** 2));
  const sign = spot.y < sideways ? 1 : spot.y > PITCH.width - sideways ? -1 : Math.sign(lateral) || 1;
  return {x, y:spot.y + sign * sideways};
}

function restPosition(player, side, restart) {
  const {kind, location} = restart;
  const ownBall = side === restart.side;
  const home = anchor(player, side, !ownBall);
  const slot = ownBall ? player.slot : player.defensiveSlot ?? player.slot;
  const line = slotLine(slot) ?? player.position;
  const ballDepth = attackingX(location.x, side);
  const baseY = home.y - middle;
  let depth, y;
  if (kind === 'kickoff') {
    depth = Math.min(home.x, PITCH.length / 2 - 1);
    y = home.y;
  } else if (kind === 'penalty') {
    // Penalty participants wait behind the mark and outside the area and arc.
    const attackingDepth = ownBall ? clamp(38 + home.x * 0.82, 45, 87.5)
      : clamp(98 - home.x * 0.60, 62, 87.7);
    depth = ownBall ? attackingDepth : PITCH.length - attackingDepth;
    y = middle + baseY * 0.84;
    if (line === 'GK') {
      depth = ownBall ? 8 : 0;
      y = middle;
    } else if ((94 - attackingDepth) ** 2 + (y - middle) ** 2 < 9.3 ** 2) {
      const legal = 94 - Math.sqrt(9.3 ** 2 - (y - middle) ** 2);
      depth = ownBall ? legal : PITCH.length - legal;
    }
  } else if (line === 'GK') {
    depth = clamp(ballDepth * 0.12, 1.7, 12);
    y = middle + (location.y - middle) * 0.12;
  } else {
    const offset = (ownBall ? {DF:-22, MF:-2, FW:13} : {DF:-18, MF:-6, FW:8})[line] ?? 0;
    depth = 0.38 * home.x + 0.62 * (ballDepth + offset);
    y = middle + baseY * (ownBall ? 0.96 : 0.82) + (location.y - middle) * 0.21;
    if (kind === 'goal-kick' && !ownBall) depth = Math.min(depth, 87.6);
  }
  let target = {x:attackingX(clamp(depth, line === 'GK' ? 0 : 1, 104), side), y:clamp(y, 1, 67)};
  if (!ownBall && ['throw-in','offside','free-kick','kickoff'].includes(kind)) {
    target = retreat(target, location, kind === 'throw-in' ? 2.2 : 9.3, side);
  }
  return target;
}

export function planRestart(teams, restart) {
  const {kind, side, location} = restart;
  const [ours, theirs] = [teams[side], teams[1-side]].map(team => team.players.filter(isActive));
  const outfield = ours.filter(p => p.position !== 'GK');
  const targets = {};
  for (const team of teams) {
    for (const player of team.players.filter(isActive)) targets[player.id] = restPosition(player, team.side, restart);
  }
  let taker = (kind === 'goal-kick' && ours.find(p => p.position === 'GK'))
    || closestPlayer(outfield, location) || ours[0];
  let routine;
  if (kind === 'corner') {
    const place = (p, point) => { targets[p.id] = point; };
    routine = stageCorner(teams[side], teams[1-side], side, location, place);
    taker = routine.taker;
  } else if (kind === 'throw-in') {
    const options = outfield.filter(p => p !== taker).sort((a,b) => distanceBetween(a,location) - distanceBetween(b,location));
    const depth = attackingX(location.x, side), flank = location.y === 0 ? 1 : -1;
    for (const [i, player] of options.slice(0,2).entries()) {
      targets[player.id] = {x:attackingX(clamp(depth + (i ? -7 : 8), 2,103), side), y:location.y + flank * (i ? 9 : 5)};
    }
  } else if (kind === 'free-kick') {
    const goal = {x:attackingX(105,side), y:middle};
    const range = distanceBetween(location, goal);
    if (range >= 10 && range <= 32) {
      const dx = (goal.x - location.x)/range, dy = (goal.y-location.y)/range;
      const wall = theirs.filter(p => p.position !== 'GK').sort((a,b) => distanceBetween(a,location) - distanceBetween(b,location)).slice(0,3);
      for (const [i, p] of wall.entries()) {
        const across = (i - (wall.length - 1)/2) * 0.95;
        targets[p.id] = {x:clamp(location.x + 9.35*dx - across*dy, 0,105), y:clamp(location.y + 9.35*dy + across*dx, 0,68)};
      }
    }
  }
  targets[taker.id] = {...location};
  return {targets, taker, routine};
}

// Players start moving together but arrive independently. Both the settled
// shape and the approach to it are authoritative server positions.
export const restartSpeed = player => runningSpeed(player) * 0.77;
export function timeRestartRuns(teams, targets, taker, now, duration) {
  for (const team of teams) for (const player of team.players.filter(isActive)) {
    const dest = targets[player.id];
    const distance = distanceBetween(player, dest);
    const line = slotLine(player.slot) ?? player.position;
    // Keepers set first. Some defenders organise early, others pick up the
    // later runs. A nearby receiver can check into space just before the kick.
    const arrival = player === taker ? 0.82 : line === 'GK' ? 0.52 :
      ({DF:0.70, MF:0.81, FW:0.86}[line] ?? 0.8) + ((player.slotIndex ?? 0) % 4) * 0.038;
    const available = duration * Math.min(0.98, arrival);
    dest.pace = Math.min(restartSpeed(player), Math.max(0.9, distance / available));
    dest.departAt = now + Math.max(0, available - distance / dest.pace);
  }
}

export function approachRestart(teams, targets, seconds, now) {
  for (const team of teams) {
    for (const player of team.players) {
      if (!isActive(player)) continue;
      const dest = targets[player.id];
      if (!dest) continue;
      const travel = clamp(now + seconds - (dest.departAt ?? now), 0, seconds);
      advancePlayer(player, dest, travel, dest.pace ?? restartSpeed(player));
    }
  }
}
