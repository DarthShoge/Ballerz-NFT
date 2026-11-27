import {clubs, defaultPlan, matchTeams, validatePlan} from './football.js';
import {startMatch} from './match-engine.js';
import {closestPlayer} from './match-decisions.js';
import {movePlayers} from './match-pitch.js';

const ballDepth = {defence: 20, midfield: 52.5, attack: 83};

export function tacticalPreview(input, rosters = clubs) {
  const {side, plan, phase, zone} = input ?? {};
  if (![0,1].includes(side) || !['inPossession','outOfPossession'].includes(phase)
      || typeof zone !== 'string' || !Object.hasOwn(ballDepth, zone)) {
    return {error: 'Choose a team, a phase and a third of the pitch.'};
  }
  const problem = validatePlan(rosters[side], plan, rosters[1-side]);
  if (problem) return {error: problem};
  const plans = rosters.map(club => defaultPlan(club));
  plans[side] = plan;
  const {teams} = startMatch(matchTeams(plans,rosters), () => 0.5);
  const relative = ({x,y}) => side ? {x: 105 - x, y: 68 - y} : {x,y};
  const ball = relative({x: ballDepth[zone], y: 27});
  const possessionSide = phase === 'inPossession' ? side : 1 - side;
  const carrier = closestPlayer(teams[possessionSide].players, ball, p => p.position !== 'GK');
  Object.assign(carrier, ball);
  // Repeated normal movement steps let the block settle around a held ball.
  // No action resolution, random rolls or changes to a fixture take place here.
  for (let step = 0; step < 12; step++) {
    movePlayers(teams, {ball, possessionSide, carrierId: carrier.id, seconds: 1});
  }
  return {ball: relative(ball), players: teams[side].players.map(player => ({
    id: player.id, slotIndex: player.slotIndex, ...relative(player)
  }))};
}
