const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const radiansToDegrees = 180 / Math.PI;

export function shotDetails(geometry, pressure, bodyPart, situation, rushed = false) {
  const {distance, angle, visibleAngle, blockers, keeperCoverage} = geometry;
  return {distance, angle, visibleAngle, blockers, keeperCoverage, pressure, bodyPart, situation, rushed,
    unguardedGoal: geometry.unguardedGoal};
}

// A chip needs space behind a keeper coming towards the striker and time to
// get under the ball. Composure and touch govern whether the player tries it.
export function breakawayFinish(shooter, geometry, goalX, rng) {
  if (!geometry.keeper || geometry.unguardedGoal) return 'placed';
  const keeper = geometry.keeper;
  const offLine = Math.abs(goalX - keeper.x);
  const gap = Math.hypot(keeper.x - shooter.x, keeper.y - shooter.y);
  if (offLine < 4.5 || gap < 2 || gap > 12 || geometry.distance < 8) return 'placed';
  const skill = (shooter.attributes.composure + shooter.attributes.firstTouch) / 2;
  const confidence = 0.13 + (offLine - 4.5) * 0.045 + (skill - 12) * 0.025;
  return rng() < clamp(confidence, 0.05, 0.60) ? 'chip' : 'placed';
}

// A pre-shot estimate uses the snapshot before the execution rolls or the
// shooter's identity are known.
export function expectedGoals(chance) {
  if (chance.situation === 'penalty') return 0.76;
  const opening = chance.visibleAngle / Math.max(0.001, chance.angle);
  let logOdds = -1.35 - (chance.distance - 12) * 0.076 + (chance.angle - 0.47) * 1.75
    + (opening - 0.72) * 1.15 - chance.blockers * 0.20 - chance.pressure * 0.52;
  if (chance.bodyPart === 'head') logOdds -= 0.42;
  if (chance.situation === 'free-kick') logOdds -= 0.50;
  if (chance.rushed) logOdds -= 0.43;
  if (chance.unguardedGoal) logOdds += 1.15;
  return clamp(1 / (1 + Math.exp(-logOdds)), 0.006, 0.85);
}

function shotProbabilities(chance, finishing, composure, fatigue, handling, reaction) {
  const penalty = chance.situation === 'penalty';
  const block = penalty || !(chance.blockers || chance.intervention) ? 0 : clamp(chance.blockers * 0.12 + chance.pressure * 0.13
    + (1 - chance.visibleAngle / Math.max(0.001, chance.angle) - chance.keeperCoverage) * 0.19
    + (chance.intervention ?? 0), 0, 0.62);

  const onTarget = penalty
    ? clamp(0.91 + (composure - 13) * 0.008 - fatigue * 0.08, 0.65, 0.97)
    : clamp(0.56 - (chance.distance - 12) * 0.008 + (chance.angle - 0.47) * 0.13
      + (finishing - 13) * 0.021 + (composure - 13) * 0.009 - fatigue * 0.21
      - chance.pressure * 0.09 - (chance.bodyPart === 'head' ? 0.08 : 0)
      - (chance.rushed ? 0.10 : 0) - (chance.finish === 'chip' ? 0.09 : 0), 0.13, 0.89);
  const conversion = penalty
    ? clamp(0.82 + (composure - 13) * 0.020 - (reaction - 14) * 0.014, 0.42, 0.98)
    : clamp(0.457 - (chance.distance - 12) * 0.014 + (chance.angle - 0.47) * 0.47
      + (finishing - 14) * 0.022 + (composure - 13) * 0.009 - fatigue * 0.10
      - chance.keeperCoverage * 0.42 - (reaction + handling - 28) * 0.019
      - (chance.situation === 'free-kick' ? 0.07 : 0)
      - (chance.rushed ? 0.06 : 0) + (chance.finish === 'chip' ? 0.12 : 0)
      - (chance.bodyPart === 'head' ? 0.085 + chance.pressure * 0.055 : 0), 0.035, 0.96);
  return {block, onTarget, conversion: chance.unguardedGoal ? 1 : conversion};
}

export function resolveShotAttempt(chance, shooter, keeper, rng) {
  const finishing = chance.bodyPart === 'head'
    ? (shooter.attributes.finishing + (shooter.attributes.aerial ?? shooter.attributes.finishing)) / 2
    : shooter.attributes.finishing;
  const reaction = chance.distance < 12 ? keeper?.attributes.oneOnOnes : keeper?.attributes.reflexes;
  const {block, onTarget, conversion} = shotProbabilities(chance, finishing, shooter.attributes.composure,
    (100 - shooter.condition) / 100, keeper?.attributes.handling ?? 5, reaction ?? 5);
  const contact = rng(), placement = rng(), response = rng();
  if (contact < block) return {outcome: 'blocked'};
  // The placement roll supplies a position on the goal line, including wide attempts.
  if (placement >= onTarget) {
    const edge = Math.min(1, onTarget + 0.035);
    const wide = placement >= edge;
    const fraction = wide ? (placement - edge) / (1 - edge) : (placement - onTarget) / (edge - onTarget);
    const offset = (fraction < 0.5 ? -1 : 1) * (3.66 + (wide ? 0.65 + Math.abs(2 * fraction - 1) * 6 : 0));
    return {outcome: wide ? 'miss' : 'woodwork', offset};
  }
  return {outcome: response < conversion ? 'goal' : 'save', offset: (placement / onTarget * 2 - 1) * 3.45};
}

export function resolveShot(chance, shooter, keeper, rng) {
  return resolveShotAttempt(chance, shooter, keeper, rng).outcome;
}

export function reportShotGeometry(chance) {
  return {
    distance: Math.round(chance.distance * 10) / 10,
    goalAngle: Math.round(chance.angle * radiansToDegrees * 10) / 10,
    visibleAngle: Math.round(chance.visibleAngle * radiansToDegrees * 10) / 10
  };
}
