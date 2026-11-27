import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFile,spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { GAME_WEEK_MS } from '../src/world-clock.js';
import { managerLoanJourney } from './manager-loan-browser.mjs';
import { playDueFixtures } from '../src/fixtures.js';
import { openStore } from '../src/local-store.js';
import { approveFixture } from '../src/fixture-appearance.js';
import { treasuryAddresses } from '../src/devnet-settlement.js';

export async function registrationJourney(rpc,world,trial,journal,settle,managers) {
  const fixtureDb=join(world,'sporting.sqlite'), configFile=join(world,'sporting.json');
  const config={fixtureDb,validatorGenesis:await rpc.getGenesisHash(),sponsor:trial.listing.sponsor,
    bbMint:trial.listing.bbMint,players:{[trial.listing.playerMint]:'northbank-7'},
    wallets:{[trial.listing.seller]:'northbank',[trial.buyer]:'eastport'},journals:[journal]};
  const write=()=>writeFileSync(configFile,JSON.stringify(config));
  write();
  const env={...process.env,BALLERZ_DEVNET_RPC:rpc.rpcEndpoint,FIXTURE_DB:fixtureDb,
    BALLERZ_LOAN_OPERATOR:configFile,PORT:'0',HOST:'127.0.0.1',WORLD_START_UTC:new Date(Date.now()-86400000).toISOString()};
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
    const currency=config.bbMint;
    config.bbMint=trial.listing.playerMint;
    write();
    await assert.rejects(index(),/different registration network, currency or sponsor/);
    config.bbMint=currency;
    write();
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
    const proposalFile=join(world,'proposed-loan.json');
    const startAt=Date.now()+3600000;
    writeFileSync(proposalFile,JSON.stringify({player:'northbank-7',borrower:'northbank',
      startAt,endAt:startAt+4*GAME_WEEK_MS}));
    const {stdout}=await promisify(execFile)(process.execPath,
      [fileURLToPath(new URL('../scripts/review-loan.mjs',import.meta.url)),configFile,proposalFile],{env});
    const proposal=JSON.parse(stdout);
    assert.equal(proposal.status,'proposal');
    assert.equal(proposal.parent,'eastport');
    assert.equal(proposal.ownerWallet,String(trial.buyer));
    assert.equal(proposal.ownershipReference,receipt.signature);
    assert.equal(proposal.borrowerWageBps,10000);
    assert.deepEqual((await api('/'+id,away.key)).plans,sheet.plans);
    config.loanManagers={eastport:String(managers.parent.publicKey),northbank:String(managers.borrower.publicKey)};
    config.wallets=Object.fromEntries(Object.entries(config.loanManagers).map(([club,wallet])=>[wallet,club]));
    write();
    const issue=()=>promisify(execFile)(process.execPath,
      [fileURLToPath(new URL('../scripts/propose-loan.mjs',import.meta.url)),configFile,proposalFile],{env});
    const agreement=JSON.parse((await issue()).stdout);
    assert.equal(JSON.parse((await issue()).stdout).terms.id,agreement.terms.id);
    const kickoffAt=startAt+3600000;
    const loanGame=await api('',null,{kickoffAt});
    const path='/'+loanGame.id;
    const previous=await api(path,loanGame.key);
    const parent=await api(path+'/join',previous.invite,{});
    const parentXI={...previous.defaults[1],xi:previous.defaults[1].xi.map(p=>p==='eastport-7'?'northbank-7':p)};
    assert.ok((await api(path+'/ready',parent.key,parentXI)).ready[1]);
    await managerLoanJourney(browser,origin,agreement,managers,async()=>{
      assert.deepEqual((await api(path,parent.key)).plans[1],parentXI);
    });
    const recovered=JSON.parse((await issue()).stdout);
    assert.equal(recovered.terms.id,agreement.terms.id);
    assert.equal(recovered.status,'scheduled');
    assert.ok(recovered.parentApproved && recovered.borrowerApproved && recovered.confirmedAt);
    const borrowerView=await api(path,loanGame.key);
    assert.equal(borrowerView.ready[1],false);
    assert.ok(borrowerView.clubs[0].squad.some(p=>p.id==='northbank-7'));
    assert.ok(!JSON.stringify(borrowerView).includes(agreement.terms.id));
    assert.deepEqual((await api('/'+id,away.key)).plans,sheet.plans);
    const borrowerPage=await browser.newPage();
    await borrowerPage.addInitScript(({id,key})=>sessionStorage.setItem('ballerz.fixture.'+id,key),loanGame);
    await borrowerPage.goto(origin+'/?fixture='+loanGame.id);
    await borrowerPage.getByText(/On loan to Northbank Athletic for this fixture/).waitFor();
    const ready=borrowerPage.waitForResponse(r=>r.url().endsWith('/ready') && r.request().method()==='POST');
    await borrowerPage.getByRole('button',{name:'Submit team sheet'}).click();
    assert.equal((await ready).status(),200);
    assert.ok((await api(path,loanGame.key)).plans[0].xi.includes('northbank-7'));
    await borrowerPage.close();
    const accounts=await treasuryAddresses(trial.listing.sponsor,[managers.borrower.publicKey,managers.parent.publicKey]);
    const store=openStore(fixtureDb);
    try {
      approveFixture(store,accounts,loanGame.id);
      await api(path+'/ready',parent.key,borrowerView.defaults[1]);
      const row=store.read(loanGame.id);
      assert.ok(store.update(loanGame.id,row.version,{...JSON.parse(row.state),matchSeed:42}));
      await playDueFixtures(store,kickoffAt);
      await playDueFixtures(store,kickoffAt+900000);
      const result=JSON.parse(store.read(loanGame.id).state).result;
      const minutes=result.performances[0].find(p=>p.playerId==='northbank-7').minutes;
      assert.ok(minutes>0);
      const url=origin+'/api/loans/'+agreement.terms.id;
      assert.equal((await (await fetch(url)).json()).matchMinutes,minutes);
    } finally {store.close();}
    return receipt;
  } finally {
    try { await browser?.close(); } finally { server.kill(); await closed; }
  }
}
