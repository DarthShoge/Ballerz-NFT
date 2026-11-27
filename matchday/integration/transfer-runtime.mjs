import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { AccountLayout, AuthorityType, ASSOCIATED_TOKEN_PROGRAM_ID, MINT_SIZE, MULTISIG_SIZE,
  TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createInitializeMint2Instruction,
  createMintToInstruction, createSetAuthorityInstruction, createTransferCheckedInstruction,
  getAssociatedTokenAddressSync as ata } from '@solana/spl-token';
import { FailedTransactionMetadata, LiteSVM } from 'litesvm';
import { cancelListingVersion, publishListing, purchaseListing } from '../src/player-transfer.js';

test('underfunded wages roll back the fee and title; an expired signed purchase cannot close', () => {
  const svm = new LiteSVM().withSigverify(true).withBlockhashCheck(true);
  for (const [key,file] of [[TOKEN_PROGRAM_ID,'spl_token'],[ASSOCIATED_TOKEN_PROGRAM_ID,'spl_associated_token_account'],
    [new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),'spl_memo']]) {
    svm.addProgramFromFile(key,join(process.env.SOLANA_TEST_PROGRAM_DIR,file+'.so'));
  }
  const [operator,home,away,version] = Array.from({length:4},() => Keypair.generate());
  const sponsor=operator.publicKey, seller=home.publicKey, buyer=away.publicKey;
  svm.airdrop(sponsor,2_000_000_000n);
  const rent = size => Number(svm.minimumBalanceForRentExemption(BigInt(size)));
  function send(tx,...signers) {
    tx.feePayer = sponsor;
    tx.recentBlockhash ??= svm.latestBlockhash();
    tx.sign(operator,...signers);
    const result = svm.sendTransaction(tx);
    assert.ok(!(result instanceof FailedTransactionMetadata),result.toString());
  }
  function mint(club,amount,spare) {
    const key = Keypair.generate();
    const mint = key.publicKey;
    const setup = new Transaction().add(SystemProgram.createAccount({fromPubkey:sponsor,newAccountPubkey:mint,
      space:MINT_SIZE,lamports:rent(MINT_SIZE),programId:TOKEN_PROGRAM_ID}),createInitializeMint2Instruction(mint,0,sponsor,null));
    for (const [owner,value] of [[club,amount],[sponsor,spare]]) {
      setup.add(createAssociatedTokenAccountIdempotentInstruction(sponsor,ata(mint,owner),owner,mint),
        createMintToInstruction(mint,ata(mint,owner),sponsor,value));
    }
    send(setup.add(createSetAuthorityInstruction(mint,sponsor,AuthorityType.MintTokens,null)),key);
    return mint;
  }
  const bbMint=mint(buyer,100000n,30000n), playerMint=mint(seller,1n,0n);
  const listing={sponsor,seller,playerMint,bbMint,version:version.publicKey,blockhash:svm.latestBlockhash(),
    lastValidBlockHeight:150,price:100000,wages:30000};
  send(publishListing(listing,rent(MULTISIG_SIZE)),home,version);
  const replacement = Keypair.generate();
  const revised = {...listing,version:replacement.publicKey,price:100001};
  send(publishListing(revised,rent(MULTISIG_SIZE)),home,replacement);
  const staleCancel = cancelListingVersion(listing);
  staleCancel.sign(operator,home);
  assert.ok(svm.sendTransaction(staleCancel) instanceof FailedTransactionMetadata);
  assert.deepEqual(AccountLayout.decode(svm.getAccount(ata(playerMint,seller)).data).delegate,
    replacement.publicKey);
  send(cancelListingVersion(revised),home);
  assert.equal(AccountLayout.decode(svm.getAccount(ata(playerMint,seller)).data).delegateOption,0);
  const reopened = Keypair.generate();
  listing.version=reopened.publicKey;
  send(publishListing(listing,rent(MULTISIG_SIZE)),home,reopened);
  const signed = purchaseListing(listing,buyer);
  signed.sign(operator,home,away);
  function amount(mint,owner) {
    const account = svm.getAccount(ata(mint,owner));
    return account ? AccountLayout.decode(account.data).amount : 0n;
  }
  const failure = svm.sendTransaction(signed);
  assert.ok(failure instanceof FailedTransactionMetadata);
  assert.match(failure.meta().logs().join('\n'),/insufficient funds/i);
  assert.equal(amount(bbMint,buyer),100000n);
  assert.equal(amount(bbMint,seller),0n);
  assert.equal(amount(playerMint,seller),1n);
  send(new Transaction().add(createTransferCheckedInstruction(ata(bbMint,sponsor),bbMint,ata(bbMint,buyer),sponsor,30000n,0)));
  svm.expireBlockhash();
  const expired = svm.sendTransaction(signed);
  assert.ok(expired instanceof FailedTransactionMetadata);
  assert.match(expired.toString(),/blockhash/i);
  assert.equal(amount(bbMint,buyer),130000n);
  assert.equal(amount(playerMint,buyer),0n);
});
