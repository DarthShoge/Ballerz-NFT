import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureApi } from '../src/fixtures.js';
import { openStore } from '../src/local-store.js';

test('two managers can complete one durable fixture, even with concurrent team sheets', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ballerz-'));
  const file = join(dir, 'match.db');
  let db = openStore(file);
  async function call(path, method = 'GET', key, body) {
    const response = await fixtureApi(new Request('http://local/api/' + path, {
      method, headers: key ? {Authorization:'Bearer ' + key} : {}, body: JSON.stringify(body)
    }), db);
    return {status: response.status, data: await response.json()};
  }
  try {
    const {data:home} = await call('fixtures', 'POST');
    const path = 'fixtures/' + home.id;
    assert.equal((await call(path)).status, 401);
    const {data:first} = await call(path, 'GET', home.key);
    const claims = await Promise.all([1,2].map(() => call(path + '/join','POST',first.invite)));
    assert.deepEqual(claims.map(x => x.status).sort(), [200,403]);
    const away = claims.find(x => x.status === 200).data;
    assert.equal((await call(path,'GET',away.key)).data.side, 1);
    assert.equal((await call(path + '/ready','POST',home.key,first.defaults[1])).status, 400);
    const ready = await Promise.all([home,away].map((manager, i) =>
      call(path + '/ready','POST',manager.key,first.defaults[i])));
    assert.ok(ready.every(x => x.status === 200));
    const pending = ready.find(x => !x.data.result).data;
    assert.equal(pending.plans[1-pending.side], null);
    const result = ready.find(x => x.data.result).data.result;
    db.close();
    db = openStore(file);
    for (const [i,manager] of [home,away].entries()) {
      assert.deepEqual((await call(path,'GET',manager.key)).data.result, result);
      assert.deepEqual((await call(path + '/ready','POST',manager.key,first.defaults[i])).data.result, result);
    }
    assert.equal((await call(path + '/ready','POST',home.key,{...first.defaults[0], tactic:'press'})).status,409);
  } finally { db.close(); rmSync(dir, {recursive:true, force:true}); }
});
