export const individualInstructions = {
  marking: {
    standard: {label: 'Standard marking', description: 'Use the marking distance and responsibilities of the defensive role.'},
    tighter: {label: 'Mark tighter', description: 'Stay closer to an available receiver when defending your area.'}
  },
  pressing: {
    standard: {label: 'Standard pressing', description: 'Follow the role and the team’s pressing plan.'},
    more: {label: 'Press more often', description: 'Leave your position to engage the carrier more readily within the team block.'},
    less: {label: 'Press less often', description: 'Hold your position longer and leave more of the pressing to teammates.'}
  },
  tackling: {
    standard: {label: 'Standard tackling', description: 'Judge the challenge with the usual balance of risk and restraint.'},
    harder: {label: 'Tackle harder', description: 'Commit to more challenges and accept a greater risk of conceding a foul.'},
    easier: {label: 'Ease off tackles', description: 'Be more selective about challenges and avoid risky contact.'}
  }
};

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function individualInstructionProblem(assignments, players) {
  if (assignments === undefined) return null;
  if (!record(assignments)) return 'Choose individual instructions from the list.';
  for (const [id, choices] of Object.entries(assignments)) {
    if (!players.some(p => p.id === id && p.position !== 'GK')) return 'Choose an outfield player on the pitch.';
    if (!record(choices) || !Object.keys(choices).length) return 'Select an instruction for this player.';
    for (const [key, value] of Object.entries(choices)) {
      if (!Object.hasOwn(individualInstructions, key) || typeof value !== 'string' || !Object.hasOwn(individualInstructions[key], value)) {
        return 'Choose a listed individual marking, pressing or tackling instruction.';
      }
    }
  }
  return null;
}

// A live edit may reset one instruction while leaving the other two in force.
export function individualValues(previous, edits) {
  const values = {...previous, ...edits};
  return Object.fromEntries(Object.keys(individualInstructions).filter(key =>
    values[key] && values[key] !== 'standard').map(key => [key, values[key]]));
}
