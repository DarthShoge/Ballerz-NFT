import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { clubs } from './football.js';

const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export function payrollTerms(config, club, epoch) {
  const settings = config.wageSettlement;
  const owners = clubs.map(c => settings?.payroll?.[c.id]);
  const accounts = [...owners, settings?.treasury];
  const reserved = new Set([config.sponsor, config.bbMint, ...Object.keys(config.wallets ?? {}),
    ...Object.values(config.loanManagers ?? {})]);
  if (!clubs.some(c => c.id === club) || new Set(accounts).size !== accounts.length ||
      accounts.some(key => typeof key !== 'string' || reserved.has(key) ||
        new PublicKey(key).toBase58() !== key || !PublicKey.isOnCurve(key)))
    throw Error('Configure distinct dedicated payroll and wage treasury wallets for this market.');
  return {club, epoch, genesis:config.genesis, mint:config.bbMint, sponsor:config.sponsor,
    payroll:settings.payroll[club], treasury:settings.treasury};
}

export function wagePaymentInstructions(terms, amount) {
  if (typeof amount !== 'bigint' || amount <= 0n || amount > 0xffffffffffffffffn) throw Error('Invalid whole-BB payment.');
  const mint = new PublicKey(terms.mint), owner = new PublicKey(terms.payroll);
  const source = getAssociatedTokenAddressSync(mint, owner);
  const destination = getAssociatedTokenAddressSync(mint, new PublicKey(terms.treasury));
  const memo = ['ballerz-loan-wages-v1',terms.genesis,terms.sponsor,terms.epoch,terms.club].join('/');
  return [createTransferCheckedInstruction(source, mint, destination, owner, amount, 0),
    new TransactionInstruction({programId:memoProgram,keys:[],data:Buffer.from(memo)}),
    createAssociatedTokenAccountIdempotentInstruction(owner,destination,new PublicKey(terms.treasury),mint),
    createAssociatedTokenAccountIdempotentInstruction(owner,source,owner,mint)];
}

export async function finalizedWagePayment(rpc, terms, signature) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) throw Error('Invalid wage payment signature.');
  const tx = await rpc.getParsedTransaction(signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
  if (!tx?.meta || tx.meta.err !== null || tx.transaction.signatures[0] !== signature)
    throw Error('A successful finalized wage payment is required.');
  const {accountKeys,instructions} = tx.transaction.message;
  const [transfer,memo] = instructions;
  const details = transfer?.parsed?.info, quantity = details?.tokenAmount;
  if (![2,4].includes(instructions.length) || transfer.parsed?.type !== 'transferChecked' ||
      !transfer.programId.equals(TOKEN_PROGRAM_ID) || quantity?.decimals !== 0 ||
      !/^\d+$/.test(quantity.amount) || details.authority !== terms.payroll ||
      !accountKeys.some(key => key.signer && key.pubkey.toBase58() === terms.payroll))
    throw Error('Unexpected wage payment instructions or authority.');
  const amount = BigInt(quantity.amount);
  const [expected,tag] = wagePaymentInstructions(terms,amount);
  const [source,mint,destination] = expected.keys.map(key => key.pubkey.toBase58());
  for (const [index,ix] of instructions.slice(2).entries()) {
    const info=ix.parsed?.info;
    if (!ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID) || ix.parsed?.type!=='createIdempotent' ||
        info.account!==(index===0?destination:source) || info.wallet!==(index===0?terms.treasury:terms.payroll) ||
        info.mint!==mint || info.source!==terms.payroll) throw Error('Unexpected payroll account ownership instruction.');
  }
  if (details.source !== source || details.mint !== mint || details.destination !== destination ||
      !memo.programId.equals(memoProgram) || memo.parsed !== tag.data.toString())
    throw Error('The payment does not match the club, treasury or wage market.');
  function balance(entries,address,owner) {
    const index = accountKeys.findIndex(key => key.pubkey.toBase58() === address);
    const entry = entries?.find(row => row.accountIndex === index && row.owner === owner && row.mint === mint &&
      row.uiTokenAmount.decimals === 0);
    if (!entry) throw Error('Missing finalized wage balance evidence.');
    return BigInt(entry.uiTokenAmount.amount);
  }
  for (const [address,owner,delta] of [[source,terms.payroll,-amount],[destination,terms.treasury,amount]]) {
    if (balance(tx.meta.postTokenBalances,address,owner) - balance(tx.meta.preTokenBalances,address,owner) !== delta)
      throw Error('The finalized wage balance change differs from the signed amount.');
  }
  return {signature,slot:tx.slot,amount:String(amount)};
}
