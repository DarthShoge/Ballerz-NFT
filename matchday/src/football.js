// The last four columns are passing, defending (handling for goalkeepers),
// finishing and stamina. Shirt numbers also act as stable roster identifiers.
function makeClub(id, name, shortName, roster) {
  const squad = roster.map(([number, name, position, passing, defending, finishing, stamina]) => ({
    id: id + '-' + number, name, position, number, passing, defending, finishing, stamina
  }));
  return { id, name, shortName, squad };
}

export const clubs = [
  makeClub('northbank', 'Northbank Athletic', 'NBA', [
    [1, 'Leon Farrow', 'GK', 62, 77, 15, 65],
    [2, 'Rafi Cole', 'DF', 73, 69, 42, 85],
    [4, 'Cian Mercer', 'DF', 66, 82, 41, 71],
    [5, 'Dayo Bell', 'DF', 62, 79, 45, 78],
    [3, 'Milo Penn', 'DF', 74, 72, 51, 78],
    [6, 'Idris Vale', 'MF', 79, 76, 55, 80],
    [8, 'Tomás Neves', 'MF', 85, 61, 68, 70],
    [7, 'Jude Kavan', 'MF', 75, 57, 72, 88],
    [11, 'Eli Nordin', 'MF', 77, 53, 70, 83],
    [9, 'Kofi Marr', 'FW', 63, 40, 85, 74],
    [10, 'Nico Firth', 'FW', 76, 45, 77, 80],
    [12, 'Finn Aubry', 'GK', 73, 70, 18, 74],
    [14, 'Ivo Dunn', 'DF', 65, 76, 39, 88],
    [15, 'Sami Keel', 'DF', 78, 66, 48, 80],
    [16, 'Luca Aire', 'MF', 72, 72, 59, 90],
    [18, 'Arun Flint', 'MF', 79, 54, 74, 72],
    [19, 'Theo Lorne', 'FW', 68, 44, 72, 93],
  ]),
  makeClub('eastport', 'Eastport Rovers', 'EPR', [
    [1, 'Remy Voss', 'GK', 65, 78, 12, 68],
    [2, 'Calder Shaw', 'DF', 69, 75, 38, 84],
    [4, 'Emil Ward', 'DF', 63, 82, 44, 75],
    [5, 'Kojo Innes', 'DF', 67, 79, 39, 78],
    [3, 'Nathan Iles', 'DF', 76, 68, 53, 83],
    [6, 'Soren Mack', 'MF', 76, 78, 56, 83],
    [8, 'Owen Rial', 'MF', 83, 63, 66, 76],
    [7, 'Cruz Alder', 'MF', 74, 59, 73, 86],
    [11, 'Yuri Moss', 'MF', 79, 54, 71, 78],
    [9, 'Ade Senna', 'FW', 64, 41, 84, 77],
    [10, 'Ari Holt', 'FW', 77, 42, 77, 79],
    [12, 'Mika Fox', 'GK', 71, 70, 17, 72],
    [14, 'Toby Rann', 'DF', 72, 73, 41, 88],
    [15, 'Levi Harte', 'DF', 64, 80, 47, 69],
    [16, 'Deni Page', 'MF', 73, 71, 60, 90],
    [18, 'Simen Gray', 'MF', 81, 55, 72, 70],
    [19, 'Noah Reed', 'FW', 67, 45, 74, 92],
  ]),
];

export const formations = {
  '4-4-2': { GK: 1, DF: 4, MF: 4, FW: 2 },
  '4-3-3': { GK: 1, DF: 4, MF: 3, FW: 3 },
  '3-5-2': { GK: 1, DF: 3, MF: 5, FW: 2 },
};

export const tactics = {
  balanced: { label: 'Balanced', description: 'Keep your shape and build through midfield.' },
  press: { label: 'High press', description: 'Win the ball high. Stamina matters in the closing stages.' },
  counter: { label: 'Counterattack', description: 'Concede territory and break quickly against a high line.' },
};

export function defaultPlan(club, formation = '4-4-2', tactic = 'balanced') {
  const shape = formations[formation];
  const xi = Object.entries(shape).flatMap(([position, count]) =>
    club.squad.filter(player => player.position === position).slice(0, count).map(player => player.id));
  return { formation, tactic, xi };
}

export function validatePlan(club, plan) {
  if (typeof plan?.formation !== 'string' || !Object.hasOwn(formations, plan.formation)) return 'Choose a listed formation.';
  if (typeof plan.tactic !== 'string' || !Object.hasOwn(tactics, plan.tactic)) return 'Choose a listed tactic.';
  if (!Array.isArray(plan.xi) || plan.xi.length !== 11 || new Set(plan.xi).size !== 11)
    return 'Select eleven different players.';
  const players = club.squad.filter(player => plan.xi.includes(player.id));
  if (players.length !== 11) return 'Select players registered to this club.';
  const shape = formations[plan.formation];
  for (const [position, count] of Object.entries(shape)) {
    if (players.filter(player => player.position === position).length !== count)
      return 'This formation requires ' + count + ' ' + position + '.';
  }
  return null;
}

