// The match service attests eligibility. The settlement operator reads this durable
// state from SQLite, never a score or recipient list supplied by a browser.
export const APPEARANCE_BB = 8_000;

export function appearanceSides(state) {
  if (!state.schedule || state.computerAway) throw new Error('Only scheduled two-manager fixtures qualify.');
  const result = state.result;
  if (!result) throw new Error('Fixture is not final.');
  const ready = state.plans.map((plan, side) => Boolean(plan)
    && Number.isSafeInteger(state.receivedAt?.[side])
    && state.receivedAt[side] < state.schedule.deadlineAt);
  if (result.kind === 'double-forfeit' && ready.every(value => !value)) return [];
  if (result.kind === 'forfeit' && ready.filter(Boolean).length === 1) return [ready.indexOf(true)];
  if (!ready.every(Boolean)) throw new Error('Inconsistent kickoff evidence.');
  if (!result.kind && result.engineVersion && Array.isArray(result.score)) return [0, 1];
  if (['abandoned', 'double-abandonment'].includes(result.kind)
      && result.abandonmentEligible?.length === 2 && result.abandonmentEligible.every(x => typeof x === 'boolean')) {
    return [0, 1].filter(side => result.abandonmentEligible[side]);
  }
  throw new Error('Unrecognized result or missing abandonment evidence.');
}
