import { PublicKey, Transaction } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import bs58 from 'bs58';
import { clubs } from './football.js';
import { purchaseListing, verifyTransfer } from './player-transfer.js';

export function decodeTerms({listing,buyer}) {
  const decoded={price:listing.price,wages:listing.wages,blockhash:listing.blockhash,
    lastValidBlockHeight:listing.lastValidBlockHeight};
  if (listing.disclosures!==undefined) decoded.disclosures=listing.disclosures;
  if (listing.grant) {
    const {revision,claim,relationship,treasury,buyer}=listing.grant;
    decoded.grant={revision,claim,relationship,treasury,buyer};
  }
  for (const field of ['playerMint','bbMint','sponsor','seller','version']) decoded[field]=new PublicKey(listing[field]);
  return {listing:decoded,buyer:new PublicKey(buyer)};
}

// The register keeps public terms and a reference. It has no signing or
// broadcasting authority, even when the financial worker has yet to submit.
function observe(register,config,journal) {
  const {listing,buyer}=decodeTerms(journal);
  const mint=listing.playerMint.toBase58(), bb=listing.bbMint.toBase58(), sponsor=listing.sponsor.toBase58();
  const player=config.players[mint], seller=config.wallets[listing.seller.toBase58()], destination=config.wallets[buyer.toBase58()];
  if (!clubs.some(c=>c.squad.some(p=>p.id===player)) || bb!==config.bbMint || sponsor!==config.sponsor ||
      !clubs.some(c=>c.id===seller) || !clubs.some(c=>c.id===destination) || seller===destination)
    throw new Error('Unknown sporting player, currency, sponsor or club wallet.');
  const signed=Transaction.from(Buffer.from(journal.purchase,'base64'));
  if (!signed.verifySignatures() || !signed.serializeMessage().equals(purchaseListing(listing,buyer).serializeMessage()))
    throw new Error('Purchase signatures do not match the registration terms.');
  const reference=bs58.encode(signed.signature);
  register.observe({reference,player,mint,bb,sponsor,seller,buyer:destination,genesis:config.genesis,
    terms:{listing,buyer}});
}

async function reconcile(rpc,register,row,clock) {
  const {listing,buyer}=decodeTerms(JSON.parse(row.terms));
  const record=await rpc.getTransaction(row.reference,{commitment:'finalized',maxSupportedTransactionVersion:0});
  if (!record) {
    const height=await rpc.getBlockHeight('finalized');
    const status=(await rpc.getSignatureStatuses([row.reference],{searchTransactionHistory:true})).value[0];
    if (status?.confirmationStatus==='finalized' && status.err) register.mark(row.reference,'failed');
    else if (!status && height>listing.lastValidBlockHeight) register.mark(row.reference,'expired');
    return;
  }
  if (record.transaction.signatures[0]!==row.reference) throw new Error('Unexpected transfer reference.');
  if (record.meta?.err) return register.mark(row.reference,'failed');
  const signed=Transaction.populate(record.transaction.message,record.transaction.signatures);
  const proof=verifyTransfer(record,signed,listing,buyer);
  const mint=await getMint(rpc,listing.playerMint,'finalized');
  if (mint.supply!==1n || mint.decimals || mint.mintAuthority || mint.freezeAuthority ||
      proof.sellerTitle.after!=='0' || proof.buyerTitle.after!=='1') throw new Error('Expected the single settled player title.');
  const block=await rpc.getBlockSignatures(proof.slot,'finalized');
  const position=block.signatures.indexOf(row.reference);
  const effectiveAt=(proof.blockTime ?? block.blockTime ?? NaN)*1000;
  if (position<0 || !Number.isSafeInteger(effectiveAt) || effectiveAt<=0 ||
      !Number.isFinite(new Date(effectiveAt).getTime())) return;
  register.finalize(row.reference,{slot:proof.slot,position,effectiveAt},clock);
}

export async function indexTransfers(rpc,register,config,journals,clock=Date.now) {
  if (await rpc.getGenesisHash()!==config.genesis) throw new Error('Unexpected registration network.');
  const errors=[];
  for (const journal of journals) {
    try { observe(register,config,journal); } catch (error) { errors.push(error.message); }
  }
  for (const row of register.unresolved(config)) {
    try { await reconcile(rpc,register,row,clock); } catch (error) { errors.push(row.reference+': '+error.message); }
  }
  if (errors.length) throw new Error(errors.join('\n'));
}
