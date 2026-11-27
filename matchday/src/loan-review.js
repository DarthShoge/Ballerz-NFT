import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount, unpackMint } from '@solana/spl-token';
import { clubs } from './football.js';
import { GAME_WEEK_MS } from './world-clock.js';
import { DEVNET_GENESIS } from './devnet-settlement.js';

export function loanNetwork(endpoint, validatorGenesis) {
  const {protocol,hostname} = new URL(endpoint);
  const loopback = ['127.0.0.1','localhost','[::1]'].includes(hostname);
  if (protocol !== 'https:' && !(loopback && protocol === 'http:'))
    throw new Error('Remote loan verification requires an HTTPS RPC endpoint.');
  return (loopback && validatorGenesis) || DEVNET_GENESIS;
}

export function loanTerms(parent, {borrower, startAt, endAt, borrowerWageBps = 10000}, now) {
  if (borrower === parent || !clubs.some(club => club.id === borrower))
    throw new Error('Choose a different registered borrowing club.');
  for (const time of [startAt, endAt]) {
    if (!Number.isSafeInteger(time) || !Number.isFinite(new Date(time).getTime()))
      throw new Error('Loan dates must be UTC epoch milliseconds.');
  }
  if (startAt < now || endAt - startAt < 4 * GAME_WEEK_MS)
    throw new Error('Choose a future loan of at least four in-game weeks.');
  if (!Number.isInteger(borrowerWageBps) || borrowerWageBps < 0 || borrowerWageBps > 10000)
    throw new Error('Borrower wage share must be 0 to 10000 basis points.');
  return {
    parent, borrower, startAt, endAt, borrowerWageBps,
    parentWageBps: 10000 - borrowerWageBps,
    trainingClubDuringLoan: borrower
  };
}

// A review describes proposed terms. Activation requires a separate agreement.
export async function reviewLoan(db, rpc, config, request, clock = Date.now, minimumSlot = 0) {
  const latest = db.prepare(`SELECT p.genesis,p.bb,p.sponsor,p.mint,s.slot,s.reference,s.buyer AS parent,
      json_extract(s.terms,'$.buyer') AS wallet
    FROM sporting_sales s JOIN sporting_players p USING(player)
    WHERE p.player=? AND s.status='finalized' ORDER BY s.slot DESC,s.position DESC LIMIT 1`);
  const row = latest.get(request.player);
  if (!row) throw new Error('A finalized player registration is required.');
  if (row.genesis !== config.genesis || row.bb !== config.bbMint || row.sponsor !== config.sponsor ||
      await rpc.getGenesisHash() !== row.genesis) throw new Error('Loan review does not match this pilot.');
  const mintAddress = new PublicKey(row.mint);
  const owner = new PublicKey(row.wallet);
  const tokenAddress = getAssociatedTokenAddressSync(mintAddress, owner);
  const minContextSlot = Math.max(row.slot,minimumSlot);
  const snapshot = await rpc.getMultipleAccountsInfoAndContext([mintAddress, tokenAddress], {
    commitment: 'finalized', minContextSlot
  });
  const mint = unpackMint(mintAddress, snapshot.value[0]);
  const title = unpackAccount(tokenAddress, snapshot.value[1]);
  if (!Number.isSafeInteger(snapshot.context.slot) || snapshot.context.slot < minContextSlot ||
      !mint.isInitialized || mint.decimals || mint.supply !== 1n ||
      mint.mintAuthority || mint.freezeAuthority || !title.isInitialized || title.isFrozen ||
      !title.owner.equals(owner) || !title.mint.equals(mintAddress) || title.amount !== 1n)
    throw new Error('The finalized title does not match the registered owner.');
  if (latest.get(request.player)?.reference !== row.reference)
    throw new Error('Player registration changed during review. Request fresh terms.');
  return {
    status: 'proposal', player: request.player, mint: row.mint, genesis: row.genesis,
    ownerWallet: row.wallet, ownershipReference: row.reference, checkedSlot: snapshot.context.slot,
    ...loanTerms(row.parent, request, clock())
  };
}
