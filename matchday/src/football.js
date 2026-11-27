import { dutyProblem, instructionProblem, instructionValues, tactics } from './match-tactics.js';
import { formationCoordinates, formations, formationSlots, mirrorLineup, setDefensiveSlot } from './match-formations.js';
import { roleProblem, shapeProblem } from './role-selection.js';
import { markingProblem, markingTarget } from './marking-targets.js';
import { individualInstructionProblem, individualValues } from './player-instructions.js';
import { simulateMatch } from './match-engine.js';
export { instructions, tactics } from './match-tactics.js';
export { formations } from './match-formations.js';

const rating = value => Math.max(1, Math.min(20, Math.round(value)));

function makeClub(id, name, shortName, roster) {
  const squad = roster.map(([number, name, position, passing, defending, finishing, stamina, vision, decisions, pace]) => {
    const keeper = position === 'GK';
    const attributes = {
      passing: rating(passing / 5),
      crossing: rating(passing * 0.114 + vision * 0.23 + pace * 0.20),
      aerial: rating({GK: 14, DF: 16, MF: 10, FW: 15}[position] * 0.64
        + Math.max(defending, finishing) * 0.056 + (number % 4 - 1.5) * 0.85),
      firstTouch: rating((passing * 0.6 + finishing * 0.4) / 5),
      dribbling: rating((passing * 0.45 + finishing * 0.55) / 5),
      finishing: rating(finishing / 5),
      tackling: keeper ? 4 : rating(defending / 5),
      vision,
      decisions,
      composure: rating((decisions + Math.max(finishing, defending) / 5) / 2),
      offBall: rating((pace + finishing / 5) / 2),
      positioning: rating((decisions + defending / 5) / 2),
      workRate: rating((stamina / 5 + decisions) / 2),
      pace,
      stamina: rating(stamina / 5)
    };
    if (keeper) {
      attributes.handling = rating(defending / 5);
      attributes.reflexes = rating((defending / 5 + pace) / 2 + 2);
      attributes.oneOnOnes = rating((defending / 5 + decisions) / 2);
    }
    return {id: id + '-' + number, name, position, number, passing, defending, finishing, stamina, attributes};
  });
  return { id, name, shortName, squad };
}

// Fictional squads. Each row ends with vision, decisions and pace on a 1–20 scale.
export const clubs = [
  makeClub('northbank', 'Northbank Athletic', 'NBA', [
    [1, 'Leon Farrow', 'GK', 62, 77, 15, 65, 9, 15, 12],
    [2, 'Rafi Cole', 'DF', 73, 69, 42, 85, 12, 12, 16],
    [4, 'Cian Mercer', 'DF', 66, 82, 41, 71, 8, 16, 11],
    [5, 'Dayo Bell', 'DF', 62, 79, 45, 78, 9, 14, 13],
    [3, 'Milo Penn', 'DF', 74, 72, 51, 78, 13, 12, 15],
    [6, 'Idris Vale', 'MF', 79, 76, 55, 80, 14, 16, 12],
    [8, 'Tomás Neves', 'MF', 85, 61, 68, 70, 18, 15, 12],
    [7, 'Jude Kavan', 'MF', 75, 57, 72, 88, 12, 11, 17],
    [11, 'Eli Nordin', 'MF', 77, 53, 70, 83, 14, 13, 16],
    [9, 'Kofi Marr', 'FW', 63, 40, 85, 74, 10, 14, 18],
    [10, 'Nico Firth', 'FW', 76, 45, 77, 80, 15, 16, 12],
    [12, 'Finn Aubry', 'GK', 73, 70, 18, 74, 12, 13, 14],
    [14, 'Ivo Dunn', 'DF', 65, 76, 39, 88, 9, 13, 12],
    [15, 'Sami Keel', 'DF', 78, 66, 48, 80, 13, 12, 17],
    [16, 'Luca Aire', 'MF', 72, 72, 59, 90, 13, 15, 13],
    [18, 'Arun Flint', 'MF', 79, 54, 74, 72, 16, 13, 15],
    [19, 'Theo Lorne', 'FW', 68, 44, 72, 93, 10, 12, 19],
  ]),
  makeClub('eastport', 'Eastport Rovers', 'EPR', [
    [1, 'Remy Voss', 'GK', 65, 78, 12, 68, 10, 16, 13],
    [2, 'Calder Shaw', 'DF', 69, 75, 38, 84, 10, 14, 15],
    [4, 'Emil Ward', 'DF', 63, 82, 44, 75, 9, 17, 10],
    [5, 'Kojo Innes', 'DF', 67, 79, 39, 78, 11, 14, 12],
    [3, 'Nathan Iles', 'DF', 76, 68, 53, 83, 14, 13, 17],
    [6, 'Soren Mack', 'MF', 76, 78, 56, 83, 13, 16, 11],
    [8, 'Owen Rial', 'MF', 83, 63, 66, 76, 18, 15, 12],
    [7, 'Cruz Alder', 'MF', 74, 59, 73, 86, 13, 12, 17],
    [11, 'Yuri Moss', 'MF', 79, 54, 71, 78, 15, 13, 16],
    [9, 'Ade Senna', 'FW', 64, 41, 84, 77, 9, 15, 17],
    [10, 'Ari Holt', 'FW', 77, 42, 77, 79, 16, 15, 13],
    [12, 'Mika Fox', 'GK', 71, 70, 17, 72, 11, 13, 14],
    [14, 'Toby Rann', 'DF', 72, 73, 41, 88, 12, 14, 15],
    [15, 'Levi Harte', 'DF', 64, 80, 47, 69, 9, 15, 12],
    [16, 'Deni Page', 'MF', 73, 71, 60, 90, 13, 14, 14],
    [18, 'Simen Gray', 'MF', 81, 55, 72, 70, 17, 12, 14],
    [19, 'Noah Reed', 'FW', 67, 45, 74, 92, 10, 12, 18],
  ]),
];

