import { randomUUID } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { ed25519 } from '@noble/curves/ed25519';
import { loanMessage } from '../public/loan-message.js';
import { reviewLoan } from './loan-review.js';
import { clubWallets } from './club-wallets.js';
import { sportingRegister } from './sporting-register.js';
import { loanWages } from './loan-wages.js';

export class LoanError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}

export function loanAgreements(db, rpc, loadConfig, clock = Date.now) {
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS loan_agreements (
      id TEXT PRIMARY KEY, mint TEXT NOT NULL, startAt INTEGER NOT NULL, endAt INTEGER NOT NULL,
      terms TEXT NOT NULL, checkedSlot INTEGER NOT NULL, superseded INTEGER NOT NULL DEFAULT 0,
      parentSignature TEXT, borrowerSignature TEXT, confirmedAt INTEGER, ownershipSlot INTEGER,
      CHECK (confirmedAt IS NULL OR (superseded=0 AND parentSignature IS NOT NULL AND borrowerSignature IS NOT NULL
        AND ownershipSlot IS NOT NULL AND confirmedAt < startAt))
    );
    CREATE INDEX IF NOT EXISTS loan_periods ON loan_agreements(mint,startAt,endAt);`);
  const find = db.prepare('SELECT * FROM loan_agreements WHERE id=?');
  const registration = sportingRegister(db,clock);
  const wages = loanWages(db);
  const wallets = clubWallets(db);
  const overlapping = db.prepare(`SELECT * FROM loan_agreements
    WHERE mint=? AND startAt < ? AND endAt > ? AND superseded=0`);
  const ownership = db.prepare(`SELECT reference FROM sporting_sales
    WHERE player=? AND status='finalized' ORDER BY slot DESC,position DESC LIMIT 1`);

  function write(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function get(id) {
    const row = find.get(id);
    if (!row) throw new LoanError('Loan agreement not found.',404);
    return row;
  }
  function view(row) {
    const now = clock();
    let status = 'awaiting approvals';
    if (row.superseded) status = 'superseded';
    else if (row.confirmedAt !== null)
      status = now < row.startAt ? 'scheduled' : now < row.endAt ? 'active' : 'ended';
    else if (now >= row.startAt) status = 'expired';
    const {matchMinutes}=db.prepare('SELECT COALESCE(SUM(minutes),0) AS matchMinutes FROM sporting_loan_minutes WHERE agreement=?').get(row.id);
    const terms = JSON.parse(row.terms);
    return {terms, status, matchMinutes, wages:wages.report(terms,row.confirmedAt !== null,now), parentApproved: !!row.parentSignature,
      borrowerApproved: !!row.borrowerSignature, confirmedAt: row.confirmedAt, ownershipSlot: row.ownershipSlot};
  }
  function checkAuthority(terms,now) {
    const config = loadConfig();
    if (config.genesis !== terms.genesis || config.sponsor !== terms.sponsor || config.bbMint !== terms.bbMint ||
        config.loanManagers?.[terms.parent] !== terms.ownerWallet || config.loanManagers?.[terms.borrower] !== terms.borrowerWallet ||
        config.wallets?.[terms.ownerWallet] !== terms.parent || config.wallets?.[terms.borrowerWallet] !== terms.borrower ||
        config.players?.[terms.mint] !== terms.player || terms.ownerWallet === terms.borrowerWallet ||
        [terms.ownerWallet,terms.borrowerWallet].includes(terms.sponsor) ||
        !wallets.matches(terms.ownerWallet,terms.parent) || !wallets.matches(terms.borrowerWallet,terms.borrower))
      throw new LoanError('The designated manager wallets or pilot bindings have changed.');
    if (ownership.get(terms.player)?.reference !== terms.ownershipReference)
      throw new LoanError('The registered owner changed. Request a new agreement.');
    if (now >= terms.startAt) throw new LoanError('The approval deadline has passed.');
  }
  async function propose(request) {
    if (!request || Object.keys(request).some(key=>!['player','borrower','startAt','endAt','borrowerWageBps'].includes(key)))
      throw new LoanError('Use only the supported ordinary loan terms.',400);
    const config = loadConfig();
    const {status,checkedSlot,...quote} = await reviewLoan(db,rpc,config,request,clock);
    const borrowerWallet = config.loanManagers?.[quote.borrower];
    if (!borrowerWallet || !PublicKey.isOnCurve(new PublicKey(borrowerWallet).toBytes()))
      throw new LoanError('Configure the borrowing manager wallet before issuing an agreement.');
    const fields = {...quote, borrowerWallet, sponsor:config.sponsor, bbMint:config.bbMint};
    return write(()=>{
      checkAuthority(fields,clock());
      const rows = overlapping.all(quote.mint,quote.endAt,quote.startAt);
      for (const row of rows) {
        if (loanMessage({...fields,id:row.id}) === loanMessage(JSON.parse(row.terms))) return view(row);
        if (row.confirmedAt !== null) throw new LoanError('This player already has an agreement for these dates.');
      }
      const id = randomUUID();
      db.prepare(`UPDATE loan_agreements SET superseded=1 WHERE mint=? AND startAt<? AND endAt>?
        AND confirmedAt IS NULL AND superseded=0`).run(quote.mint,quote.endAt,quote.startAt);
      db.prepare('INSERT INTO loan_agreements(id,mint,startAt,endAt,terms,checkedSlot) VALUES(?,?,?,?,?,?)')
        .run(id,quote.mint,quote.startAt,quote.endAt,JSON.stringify({...fields,id}),checkedSlot);
      return view(get(id));
    });
  }
  async function approve(id,wallet,signature) {
    const original = get(id);
    const terms = JSON.parse(original.terms);
    const column = wallet === terms.ownerWallet ? 'parentSignature' : wallet === terms.borrowerWallet ? 'borrowerSignature' : null;
    if (!column || typeof signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature))
      throw new LoanError('A signature from the designated manager is required.',403);
    const bytes = Buffer.from(signature,'base64');
    if (bytes.toString('base64') !== signature ||
        !ed25519.verify(bytes,Buffer.from(loanMessage(terms)),new PublicKey(wallet).toBytes(),{zip215:false}))
      throw new LoanError('The signature does not approve these loan terms.',403);
    if (original[column]) return view(original);
    if (original.superseded) throw new LoanError('A newer agreement replaced these terms.');
    checkAuthority(terms,clock());
    const evidence = await reviewLoan(db,rpc,loadConfig(),terms,clock,original.checkedSlot);
    if (evidence.ownershipReference !== terms.ownershipReference || evidence.ownerWallet !== terms.ownerWallet)
      throw new LoanError('The title evidence changed. Review a new agreement.');
    return write(()=>{
      const row = get(id);
      if (row[column]) return view(row);
      const now=clock();
      checkAuthority(terms,now);
      if (row.superseded) throw new LoanError('A newer agreement replaced these terms.');
      if (evidence.checkedSlot < row.checkedSlot) throw new LoanError('Newer title evidence arrived. Retry this approval.');
      wallets.bind(wallet,column==='parentSignature' ? terms.parent : terms.borrower);
      db.prepare('UPDATE loan_agreements SET '+column+'=?,checkedSlot=? WHERE id=?').run(signature,evidence.checkedSlot,id);
      // One write transaction serializes both signers, replacements and competing processes.
      const confirmation=db.prepare(`UPDATE loan_agreements SET confirmedAt=?,ownershipSlot=? WHERE id=? AND confirmedAt IS NULL
        AND parentSignature IS NOT NULL AND borrowerSignature IS NOT NULL`).run(now,evidence.checkedSlot,id);
      if (confirmation.changes) registration.confirmed(now);
      return view(get(id));
    });
  }
  return {propose, approve, get:id=>view(get(id)), publishRate:input=>write(()=>wages.publish(loadConfig(),input))};
}
