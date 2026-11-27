import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { MULTISIG_SIZE, TOKEN_PROGRAM_ID, getAccount, getAssociatedTokenAddressSync, getMint,
  TokenAccountNotFoundError } from '@solana/spl-token';
import bs58 from 'bs58';
import { cancelListingVersion, publishListing, transferTerms } from './player-transfer.js';
import { DEVNET_GENESIS } from './devnet-settlement.js';

const policy = {
  name:'Trial winger', wages:30000, commission:0, grantRecovery:0, arrears:0,
  risk:'No retirement draw or youth credit is enabled for this trial player.',
  restrictions:'Independent club wallets only. Sporting registration is separate from title.',
  feePayer:'Ballerz pays the SOL network fee and account rent.'
};
const disclosures = createHash('sha256').update(JSON.stringify(policy)).digest('hex');
const base64 = tx => tx.serialize({requireAllSignatures:false}).toString('base64');

class ListingError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}
function walletKey(value) {
  try {
    const key = new PublicKey(value);
    if (key.toBase58() === value && PublicKey.isOnCurve(key.toBytes())) return key;
  } catch {}
  throw new ListingError('Connect a valid seller wallet.',400);
}

export async function openListingDesk(rpc, sponsor, filename, genesis = DEVNET_GENESIS) {
  const payer = sponsor.publicKey;
  const mint = seed => PublicKey.createWithSeed(payer,seed,TOKEN_PROGRAM_ID);
  const [playerMint,bbMint] = await Promise.all([mint('ballerz-transfer-winger-v1'),mint('ballerz-transfer-test-bb-v1')]);
  if (await rpc.getGenesisHash() !== genesis) throw new Error('Unexpected Solana network.');
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS manager_listings(
      id INTEGER PRIMARY KEY, mint TEXT NOT NULL, parent INTEGER NOT NULL, seller TEXT NOT NULL,
      version TEXT NOT NULL, action TEXT NOT NULL, price INTEGER NOT NULL, height INTEGER NOT NULL,
      sig TEXT NOT NULL UNIQUE, wire TEXT NOT NULL, state TEXT NOT NULL, UNIQUE(mint,parent));`);
  const asset = playerMint.toBase58();
  const latest = () => db.prepare('SELECT * FROM manager_listings WHERE mint=? ORDER BY id DESC LIMIT 1').get(asset);
  const mac = quote => createHmac('sha256',sponsor.secretKey).update('Ballerz manager listing v1\n'+JSON.stringify(quote)).digest();
  async function title(seller) {
    try {
      const account = await getAccount(rpc,getAssociatedTokenAddressSync(playerMint,seller),'finalized');
      return account.owner.equals(seller) && account.mint.equals(playerMint) && account.amount===1n && !account.isFrozen ? account : null;
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) return null;
      throw error;
    }
  }

  async function reconcile(row) {
    if (!row || row.state !== 'pending') return;
    const height = await rpc.getBlockHeight('finalized');
    const status = (await rpc.getSignatureStatuses([row.sig],{searchTransactionHistory:true})).value[0];
    let state;
    if (status?.confirmationStatus === 'finalized') state = status.err ? 'failed' : 'finalized';
    else if (!status && height > row.height) state = 'expired';
    if (state) db.prepare("UPDATE manager_listings SET state=? WHERE sig=? AND state='pending'").run(state,row.sig);
    else if (!status) {
      // Retry exactly the committed bytes after an RPC failure or a process restart.
      try { await rpc.sendRawTransaction(Buffer.from(row.wire,'base64'),{preflightCommitment:'confirmed'}); }
      catch { /* Until finality or expiry, the original signature remains pending. */ }
    }
  }

  async function view(sellerAddress) {
    await reconcile(latest());
    const row = latest();
    const height = await rpc.getBlockHeight('confirmed');
    let active = null;
    // An unsigned draft never creates an order. Only a known delegate on a
    // finalized title account can expose a listing to other managers.
    const owner = row && walletKey(row.seller);
    const held = owner && await title(owner);
    if (held?.delegate && held.delegatedAmount === 1n) {
      const offer = db.prepare("SELECT * FROM manager_listings WHERE mint=? AND version=? AND action='list' AND state='finalized'").get(asset,held.delegate.toBase58());
      if (offer && height <= offer.height) {
        const publication = Transaction.from(Buffer.from(offer.wire,'base64'));
        active = {seller:offer.seller,price:offer.price,wages:policy.wages,expiry:offer.height,
          blockhash:publication.recentBlockhash,disclosures,version:offer.version,signature:offer.sig};
      }
    }
    const owns = sellerAddress ? !!await title(walletKey(sellerAddress)) : false;
    return {asset,bbMint:bbMint.toBase58(),sponsor:payer.toBase58(),policy,height,active,owns,
      revision:row?.id ?? 0, last:row ? {action:row.action,state:row.state,signature:row.sig,expiry:row.height} : null};
  }

  async function prepare({seller:address,action,price,revision}) {
    if (action !== 'list' && action !== 'cancel') throw new ListingError('Choose a listing action.',400);
    const seller = walletKey(address);
    const state = await view(address);
    if (!state.owns || seller.equals(payer)) throw new ListingError('Only the current player owner can approve.',403);
    if (state.last?.state==='pending' || revision !== state.revision) throw new ListingError('The listing changed. Refresh and review it again.');
    if (action === 'cancel' && !state.active) throw new ListingError('There is no active listing to cancel.');
    const info = await getMint(rpc,playerMint,'finalized');
    if (info.supply !== 1n || info.decimals || info.mintAuthority || info.freezeAuthority) throw new ListingError('The player title is ineligible.');
    price = action==='cancel' ? state.active.price : price;
    try { transferTerms({price,wages:policy.wages}); } catch { throw new ListingError('Enter a positive whole-BB price.',400); }
    const key = action==='list' ? Keypair.generate() : null;
    const version = key?.publicKey ?? new PublicKey(state.active.version);
    const block = await rpc.getLatestBlockhash('confirmed');
    const listing = {sponsor:payer,seller,playerMint,bbMint,version,price,wages:policy.wages,disclosures,...block};
    const tx = key ? publishListing(listing,await rpc.getMinimumBalanceForRentExemption(MULTISIG_SIZE)) : cancelListingVersion(listing);
    if (key) tx.partialSign(key);
    const quote = {asset,seller:address,action,revision,version:version.toBase58(),price,wages:policy.wages,
      net:price,total:price+policy.wages,policy,expiry:block.lastValidBlockHeight,wire:base64(tx)};
    return {quote,seal:mac(quote).toString('hex')};
  }

  async function approve({quote,seal,signed}) {
    const proof = Buffer.from(typeof seal==='string'?seal:'','hex');
    if (!quote || proof.length!==32 || !timingSafeEqual(proof,mac(quote)) || quote.asset!==asset)
      throw new ListingError('The reviewed terms changed. Request a new review.',400);
    let tx;
    try {
      tx = Transaction.from(Buffer.from(signed,'base64'));
      const reviewed = Transaction.from(Buffer.from(quote.wire,'base64'));
      if (!reviewed.serializeMessage().equals(tx.serializeMessage())) throw Error();
      tx.partialSign(sponsor);
      if (!tx.verifySignatures()) throw Error();
    } catch { throw new ListingError('The owner must sign the exact reviewed transaction.',403); }
    const signature = bs58.encode(tx.signature);
    const duplicate = db.prepare('SELECT id FROM manager_listings WHERE sig=?').get(signature);
    if (!duplicate) {
      const state = await view(quote.seller);
      if (!state.owns || state.revision!==quote.revision || state.last?.state==='pending' || state.height>quote.expiry)
        throw new ListingError('Ownership, expiry or listing version changed. Review again.');
      if (quote.action==='cancel' && state.active?.version!==quote.version) throw new ListingError('The listing has changed.');
      // Claim this parent version before any broadcast, including across server processes.
      const write = db.prepare(`INSERT OR IGNORE INTO manager_listings(mint,parent,seller,version,action,price,height,sig,wire,state)
        VALUES(?,?,?,?,?,?,?,?,?,'pending')`).run(asset,quote.revision,quote.seller,quote.version,quote.action,quote.price,quote.expiry,signature,tx.serialize().toString('base64'));
      if (!write.changes && !db.prepare('SELECT id FROM manager_listings WHERE sig=?').get(signature))
        throw new ListingError('Another approval has already changed this listing.');
    }
    await reconcile(db.prepare('SELECT * FROM manager_listings WHERE sig=?').get(signature));
    return {signature};
  }
  return {view,prepare,approve,close:()=>db.close()};
}

export async function listingApi(request,desk) {
  const url = new URL(request.url);
  const reply = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  if (!desk) return reply({error:'The Devnet listing pilot is offline.'},503);
  try {
    if (request.method==='GET' && url.pathname==='/api/listings') return reply(await desk.view(url.searchParams.get('seller')));
    if (request.method==='POST' && ['/api/listings/review','/api/listings/approve'].includes(url.pathname)) {
      if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({error:'Expected JSON.'},415);
      let body;
      try { body=await request.json(); } catch { return reply({error:'Invalid request.'},400); }
      if (!body || typeof body!=='object') return reply({error:'Invalid request.'},400);
      return reply(await (url.pathname.endsWith('/review') ? desk.prepare(body) : desk.approve(body)));
    }
    return reply({error:'Unknown listing endpoint.'},404);
  } catch (error) {
    if (error instanceof ListingError) return reply({error:error.message},error.status);
    return reply({error:'Listing data is unavailable. Refresh to check the original reference.'},503);
  }
}
