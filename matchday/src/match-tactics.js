export const neutralInstructions = {
  mentality: 'balanced', buildUp: 'mixed', tempo: 'normal', width: 'standard',
  finalThird: 'mixed', transition: 'balanced', pressing: 'standard', defensiveLine: 'standard',
  attackingFocus: 'mixed', crossing: 'mixed', distribution: 'mixed', afterLoss: 'balanced'
};

export const instructions = {
  attackingFocus: {
    mixed: {label: 'Use the whole pitch', description: 'Look for an opening in any lane.'},
    flanks: {label: 'Play down the flanks', description: 'Prefer passes that reach a wide outlet.'},
    central: {label: 'Play through the middle', description: 'Look for a receiver between the lines in the middle.'}
  },
  crossing: {
    mixed: {label: 'Mixed crosses', description: 'Choose the delivery from the angle and distance.'},
    low: {label: 'Low crosses', description: 'Drive deliveries along the ground for runners and cutbacks.'},
    floated: {label: 'Floated crosses', description: 'Lift crosses towards players who can win first contact.'}
  },
  distribution: {
    mixed: {label: 'Keeper decides', description: 'Let the goalkeeper choose an outlet using the usual passing plan.'},
    short: {label: 'Build from the back', description: 'The keeper looks for short outlets under the first press.'},
    long: {label: 'Go long', description: 'The keeper looks to reach teammates further upfield.'}
  },
  afterLoss: {
    balanced: {label: 'Keep the usual press', description: 'Use the normal pressing block after losing possession.'},
    regroup: {label: 'Regroup', description: 'Drop into a compact block in the first seconds after a turnover.'},
    counterpress: {label: 'Counter-press', description: 'Engage the new ball carrier immediately after a turnover.'}
  },
  mentality: {
    cautious: {label: 'Cautious', description: 'Keep supporting players behind the ball and favour safer passes.'},
    balanced: {label: 'Balanced', description: 'Balance forward support with cover behind the ball.'},
    attacking: {label: 'Attacking', description: 'Push support forward and accept more risk on progressive passes.'}
  },
  buildUp: {
    mixed: {label: 'Mixed passing', description: 'Switch between keeping the ball and playing forward.'},
    short: {label: 'Short passing', description: 'Prefer nearby support and work the ball forward in stages.'},
    direct: {label: 'Direct passing', description: 'Look early for runners beyond the opposition line.'}
  },
  tempo: {
    patient: {label: 'Patient', description: 'Take an extra touch before releasing the ball.'},
    normal: {label: 'Standard tempo', description: 'Use the time available to control the ball.'},
    quick: {label: 'Quick', description: 'Release the ball earlier, with less time to control it under pressure.'}
  },
  width: {
    narrow: {label: 'Narrow', description: 'Bring supporting players inside for closer passing options.'},
    standard: {label: 'Standard width', description: 'Use the natural width of the formation.'},
    wide: {label: 'Wide', description: 'Stretch supporting players towards the touchlines.'}
  },
  finalThird: {
    patient: {label: 'Work into the box', description: 'Pass up speculative shots while looking for a closer finish.'},
    mixed: {label: 'Player judgement', description: 'Let players weigh the opening and the pressure.'},
    early: {label: 'Shoot earlier', description: 'Take more shots from the edge of the area.'}
  },
  transition: {
    hold: {label: 'Hold shape', description: 'Look for a short outlet in the first seconds after winning the ball.'},
    balanced: {label: 'Read the break', description: 'Keep the usual passing approach after a regain.'},
    counter: {label: 'Counter quickly', description: 'Look for a forward runner before the defence can recover.'}
  },
  pressing: {
    standard: {label: 'Mid-block', description: 'Engage as opponents reach midfield.'},
    high: {label: 'High press', description: 'Close down early and make recoveries higher up the pitch.'},
    compact: {label: 'Low block', description: 'Protect the box and give runners space to break into.'}
  },
  defensiveLine: {
    deep: {label: 'Drop deeper', description: 'Defenders drop towards goal to protect the space behind them.'},
    standard: {label: 'Standard line', description: 'Keep the usual distance between the defensive lines.'},
    high: {label: 'Push higher', description: 'Move the back line up, leaving more room for opposition runners.'}
  }
};

