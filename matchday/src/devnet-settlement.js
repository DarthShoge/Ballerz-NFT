import { createHash } from 'node:crypto';
import {
  PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  AuthorityType, MINT_SIZE, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction, createMintToInstruction, createSetAuthorityInstruction,
  createTransferCheckedInstruction, getAssociatedTokenAddressSync, getMint, getAccount
} from '@solana/spl-token';
import { APPEARANCE_BB, appearanceSides } from './appearance-rewards.js';

export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const finality = 'finalized';
const options = {commitment: finality, preflightCommitment: 'confirmed'};
const mintSeed = 'ballerz-test-bb-v1';
const initialSupply = 160_000n;

export async function treasuryAddresses(payer, owners) {
  if (owners.length !== 2 || new Set([payer, ...owners].map(key => key.toBase58())).size !== 3)
    throw new Error('Treasury and both club wallets must be distinct.');
  const mint = await PublicKey.createWithSeed(payer, mintSeed, TOKEN_PROGRAM_ID);
  return {mint, vault: getAssociatedTokenAddressSync(mint, payer), owners,
    clubs: owners.map(owner => getAssociatedTokenAddressSync(mint, owner))};
}

export async function fundTreasury(connection, payer, accounts) {
  const {mint, vault, owners} = accounts;
  if (!await connection.getAccountInfo(mint, finality)) {
    const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const key = payer.publicKey;
    const setup = new Transaction().add(
      SystemProgram.createAccountWithSeed({fromPubkey:key, basePubkey:key, seed:mintSeed,
        newAccountPubkey:mint, lamports, space:MINT_SIZE, programId:TOKEN_PROGRAM_ID}),
      createInitializeMint2Instruction(mint, 0, key, null));
    for (const owner of [key, ...owners]) {
      setup.add(createAssociatedTokenAccountIdempotentInstruction(key,
        getAssociatedTokenAddressSync(mint, owner), owner, mint));
    }
    setup.add(createMintToInstruction(mint, vault, key, initialSupply),
      createSetAuthorityInstruction(mint, key, AuthorityType.MintTokens, null));
    try { await sendAndConfirmTransaction(connection, setup, [payer], options); }
    catch (error) { if (!await connection.getAccountInfo(mint, finality)) throw error; }
  }
  const info = await getMint(connection, mint, finality);
  if (info.decimals !== 0 || info.mintAuthority || info.freezeAuthority)
    throw new Error('Unexpected test BB mint configuration.');
  for (const [i, owner] of owners.entries()) {
    const account = await getAccount(connection, accounts.clubs[i], finality);
    if (!account.owner.equals(owner) || !account.mint.equals(mint)) throw new Error('Club BB account mismatch.');
  }
}

export async function appearanceBatch(id, state, payer, accounts, lamports) {
  const sides = appearanceSides(state);
  const binding = state.appearanceApproval;
  if (!binding || binding.mint !== accounts.mint.toBase58()
      || binding.owners.length !== 2 || binding.owners.some((key,i) => key !== accounts.owners[i].toBase58()))
    throw new Error('Fixture is not approved for this mint and these club wallets.');
  // Stable across blockhashes, process restarts, score changes and competing submissions.
  const seed = createHash('sha256').update('ballerz.appearance.v1/' + id).digest('hex').slice(0,32);
  const marker = await PublicKey.createWithSeed(payer, seed, memoProgram);
  const memo = JSON.stringify({v:1, fixture:id, outcome:state.result.kind ?? 'played',
    score:state.result.score, sides, bb:APPEARANCE_BB});
  const transaction = new Transaction().add(SystemProgram.createAccountWithSeed({
    fromPubkey:payer, basePubkey:payer, seed, newAccountPubkey:marker,
    lamports, space:0, programId:memoProgram
  }));
  for (const side of sides) transaction.add(createTransferCheckedInstruction(
    accounts.vault, accounts.mint, accounts.clubs[side], payer, APPEARANCE_BB, 0));
  transaction.add(new TransactionInstruction({programId:memoProgram, keys:[], data:Buffer.from(memo)}));
  return {transaction, marker, memo, sides};
}

