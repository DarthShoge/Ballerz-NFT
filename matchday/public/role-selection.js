export const phases = {inPossession: 'In possession', outOfPossession: 'Out of possession'};

export function phaseSlot(catalog, formation, defensiveFormation, index, phase) {
  if (phase === 'outOfPossession' && defensiveFormation && defensiveFormation !== 'same') {
    return {formation: defensiveFormation, index: catalog.defensiveSlotMap[formation][defensiveFormation][index]};
  }
  return {formation, index};
}

function phaseOptions(catalog, formation, defensiveFormation, index, phase) {
  const slot = phaseSlot(catalog, formation, defensiveFormation, index, phase);
  return catalog.roleOptions[slot.formation][slot.index][phase];
}

export function validRoles(catalog, formation, defensiveFormation, players, assignments) {
  const valid = {};
  for (const {id, slotIndex} of players) {
    for (const phase of Object.keys(phases)) {
      const value = assignments?.[id]?.[phase];
      if (value && phaseOptions(catalog, formation, defensiveFormation, slotIndex, phase).some(role => role.id === value)) {
        (valid[id] ??= {})[phase] = value;
      }
    }
  }
  return valid;
}

export function starterSelector(catalog, formation, players, selectedId, label, esc) {
  const options = players.map(p => {
    const slot = catalog.formationSlots[formation][p.slotIndex];
    return `<option value="${esc(p.id)}"${p.id === selectedId ? ' selected' : ''}>${esc(slot)} · ${esc(p.name)}</option>`;
  }).join('');
  return `<label for="role-player">${label}</label><select id="role-player">${options}</select>`;
}

export function targetValue(target) {
  if (target?.kind === 'player') return 'player:' + target.id;
  if (target?.kind === 'position') return 'position:' + target.slot;
  return '';
}

function markingField(catalog, player, opponents, target, disabled, esc) {
  if (!catalog.markingPositions) return '';
  const current = targetValue(target);
  const option = (value, label) => `<option value="${esc(value)}"${current === value ? ' selected' : ''}>${esc(label)}</option>`;
  const players = opponents.filter(p => p.position !== 'GK' && (!p.unavailable || target?.id === p.id));
  const named = players.map(p => option('player:' + p.id, p.name + ' \u00b7 ' + (p.unavailable ? 'off pitch' : p.active === false ? 'bench' : p.slot ?? p.position))).join('');
  const live = opponents.some(p => p.active === true);
  const slots = catalog.markingPositions.map(slot => {
    const occupant = live && opponents.find(p => p.active && p.slot === slot);
    return option('position:' + slot, live ? slot + ' \u00b7 ' + (occupant?.name ?? 'unoccupied') : slot);
  }).join('');
  const help = target?.kind === 'player' ? 'Follow this player when they change position. Resume normal duties while they are off the pitch.' :
    target?.kind === 'position' ? 'Pick up the opponent occupying this attacking position, including their replacement.' :
    'Use the marking assignments from your defensive shape.';
  return `<div><label for="marking-target">Marking target</label>
    <select id="marking-target" data-marking-player="${esc(player.id)}" aria-describedby="marking-target-help"${disabled ? ' disabled' : ''}>
      ${option('', 'Use defensive shape')}<optgroup label="Specific opponent">${named}</optgroup><optgroup label="Specific position">${slots}</optgroup>
    </select><small id="marking-target-help">${help}</small></div>`;
}

function defensiveInstructions(options, player, selected, disabled, esc, marking) {
  if (player.position === 'GK' || !options) return '';
  const fields = Object.entries(options).map(([key, choices]) => {
    const value = selected?.[key] ?? 'standard';
    const field = 'individual-' + key;
    return `<div><label for="${field}">${esc(key[0].toUpperCase() + key.slice(1))}</label>
      <select id="${field}" data-individual="${esc(key)}" data-player-id="${esc(player.id)}" aria-describedby="${field}-help"${disabled ? ' disabled' : ''}>
        ${Object.entries(choices).map(([id, choice]) => `<option value="${esc(id)}"${id === value ? ' selected' : ''}>${esc(choice.label)}</option>`).join('')}
      </select><small id="${field}-help">${esc(choices[value]?.description ?? '')}</small></div>`;
  }).join('');
  return `<fieldset class="individual-instructions"><legend>Individual defensive instructions</legend>${fields}${marking}</fieldset>`;
}

export function roleEditor({catalog, formation, defensiveFormation, players, assignments, playerInstructions, markingTargets, opponents = [], selectedId, disabled, esc, showSelector = true}) {
  if (!players.length) return '';
  const player = players.find(p => p.id === selectedId) ?? players.find(p => p.position === 'FW') ?? players[0];
  const controls = Object.entries(phases).map(([phase, label]) => {
    const slot = phaseSlot(catalog, formation, defensiveFormation, player.slotIndex, phase);
    const options = phaseOptions(catalog, formation, defensiveFormation, player.slotIndex, phase);
    const selected = options.find(role => role.id === assignments?.[player.id]?.[phase]) ?? options[0];
    const field = 'role-' + phase;
    return `<div class="role-phase"><div><label for="${field}">${label}</label><span>${esc(catalog.formationSlots[slot.formation][slot.index])}</span></div>
      <select id="${field}" data-role-phase="${phase}" data-role-player="${esc(player.id)}" aria-describedby="${field}-help"${disabled ? ' disabled' : ''}>
        ${options.map(option => `<option value="${esc(option.id)}"${option === selected ? ' selected' : ''}>${esc(option.label)}</option>`).join('')}
      </select><small id="${field}-help">${esc(selected.description)}</small></div>`;
  }).join('');
  const overview = players.map(p => {
    const roles = Object.keys(phases).map(phase => {
      const options = phaseOptions(catalog, formation, defensiveFormation, p.slotIndex, phase);
      const role = options.find(r => r.id === assignments?.[p.id]?.[phase]) ?? options[0];
      return `<td>${esc(role.label)}</td>`;
    }).join('');
    return `<tr><th scope="row">${esc(p.name)}</th>${roles}</tr>`;
  }).join('');
  return `<section class="role-editor" aria-label="Player roles"><h3>Player roles</h3>
    ${showSelector ? starterSelector(catalog, formation, players, player.id, 'Player', esc) : ''}
    <div class="role-phases">${controls}</div>${defensiveInstructions(catalog.individualInstructions, player, playerInstructions?.[player.id], disabled, esc, markingField(catalog, player, opponents, markingTargets?.[player.id], disabled, esc))}
    <details class="role-overview"><summary>All team roles</summary>
    <table><thead><tr><th scope="col">Player</th><th scope="col">In possession</th><th scope="col">Out of possession</th></tr></thead><tbody>${overview}</tbody></table></details></section>`;
}
