import { DatabaseSync } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { grantSettlement, transferTerms } from './player-transfer.js';

// Private operator inputs. Neither control groups nor the initial funded
// amount are accepted from a manager's listing or purchase request.
export function openGrantLedger(filename, {genesis, treasury, controlGroups, reviewHolds=[]}) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS grant_market (id INTEGER PRIMARY KEY CHECK(id=1), genesis TEXT NOT NULL, treasury TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS purchase_grants (
      mint TEXT PRIMARY KEY, bb TEXT NOT NULL, sponsor TEXT NOT NULL, owner TEXT NOT NULL,
      claim INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS grant_sales (
      signature TEXT PRIMARY KEY, mint TEXT NOT NULL, revision INTEGER NOT NULL,
      journal TEXT NOT NULL, receipt TEXT, UNIQUE(mint,revision));`);
  db.prepare('INSERT OR IGNORE INTO grant_market VALUES(1,?,?)').run(genesis,treasury.toBase58());
  const market = db.prepare('SELECT * FROM grant_market').get();
  if (market.genesis!==genesis || market.treasury!==treasury.toBase58()) {
    db.close();
    throw new Error('Grant ledger belongs to a different network or treasury.');
  }
  const address = key => key.toBase58();
  const get = mint => db.prepare('SELECT * FROM purchase_grants WHERE mint=?').get(address(mint));
  function atomic(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  function quote({bbMint,playerMint,sponsor,seller,price,wages},buyer) {
    const row = get(playerMint);
    if (!row || row.bb !== address(bbMint) || row.sponsor !== address(sponsor) || row.owner !== address(seller))
      throw new Error('No matching grant record for this title, currency and seller.');
    if (buyer.equals(seller) || buyer.equals(sponsor) || [buyer,seller,sponsor].some(key=>key.equals(treasury)))
      throw new Error('Separate club, payroll and grant treasury accounts are required.');
    const held = reviewHolds.find(h=>h.clubs.includes(row.owner) && h.clubs.includes(address(buyer)));
    if (held) throw new Error('Sale held for operator review: '+held.reason+'. Appeal to the pilot operator.');
    const from = controlGroups.get(row.owner), to = controlGroups.get(address(buyer));
    if (!from || !to) throw new Error('Club control requires operator review.');
    const relationship = from === to ? 'connected' : 'independent';
    const grant = {revision:row.revision,claim:row.claim,relationship,
      treasury:address(treasury),buyer:address(buyer)};
    return {playerMint:row.mint,bbMint:row.bb,sponsor:row.sponsor,seller:row.owner,
      ...transferTerms({price,wages}),grant,...grantSettlement(price,row.claim,relationship)};
  }
  return {
    async assertNetwork(rpc) {
      if (await rpc.getGenesisHash()!==genesis) throw new Error('Unexpected grant settlement network.');
    },
    // Called once by the trusted funding operator. A duplicate allocation
    // fails even after resale, so replay cannot replenish a spent claim.
    async register({playerMint,bbMint,sponsor,seller},claim) {
      if (!Number.isSafeInteger(claim) || claim<0) throw new Error('Invalid initial purchase grant.');
      if (playerMint.equals(await PublicKey.createWithSeed(sponsor,'ballerz-transfer-winger-v1',TOKEN_PROGRAM_ID)))
        throw new Error('The original unencumbered trial winger is reserved for legacy settlements.');
      db.prepare('INSERT INTO purchase_grants(mint,bb,sponsor,owner,claim) VALUES(?,?,?,?,?)')
        .run(address(playerMint),address(bbMint),address(sponsor),address(seller),claim);
    },
    quote,
    pending(mint) {
      return db.prepare('SELECT signature,journal FROM grant_sales WHERE mint=? AND receipt IS NULL').get(address(mint));
    },
    reserve(trial,signature) {
      return atomic(()=>{
        const existing = db.prepare('SELECT journal,receipt FROM grant_sales WHERE signature=?').get(signature);
        const journal = JSON.stringify(trial);
        if (existing) {
          if (existing.journal !== journal) throw new Error('Conflicting transfer journal.');
          return existing.receipt ? JSON.parse(existing.receipt) : null;
        }
        const {grant} = quote(trial.listing,trial.buyer);
        if (!isDeepStrictEqual(trial.listing.grant,grant))
          throw new Error('Grant or club control changed. Review the sale again.');
        if (this.pending(trial.listing.playerMint)) throw new Error('Reconcile the pending grant sale first.');
        db.prepare('INSERT INTO grant_sales(signature,mint,revision,journal) VALUES(?,?,?,?)')
          .run(signature,address(trial.listing.playerMint),grant.revision,journal);
        return null;
      });
    },
    finalize(receipt, buyer) {
      return atomic(()=>{
        const row = db.prepare('SELECT * FROM grant_sales WHERE signature=?').get(receipt.signature);
        if (!row) throw new Error('Missing grant sale reservation.');
        if (row.receipt) return JSON.parse(row.receipt);
        const changed = db.prepare('UPDATE purchase_grants SET claim=?,owner=?,revision=revision+1 WHERE mint=? AND revision=?')
          .run(receipt.grant.carried,address(buyer),row.mint,row.revision);
        if (!changed.changes) throw new Error('Grant revision changed before finality.');
        db.prepare('UPDATE grant_sales SET receipt=? WHERE signature=?').run(JSON.stringify(receipt),receipt.signature);
        return receipt;
      });
    },
    release(signature) {
      db.prepare('DELETE FROM grant_sales WHERE signature=? AND receipt IS NULL').run(signature);
    },
    close() { db.close(); }
  };
}
