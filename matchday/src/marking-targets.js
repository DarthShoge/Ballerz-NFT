import { formationSlots } from './match-formations.js';

export const markingPositions = [...new Set(Object.values(formationSlots).flat())].filter(slot => slot !== 'GK');

export function markingProblem(assignments, players, opponents) {
  if (assignments === undefined) return null;
  if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) return 'Choose a marking assignment.';
  for (const [id, target] of Object.entries(assignments)) {
    if (!players.some(p => p.id === id && p.position !== 'GK')) return 'Choose an active outfield marker.';
    if (target === null) continue;
    if (!target || Object.keys(target).length !== 2) return 'Choose a named opponent or an opposition position.';
    if (target.kind === 'player' && opponents.some(p => p.id === target.id && p.position !== 'GK')) continue;
    if (target.kind === 'position' && markingPositions.includes(target.slot)) continue;
    return 'Choose an opposing outfield player or a listed outfield position.';
  }
  return null;
}

export function markingTarget(choice) {
  if (!choice) return null;
  return choice.kind === 'position' ? {kind:'position', slot:choice.slot} : {kind:'player', id:choice.id};
}
