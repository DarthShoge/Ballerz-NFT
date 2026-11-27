export function keyOf(value) {
  const address=value?.publicKey ?? value;
  if (!address || (typeof address!=='string' && !address.toBase58 && !(address instanceof Uint8Array))) return null;
  return new solanaWeb3.PublicKey(address.toBase58?.() ?? address);
}

// Older injected wallets can acknowledge a request before reporting the account.
export async function connectInjected(provider) {
  let reported;
  const connected = key => { reported=keyOf(key); };
  provider.on?.('connect',connected);
  try {
    const reply=await provider.connect();
    if (reply===false) throw Error('Solflare did not approve the connection. Unlock it and try again.');
    const deadline=Date.now()+60000;
    let key=keyOf(provider.publicKey) ?? keyOf(reply) ?? reported;
    while (!key && Date.now()<deadline) {
      await new Promise(resolve=>setTimeout(resolve,200));
      key=keyOf(provider.publicKey) ?? reported;
    }
    if (!key) throw Error('Solflare has not shared an account. Unlock your Ballerz wallet, approve the connection, then reconnect.');
    return key;
  } finally {
    if (provider.off) provider.off('connect',connected);
    else provider.removeListener?.('connect',connected);
  }
}

export function standardSolflare(wallet) {
  const chain='solana:devnet';
  const connect=wallet.features['standard:connect'];
  const signing=wallet.features['solana:signTransaction'];
  const events=wallet.features['standard:events'];
  if (!connect || !signing || !events) throw Error('This Solflare wallet does not support listing signatures.');
  let account;
  return {
    get publicKey() {return keyOf(account?.address);},
    async connect() {
      const {accounts}=await connect.connect();
      account=accounts[0];
      if (!account) throw Error('Unlock Solflare and approve sharing your Ballerz account.');
      if (!account.chains.includes(chain)) throw Error('Select Devnet in Solflare and reconnect.');
      return this.publicKey;
    },
    watch(reset) {
      return events.on('change',change=>{
        if (change.accounts && change.accounts[0]?.address!==account?.address) {
          account=undefined;
          reset();
        }
      });
    },
    async signTransaction(tx) {
      if (!account || wallet.accounts[0]?.address!==account.address) throw Error('The wallet account changed. Reconnect to review the terms.');
      const [result]=await signing.signTransaction({account,chain,transaction:
        new Uint8Array(tx.serialize({requireAllSignatures:false}))});
      return solanaWeb3.Transaction.from(result.signedTransaction);
    }
  };
}