function average(players, attribute) {
  return players.reduce((total, player) => total + player[attribute], 0) / players.length;
}

function prepare(club, plan) {
  const error = validatePlan(club, plan);
  if (error) throw new Error(error);
  const players = club.squad.filter(player => plan.xi.includes(player.id));
  const outfield = players.filter(player => player.position !== 'GK');
  const midfield = players.filter(player => player.position === 'MF');
  const defence = players.filter(player => player.position === 'DF');
  return {
    players: outfield, tactic: plan.tactic,
    passing: 0.7 * average(midfield, 'passing') + 0.3 * average(outfield, 'passing'),
    midfieldCount: midfield.length,
    defending: average(defence, 'defending') + 2 * (defence.length - 4),
    stamina: average(outfield, 'stamina'), keeper: players.find(player => player.position === 'GK'),
  };
}

function pressIntensity(team, minute) {
  if (team.tactic !== 'press') return 0;
  return minute <= 60 ? 0.09 : -(100 - team.stamina) / 300;
}

function pickShooter(players, rng) {
  const weights = { DF: 1, MF: 4, FW: 10 };
  let ticket = rng() * players.reduce((sum, player) => sum + weights[player.position], 0);
  for (const player of players) {
    ticket -= weights[player.position];
    if (ticket < 0) return player;
  }
  return players[players.length - 1];
}

function analysis(team, index, events, possession, shots) {
  const side = index === 0 ? 'home' : 'away';
  const chances = events.filter(event => event.side === side);
  if (team.tactic === 'press') {
    const early = chances.filter(event => event.minute <= 60).length;
    return 'The high press produced ' + early + ' shots in the first hour and ' +
      (chances.length - early) + ' in the final half-hour.';
  }
  if (team.tactic === 'counter') {
    const breaks = chances.filter(event => event.move === 'break').length;
    return 'The counterattack produced ' + breaks + ' of your ' + shots[index] +
      ' shots from quick breaks, with ' + possession[index] + '% possession.';
  }
  return 'Your midfield held ' + possession[index] + '% possession. Patient build-up produced ' +
    chances.filter(event => event.move === 'build').length + ' of your ' + shots[index] + ' shots.';
}

export function simulate(homePlan, awayPlan, rng = Math.random) {
  const teams = [prepare(clubs[0], homePlan), prepare(clubs[1], awayPlan)];
  const score = [0, 0], shots = [0, 0], onTarget = [0, 0], controlled = [0, 0];
  const events = [];
  for (let minute = 1; minute <= 90; minute++) {
    const control = teams.map(team =>
      team.passing / 200 + team.midfieldCount * 0.023 +
      pressIntensity(team, minute) - (team.tactic === 'counter' ? 0.08 : 0));
    const side = rng() < 0.51 + control[0] - control[1] ? 0 : 1;
    const attack = teams[side], defence = teams[1 - side];
    controlled[side]++;
    const fastBreak = attack.tactic === 'counter' && rng() < (defence.tactic === 'press' ? 0.75 : 0.48);
    const highRecovery = attack.tactic === 'press' && minute <= 60 && rng() < 0.35;
    const shotChance = 0.20 + (attack.passing - defence.defending) / 240 +
      (fastBreak ? 0.12 : 0) + (highRecovery ? 0.07 : 0);
    if (rng() >= shotChance) continue;
    const shooter = pickShooter(attack.players, rng);
    shots[side]++;
    const move = fastBreak ? 'break' : highRecovery ? 'press' : 'build';
    const situation = { break: 'on the break', press: 'after a high turnover', build: 'after a passing move' }[move];
    let type = 'miss', text = shooter.name + ' fires wide ' + situation + '.';
    if (rng() < 0.41 + (shooter.finishing - 65) / 200) {
      onTarget[side]++;
      if (rng() < 0.30 + (shooter.finishing - defence.keeper.defending) / 190 + (fastBreak ? 0.06 : 0)) {
        score[side]++;
        type = 'goal';
        text = shooter.name + ' finds the net ' + situation + '.';
      } else {
        type = 'save';
        text = defence.keeper.name + ' saves from ' + shooter.name + ' ' + situation + '.';
      }
    }
    events.push({ minute, side: side === 0 ? 'home' : 'away', type, move, text });
  }
  const homePossession = Math.round(100 * controlled[0] / 90);
  const possession = [homePossession, 100 - homePossession];
  return { score, events, stats: { shots, onTarget, possession },
    analysis: teams.map((team, index) => analysis(team, index, events, possession, shots)) };
}
