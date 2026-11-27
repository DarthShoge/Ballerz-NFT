import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { openStore } from '../src/local-store.js';
import { treasuryAddresses } from '../src/devnet-settlement.js';
import { settleFixture } from '../src/fixture-appearance.js';

const [world, port, id, mode] = process.argv.slice(2);
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(world + '/payer.json'))));
const store = openStore(world + '/fixtures.sqlite');
const state = JSON.parse(store.read(id).state);
const accounts = await treasuryAddresses(payer.publicKey, state.appearanceApproval.owners.map(key => new PublicKey(key)));
const rpc = new Connection('http://127.0.0.1:' + port, 'finalized');

if (mode === 'crash') {
  // The production worker reaches this storage boundary only after verifying finality.
  store.update = () => process.exit(86);
}
if (mode === 'race') {
  const send = rpc.sendRawTransaction.bind(rpc);
  rpc.sendRawTransaction = async (bytes, options) => {
    const release = once(process, 'message');
    process.send({ready: Transaction.from(bytes).recentBlockhash});
    await release;
    return send(bytes, options);
  };
}
try {
  const result = await settleFixture(store, rpc, payer, accounts, id);
  process.send({result});
} finally {
  store.close();
  process.disconnect();
}
