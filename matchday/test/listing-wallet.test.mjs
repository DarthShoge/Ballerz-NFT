import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Keypair, PublicKey } from '@solana/web3.js';
import { connectInjected } from '../public/listing-wallet.js';

test('an injected wallet may acknowledge connect before reporting its public key',async()=>{
  globalThis.solanaWeb3={PublicKey};
  try {
    const key=Keypair.generate().publicKey;
    const wallet=new EventEmitter();
    wallet.connect=async()=>{setTimeout(()=>wallet.emit('connect',key),10);};
    assert.ok((await connectInjected(wallet)).equals(key));
    assert.equal(wallet.listenerCount('connect'),0);
    wallet.connect=async()=>key.toBase58();
    assert.ok((await connectInjected(wallet)).equals(key));
    wallet.connect=async()=>false;
    await assert.rejects(connectInjected(wallet),/did not approve/);
    assert.equal(wallet.listenerCount('connect'),0);
  } finally {delete globalThis.solanaWeb3;}
});
