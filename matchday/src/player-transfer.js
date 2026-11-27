import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import {
  MULTISIG_SIZE, TOKEN_PROGRAM_ID, createApproveCheckedInstruction, createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMultisigInstruction, createRevokeInstruction, createTransferCheckedInstruction,
  getAssociatedTokenAddressSync
} from '@solana/spl-token';

const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const ata = getAssociatedTokenAddressSync;

export function transferTerms({price, wages}) {
  if (!Number.isSafeInteger(price) || price <= 0 || !Number.isSafeInteger(wages) || wages < 0
      || !Number.isSafeInteger(price + wages)) throw new Error('Invalid whole-BB transfer terms.');
  return {price, wages, total:price + wages};
}

function validate(listing) {
  transferTerms(listing);
  if (listing.sponsor.equals(listing.seller) || listing.playerMint.equals(listing.bbMint))
    throw new Error('Separate club, sponsor and asset identities are required.');
  if (!Number.isSafeInteger(listing.lastValidBlockHeight) || listing.lastValidBlockHeight <= 0)
    throw new Error('Missing listing expiry.');
}

function transaction(listing) {
  validate(listing);
  // Every signature binds the same recent blockhash, including the sponsor's.
  // Refreshing it would require a new approval from all signing parties.
  return new Transaction({feePayer:listing.sponsor, blockhash:listing.blockhash,
    lastValidBlockHeight:listing.lastValidBlockHeight});
}

function termsMemo(listing, action) {
  return new TransactionInstruction({programId:memoProgram, keys:[], data:Buffer.from(JSON.stringify({
    v:1, action, listing:listing.version.toBase58(), bb:listing.bbMint.toBase58(),
    price:listing.price, wages:listing.wages, expires:listing.lastValidBlockHeight
  }))});
}

// The seller can revoke or replace the delegate while a listing is open. Each
// version uses a fresh multisig delegate requiring BOTH seller and sponsor.
export function publishListing(listing, rent) {
  const {sponsor,seller,playerMint,version} = listing;
  return transaction(listing).add(
    SystemProgram.createAccount({fromPubkey:sponsor,newAccountPubkey:version,lamports:rent,
      space:MULTISIG_SIZE,programId:TOKEN_PROGRAM_ID}),
    createInitializeMultisigInstruction(version,[seller,sponsor],2),
    createApproveCheckedInstruction(ata(playerMint,seller),playerMint,version,seller,1n,0),
    termsMemo(listing,'list'));
}

export function cancelCurrentListing(listing) {
  return createRevokeInstruction(ata(listing.playerMint,listing.seller),listing.seller);
}

export function purchaseListing(listing, buyer) {
  const {seller,sponsor,bbMint,playerMint,price,wages,version} = listing;
  if (buyer.equals(seller) || buyer.equals(sponsor)) throw new Error('Independent club wallets required.');
  const tx = transaction(listing);
  // The pilot's separate payroll ATA is controlled by the operator. Neither club
  // can withdraw from it. A production payroll programme is a separate milestone.
  for (const [mint,owner] of [[bbMint,buyer],[bbMint,seller],[bbMint,sponsor],[playerMint,seller],[playerMint,buyer]]) {
    tx.add(createAssociatedTokenAccountIdempotentInstruction(sponsor,ata(mint,owner),owner,mint));
  }
  tx.add(createTransferCheckedInstruction(ata(bbMint,buyer),bbMint,ata(bbMint,seller),buyer,BigInt(price),0));
  if (wages) tx.add(createTransferCheckedInstruction(ata(bbMint,buyer),bbMint,ata(bbMint,sponsor),buyer,BigInt(wages),0));
  tx.add(createTransferCheckedInstruction(ata(playerMint,seller),playerMint,ata(playerMint,buyer),version,1n,0,
    [seller,sponsor]),termsMemo(listing,'transfer'));
  return tx;
}

export function verifyTransfer(record, signed, listing, buyer) {
  const message = record?.transaction?.message;
  if (!record?.meta || record.meta.err || !message || !signed.verifySignatures()
      || !Buffer.from(message.serialize()).equals(signed.serializeMessage())
      || !signed.serializeMessage().equals(purchaseListing(listing,buyer).serializeMessage()))
    throw new Error('Missing finalized transfer for the approved terms.');
  function change(mint,owner,expected) {
    const key = ata(mint,owner);
    const index = message.accountKeys.findIndex(k => k.equals(key));
    function balance(rows, before) {
      if (!Array.isArray(rows) || index < 0) throw new Error('Missing transfer balance evidence.');
      const row = rows.find(r => r.accountIndex === index);
      // The purchase creates missing ATAs idempotently in this same message.
      if (!row && before && record.meta.preBalances[index] === 0) return 0n;
      if (!row || row.mint !== mint.toBase58() || row.owner !== owner.toBase58() || row.uiTokenAmount.decimals !== 0)
        throw new Error('Unexpected transfer account or currency.');
      return BigInt(row.uiTokenAmount.amount);
    }
    const pre = balance(record.meta.preTokenBalances,true);
    const post = balance(record.meta.postTokenBalances,false);
    if (post-pre !== BigInt(expected)) throw new Error('Incorrect transfer balance change.');
    return {account:key.toBase58(),before:pre.toString(),after:post.toString()};
  }
  return {slot:record.slot,blockTime:record.blockTime,listing:listing.version.toBase58(),
    buyerBB:change(listing.bbMint,buyer,-(listing.price+listing.wages)),
    sellerBB:change(listing.bbMint,listing.seller,listing.price),
    wageReserve:change(listing.bbMint,listing.sponsor,listing.wages),
    sellerTitle:change(listing.playerMint,listing.seller,-1),buyerTitle:change(listing.playerMint,buyer,1)};
}
