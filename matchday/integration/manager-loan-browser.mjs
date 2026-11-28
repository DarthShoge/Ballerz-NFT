import assert from 'node:assert/strict';
import { ed25519 } from '@noble/curves/ed25519';
import { loanMessage } from '../public/loan-message.js';

export async function managerLoanJourney(browser,origin,agreement,managers,checkPendingFixture) {
  const url=origin+agreement.reviewPath;
  const api=origin+'/api/loans/'+agreement.terms.id;
  const withoutSignature=await fetch(api+'/approve',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({wallet:agreement.terms.ownerWallet,signature:''})});
  assert.equal(withoutSignature.status,403);
  const altered=await fetch(api+'/approve',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({wallet:agreement.terms.ownerWallet,signature:'',borrowerWageBps:0})});
  assert.equal(altered.status,400);
  async function managerPage(role) {
    const page=await browser.newPage();
    const manager=managers[role];
    await page.exposeFunction('signReviewed',base64=>{
      const message=Buffer.from(base64,'base64');
      const signed=message.toString('utf8');
      if (signed.startsWith('View my Ballerz loan agreements\n')) {
        assert.ok(signed.startsWith('View my Ballerz loan agreements\n'+origin+'\nWallet: '+manager.publicKey+'\nRequest: '));
      } else assert.equal(signed,loanMessage(agreement.terms));
      return Buffer.from(ed25519.sign(message,manager.secretKey.slice(0,32))).toString('base64');
    });
    await page.addInitScript(({address,role})=>{
      const sign=async bytes=>Uint8Array.from(atob(await window.signReviewed(btoa(String.fromCharCode(...bytes)))),c=>c.charCodeAt(0));
      if (role==='parent') {
        const account={address,chains:['solana:devnet']};
        const wallet={name:'Solflare',accounts:[account],features:{
          'standard:connect':{connect:async()=>({accounts:[account]})},
          'solana:signMessage':{signMessage:async({account:selected,message})=>{
            if (selected!==account) throw Error('Wrong wallet account');
            return [{signedMessage:message,signature:await sign(message)}];
          }}
        }};
        window.addEventListener('wallet-standard:app-ready',e=>e.detail.register(wallet));
      } else {
        window.solflare={publicKey:address,connect:async()=>({publicKey:address}),signMessage:sign};
      }
    },{address:String(manager.publicKey),role});
    await page.goto(origin);
    await page.getByRole('link',{name:'Loans',exact:true}).click();
    await page.getByRole('button',{name:'Open my inbox'}).click();
    await page.getByRole('link',{name:/Awaiting your approval/}).click();
    assert.equal(page.url(),url);
    await page.getByRole('button',{name:'Connect Solflare'}).click();
    await page.getByText('Connected wallet · '+manager.publicKey).waitFor();
    return page;
  }
  const parent=await managerPage('parent'), borrower=await managerPage('borrower');
  const approve=async page=>{
    const received=page.waitForResponse(response=>response.url()===api+'/approve');
    await page.getByRole('button',{name:'Approve loan terms'}).click();
    const response=await received;
    assert.equal(response.status(),200);
    return {view:await response.json(),body:response.request().postDataJSON()};
  };
  try {
    const first=await approve(parent);
    assert.ok(first.view.parentApproved);
    assert.equal(first.view.confirmedAt,null);
    await checkPendingFixture();
    const second=await approve(borrower);
    assert.ok(second.view.confirmedAt);
    assert.equal(second.view.status,'scheduled');
    await parent.getByRole('button',{name:'Refresh agreement'}).click();
    await parent.getByText(/Agreement scheduled · Parent approved · Borrower approved/).waitFor();
    const retry=await fetch(api+'/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(second.body)});
    assert.deepEqual(await retry.json(),second.view);
    assert.deepEqual(await (await fetch(api)).json(),second.view);
  } finally {await parent.close();await borrower.close();}
}
