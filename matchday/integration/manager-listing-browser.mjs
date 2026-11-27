import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Transaction } from '@solana/web3.js';
import { chromium } from 'playwright';
import { listingApi, openListingDesk } from '../src/manager-listings.js';

export async function managerListingJourney(rpc,sponsor,seller,other,world) {
  const genesis=await rpc.getGenesisHash();
  const open=()=>openListingDesk(rpc,sponsor,join(world,'manager.sqlite'),genesis);
  let desk=await open();
  const files=new Map(['listings.html','listings.js','reviewed-listing.js','listings.css','matchday.css'].map(name=>[
    '/'+name,readFileSync(new URL('../public/'+name,import.meta.url))]));
  files.set('/vendor/solana.js',readFileSync(join(dirname(createRequire(import.meta.url).resolve('@solana/web3.js')),'index.iife.min.js')));
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if (files.has(url.pathname)) {
        res.setHeader('content-type',url.pathname.endsWith('js')?'application/javascript':url.pathname.endsWith('css')?'text/css':'text/html');
        return res.end(files.get(url.pathname));
      }
      const chunks=[]; for await(const chunk of req) chunks.push(chunk);
      const input=new Request(url,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined});
      const output=await listingApi(input,desk);res.writeHead(output.status,Object.fromEntries(output.headers));res.end(await output.text());
    } catch {res.writeHead(500).end();}
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  let browser;
  try {
    browser=await chromium.launch();
    const page=await browser.newPage();
    const address=seller.publicKey.toBase58();
    let deny=true;
    await page.exposeFunction('testSign',wire=>{
      if (deny) throw Error('Manager declined the wallet request.');
      const tx=Transaction.from(Buffer.from(wire,'base64'));tx.partialSign(seller);
      return tx.serialize({requireAllSignatures:false}).toString('base64');
    });
    await page.addInitScript(({address})=>{
      // The browser only sees a wallet interface, as it does with an extension.
      window.solana={
        get publicKey(){return new window.solanaWeb3.PublicKey(address);},
        async connect(){return {publicKey:this.publicKey};},
        async signTransaction(tx){
          const wire=btoa(String.fromCharCode(...tx.serialize({requireAllSignatures:false})));
          return window.solanaWeb3.Transaction.from(Uint8Array.from(atob(await window.testSign(wire)),c=>c.charCodeAt(0)));
        }
      };
    },{address});
    const origin='http://127.0.0.1:'+server.address().port;
    const request=async(path,body)=>{
      const reply=await fetch(origin+'/api/listings'+path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{});
      return {status:reply.status,data:await reply.json()};
    };
    const initial=await request('');
    const draft={seller:address,revision:initial.data.revision,price:100000,action:'list'};
    assert.equal((await request('/review',{...draft,seller:other.publicKey.toBase58()})).status,403);
    assert.equal((await request('/review',{...draft,price:-1})).status,400);
    const {data:packet}=await request('/review',draft);
    const wire=Transaction.from(Buffer.from(packet.quote.wire,'base64'));wire.partialSign(seller);
    const signed=wire.serialize({requireAllSignatures:false}).toString('base64');
    assert.equal((await request('/approve',{...packet,signed:packet.quote.wire})).status,403);
    assert.equal((await request('/approve',{...packet,quote:{...packet.quote,price:1},signed})).status,400);
    await page.goto(origin+'/listings.html');
    const button=name=>page.getByRole('button',{name,exact:true});
    await button('Connect seller wallet').click();
    await button('Review listing').click();
    await page.locator('#terms').getByText('130,000 test BB',{exact:true}).waitFor();
    await button('Approve listing in wallet').click();
    await page.getByText(/Manager declined/).waitFor();
    assert.equal((await request('')).data.last,null);
    await page.locator('#price').fill('110000');
    assert.ok(await page.locator('#approval').isHidden());
    await button('Review listing').click();
    await page.locator('#terms').getByText('140,000 test BB',{exact:true}).waitFor();
    deny=false;
    const posted=page.waitForResponse(r=>r.url().endsWith('/approve'));
    await button('Approve listing in wallet').click();
    const approval=await posted;
    assert.equal(approval.status(),200);
    const receipt=await approval.json();
    const submission=approval.request().postDataJSON();
    // Open the same durable store again before resuming by the exact signature.
    desk.close();desk=await open();
    assert.equal((await request('/approve',submission)).data.signature,receipt.signature);
    async function finalized() {
      for(let attempt=0;attempt<90;attempt++){
        const {data}=await request('');
        if(data.last?.state==='finalized') return data;
        assert.equal(data.last?.state,'pending');
        await delay(500);
      }
      assert.fail('Listing did not finalize');
    }
    let market=await finalized();
    assert.equal(market.active.price,110000);
    assert.equal(market.active.signature,receipt.signature);
    assert.equal((await request('/approve',{...packet,signed})).status,409);
    await page.reload();await button('Connect seller wallet').click();
    await button('Review cancellation').click();await button('Approve cancellation in wallet').click();
    await page.getByText(/Approval recorded/).waitFor();
    market=await finalized();
    assert.equal(market.last.action,'cancel');
    assert.equal(market.active,null);
    await page.reload();
    await page.getByText('No active listing.').waitFor();
  } finally {
    await browser?.close();await new Promise(resolve=>server.close(resolve));desk.close();
  }
}
