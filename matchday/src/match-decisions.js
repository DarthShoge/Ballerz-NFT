import { PITCH, attackingX, clearRunAtGoal, counterOutlet, fieldPosition, offsideLine, passLane, runningSpeed, shotGeometry } from './match-pitch.js';
import { crossType } from './match-deliveries.js';
import { expectedGoals, shotDetails } from './match-shot.js';
import {roleEffects} from './match-roles.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const decisionStyles = {
  short: {progress: 0.34, length: 0.0115, risk: 0.69},
  mixed: {progress: 0.43, length: 0.008, risk: 0.59},
  direct: {progress: 0.57, length: 0.0065, risk: 0.55}
};

export const isActive = player => !player.dismissed && !player.replaced && !player.injured;

export function closestPlayer(players, point, accepts = isActive) {
  let closest = null;
  let smallest = Infinity;
  for (const player of players) {
    if (!accepts(player)) continue;
    const distance = (player.x - point.x) ** 2 + (player.y - point.y) ** 2;
    if (distance < smallest) {
      closest = player;
      smallest = distance;
    }
  }
  return closest;
}

export function goalArea(point, side) {
  return attackingX(point.x, side) >= PITCH.length - 16.5 && Math.abs(point.y - PITCH.width / 2) <= 20.16;
}

function finishOrAdvance(carrier, opponents, geometry, pressure, side) {
  const shot = {type: 'shot', geometry, pressure, bodyPart: 'foot', oneOnOne: Boolean(geometry.keeper)};
  const keeperGap = geometry.keeper ? distanceBetween(carrier, geometry.keeper) : Infinity;
  const shootDistance = 14 + (carrier.attributes.finishing - 12) * 0.28;
  if (geometry.distance <= shootDistance || keeperGap <= 6.5) return shot;

  const goal = {x: attackingX(PITCH.length, side), y: PITCH.width / 2};
  const stride = Math.min(geometry.distance - 10, runningSpeed(carrier) * 1.35);
  const end = {x: carrier.x + (goal.x - carrier.x) * stride / geometry.distance,
    y: carrier.y + (goal.y - carrier.y) * stride / geometry.distance};
  const lane = passLane(carrier, end, opponents, runningSpeed(carrier));
  if (lane.risk > 0.5) return shot;
  const control = clamp(0.975 - lane.risk * 0.44 - pressure * 0.08
    + (carrier.attributes.dribbling - 13) * 0.007, 0.60, 0.99);
  return {type: 'carry', end, lane, control};
}

function betterSquareBall(carrier, attack, opponents, context, geometry) {
  const {side, pressure} = context;
  const current = expectedGoals(shotDetails(geometry, pressure, 'foot', 'open-play'));
  // Only give up the clear run for a teammate with a materially better finish.
  let best = null;
  let bestValue = current + 0.06 + (20 - carrier.attributes.vision) * 0.003;
  for (const player of attack.players) {
    if (player === carrier || !isActive(player) || player.position === 'GK'
      || !goalArea(player, side) || Math.abs(player.y - PITCH.width / 2) > 10) continue;
    const pass = passOption(carrier, player, opponents, context, false);
    if (!pass || pass.offside || pass.control < 0.67) continue;
    const nearest = closestPlayer(opponents, player);
    const pressureAtTarget = nearest ? clamp(1 - distanceBetween(nearest, player) / 11, 0, 1) : 0;
    const chance = shotDetails(shotGeometry(player, side, opponents), pressureAtTarget, 'foot', 'open-play');
    const value = expectedGoals(chance) * pass.control - 0.012 * pass.lane.time;
    if (value > bestValue) {
      best = pass;
      bestValue = value;
    }
  }
  return best;
}

