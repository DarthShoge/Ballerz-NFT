// Fixture data and transaction submission for the closed, zero-commission trial.
import bs58 from 'bs58';
import { setTimeout as delay } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import { Keypair, PublicKey, SystemInstruction, SystemProgram, Transaction } from '@solana/web3.js';
import {
  AuthorityType, MINT_SIZE, MULTISIG_SIZE, TOKEN_PROGRAM_ID, createInitializeMint2Instruction,
  createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, createSetAuthorityInstruction,
  getAssociatedTokenAddressSync, getAccount, getMint
} from '@solana/spl-token';
import { publishListing, purchaseListing, verifyTransfer } from '../src/player-transfer.js';

export async function fixedMint(rpc,sponsor,seed,initialHoldings) {
  const owner = sponsor.publicKey;
  const mint = await PublicKey.createWithSeed(owner,seed,TOKEN_PROGRAM_ID);
  if (!await rpc.getAccountInfo(mint,'finalized')) {
    const tx = new Transaction().add(SystemProgram.createAccountWithSeed({fromPubkey:owner,
      newAccountPubkey:mint,basePubkey:owner,seed,space:MINT_SIZE,programId:TOKEN_PROGRAM_ID,
      lamports:await rpc.getMinimumBalanceForRentExemption(MINT_SIZE)}),createInitializeMint2Instruction(mint,0,owner,null));
    for (const [club,amount] of initialHoldings) {
      const account = getAssociatedTokenAddressSync(mint,club);
      tx.add(createAssociatedTokenAccountIdempotentInstruction(owner,account,club,mint),
        createMintToInstruction(mint,account,owner,amount));
    }
    tx.add(createSetAuthorityInstruction(mint,owner,AuthorityType.MintTokens,null));
    const block = await rpc.getLatestBlockhash('confirmed');
    tx.feePayer=owner;
    tx.recentBlockhash=block.blockhash;
    tx.sign(sponsor);
    try {
      const signature=await rpc.sendRawTransaction(tx.serialize(),{preflightCommitment:'confirmed'});
      const confirmed=await rpc.confirmTransaction({signature,...block},'finalized');
      if (confirmed.value.err) throw new Error('Trial mint setup failed: '+JSON.stringify(confirmed.value.err));
    } catch (error) {
      // Another operator process can finish this same seeded setup first.
      // Adopt only a finalized mint that passes the supply checks below.
      if (!await rpc.getAccountInfo(mint,'confirmed')) throw error;
      for (let attempt=0; !await rpc.getAccountInfo(mint,'finalized'); attempt++) {
        if (attempt>=45) throw error;
        await delay(500);
      }
    }
  }
  const info = await getMint(rpc,mint,'finalized');
  const supply = initialHoldings.reduce((sum,[,amount]) => sum + amount,0n);
  if (info.decimals || info.mintAuthority || info.freezeAuthority || info.supply !== supply)
    throw new Error('Unexpected trial mint.');
  return mint;
}

export async function setupTransferTrial(rpc,sponsor,seller,buyers) {
  const bbMint = await fixedMint(rpc,sponsor,'ballerz-transfer-test-bb-v1',buyers.map(b => [b,130000n]));
  const playerMint = await fixedMint(rpc,sponsor,'ballerz-transfer-winger-v1',[[seller,1n]]);
  return {bbMint,playerMint};
}

async function requireLegacyAssets({sponsor,bbMint,playerMint}) {
  const mint = seed => PublicKey.createWithSeed(sponsor,seed,TOKEN_PROGRAM_ID);
  if (!(await mint('ballerz-transfer-winger-v1')).equals(playerMint)
      || !(await mint('ballerz-transfer-test-bb-v1')).equals(bbMint))
    throw new Error('A registered purchase grant ledger is required for this player.');
}

export async function signTrial(rpc, sponsor, seller, buyer, assets, {ledger,reviewedTerms}={}) {
  const version = Keypair.generate();
  const rent = await rpc.getMinimumBalanceForRentExemption(MULTISIG_SIZE);
  const block = await rpc.getLatestBlockhash('confirmed');
  const listing = {...assets,...block,sponsor:sponsor.publicKey,seller:seller.publicKey,
    version:version.publicKey,price:reviewedTerms?.price ?? 100000,wages:reviewedTerms?.wages ?? 30000};
  if (ledger) {
    await ledger.assertNetwork(rpc);
    const quote=ledger.quote(listing,buyer.publicKey);
    if (!isDeepStrictEqual(quote,reviewedTerms)) throw new Error('Review the current grant settlement before signing.');
    listing.grant=quote.grant;
  }
  else {
    if (listing.grant || reviewedTerms) throw new Error('A grant quote requires its operator ledger.');
    await requireLegacyAssets(listing);
  }
  const publication = publishListing(listing,rent);
  publication.sign(sponsor,seller,version);
  const purchase = purchaseListing(listing,buyer.publicKey);
  purchase.sign(sponsor,seller,buyer);
  const trial = {listing,buyer:buyer.publicKey,publication:publication.serialize().toString('base64'),
    purchase:purchase.serialize().toString('base64')};
  // Commit the sole authorized revision before releasing spendable bytes.
  if (ledger) ledger.reserve(trial,bs58.encode(purchase.signature));
  return trial;
}

