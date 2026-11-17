import { clubs, defaultPlan, tactics, validatePlan, simulate } from './football.js';

const defaults = clubs.map(club => defaultPlan(club));
const catalog = { clubs, defaults, tactics };
const encode = value => Array.from(value, x => x.toString(16).padStart(2, '0')).join('');
const newKey = () => encode(crypto.getRandomValues(new Uint8Array(32)));
const digest = async key => encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))));
const json = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
const error = (message, status) => json({error: message}, status);

function view(id, state, side) {
  return {
    ...catalog, id, side, joined: Boolean(state.managers[1]),
    ready: state.plans.map(Boolean), result: state.result,
    plans: state.plans.map((plan, i) => i === side || state.result ? plan : null),
    invite: side === 0 ? state.invite : null
  };
}

export async function fixtureApi(request, store) {
  const path = new URL(request.url).pathname;
  const method = request.method;
  if (method === 'GET' && path === '/api/clubs') return json(catalog);

  if (method === 'POST' && path === '/api/fixtures') {
    const id = crypto.randomUUID();
    const key = newKey();
    const state = { managers: [await digest(key), null], invite: newKey(), plans: [null, null], result: null };
    await store.create(id, state);
    return json({id, key}, 201);
  }

  const match = /^\/api\/fixtures\/([a-f0-9-]{36})(?:\/(join|ready))?$/.exec(path);
  if (!match) return error('Fixture not found.', 404);
  const [, id, action] = match;
  if (method !== (action ? 'POST' : 'GET')) return error('Unsupported method.', 405);
  const auth = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization') || '');
  if (!auth) return error('A manager key or invitation is required.', 401);
  const token = auth[1];
  const hash = await digest(token);
  let submitted;
  if (action === 'ready') {
    try { submitted = await request.json(); } catch { return error('Invalid team sheet.', 400); }
  }

  // Re-read after competing updates. Only the successful version is visible to either manager.
  for (let retry = 0; retry < 5; retry++) {
    const row = await store.read(id);
    if (!row) return error('Fixture not found.', 404);
    const state = JSON.parse(row.state);
    if (action === 'join') {
      // An invite alone is single-use. The original client can recover a lost claim response.
      const nonce = request.headers.get('Idempotency-Key');
      const claimKey = nonce && /^[a-f0-9-]{32,64}$/i.test(nonce) ? await digest(token + ':' + nonce) : null;
      if (!state.invite && claimKey && state.managers[1] === await digest(claimKey)) return json({id, key:claimKey});
      if (!state.invite || state.invite !== token) return error('This invitation is invalid or already claimed.', 403);
      const key = claimKey || newKey();
      state.managers[1] = await digest(key);
      state.invite = null;
      if (await store.update(id, row.version, state)) return json({id, key});
      continue;
    }

    const side = state.managers.indexOf(hash);
    if (side < 0) return error('This manager key does not match the fixture.', 403);
    if (!action) return json(view(id, state, side));
    const problem = validatePlan(clubs[side], submitted);
    if (problem) return error(problem, 400);
    const plan = {formation: submitted.formation, tactic: submitted.tactic, xi: submitted.xi};
    if (state.plans[side]) {
      if (JSON.stringify(plan) === JSON.stringify(state.plans[side])) return json(view(id, state, side));
      return error('Your team sheet is locked for this fixture.', 409);
    }
    state.plans[side] = plan;
    if (state.plans.every(Boolean)) state.result = simulate(...state.plans);
    if (await store.update(id, row.version, state)) return json(view(id, state, side));
  }
  return error('The fixture was updated. Please try again.', 409);
}
