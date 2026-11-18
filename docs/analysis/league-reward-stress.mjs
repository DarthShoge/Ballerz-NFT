// Run with node docs/analysis/league-reward-stress.mjs from the Ballerz checkout.
// These are balance scenarios. Attendance and improvement assumptions are inputs.
import assert from 'node:assert/strict';

const teamCount = 20;
const gamesPerTeam = 2 * (teamCount - 1);
const finishThreshold = Math.ceil(gamesPerTeam * 0.85);
const matchBase = 60_000;
const finishBonus = 150_000;
const winBonus = 10_000;
const drawBonus = 5_000;
const regularWages = 2_204_000;
const upgradeWages = 152_000;
const upgradePrice = 1_000_000;
const reserve = 400_000;
const seasons = 6;
const worlds = 1500;

const curves = [
  { name: 'Original', step: 5_000, title: 0 },
  { name: 'Steeper places', step: 21_000, title: 0 },
  { name: 'Smaller title bonus', step: 20_500, title: 100_000 },
  { name: 'Places + title', step: 20_000, title: 200_000 },
  { name: 'Large gap', step: 40_000, title: 400_000 }
];

const scenarios = [
  { name: 'Full attendance', usual: 1, intermittent: 1, readyPayment: 0, improvement: 0.25 },
  { name: 'Full attendance, teams save', usual: 1, intermittent: 1, readyPayment: 0, improvement: 0.25, saveOnly: true },
  { name: 'Mixed, played games pay', usual: 0.98, intermittent: 0.86, readyPayment: 0, improvement: 0.25 },
  { name: 'Mixed, ready side paid', usual: 0.98, intermittent: 0.86, readyPayment: matchBase, improvement: 0.25 },
  { name: 'Mixed, stronger upgrades', usual: 0.98, intermittent: 0.86, readyPayment: matchBase, improvement: 0.55 },
  { name: 'Attendance shock', usual: 0.94, intermittent: 0.80, readyPayment: matchBase, improvement: 0.25 }
];

function randomSource(seed) {
  let state = seed;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 2 ** 32;
  };
}

function makeSchedule() {
  const order = Array.from({ length: teamCount }, (_, id) => id);
  const firstLeg = [];
  for (let round = 0; round < teamCount - 1; round++) {
    for (let i = 0; i < teamCount / 2; i++) {
      const pair = [order[i], order[teamCount - i - 1]];
      if ((round + i) % 2) pair.reverse();
      firstLeg.push(pair);
    }
    order.splice(1, 0, order.pop());
  }
  return firstLeg.concat(firstLeg.map(([home, away]) => [away, home]));
}

const schedule = makeSchedule();
assert.equal(schedule.length, 380);
assert.equal(new Set(schedule.map(pair => pair.join('-'))).size, 380);
assert.equal(2 * drawBonus, winBonus);

function placementReward(curve, rank, ready) {
  if (ready < finishThreshold) return 0;
  return finishBonus + curve.step * (teamCount - rank) + (rank === 1 ? curve.title : 0);
}

function makeTeam(id, random, scenario) {
  const wonderkid = random() < 0.35;
  const talent = 1.2 * (random() - 0.5);
  const attendance = random() < 0.20 ? scenario.intermittent : scenario.usual;
  return {
    id, talent, attendance, wonderkid,
    balance: wonderkid ? 450_000 : 1_200_000,
    upgrades: []
  };
}

function seasonTeam(team, scenario, year, random) {
  const upgrades = team.upgrades.filter(expires => expires > year);
  const strength = team.talent + scenario.improvement * (upgrades.length + Number(team.wonderkid));
  return {
    ...team, upgrades, strength, tiebreak: random(), points: 0, ready: 0,
    reward: 0, bill: regularWages + upgradeWages * (upgrades.length + Number(team.wonderkid))
  };
}

