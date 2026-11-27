import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { openGrantLedger } from '../src/grant-ledger.js';
import { fixedMint, parseTrial, settleTrial, signTrial, submitSigned } from '../scripts/transfer-trial.mjs';
import { registrationJourney } from './sporting-registration.mjs';

export async function grantSaleJourney(rpc,payer,world) {
  const [home,affiliate,away,treasury]=Array.from({length:4},()=>Keypair.generate());
  const bbMint=await fixedMint(rpc,payer,'grant-test-bb',[[affiliate.publicKey,180000n],[away.publicKey,400000n]]);
  const config={genesis:await rpc.getGenesisHash(),treasury:treasury.publicKey,controlGroups:new Map(
    [[home,'A'],[affiliate,'A'],[away,'B']].map(([key,group])=>[key.publicKey.toBase58(),group]))};
  const filename=join(world,'grants.sqlite');
  const configPath=join(world,'grant-operator.json');
  writeFileSync(configPath,JSON.stringify({ledger:filename,validatorGenesis:config.genesis,
    treasury:config.treasury,controlGroups:Object.fromEntries(config.controlGroups)}));
  const command=(action,input)=>promisify(execFile)(process.execPath,[
    fileURLToPath(new URL('../scripts/grant-sale.mjs',import.meta.url)),action,configPath,input
  ],{env:{...process.env,BALLERZ_DEVNET_RPC:rpc.rpcEndpoint}});
  let ledger=openGrantLedger(filename,config);
  const sign=(seller,buyer,assets,price,wages=30000)=>{
    const reviewedTerms=ledger.quote({...assets,sponsor:payer.publicKey,seller:seller.publicKey,price,wages},buyer.publicKey);
    return signTrial(rpc,payer,seller,buyer,assets,{ledger,reviewedTerms});
  };
  try {
    const issue = async seed=>{
      const playerMint=await fixedMint(rpc,payer,seed,[[home.publicKey,1n]]);
      const allocation=join(world,seed+'.json');
      writeFileSync(allocation,JSON.stringify({playerMint,bbMint,sponsor:payer.publicKey,seller:home.publicKey,claim:200000}));
      await command('register',allocation);
      return {playerMint,bbMint};
    };
    const first=await issue('grant-test-connected');
    await assert.rejects(signTrial(rpc,payer,home,affiliate,first),/ledger/);
    const termsFile=join(world,'review.json');
    writeFileSync(termsFile,JSON.stringify({...first,sponsor:payer.publicKey,seller:home.publicKey,buyer:affiliate.publicKey,price:150000,wages:30000}));
    const reviewedTerms=JSON.parse((await command('review',termsFile)).stdout);
    await assert.rejects(signTrial(rpc,payer,home,affiliate,first,{ledger,reviewedTerms:{...reviewedTerms,carried:0}}),/Review/);
    const sale=await sign(home,affiliate,first,150000);
    await assert.rejects(sign(home,away,first,150000),/pending/);
    await assert.rejects(settleTrial(rpc,sale),/ledger/);
    // Simulate a crash between finality and the database commit. Only the
    // reserved purchase may finish, including after the process restarts.
    const crash={...ledger,finalize(){throw Error('process stopped before commit');}};
    await assert.rejects(settleTrial(rpc,sale,crash),/process stopped/);
    await assert.rejects(sign(home,away,first,150000),/pending/);
    ledger.close();
    ledger=openGrantLedger(filename,config);
    const resumed=parseTrial(ledger.pending(first.playerMint).journal);
    const receipt=JSON.parse((await command('recover',first.playerMint.toBase58())).stdout);
    assert.deepEqual(await settleTrial(rpc,resumed,ledger),receipt);
    assert.deepEqual([receipt.grant.recovered,receipt.grant.carried,receipt.grant.writtenOff],[150000,50000,0]);
    assert.equal(receipt.sellerBB.after,'0');
    assert.equal(receipt.wageReserve.after,'30000');
    assert.equal(receipt.buyerTitle.after,'1');
    assert.equal(ledger.pending(first.playerMint),undefined);
    assert.deepEqual(await settleTrial(rpc,sale,ledger),receipt);

    const resale=await sign(affiliate,away,first,75000);
    const second=await settleTrial(rpc,resale,ledger);
    assert.deepEqual([second.grant.recovered,second.grant.sellerProceeds,second.grant.carried],[50000,25000,0]);
    assert.equal(second.sellerBB.after,'25000');
    const latest=ledger.quote({...resale.listing,seller:away.publicKey},home.publicKey);
    assert.equal(latest.grant.claim,0);
    assert.equal(latest.originalPurchaseGrant,200000);
    const clearSale=await sign(away,affiliate,first,10000,0);
    const clear=await settleTrial(rpc,clearSale,ledger);
    assert.deepEqual([clear.grant.recovered,clear.grant.sellerProceeds,clear.grant.carried],[0,10000,0]);
    // Retrying a previous owner's finalized sale cannot reopen the old claim.
    assert.deepEqual(await settleTrial(rpc,sale,ledger),receipt);
    const other=await issue('grant-test-independent');
    const unfunded=await sign(home,affiliate,other,150000);
    await submitSigned(rpc,unfunded.publication,unfunded.listing);
    const failedSig=await rpc.sendRawTransaction(Buffer.from(unfunded.purchase,'base64'),{skipPreflight:true});
    const {blockhash,lastValidBlockHeight}=unfunded.listing;
    const failed=await rpc.confirmTransaction({signature:failedSig,blockhash,lastValidBlockHeight},'finalized');
    assert.ok(failed.value.err);
    await assert.rejects(settleTrial(rpc,unfunded,ledger),/Finalized message/);
    assert.equal(ledger.pending(other.playerMint),undefined);
    assert.equal(ledger.quote(unfunded.listing,affiliate.publicKey).grant.claim,200000);
    const independent=await sign(home,away,other,150000);
    const signedFile=join(world,'approved-grant-sale.json');
    writeFileSync(signedFile,JSON.stringify(independent),{mode:0o600});
    const loss=await registrationJourney(rpc,world,independent,signedFile,async()=>
      JSON.parse((await command('settle',signedFile)).stdout),{parent:away,borrower:home});
    assert.deepEqual([loss.grant.recovered,loss.grant.writtenOff,loss.grant.carried],[150000,50000,0]);
    assert.equal(ledger.quote({...independent.listing,seller:away.publicKey},home.publicKey).grant.claim,0);
    assert.equal((await rpc.getTokenAccountBalance(getAssociatedTokenAddressSync(bbMint,treasury.publicKey),'finalized')).value.amount,'350000');
  } finally {ledger.close();}
}
