import { attackingX } from './match-pitch.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function judgeChallenge(carrier, defender, side, penaltyArea, rng) {
  const attributes = defender.attributes;
  const fatigue = 1 - defender.condition / 100;
  const fromBehind = attackingX(carrier.x, side) - attackingX(defender.x, side) > 1.1;
  const technique = (attributes.tackling - 13) * 0.012 + (attributes.decisions - 13) * 0.008;
  // Players are more reluctant to risk an illegal challenge inside their own area.
  const foulChance = penaltyArea
    ? clamp(0.056 + fatigue * 0.06 + (fromBehind ? 0.020 : 0) - technique * 0.45, 0.018, 0.10)
    : clamp(0.455 + fatigue * 0.16 + (fromBehind ? 0.092 : 0) - technique, 0.22, 0.64);

  const restraint = defender.cautions ? clamp((attributes.decisions - 5) * 0.025, 0.08, 0.33) : 0;
  const tackle = defender.instructions?.tackling;
  // More committed tackles risk mistiming contact. A legal attempt is still
  // resolved from tackling, decisions, condition and the dribbler's skill.
  const contactRisk = tackle === 'harder' ? 1.13 : tackle === 'easier' ? 0.85 : 1;
  const infringement = foulChance * (1 - restraint) * contactRisk;
  const contest = rng();
  if (contest >= infringement) {
    const fairWin = clamp(0.53 + technique * 1.6 - (carrier.attributes.dribbling - 13) * 0.025
      - fatigue * 0.20 - (fromBehind ? 0.09 : 0), 0.20, 0.72);
    return {kind: contest < infringement + (1 - infringement) * fairWin ? 'won' : 'escaped'};
  }

  const severity = rng();
  const redChance = 0.002 + (fromBehind ? 0.003 : 0) + fatigue * 0.003;
  const cautionChance = clamp(0.088 + (fromBehind ? 0.065 : 0) + fatigue * 0.12 - technique * 0.42, 0.045, 0.31);
  const card = severity < redChance ? 'red' : severity < redChance + cautionChance ? 'yellow' : null;
  return {kind: 'foul', card, reason: card === 'red' ? 'excessive-force' : card === 'yellow' ? 'reckless' : 'careless'};
}