function playFixture(home, away, scenario, random) {
  // Draw rolls even if a club is absent so every curve sees the same inputs.
  const homeReady = random() < home.attendance;
  const awayReady = random() < away.attendance;
  const draw = random() < 0.25;
  const homeWin = random() < 1 / (1 + Math.exp(away.strength - home.strength - 0.18));
  home.ready += Number(homeReady);
  away.ready += Number(awayReady);

  if (homeReady && awayReady) {
    home.reward += matchBase;
    away.reward += matchBase;
    if (draw) {
      home.points++;
      away.points++;
      home.reward += drawBonus;
      away.reward += drawBonus;
    } else {
      const winner = homeWin ? home : away;
      winner.points += 3;
      winner.reward += winBonus;
    }
  } else if (homeReady || awayReady) {
    const ready = homeReady ? home : away;
    ready.points += 3;
    ready.reward += scenario.readyPayment;
  }
}

function simulate(curve, scenario) {
  const totals = { arrears: 0, repeats: 0, completion: 0, netBB: 0, topBottom: 0 };
  for (let run = 1; run <= worlds; run++) {
    const random = randomSource(run * 104729);
    let teams = Array.from({ length: teamCount }, (_, id) => makeTeam(id, random, scenario));
    let previousChampion = null;

    for (let year = 0; year < seasons; year++) {
      const seasonTeams = teams.map(team => seasonTeam(team, scenario, year, random));
      for (const [home, away] of schedule) playFixture(seasonTeams[home], seasonTeams[away], scenario, random);
      const table = [...seasonTeams].sort((a, b) => b.points - a.points || b.tiebreak - a.tiebreak);
      if (table[0].id === previousChampion) totals.repeats++;
      previousChampion = table[0].id;

      for (const [index, team] of table.entries()) {
        if (team.ready >= finishThreshold) totals.completion++;
        team.reward += placementReward(curve, index + 1, team.ready);
        team.balance += team.reward;
        const payment = Math.min(team.balance, team.bill);
        team.balance -= payment;
        team.inArrears = payment < team.bill;
        totals.arrears += Number(team.inArrears);
        totals.netBB += team.reward - payment;
        if (index === 0) totals.topBottom += team.reward;
        if (index === teamCount - 1) totals.topBottom -= team.reward;
      }

      teams = seasonTeams.map((team, id) => {
        // Prepare replacements with the same rolls even when a place stays occupied.
        const replacement = makeTeam(teamCount * (year + 1) + id, random, scenario);
        if (team.inArrears) return replacement;
        // A proxy for reinvestment. No secondary-market trades or future grants are simulated.
        if (!scenario.saveOnly && team.balance >= upgradePrice + reserve && team.upgrades.length < 3) {
          team.upgrades.push(year + 4);
          team.balance -= upgradePrice;
          totals.netBB -= upgradePrice;
        }
        return team;
      });
    }
  }
  const divisionSeasons = worlds * seasons;
  return {
    arrearsPct: 100 * totals.arrears / (teamCount * divisionSeasons),
    repeatChampionPct: 100 * totals.repeats / (worlds * (seasons - 1)),
    qualifiedPct: 100 * totals.completion / (teamCount * divisionSeasons),
    netBBMillions: totals.netBB / divisionSeasons / 1_000_000,
    rankIncomeGapBB: totals.topBottom / divisionSeasons
  };
}

function payoutAtFullQualification(curve) {
  const rewards = Array.from({ length: teamCount }, (_, index) =>
    placementReward(curve, index + 1, gamesPerTeam));
  return {
    curve: curve.name, first: rewards[0], second: rewards[1], tenth: rewards[9], last: rewards.at(-1),
    pool: rewards.reduce((total, reward) => total + reward, 0)
  };
}

assert.equal(finishThreshold, 33);
assert.deepEqual(curves.map(curve => payoutAtFullQualification(curve).pool),
  [3_950_000, 6_990_000, 6_995_000, 7_000_000, 11_000_000]);
assert.equal(placementReward(curves[2], 20, 32), 0);
assert.equal(placementReward(curves[2], 20, 33), 150_000);
assert.equal(38 * matchBase + finishBonus - regularWages - upgradeWages, 74_000);
assert.equal(33 * matchBase + finishBonus - regularWages - upgradeWages, -226_000);
assert.equal(32 * matchBase - regularWages - upgradeWages, -436_000);

console.table(curves.map(payoutAtFullQualification));
for (const scenario of scenarios) {
  console.log(scenario.name);
  console.table(curves.map(curve => {
    const values = simulate(curve, scenario);
    return { curve: curve.name, ...Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, Number(value.toFixed(2))])
    ) };
  }));
}