function passOption(carrier, recipient, opponents, context, leading, emergency = false) {
  const {side, style, pressure, chainLength, restart, lastPass, outlet, shootingValue = 0} = context;
  const direction = side === 0 ? 1 : -1;
  const shift = leading ? 4 + (recipient.attributes.offBall - 10) * 0.3 : 0;
  const end = fieldPosition({x: recipient.x + direction * shift, y: recipient.y});
  const length = distanceBetween(carrier, end);
  if (!emergency && (length < 2.5 || length > 61)) return null;

  const progress = (end.x - carrier.x) * direction;
  const lateral = Math.abs(end.y - carrier.y);
  const cross = restart ? null : crossType(carrier, end, side, context.crossing);
  const airborne = cross ? cross === 'high-cross' : length > 32;
  const speed = airborne ? 18.5 : 14 + carrier.attributes.passing * 0.23;
  const lane = passLane(carrier, end, opponents, speed);
  const lengthPenalty = Math.max(0, length - 17) * 0.003 + Math.max(0, length - 36) * 0.004;
  const deliverySkill = cross ? carrier.attributes.crossing ?? carrier.attributes.passing : carrier.attributes.passing;
  const reception = cross === 'high-cross' ? recipient.attributes.aerial ?? recipient.attributes.firstTouch : recipient.attributes.firstTouch;
  const ability = (deliverySkill - 13) * 0.010 + (reception - 13) * 0.009;
  const fatigue = (100 - carrier.condition) * 0.0011 + (100 - recipient.condition) * 0.0005;
  // The receiver is judged at the kick. Space ahead can be reached after the ball is played.
  const margin = attackingX(recipient.x, side) - context.offsideLine;
  const offside = !['throw-in', 'goal-kick', 'corner'].includes(restart) && margin > 0;
  // A passer can misread a marginal run, particularly when pressed. An
  // obviously offside receiver remains a poor choice.
  const judgement = 0.9 + pressure * 1.4 + (20 - carrier.attributes.vision) * 0.10;
  const offsidePenalty = offside ? 0.68 * clamp(margin / judgement, 0, 1) : 0;
  const laneRisk = lane.risk * (airborne ? 0.35 : 0.53);
  const control = clamp(0.982 - lengthPenalty + ability - fatigue - pressure * 0.038 - laneRisk
    - (leading ? 0.055 : 0) - (cross ? 0.10 : 0) - (context.quickRelease && !restart ? pressure * 0.025 : 0), 0.16, 0.993);
  const fromDepth = attackingX(carrier.x, side);
  const crossed = player => player.position !== 'GK' &&
    attackingX(player.x, side) > fromDepth + 2 && attackingX(player.x, side) < fromDepth + progress - 2;
  const breaksLine = fromDepth >= 35 && progress >= 14 && opponents.some(player => crossed(player) &&
    Math.abs(player.y - end.y) < 17 && opponents.some(teammate => teammate !== player &&
      teammate.position === player.position && crossed(teammate) && Math.abs(teammate.x - player.x) <= 5));
  const adaptedProgress = clamp(progress / 25, -0.85, 1.25);
  const ambition = style.progress + context.riskAppetite + Math.min(0.11, chainLength * 0.012);
  const repetition = recipient === lastPass?.player ? 0.13 : 0;
  const keeperPenalty = recipient.position === 'GK' ? 0.36 : 0;
  const outletValue = recipient === outlet && progress >= 14 && lane.risk < 0.42 ? 0.12 : 0;
  const deliveryValue = cross ? 0.22 + clamp((attackingX(end.x, side) - 84) * 0.012, -0.06, 0.15)
    + (deliverySkill - 13) * 0.012 + (cross === 'cutback' ? 0.17 : 0) : 0;
  const wider = Math.max(0, Math.abs(end.y - PITCH.width / 2) - Math.abs(carrier.y - PITCH.width / 2));
  const marker = closestPlayer(opponents, end);
  const space = marker ? distanceBetween(marker, end) : 15;
  // Reward a receiver who will have time to turn, particularly when the
  // passer needs a way out of a press. Limit the reward for safe circulation.
  const roomToReceive = clamp((space - 5) / 10, -0.6, 1) * (0.055 + pressure * 0.11);
  const receiverRole = roleEffects(recipient, true);
  const passerRole = context.carrierRole;
  const rolePreference = (passerRole.shortPass ?? 0) * clamp((26 - length) / 18, -1, 1)
    + (passerRole.direct ?? 0) * clamp(progress / 28, -1, 1.5)
    + (leading || breaksLine ? (passerRole.through ?? 0) : 0)
    + (cross ? (passerRole.cross ?? 0) : 0)
    + (leading ? 0 : receiverRole.attract ?? 0)
    + (airborne ? receiverRole.aerialTarget ?? 0 : 0)
    + (passerRole.safeExit ?? 0) * (pressure * clamp(progress / 30, -1, 1) - lane.risk - (leading ? 0.45 : 0));
  const widthFraction = Math.abs(end.y - PITCH.width / 2) / (PITCH.width / 2);
  const focus = context.attackingFocus === 'flanks' ? 0.21 * widthFraction
    : context.attackingFocus === 'central' ? 0.21 * (1 - widthFraction) : 0;
  const distribution = carrier.position !== 'GK' ? 0 : context.distribution === 'long' ? 0.35 * clamp(progress / 36, 0, 1)
    : context.distribution === 'short' ? 0.35 * clamp(1 - length / 33, -1, 1) : 0;
  const utility = 0.55 + focus + distribution + adaptedProgress * ambition + lateral * 0.0017 + outletValue - length * style.length
    - (1 - control) * style.risk - repetition - keeperPenalty - offsidePenalty
    + (leading ? (carrier.attributes.vision - 14) * 0.010 : 0) + deliveryValue
    - shootingValue * Math.min(2.4, wider / 7) + roomToReceive + rolePreference;
  return {type: 'pass', recipient, end, airborne, cross, length, control, lane, breaksLine, offside, utility,
    ...(offside ? {offsideLine: context.offsideLine} : {})};
}

