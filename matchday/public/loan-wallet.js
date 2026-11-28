import { getWallets } from '/vendor/wallet-standard.js';
import { connectInjected, keyOf } from './listing-wallet.js';

const registry=getWallets();

export async function connectLoanWallet() {
  const wallet=registry.get().find(w=>w.name==='Solflare');
  if (wallet?.features['solana:signMessage'] && wallet.features['standard:connect']) {
    const {accounts}=await wallet.features['standard:connect'].connect();
    const account=accounts[0];
    if (!account?.chains.includes('solana:devnet')) throw Error('Select your Ballerz Devnet account in Solflare.');
    return {address:account.address,watch(fn) { return wallet.features['standard:events']?.on('change',fn); },async sign(message) {
      if (wallet.accounts[0]?.address!==account.address) throw Error('Wallet changed. Reconnect before approving.');
      const [result]=await wallet.features['solana:signMessage'].signMessage({account,message});
      if (!(result.signedMessage instanceof Uint8Array) || result.signedMessage.length!==message.length ||
          !message.every((byte,i)=>result.signedMessage[i]===byte)) throw Error('Wallet returned a different message.');
      return result.signature;
    }};
  } else {
    const injected=window.solflare;
    if (!injected?.signMessage) throw Error('Open this agreement in the browser profile with Solflare installed.');
    const address=(await connectInjected(injected)).toBase58();
    return {address,watch(fn) {
      injected.on?.('accountChanged',fn); injected.on?.('disconnect',fn);
      return ()=>{
        const remove=injected.off ?? injected.removeListener;
        remove?.call(injected,'accountChanged',fn); remove?.call(injected,'disconnect',fn);
      };
    },async sign(message) {
      if (keyOf(injected.publicKey)?.toBase58()!==address) throw Error('Wallet changed. Reconnect before approving.');
      const reply=await injected.signMessage(message,'utf8');
      return reply.signature ?? reply;
    }};
  }
}
