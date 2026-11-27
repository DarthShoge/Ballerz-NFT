// The four groups select registered keepers, defenders, midfielders and forwards.
// The slot determines where each selected player actually plays.
const squads = {
  '4-4-2': [['GK'], ['LB','LCB','RCB','RB'], ['LM','LCM','RCM','RM'], ['LS','RS']],
  '4-3-3': [['GK'], ['LB','LCB','RCB','RB'], ['LCM','CM','RCM'], ['LW','ST','RW']],
  '3-5-2': [['GK'], ['LCB','CB','RCB'], ['LWB','LCM','CM','RCM','RWB'], ['LS','RS']],
  '4-2-3-1': [['GK'], ['LB','LCB','RCB','RB'], ['LDM','RDM','LW','AM','RW'], ['ST']],
  '4-1-4-1': [['GK'], ['LB','LCB','RCB','RB'], ['DM','LM','LCM','RCM','RM'], ['ST']],
  '4-4-2 diamond': [['GK'], ['LB','LCB','RCB','RB'], ['DM','LCM','RCM','AM'], ['LS','RS']],
  '3-4-2-1': [['GK'], ['LCB','CB','RCB'], ['LWB','LCM','RCM','RWB','LAM','RAM'], ['ST']],
  '5-3-2': [['GK'], ['LWB','LCB','CB','RCB','RWB'], ['LCM','CM','RCM'], ['LS','RS']],
  '4-5-1': [['GK'], ['LB','LCB','RCB','RB'], ['LM','LCM','CM','RCM','RM'], ['ST']],
  '4-3-3 DM': [['GK'], ['LB','LCB','RCB','RB'], ['DM','LCM','RCM'], ['LW','ST','RW']],
  '3-4-3': [['GK'], ['LCB','CB','RCB'], ['LWB','LCM','RCM','RWB'], ['LW','ST','RW']],
  '5-2-3': [['GK'], ['LWB','LCB','CB','RCB','RWB'], ['LCM','RCM'], ['LW','ST','RW']],
  '4-3-2-1': [['GK'], ['LB','LCB','RCB','RB'], ['LCM','CM','RCM','LAM','RAM'], ['ST']],
  '4-2-2-2': [['GK'], ['LB','LCB','RCB','RB'], ['LDM','RDM','LAM','RAM'], ['LS','RS']]
};
const positions = ['GK','DF','MF','FW'];
const slotPoints = {
  GK: [6,34], LB: [27,9], RB: [27,59], LCB: [25,24], CB: [24,34], RCB: [25,44],
  LWB: [37,7], RWB: [37,61], DM: [33,34], LDM: [33,24], RDM: [33,44],
  LM: [41,7], LCM: [41,25], CM: [41,34], RCM: [41,43], RM: [41,61],
  LAM: [54,22], AM: [54,34], RAM: [54,46], LW: [61,11], RW: [61,57],
  LS: [65,23], ST: [65,34], RS: [65,45]
};

export function slotLine(slot) {
  if (!slot || positions.includes(slot)) return slot;
  if (slot === 'GK') return 'GK';
  if (['LB','RB','LWB','RWB','LCB','CB','RCB'].includes(slot)) return 'DF';
  if (['LS','ST','RS','LW','RW'].includes(slot)) return 'FW';
  return 'MF';
}

export const formationSlots = Object.fromEntries(Object.entries(squads).map(([id, groups]) => [id, groups.flat()]));
export const formations = Object.fromEntries(Object.entries(squads).map(([id, groups]) =>
  [id, Object.fromEntries(groups.map((line, i) => [positions[i], line.length]))]));
export const formationCoordinates = Object.fromEntries(Object.entries(formationSlots).map(([id, slots]) =>
  [id, slots.map(slot => {
    let [x,y] = slotPoints[slot];
    // A three-man back line and a five-man midfield cover more of the pitch.
    if (slots.includes('CB') && slot === 'LCB') y = 16;
    if (slots.includes('CB') && slot === 'RCB') y = 52;
    if (slots.includes('CM') && slot === 'LCM') y = 17;
    if (slots.includes('CM') && slot === 'RCM') y = 51;
    if (id.startsWith('5-') && slot.endsWith('WB')) x = 28;
    return {x,y};
  })]));

// Assign each shirt exactly once. Minimise the squad's total movement between
// the two shapes, favouring the same named slot when distances are similar.
function matchSlots(from, to) {
  const a = formationCoordinates[from], b = formationCoordinates[to];
  const memo = new Map();
  function best(index, used) {
    if (index === 11) return {cost: 0, slots: []};
    if (memo.has(used)) return memo.get(used);
    let result = {cost: Infinity};
    for (let j = 1; j < 11; j++) {
      if (used & (1 << j)) continue;
      const rest = best(index + 1, used | (1 << j));
      const cost = rest.cost + (a[index].x - b[j].x) ** 2 + (a[index].y - b[j].y) ** 2
        + (formationSlots[from][index] === formationSlots[to][j] ? 0 : 16);
      if (cost < result.cost) result = {cost, slots: [j, ...rest.slots]};
    }
    memo.set(used, result);
    return result;
  }
  return [0, ...best(1, 1).slots];
}

export const defensiveSlotMap = Object.fromEntries(Object.keys(squads).map(from =>
  [from, Object.fromEntries(Object.keys(squads).map(to => [to, matchSlots(from, to)]))]));

// Previous away team sheets listed shirts in pitch-screen order. Flip each
// lateral pair to keep the same player at left-back, right wing, etc.
export function mirrorLineup(formation, entries) {
  const slots = formationSlots[formation];
  return slots.map((slot, i) => {
    const opposite = slot[0] === 'L' ? 'R' + slot.slice(1) : slot[0] === 'R' ? 'L' + slot.slice(1) : slot;
    const index = slots.indexOf(opposite);
    return entries[index < 0 ? i : index];
  });
}

export function shapeFor(team) {
  if (Object.hasOwn(formations, team.formation)) return team.formation;
  // Older checkpoints have the original eleven before any replacements.
  const starters = team.players.slice(0, 11);
  if (starters.some(p => p.slot === 'CB') || starters.filter(p => p.position === 'DF').length === 3) return '3-5-2';
  return starters.some(p => p.slot === 'LW' || p.slot === 'RW') ? '4-3-3' : '4-4-2';
}

export function setDefensiveSlot(player, team) {
  const {formation, defensiveFormation, side} = team;
  const shape = defensiveFormation && defensiveFormation !== 'same' ? defensiveFormation : formation;
  const index = defensiveSlotMap[formation][shape][player.slotIndex];
  player.defensiveSlot = formationSlots[shape][index];
  if (shape === formation) {
    player.defensiveAnchorX = player.anchorX;
    player.defensiveAnchorY = player.anchorY;
  } else {
    const {x, y} = formationCoordinates[shape][index];
    player.defensiveAnchorX = side ? 105 - x : x;
    player.defensiveAnchorY = side ? 68 - y : y;
  }
}

export function restoreTeamShape(team) {
  if (team.formation && team.players.every(p => Number.isInteger(p.slotIndex))) return;
  team.formation = shapeFor(team);
  team.defensiveFormation ??= 'same';
  const slots = formationSlots[team.formation];
  for (const [i, player] of team.players.entries()) {
    let slot = player.slot;
    if (team.formation === '3-5-2' && ['LM','RM'].includes(slot)) slot = slot === 'LM' ? 'LWB' : 'RWB';
    const index = slots.indexOf(slot);
    player.slotIndex = index >= 0 ? index : Math.min(i, 10);
    player.slot = slots[player.slotIndex];
    setDefensiveSlot(player, team);
  }
}