export function parseTrial(json) {
  const trial = JSON.parse(json);
  for (const field of ['sponsor','seller','bbMint','playerMint','version']) trial.listing[field]=new PublicKey(trial.listing[field]);
  trial.buyer = new PublicKey(trial.buyer);
  return trial;
}

export async function submitSigned(rpc,encoded,listing) {
  const wire = Buffer.from(encoded,'base64');
  const tx = Transaction.from(wire);
  if (!tx.verifySignatures() || tx.recentBlockhash !== listing.blockhash) throw new Error('Invalid signed transaction.');
  const signature = bs58.encode(tx.signature);
  const config = {commitment:'finalized',maxSupportedTransactionVersion:0};
  let record = await rpc.getTransaction(signature,config);
  if (!record) {
    // Resume a pending transaction by its original signature. Never replace its
    // blockhash, re-sign an expired quote or make a second financial commitment.
    const status = (await rpc.getSignatureStatuses([signature],{searchTransactionHistory:true})).value[0];
    if (status?.err) throw new Error('Transaction failed: ' + signature);
    if (!status) {
      if (!((await rpc.isBlockhashValid(listing.blockhash,{commitment:'confirmed'})).value))
        throw new Error('Listing expired. Check its original signature before requesting a new listing: ' + signature);
      await rpc.sendRawTransaction(wire,{preflightCommitment:'confirmed'});
    }
    const confirmed = await rpc.confirmTransaction({signature,blockhash:listing.blockhash,
      lastValidBlockHeight:listing.lastValidBlockHeight},'finalized');
    if (confirmed.value.err) throw new Error('Settlement failed: ' + JSON.stringify(confirmed.value.err));
    record = await rpc.getTransaction(signature,config);
  }
  if (!record || record.meta?.err || !Buffer.from(record.transaction.message.serialize()).equals(tx.serializeMessage()))
    throw new Error('Finalized message unavailable or inconsistent: ' + signature);
  return {record,signature,tx};
}

export async function settleTrial(rpc,trial,ledger) {
  const published = Transaction.from(Buffer.from(trial.publication,'base64'));
  const purchase = Transaction.from(Buffer.from(trial.purchase,'base64'));
  const {lamports} = SystemInstruction.decodeCreateAccount(published.instructions[0]);
  if (!published.verifySignatures() || !purchase.verifySignatures()
      || !published.serializeMessage().equals(publishListing(trial.listing,lamports).serializeMessage())
      || !purchase.serializeMessage().equals(purchaseListing(trial.listing,trial.buyer).serializeMessage()))
    throw new Error('Signed listing and purchase must match the approved terms.');
  const reference = bs58.encode(purchase.signature);
  if (ledger) {
    await ledger.assertNetwork(rpc);
    const receipt = ledger.reserve(trial,reference);
    if (receipt) return receipt;
  } else {
    if (trial.listing.grant) throw new Error('A grant quote requires its operator ledger.');
    await requireLegacyAssets(trial.listing);
  }
  try {
    await submitSigned(rpc,trial.publication,trial.listing);
    const {record,signature,tx} = await submitSigned(rpc,trial.purchase,trial.listing);
    const receipt = {signature,playerMint:trial.listing.playerMint.toBase58(),bbMint:trial.listing.bbMint.toBase58(),
      ...verifyTransfer(record,tx,trial.listing,trial.buyer)};
    return ledger ? ledger.finalize(receipt,trial.buyer) : receipt;
  } catch (error) {
    if (ledger) {
      // A timeout alone cannot release a sale. Check finalized height first
      // so an absent history response cannot race the last valid block.
      const height = await rpc.getBlockHeight('finalized');
      const status = (await rpc.getSignatureStatuses([reference],{searchTransactionHistory:true})).value[0];
      if (status?.confirmationStatus==='finalized' && status.err) ledger.release(reference);
      else if (!status && height>trial.listing.lastValidBlockHeight &&
          !await rpc.getTransaction(reference,{commitment:'finalized',maxSupportedTransactionVersion:0})) {
        const {playerMint,seller} = trial.listing;
        const title = await getAccount(rpc,getAssociatedTokenAddressSync(playerMint,seller),'finalized');
        if (title.amount===1n && title.owner.equals(seller) && title.mint.equals(playerMint)) ledger.release(reference);
      }
    }
    throw error;
  }
}
