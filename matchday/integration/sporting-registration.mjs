import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFile,spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export async function registrationJourney(rpc,world,trial,journal,settle) {
  const fixtureDb=join(world,'sporting.sqlite'), configFile=join(world,'sporting.json');
  const config={fixtureDb,validatorGenesis:await rpc.getGenesisHash(),sponsor:trial.listing.sponsor,
    bbMint:trial.listing.bbMint,players:{[trial.listing.playerMint]:'northbank-7'},
    wallets:{[trial.listing.seller]:'northbank',[trial.buyer]:'eastport'},journals:[journal]};
  const write=()=>writeFileSync(configFile,JSON.stringify(config));
  write();
  const env={...process.env,BALLERZ_DEVNET_RPC:rpc.rpcEndpoint,FIXTURE_DB:fixtureDb,
    PORT:'0',HOST:'127.0.0.1',WORLD_START_UTC:new Date(Date.now()-86400000).toISOString()};
  const index=async()=>JSON.parse((await promisify(execFile)(process.execPath,
    [fileURLToPath(new URL('../scripts/register-transfers.mjs',import.meta.url)),configFile],{env})).stdout);
  const server=spawn(process.execPath,[fileURLToPath(new URL('../server.js',import.meta.url))],{env,stdio:['ignore','pipe','pipe']});
  const closed=once(server,'exit');
  let browser;
  try {
    const [output]=await once(server.stdout,'data');
    const origin=String(output).match(/http:\/\/127\.0\.0\.1:\d+/)[0];
    async function api(path,token,body) {
      const response=await fetch(origin+'/api/fixtures'+path,{method:body===undefined?'GET':'POST',
        headers:token?{authorization:'Bearer '+token}:{},body:JSON.stringify(body)});
      const data=await response.json();assert.ok(response.ok,data.error);return data;
    }
    const {id,key}=await api('',null,{kickoffAt:Date.now()+3600000});
    const fixture=await api('/'+id,key);
    const away=await api('/'+id+'/join',fixture.invite,{});
    const [pending]=await index();
    assert.equal(pending.status,'pending');
    assert.equal((await api('/'+id,key)).transfers[0].reference,pending.reference);
    browser=await chromium.launch();
    const page=await browser.newPage();
    await page.addInitScript(({id,key})=>sessionStorage.setItem('ballerz.fixture.'+id,key),{id,key:away.key});
    await page.goto(origin+'/?fixture='+id);
    const registration=page.locator('section.registration');
    await registration.getByText(/Awaiting finalized settlement/).waitFor();
    assert.equal(await registration.locator('code').textContent(),pending.reference);
    const receipt=await settle();
    // A restart can resume by reference alone, even if a wallet mapping changed
    // or the private financial journal is no longer available to this reader.
    config.journals=[];config.wallets={};write();
    const [final]=await index();
    assert.equal(final.reference,receipt.signature);
    assert.equal(final.effectiveAt,receipt.blockTime*1000);
    assert.equal(final.firstFixture,id);
    await registration.getByText(/First eligible fixture is this match/).waitFor();
    await page.getByLabel('Starting player').selectOption('eastport-7');
    await page.getByRole('button',{name:/Start Jude Kavan in place of/}).click();
    const submitted=page.waitForResponse(r=>r.url().endsWith('/ready') && r.request().method()==='POST');
    await page.getByRole('button',{name:'Submit team sheet'}).click();
    assert.equal((await submitted).status(),200);
    const sheet=await api('/'+id,away.key);
    assert.ok(sheet.plans[1].xi.includes('northbank-7'));
    assert.equal(sheet.transfers.length,1);
    return receipt;
  } finally {
    try { await browser?.close(); } finally { server.kill(); await closed; }
  }
}
