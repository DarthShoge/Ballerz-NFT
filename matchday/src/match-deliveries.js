import { PITCH, attackingX } from './match-pitch.js';

const centre = PITCH.width / 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function crossType(start, end, side, delivery = 'mixed') {
  const depth = attackingX(start.x, side);
  const target = attackingX(end.x, side);
  const width = Math.abs(start.y - centre);
  if (depth < 73 || width < 15 || target < 79 || Math.abs(end.y - centre) > 16
      || Math.abs(end.y - start.y) < 12) return null;
  if (depth >= 93 && target < depth - 3) return 'cutback';
  if (delivery === 'low') return 'low-cross';
  if (delivery === 'floated') return 'high-cross';
  return Math.hypot(end.x - start.x, end.y - start.y) > 24 ? 'high-cross' : 'low-cross';
}

// Both sides use attacking depth for the calculation. The first boundary ends play.
export function ballExit(start, end, side) {
  const depth = attackingX(end.x, side);
  const startDepth = attackingX(start.x, side);
  const touchline = end.y < 0 ? 0 : end.y > PITCH.width ? PITCH.width : null;
  const touchlineTime = touchline === null ? Infinity : (touchline - start.y) / (end.y - start.y);
  const goalLineTime = depth > PITCH.length ? (PITCH.length - startDepth) / (depth - startDepth) : Infinity;

  if (touchlineTime < goalLineTime) {
    return {boundary: 'touchline', x: start.x + (end.x - start.x) * touchlineTime, y: touchline};
  }
  if (goalLineTime === Infinity) return null;
  const y = start.y + (end.y - start.y) * goalLineTime;
  if (Math.abs(y - centre) < PITCH.goalWidth / 2) return null;
  return {boundary: 'goal-line', x: attackingX(PITCH.length, side), y};
}

// Carry a heavy touch or an inaccurate delivery beyond its intended receiver.
// It can go out only when its path physically crosses a boundary.
export function misplayedBallExit(start, play, side, rng) {
  const dx = play.end.x - start.x;
  const dy = play.end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.1) return null;
  const extra = play.type === 'carry' ? 1.5 + rng() * 4 : 2 + rng() * (4 + distance * 0.30);
  const skew = (rng() * 2 - 1) * Math.min(7, 0.5 + distance * 0.15);
  const end = {x: play.end.x + (extra * dx - skew * dy) / distance,
    y: play.end.y + (extra * dy + skew * dx) / distance};
  const ownGoalLine = attackingX(end.x, side) < 0;
  const exit = ballExit(start, end, ownGoalLine ? 1 - side : side);
  return exit ? {...exit, ownGoalLine: ownGoalLine && exit.boundary === 'goal-line'} : null;
}

// A last-ditch touch can retain the ball's forward momentum. A controlled
// clearance usually sends it upfield. The projected path sets the restart.
export function defensiveExit(contact, incoming, side, behindChance, rng) {
  const depth = attackingX(contact.x, side);
  const flank = Math.abs(contact.y - centre) > 2 ? Math.sign(contact.y - centre)
    : Math.sign(incoming.y - centre) || 1;
  const angle = rng();
  const forward = angle < behindChance;
  const end = {
    x: attackingX(depth + (forward ? 11 + rng() * 27 : -8 - rng() * 17), side),
    y: contact.y + flank * (4 + rng() * (forward ? 21 : 31))
  };
  if (forward && Math.abs(contact.y - centre) < PITCH.goalWidth / 2 + 1) {
    // This path represents an attempt to redirect the ball away from goal.
    // Use the playable path outside the post or let the touch stay live.
    const distance = attackingX(end.x, side) - depth;
    const remaining = PITCH.length - depth;
    if (remaining <= 0.1) return null;
    end.y = centre + flank * Math.max(Math.abs(end.y - centre),
      Math.abs(contact.y - centre) + (PITCH.goalWidth / 2 + 0.25) * distance / remaining);
  }
  return ballExit(contact, end, side);
}

export function defendDelivery(play, carrier, side, rng) {
  const {interceptor, contact, risk} = play.lane;
  if (!interceptor || !contact) return null;
  const depth = attackingX(contact.x, side);
  const startDepth = attackingX(carrier.x, side);
  const width = Math.abs(contact.y - centre);
  const byline = play.cross || (startDepth >= 83 && Math.abs(carrier.y - centre) >= 15);
  const forced = depth >= 92 && risk >= 0.33 && width <= 18;
  if (depth < 84 || (!byline && !forced)) {
    // An outstretched foot redirects a contested ball towards the nearest
    // touchline. Use the actual point of contact and the incoming momentum.
    const room = PITCH.width / 2 - width;
    if (room > 21 || rng() >= 0.35 + risk * 0.46) return null;
    const incoming = Math.hypot(play.end.x - carrier.x, play.end.y - carrier.y);
    const flank = Math.sign(contact.y - centre);
    const clipped = {x: contact.x + (play.end.x - carrier.x) * 0.23,
      y: contact.y + flank * (3 + rng() * (12 + Math.min(18, incoming * 0.65)))};
    const exit = ballExit(contact, clipped, side);
    if (exit?.boundary !== 'touchline') return null;
    return {defender: interceptor, cause: play.type === 'carry' ? 'challenge' : 'deflected-pass', exit};
  }

  const keeperInAir = interceptor.position === 'GK' && play.airborne;
  if (keeperInAir && rng() < clamp(0.42 + (interceptor.attributes.handling - 13) * 0.03, 0.22, 0.74)) {
    return {defender: interceptor, cause: 'claimed-delivery', exit: null};
  }
  const cause = keeperInAir ? 'punched-delivery'
    : forced ? 'clearance' : play.cross ? 'deflected-cross' : play.type === 'carry' ? 'challenge' : 'deflected-pass';
  const behindChance = clamp(0.115 + (depth - 84) * 0.014 + (byline ? 0.13 : 0), 0, 0.50);
  return {defender: interceptor, cause, exit: defensiveExit(contact, play.end, side, behindChance, rng)};
}