export function choosePlay(carrier, attack, opponents, state, rng) {
  const {side, chainLength, restart, lastPass, recovery} = state;
  const nearest = closestPlayer(opponents, carrier);
  const separation = nearest ? distanceBetween(nearest, carrier) : Infinity;
  const pressure = Math.max(recovery?.pressure ?? 0, clamp(1 - separation / 11, 0, 1));
  const location = attackingX(carrier.x, side);
  const direction = side === 0 ? 1 : -1;
  const goalkeeper = carrier.position === 'GK';
  const carrierRole = roleEffects(carrier, true);
  const transition = state.recentRegain ? attack.transition : null;
  const style = transition === 'counter' ? decisionStyles.direct : transition === 'hold' ? decisionStyles.short : decisionStyles[attack.buildUp];
  const riskAppetite = attack.mentality === 'attacking' ? 0.14 : attack.mentality === 'cautious' ? -0.14 : 0;
  const outlet = state.countering ? counterOutlet(attack) : null;
  const passingContext = {side, style, pressure, chainLength, restart, lastPass, outlet, carrierRole,
    attackingFocus: attack.attackingFocus, distribution: attack.distribution, crossing: attack.crossing,
    offsideLine: offsideLine(carrier, side, opponents), riskAppetite, quickRelease: attack.tempo === 'quick'};
  const decisionNoise = 0.31 - carrier.attributes.decisions * 0.008;

  if ((!restart || restart === 'free-kick') && !goalkeeper && location > 70) {
    const geometry = shotGeometry(carrier, side, opponents);
    const {distance, angle, visibleAngle} = geometry;
    if (!restart && !state.fromCorner && clearRunAtGoal(carrier, side, opponents)) {
      return betterSquareBall(carrier, attack, opponents, passingContext, geometry)
        ?? finishOrAdvance(carrier, opponents, geometry, pressure, side);
    }
    const firstCornerContact = lastPass?.cornerRoute && lastPass.airborne && distance <= 22;
    const rushed = Boolean(recovery && distance <= 29 && angle >= 0.17 && visibleAngle >= 0.028);
    const base = firstCornerContact ? 0.54 : rushed ? 0.66 : 0.034;
    const value = expectedGoals(shotDetails(geometry, pressure, 'foot', restart ?? 'open-play'));
    passingContext.shootingValue = value;
    // In the box the carrier can finish first time through a visible part
    // of the goal. From further out it pays to look for another runner.
    const centralFinish = clamp((19.5 - distance) / 4, 0, 1)
      * clamp((15 - Math.abs(carrier.y - PITCH.width / 2)) / 5, 0, 1);
    const opening = visibleAngle / Math.max(angle, 0.001);
    const longRange = clamp((distance - 17) / 8, 0, 1);
    const shotPreference = attack.finalThird === 'early' ? 0.10 : attack.finalThird === 'patient' ? -0.09 : 0;
    const selection = state.fromCorner || restart ? 0 : (value - 0.07) * 0.88
      + centralFinish * (0.09 + 0.28 * opening + (carrierRole.finish ?? 0)) + longRange * (shotPreference - 0.085);
    const chance = clamp(base + (28 - distance) * 0.0075 + angle * 0.065 + visibleAngle * 0.032
      + (carrier.attributes.finishing - 13) * 0.005 - pressure * 0.052 + selection, 0.003, rushed ? 0.79 : firstCornerContact ? 0.70 : 0.87);
    if (angle > 0.025 && rng() < chance * (restart === 'free-kick' ? 1.40 : 1)) {
      const header = firstCornerContact ? rng() < 0.83 : lastPass?.airborne && distance < 19 && rng() < 0.53;
      return {type: 'shot', geometry, pressure, bodyPart: header ? 'head' : 'foot', rushed};
    }
  }

  let best = null;
  let bestScore = -Infinity;
  const consider = option => {
    if (!option) return;
    const score = option.utility + rng() * decisionNoise;
    if (score > bestScore) {
      best = option;
      bestScore = score;
    }
  };
  for (const recipient of attack.players) {
    if (recipient === carrier || !isActive(recipient)) continue;
    consider(passOption(carrier, recipient, opponents, passingContext, false));
    const leadingRange = recipient === outlet ? 52 : 38;
    if (!restart && recipient.position !== 'GK' && attackingX(recipient.x, side) > location + 6
        && distanceBetween(carrier, recipient) < leadingRange) {
      consider(passOption(carrier, recipient, opponents, passingContext, true));
    }
  }
  const carryOpening = 0.32 + (carrier.attributes.dribbling - 12) * 0.024 + pressure * 0.07 + (carrierRole.carry ?? 0);
  if (!restart && !goalkeeper && location < PITCH.length - 5 && rng() < carryOpening) {
    const path = 4 + carrier.attributes.pace * 0.22;
    const lateral = nearest && Math.abs(nearest.y - carrier.y) < 5 ? (nearest.y < carrier.y ? 2.5 : -2.5) : 0;
    const end = {x: attackingX(Math.min(location + path, PITCH.length - 1.2), side),
      y: clamp(carrier.y + lateral + Math.sign(PITCH.width / 2 - carrier.y) * Math.min(Math.abs(PITCH.width / 2 - carrier.y), carrierRole.cutInside ?? 0), 1.2, PITCH.width - 1.2)};
    const lane = passLane(carrier, end, opponents, 5 + carrier.attributes.pace * 0.12);
    const control = clamp(0.95 + (carrier.attributes.dribbling - 12) * 0.013 - lane.risk * 0.60
      - pressure * 0.13 - (100 - carrier.condition) * 0.0018, 0.18, 0.98);
    const wideRun = location >= 72 && Math.abs(carrier.y - PITCH.width / 2) >= 16 ? 0.13 : 0;
    consider({type: 'carry', end, lane, control, utility: 0.23 + (location > 58 ? 0.055 : 0)
      + (control - 0.68) * 0.76 + (carrier.attributes.dribbling - 12) * 0.012 - pressure * 0.08 + wideRun + (carrierRole.carry ?? 0)});
  }
  if (best) return best;
  // If normal passing range is exhausted, clear towards an actual teammate.
  const outletPlayer = closestPlayer(attack.players, carrier, p => p !== carrier && isActive(p));
  return outletPlayer ? passOption(carrier, outletPlayer, opponents, passingContext, false, true)
    : {type: 'clearance', pressure};
}
