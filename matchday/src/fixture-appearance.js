import { settleAppearance } from './devnet-settlement.js';

export function approveFixture(store, accounts, id, now = Date.now()) {
  const row = store.read(id);
  if (!row) throw new Error('Unknown fixture.');
  const state = JSON.parse(row.state);
  const binding = {mint:accounts.mint.toBase58(), owners:accounts.owners.map(key => key.toBase58())};
  if (state.appearanceApproval) {
    if (JSON.stringify(state.appearanceApproval) !== JSON.stringify(binding)) throw new Error('Different prior approval.');
    return;
  }
  if (!state.schedule || state.computerAway || state.result || state.live || now >= state.schedule.deadlineAt)
    throw new Error('Approve a scheduled two-manager fixture before lineup lock.');
  state.appearanceApproval = binding;
  if (!store.update(id, row.version, state)) throw new Error('Fixture changed; retry approval.');
}

export async function settleFixture(store, connection, payer, accounts, id) {
  const row = store.read(id);
  if (!row) throw new Error('Unknown fixture.');
  const state = JSON.parse(row.state);
  if (!state.appearanceApproval || !state.result) throw new Error('An approved final result is required.');
  const result = await settleAppearance(connection, payer, accounts, id, state);
  // Persist only public, verified evidence. A crash here is recoverable from the marker.
  if (!state.appearanceReceipt) {
    state.appearanceReceipt = {signature:result.signature ?? null, payments:result.payments};
    if (!store.update(id, row.version, state) && !JSON.parse(store.read(id).state).appearanceReceipt)
      throw new Error('Payment verified; retry to save the public receipt.');
  }
  return {...result, score:state.result.score};
}