export function orderedXI(club, plan) {
  const players = plan.xi.map(id => club.squad.find(player => player.id === id));
  return Object.keys(formations[plan.formation]).flatMap(pos => players.filter(p => p.position === pos));
}

export function defaultPlan(club, formation = '4-4-2', tactic = 'balanced') {
  const shape = formations[formation];
  const xi = Object.entries(shape).flatMap(([position, count]) =>
    club.squad.filter(player => player.position === position).slice(0, count).map(player => player.id));
  return { formation, tactic, xi: club.id === clubs[1].id ? mirrorLineup(formation, xi) : xi };
}

export function fixtureClubs(registrations) {
  if (!registrations || !Object.keys(registrations).length) return clubs;
  return clubs.map(club => {
    const retained=club.squad.filter(player=>(registrations[player.id]?.club ?? club.id)===club.id);
    const arrivals=clubs.filter(other=>other!==club).flatMap(other=>other.squad.filter(player=>
      registrations[player.id]?.club===club.id));
    return {...club,squad:[...retained,...arrivals]};
  });
}

export function validatePlan(club, plan, opponents = clubs.find(other => other.id !== club.id)) {
  if (typeof plan?.formation !== 'string' || !Object.hasOwn(formations, plan.formation)) return 'Choose a listed formation.';
  if (typeof plan.tactic !== 'string' || !Object.hasOwn(tactics, plan.tactic)) return 'Choose a listed tactic.';
  const problem = instructionProblem(plan);
  if (problem) return problem;
  if (!Array.isArray(plan.xi) || plan.xi.length !== 11 || new Set(plan.xi).size !== 11)
    return 'Select eleven different players.';
  const players = club.squad.filter(player => plan.xi.includes(player.id));
  if (players.length !== 11) return 'Select players registered to this club.';
  const shape = formations[plan.formation];
  for (const [position, count] of Object.entries(shape)) {
    if (players.filter(player => player.position === position).length !== count)
      return 'This formation requires ' + count + ' ' + position + '.';
  }
  return dutyProblem(plan.duties, players) ?? individualInstructionProblem(plan.playerInstructions, players) ?? markingProblem(plan.markingTargets, players, opponents.squad) ?? shapeProblem(plan.defensiveFormation)
    ?? roleProblem(plan.playerRoles, plan.formation, plan.defensiveFormation,
      orderedXI(club, plan).map(({id}, slotIndex) => ({id, slotIndex})));
}

export function matchTeams(plans, rosters = clubs) {
  return plans.map((plan, index) => {
    const club = rosters[index];
    const error = validatePlan(club, plan, rosters[1-index]);
    if (error) throw new Error(error);
    const preset = tactics[plan.tactic];
    const team = { side: index, formation: plan.formation, defensiveFormation: plan.defensiveFormation ?? 'same',
      bench: club.squad.filter(player => !plan.xi.includes(player.id)),
      ...instructionValues(plan, preset)
    };
    team.players = orderedXI(club, plan).map((player, slotIndex) => {
      const {x, y} = formationCoordinates[plan.formation][slotIndex];
      const participant = {...player, slotIndex, slot: formationSlots[plan.formation][slotIndex],
        anchorX: index ? 105 - x : x, anchorY: index ? 68 - y : y,
        duty: plan.duties?.[player.id] ?? 'support', roles: {...plan.playerRoles?.[player.id]},
        markingTarget: markingTarget(plan.markingTargets?.[player.id]),
        instructions: individualValues(null, plan.playerInstructions?.[player.id])};
      setDefensiveSlot(participant, team);
      return participant;
    });
    // Keep screen-order iteration stable for seeded simulation and historic reports.
    if (index === 1) team.players = mirrorLineup(plan.formation, team.players);
    return team;
  });
}

export function simulate(homePlan, awayPlan, rng = Math.random) {
  return simulateMatch(matchTeams([homePlan, awayPlan]), rng);
}
