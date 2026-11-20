import { defensiveSlotMap, formationSlots } from './match-formations.js';
import { roleChoices } from './match-roles.js';

const phases = ['inPossession', 'outOfPossession'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export const roleOptions = Object.fromEntries(Object.entries(formationSlots).map(([shape, slots]) =>
  [shape, slots.map(slot => {
    const wideCentreBack = slots.includes('CB') && (slot === 'LCB' || slot === 'RCB');
    const choices = roleChoices(slot, {wideCentreBack});
    return Object.fromEntries(phases.map(phase => [phase, Object.entries(choices[phase])
      .map(([id, {label, description}]) => ({id, label, description}))]));
  })]));

export function optionsFor(formation, defence, index) {
  const shape = !defence || defence === 'same' ? formation : defence;
  const j = defensiveSlotMap[formation][shape][index];
  return {inPossession: roleOptions[formation][index].inPossession,
    outOfPossession: roleOptions[shape][j].outOfPossession};
}

export function shapeProblem(formation) {
  if (formation === undefined || formation === 'same' || (typeof formation === 'string' && Object.hasOwn(formationSlots, formation))) return null;
  return 'Choose a listed defensive formation.';
}

export function roleProblem(roles, formation, defence, players) {
  if (roles === undefined) return null;
  if (!record(roles)) return 'Choose player roles from the list.';
  for (const [id, pair] of Object.entries(roles)) {
    const player = players.find(p => p.id === id);
    if (!player || !record(pair) || !Object.keys(pair).length) return 'Choose a role for a player on the pitch.';
    const options = optionsFor(formation, defence, player.slotIndex);
    for (const [phase, role] of Object.entries(pair)) {
      if (!phases.includes(phase) || !options[phase].some(option => option.id === role)) {
        return 'Choose a role available for this position and phase of play.';
      }
    }
  }
  return null;
}

// Store only overrides, in canonical phase order. A shape change can make a
// previously selected role inapplicable without affecting the other phase.
export function selectedRoles(previous, patch, options) {
  const pair = {...previous, ...patch};
  return Object.fromEntries(phases.filter(phase => options[phase].some((option, i) =>
    i > 0 && option.id === pair[phase])).map(phase => [phase, pair[phase]]));
}
