import {goalArea} from './match-decisions.js';

// Read the same recorded actions at the touchline and at full time. A regain
// from a pass interception or a second ball is distinct from tackling a carrier.
function contributions(playerIds, actions, events) {
  const figures = new Map(playerIds.map(id => [id, {onTarget: 0, xg: 0, challengesWon: 0, fouls: 0}]));
  const challenges = [0, 0], challengesWon = [0, 0], saves = [0, 0], boxShots = [0, 0], oneOnOnes = [0, 0];
  for (const play of actions) {
    if (play.type !== 'duel' && !(play.type === 'carry' && play.outcome === 'tackled')) continue;
    const defender = figures.get(play.defenderId);
    if (!defender) continue;
    const defendingSide = play.side === 'home' ? 1 : 0;
    challenges[defendingSide]++;
    if (play.outcome === 'foul' || play.outcome === 'advantage') defender.fouls++;
    if (play.outcome === 'tackled') {
      defender.challengesWon++;
      challengesWon[defendingSide]++;
    }
  }
  for (const shot of events) {
    const shooter = figures.get(shot.playerId);
    const side = shot.side === 'home' ? 0 : 1;
    if (shot.location && goalArea(shot.location, side)) boxShots[side]++;
    if (shot.oneOnOne) oneOnOnes[side]++;
    shooter.xg += shot.xg;
    if (shot.type === 'save' || shot.type === 'goal') shooter.onTarget++;
    if (shot.type === 'save') saves[shot.side === 'home' ? 1 : 0]++;
  }
  for (const player of figures.values()) player.xg = Math.round(player.xg * 1000) / 1000;
  return {figures, challenges, challengesWon, saves, boxShots, oneOnOnes};
}

export function matchStatistics(game) {
  const playerIds = game.teams.flatMap(team => team.players.map(player => player.id));
  const {figures, challenges, challengesWon, saves, boxShots, oneOnOnes} = contributions(playerIds, game.actions, game.events);
  const ballInPlay = game.possessionTime[0] + game.possessionTime[1];
  const homePossession = ballInPlay ? Math.round(100 * game.possessionTime[0] / ballInPlay) : 50;
  const stats = {...game.stats, possession: [homePossession, 100 - homePossession],
    xg: game.stats.xg.map(value => Math.round(value * 1000) / 1000), challengesWon, saves, boxShots};
  // Older live checkpoints did not log a carrier escaping a challenge.
  if (game.recordsEscapedChallenges) Object.assign(stats, {challenges, oneOnOnes});
  return {figures, stats, ballInPlay};
}

export function recordedMatchReport(report) {
  if (report?.engineVersion !== 7 || !Array.isArray(report.performances) ||
      !Array.isArray(report.actions) || !Array.isArray(report.events)) return report;
  const playerIds = report.performances.flat().map(player => player.playerId);
  const {figures, challengesWon, saves, boxShots} = contributions(playerIds, report.actions, report.events);
  return {...report, stats: {...report.stats, challengesWon, saves, boxShots},
    performances: report.performances.map(team => team.map(player => ({...player, ...figures.get(player.playerId)})))};
}
