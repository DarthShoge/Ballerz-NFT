import { defaultPlan } from './football.js';
import { isActive } from './match-decisions.js';
import { substitutionProblem } from './match-rules.js';
import { instructionValues, tactics } from './match-tactics.js';

const selectionAttributes = {
  GK: ['handling', 'reflexes', 'oneOnOnes'],
  DF: ['positioning', 'tackling', 'aerial'],
  MF: ['passing', 'vision', 'decisions'],
  FW: ['finishing', 'offBall', 'composure']
};

function ability(player) {
  return selectionAttributes[player.position].reduce((sum, key) => sum + player.attributes[key], 0);
}

export function computerPlan(club) {
  const squad = [...club.squad].sort((a, b) => ability(b) - ability(a));
  return defaultPlan({...club, squad}, '4-4-2', 'counter');
}

export function manageComputerTeam(game, side) {
  const team = game.teams[side];
  const review = [55, 69, 80][team.computerReviews ?? 0];
  if (!review || game.second < 60 * review || game.abandoned) return;
  team.computerReviews = (team.computerReviews ?? 0) + 1;
  const difference = game.score[side] - game.score[1 - side];
  const style = difference < 0 ? 'chase' : difference > 0 ? 'protect' : 'balanced';
  const settings = instructionValues(tactics[style]);
  if (Object.keys(settings).some(key => team[key] !== settings[key])) {
    Object.assign(team, settings);
    game.incident(side, 'tactics', null, 'Computer manager: ' + tactics[style].label + '.');
  }
  if (team.pendingSubstitution) return;
  const outfield = team.players.filter(p => isActive(p) && p.position !== 'GK' && p.condition < 90);
  for (const player of outfield.sort((a, b) => a.condition - b.condition)) {
    const reserve = team.bench.filter(p => p.position === player.position).sort((a, b) => ability(b) - ability(a))[0];
    if (reserve && !substitutionProblem(team, player.id, reserve.id, game.second)) {
      team.pendingSubstitution = {outgoingId: player.id, incomingId: reserve.id};
      break;
    }
  }
}