export function verifyPayout(tx, batch, accounts, payer) {
  if (!tx?.meta || tx.meta.err) throw new Error('Missing successful finalized transaction.');
  const {message} = tx.transaction;
  const address = key => key.toBase58();
  if (!message.accountKeys[0].signer || !message.accountKeys[0].pubkey.equals(payer))
    throw new Error('Unexpected settlement authority.');
  const first = message.instructions[0]?.parsed;
  if (!message.instructions[0].programId.equals(SystemProgram.programId)
      || first?.type !== 'createAccountWithSeed' || first.info.newAccount !== address(batch.marker)
      || first.info.owner !== address(memoProgram) || first.info.source !== address(payer)
      || message.instructions.length !== batch.sides.length + 2)
    throw new Error('Fixture receipt instruction mismatch.');
  const memo = message.instructions.at(-1);
  if (!memo.programId.equals(memoProgram) || memo.parsed !== batch.memo) throw new Error('Result attestation mismatch.');
  function amounts(key) {
    const index = message.accountKeys.findIndex(entry => entry.pubkey.equals(key));
    const read = balances => {
      const row = balances?.find(item => item.accountIndex === index && item.mint === address(accounts.mint));
      if (!row || row.uiTokenAmount.decimals !== 0) throw new Error('Missing BB balance evidence.');
      return BigInt(row.uiTokenAmount.amount);
    };
    return [read(tx.meta.preTokenBalances), read(tx.meta.postTokenBalances)];
  }
  const [before, after] = amounts(accounts.vault);
  if (before - after !== BigInt(APPEARANCE_BB * batch.sides.length)) throw new Error('Treasury debit mismatch.');
  return batch.sides.map((side, index) => {
    const instruction = message.instructions[index + 1];
    const transfer = instruction.parsed;
    if (!instruction.programId.equals(TOKEN_PROGRAM_ID) || transfer?.type !== 'transferChecked'
        || transfer.info.mint !== address(accounts.mint) || transfer.info.authority !== address(payer)
        || transfer.info.source !== address(accounts.vault) || transfer.info.destination !== address(accounts.clubs[side])
        || transfer.info.tokenAmount.amount !== String(APPEARANCE_BB))
      throw new Error('Appearance transfer mismatch.');
    const [pre, post] = amounts(accounts.clubs[side]);
    if (post - pre !== BigInt(APPEARANCE_BB)) throw new Error('Club credit mismatch.');
    return {club:side === 0 ? 'northbank' : 'eastport', owner:address(accounts.owners[side]),
      tokenAccount:address(accounts.clubs[side]), before:pre.toString(), after:post.toString(), bb:APPEARANCE_BB};
  });
}

export async function settleAppearance(connection, payer, accounts, id, state) {
  const rent = await connection.getMinimumBalanceForRentExemption(0);
  const batch = await appearanceBatch(id, state, payer.publicKey, accounts, rent);
  if (!batch.sides.length) return {status:'no eligible clubs', fixture:id, payments:[]};
  let signature;
  let recovered = false;
  if (!await connection.getAccountInfo(batch.marker, finality)) {
    try { signature = await sendAndConfirmTransaction(connection, batch.transaction, [payer], options); }
    catch (error) {
      // A concurrent/retried call may already have finalized the very same batch.
      if (!await connection.getAccountInfo(batch.marker, finality)) throw error;
    }
  }
  if (!signature) {
    recovered = true;
    const marker = await connection.getAccountInfo(batch.marker, finality);
    if (!marker?.owner.equals(memoProgram)) throw new Error('Unexpected receipt owner; no payment verified.');
    // Only a verified creation transaction is proof, even if someone references this address later.
    let before;
    while (!signature) {
      const page = await connection.getSignaturesForAddress(batch.marker, {limit:100, before}, finality);
      if (!page.length) throw new Error('Receipt exists but its finalized payment history is unavailable.');
      for (const candidate of page.filter(item => !item.err)) {
        const tx = await connection.getParsedTransaction(candidate.signature, {commitment:finality,maxSupportedTransactionVersion:0});
        if (tx?.transaction.message.instructions[0]?.parsed?.info?.newAccount === batch.marker.toBase58()
            && tx.transaction.message.accountKeys[0]?.pubkey.equals(payer.publicKey)) {
          signature = candidate.signature;
          break;
        }
      }
      before = page.at(-1).signature;
    }
  }
  const tx = await connection.getParsedTransaction(signature, {commitment:finality,maxSupportedTransactionVersion:0});
  const payments = verifyPayout(tx, batch, accounts, payer.publicKey);
  return {status:recovered ? 'already paid' : 'paid', fixture:id, signature, slot:tx.slot,
    mint:accounts.mint.toBase58(), receipt:batch.marker.toBase58(), payments};
}