export const tactics = {
  balanced: {...neutralInstructions, label: 'Balanced', description: 'Mixed passing and a mid-block.'},
  press: {...neutralInstructions, label: 'High press', description: 'Close down early after a backward pass or loose touch.', pressing: 'high'},
  counter: {...neutralInstructions, label: 'Counterattack', description: 'Direct passing from a low block, with a forward staying up as an outlet.', buildUp: 'direct', pressing: 'compact'},
  possession: {...neutralInstructions, label: 'Keep possession', description: 'Short, patient passing with close support. Work the ball into the box.', buildUp: 'short', width: 'narrow', tempo: 'patient', transition: 'hold', finalThird: 'patient'},
  chase: {...neutralInstructions, label: 'Chase a goal', description: 'Stretch the pitch, move the ball quickly and squeeze the opposition with a high line.', mentality: 'attacking', width: 'wide', tempo: 'quick', transition: 'counter', pressing: 'high', defensiveLine: 'high'},
  gegenpress: {...neutralInstructions, label: 'Gegenpress', description: 'Swarm the ball on loss, hold a high line and attack the regain quickly.', pressing: 'high', afterLoss: 'counterpress', defensiveLine: 'high', tempo: 'quick', transition: 'counter'},
  tiki: {...neutralInstructions, label: 'Tiki-taka', description: 'Use short central combinations, play out from the keeper and press after a loss.', buildUp: 'short', attackingFocus: 'central', distribution: 'short', finalThird: 'patient', afterLoss: 'counterpress', width: 'narrow'},
  vertical: {...neutralInstructions, label: 'Vertical possession', description: 'Build short from the keeper, then combine quickly through midfield.', buildUp: 'short', distribution: 'short', attackingFocus: 'central', transition: 'counter', tempo: 'quick'},
  wing: {...neutralInstructions, label: 'Wing play', description: 'Stretch opposing full-backs and lift crosses towards the forwards.', attackingFocus: 'flanks', width: 'wide', crossing: 'floated'},
  direct: {...neutralInstructions, label: 'Direct outlet', description: 'Bypass the press with long distribution and play quickly off a forward.', distribution: 'long', buildUp: 'direct', tempo: 'quick', transition: 'counter'},
  protect: {...neutralInstructions, label: 'Protect a lead', description: 'Regroup into a deep block and retain the ball after a regain.', mentality: 'cautious', pressing: 'compact', defensiveLine: 'deep', afterLoss: 'regroup', transition: 'hold', tempo: 'patient'}
};

export function instructionValues(plan, defaults = neutralInstructions) {
  return Object.fromEntries(Object.keys(instructions).map(key => [key, plan[key] ?? defaults[key]]));
}

export function instructionProblem(plan) {
  for (const [key, choices] of Object.entries(instructions)) {
    if (Object.hasOwn(plan, key) && (typeof plan[key] !== 'string' || !Object.hasOwn(choices, plan[key]))) {
      return 'Unknown tactical instruction for ' + key + '.';
    }
  }
  return null;
}

export const playerDuties = {hold: 'Hold position', support: 'Support', attack: 'Get further forward'};

export function dutyProblem(duties, players) {
  if (duties === undefined) return null;
  if (!duties || typeof duties !== 'object' || Array.isArray(duties)) return 'Choose player duties from the list.';
  for (const [id, duty] of Object.entries(duties)) {
    if (!players.some(p => p.id === id && p.position !== 'GK') || typeof duty !== 'string' || !Object.hasOwn(playerDuties, duty)) {
      return 'Choose a listed duty for an outfield player on the pitch.';
    }
  }
  return null;
}
