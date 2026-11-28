import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { Keypair } from '@solana/web3.js';
import { ed25519 } from '@noble/curves/ed25519';
import { inboxMessage } from '../public/inbox-message.js';
import { loanInbox } from '../src/loan-inbox.js';
import { loanApi } from '../src/loan-desk.js';

test('manager inbox requires a fresh wallet proof for this origin and returns only that wallet’s agreements',async t=>{
  const db=new DatabaseSync(':memory:'); t.after(()=>db.close());
  db.exec('CREATE TABLE loan_agreements(id TEXT,terms TEXT,startAt INTEGER,endAt INTEGER,confirmedAt INTEGER,parentSignature TEXT,borrowerSignature TEXT,superseded INTEGER)');
  let now=1000;
  const desk={inbox:loanInbox(db,()=>now)};
  const origin='http://localhost:4173';
  const [parent,borrower,stranger]=Array.from({length:3},()=>Keypair.generate());
  const wallet=String(parent.publicKey);
  const terms={ownerWallet:wallet,borrowerWallet:String(borrower.publicKey),parent:'eastport',borrower:'northbank',player:'northbank-7'};
  const insert=db.prepare("INSERT INTO loan_agreements VALUES(?,?,2000,3000,NULL,'signed',NULL,?)");
  insert.run('mine',JSON.stringify(terms),0);
  insert.run('replaced',JSON.stringify(terms),1);
  insert.run('other',JSON.stringify({...terms,ownerWallet:'other'}),0);
  const post=(path,body,site=origin)=>loanApi(new Request(origin+'/api/loans/inbox'+path,{method:'POST',
    headers:{'content-type':'application/json',host:'localhost:4173',origin:site},body:JSON.stringify(body)}),desk);
  const getTicket=async address=>(await post('/challenge',{wallet:address})).json();
  const proof=(signer,address,ticket)=>({wallet:address,nonce:ticket.nonce,signature:Buffer.from(
    ed25519.sign(Buffer.from(inboxMessage(origin,address,ticket)),signer.secretKey.slice(0,32))).toString('base64')});
  assert.equal((await post('/challenge',{wallet},'https://elsewhere.example')).status,403);
  assert.equal((await post('/challenge',{wallet:'bad'})).status,400);
  const ticket=await getTicket(wallet),args=proof(parent,wallet,ticket);
  assert.equal((await post('',proof(stranger,wallet,ticket))).status,403);
  assert.equal((await post('',args,'http://localhost:4188')).status,403);
  const response=await post('',args);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const rows=await response.json();
  assert.deepEqual(rows.map(row=>[row.id,row.status]),[['mine','Awaiting the other manager']]);
  assert.equal((await post('',args)).status,403);
  const unknown=String(stranger.publicKey);
  assert.deepEqual(await (await post('',proof(stranger,unknown,await getTicket(unknown)))).json(),[]);
  const expired=await getTicket(wallet);
  now=expired.expiresAt;
  assert.equal((await post('',proof(parent,wallet,expired))).status,403);
});
