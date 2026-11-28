import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { realpathSync } from 'node:fs';
import { PublicKey } from '@solana/web3.js';
import { ed25519 } from '@noble/curves/ed25519';
import { buyerMessage } from '../public/buyer-message.js';
import { clubs } from './football.js';

function initialise(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS transfer_discipline(
    mint TEXT PRIMARY KEY, remaining INTEGER NOT NULL CHECK(remaining>=0), checkedAt INTEGER NOT NULL,
    results INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1) STRICT;
    CREATE TABLE IF NOT EXISTS transfer_acknowledgements(
    digest TEXT NOT NULL, buyer TEXT NOT NULL, signature TEXT NOT NULL, PRIMARY KEY(digest,buyer)) STRICT;`);
}
// Both clubs participate in every approved competitive fixture in this pilot.
// A new result invalidates the operator's count until discipline is reconciled.
const results=db=>db.prepare(`SELECT count(*) AS n FROM fixtures
  WHERE json_type(state,'$.appearanceApproval')='object' AND json_type(state,'$.result')='object'`).get().n;

function disclosure(db,mint,now) {
  const sale=db.prepare(`SELECT p.genesis,p.bb AS bbMint,p.sponsor,p.mint,p.player,s.buyer AS parent,
    json_extract(s.terms,'$.buyer') AS owner,s.reference FROM sporting_players p JOIN sporting_sales s USING(player)
    WHERE p.mint=? AND s.status='finalized' ORDER BY s.slot DESC,s.position DESC LIMIT 1`).get(mint);
  if (!sale) return null;
  const loans=db.prepare(`SELECT a.startAt,a.endAt,json_extract(a.terms,'$.borrower') AS borrower,
    json_extract(a.terms,'$.borrowerWageBps') AS borrowerWageBps,json_extract(a.terms,'$.parentWageBps') AS parentWageBps
    FROM loan_agreements a WHERE a.mint=? AND a.confirmedAt IS NOT NULL AND
    (a.endAt>? OR EXISTS(SELECT 1 FROM sporting_loan_holds h WHERE h.agreement=a.id)
    OR EXISTS(SELECT 1 FROM sporting_loans l WHERE l.agreement=a.id AND l.returned=0))
    ORDER BY a.startAt`).all(mint,now).map(loan=>({...loan,returnPending:loan.endAt<=now}));
  const suspension=db.prepare('SELECT remaining,checkedAt,revision FROM transfer_discipline WHERE mint=? AND results=?')
    .get(mint,results(db)) ?? null;
  return {...sale,loans,suspension:suspension && {...suspension}};
}

export async function buyerReviewApi(request,desk) {
  const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
  if (!desk) return reply({error:'The sporting register is offline.'},503);
  const path=new URL(request.url).pathname;
  if (path==='/api/buyer-reviews' && request.method==='GET') {
    try { return reply(desk.buyers.list()); }
    catch { return reply({error:'The sporting register is unavailable.'},503); }
  }
  if (path!=='/api/buyer-reviews/acknowledge' || request.method!=='POST') return reply({error:'Unknown buyer review route.'},404);
  if (request.headers.get('content-type')?.split(';')[0]!=='application/json') return reply({error:'Expected JSON.'},415);
  const input=await request.json().catch(()=>null);
  if (!input || typeof input.mint!=='string' || typeof input.wallet!=='string' || typeof input.signature!=='string' ||
    Object.keys(input).length!==3) return reply({error:'Submit the mint, wallet and review signature.'},400);
  try { return reply(desk.buyers.acknowledge(input)); }
  catch { return reply({error:'The buyer or sporting terms could not be verified. Refresh and review again.'},409); }
}
const digestOf=(report,wallet)=>createHash('sha256').update(buyerMessage(report,wallet)).digest('hex');
function transaction(db,mode,read) {
  db.exec('BEGIN '+mode);
  try { const value=read(); db.exec('COMMIT'); return value; }
  catch (error) {db.exec('ROLLBACK'); throw error;}
}
export function buyerReviews(db,config,clock,bindSale) {
  initialise(db);
  function report(mint) {
    const view=disclosure(db,mint,clock()), pilot=config();
    if (!view || view.genesis!==pilot.genesis || view.bbMint!==pilot.bbMint || view.sponsor!==pilot.sponsor ||
      pilot.players?.[mint]!==view.player) throw Error('No matching finalized player registration.');
    return view;
  }
  return {
    list:()=>transaction(db,'DEFERRED',()=>Object.keys(config().players ?? {}).flatMap(mint=>{
      if (!db.prepare("SELECT 1 FROM sporting_players p JOIN sporting_sales s USING(player) WHERE p.mint=? AND s.status='finalized'").get(mint)) return [];
      const view=report(mint);
      const name=clubs.flatMap(c=>c.squad).find(p=>p.id===view.player)?.name ?? view.player;
      return [{name,report:view}];
    })),
    record({mint,remaining}) {
      if (!Number.isSafeInteger(remaining) || remaining<0) throw Error('Enter the verified remaining number of matches.');
      return transaction(db,'IMMEDIATE',()=>{
        const view=report(mint);
        bindSale({mint,bbMint:view.bbMint,sponsor:view.sponsor,genesis:view.genesis,
          ownerWallet:view.owner,ownershipReference:view.reference});
        db.prepare(`INSERT INTO transfer_discipline(mint,remaining,checkedAt,results) VALUES(?,?,?,?)
          ON CONFLICT(mint) DO UPDATE SET remaining=excluded.remaining,checkedAt=excluded.checkedAt,
          results=excluded.results,revision=transfer_discipline.revision+1
          WHERE remaining<>excluded.remaining OR results<>excluded.results`).run(mint,remaining,clock(),results(db));
        return report(mint).suspension;
      });
    },
    acknowledge({mint,wallet,signature}) {
      return transaction(db,'IMMEDIATE',()=>{
        const view=report(mint);
        if (!view.suspension) throw Error('The remaining suspension needs verification before acknowledgement.');
        let key;
        try { key=new PublicKey(wallet); } catch { throw Error('Invalid buyer wallet.'); }
        if (key.toBase58()!==wallet || wallet===view.owner || wallet===view.sponsor || !PublicKey.isOnCurve(key.toBytes()) ||
          !clubs.some(club=>club.id===config().wallets?.[wallet]) ||
          typeof signature!=='string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature) ||
          !ed25519.verify(Buffer.from(signature,'base64'),Buffer.from(buyerMessage(view,wallet)),key.toBytes(),{zip215:false}))
          throw Error('The buyer must sign the current sporting terms.');
        const digest=digestOf(view,wallet);
        db.prepare('INSERT OR IGNORE INTO transfer_acknowledgements VALUES(?,?,?)').run(digest,wallet,signature);
        return {digest};
      });
    }
  };
}

// The grant ledger pins this database for new quotes. Recovery uses the already
// signed journal even if a later match, sale or loan changes the live review.
export function reviewedSportingTerms(filename,terms,buyer,genesis) {
  const db=new DatabaseSync(filename,{readOnly:true});
  try {
    return transaction(db,'DEFERRED',()=>{
      const view=disclosure(db,String(terms.playerMint),Date.now());
      if (!view || view.genesis!==genesis || view.sponsor!==String(terms.sponsor) || view.bbMint!==String(terms.bbMint) ||
        view.owner!==String(terms.seller)) throw Error('Reconcile the sporting owner and network before this sale.');
      const digest=digestOf(view,String(buyer));
      if (!view.suspension || !db.prepare('SELECT 1 FROM transfer_acknowledgements WHERE digest=? AND buyer=?').get(digest,String(buyer)))
        throw Error('The buyer must review and acknowledge the current sporting terms before purchase.');
      return {sportingReview:view,disclosures:digest};
    });
  } finally { db.close(); }
}

// Loan confirmation and grant reservation serialize on the same grant database.
// Attach before BEGIN IMMEDIATE so a pending purchase cannot race a new loan.
export function loanSaleBinding(db,filename) {
  if (filename) {
    db.prepare('ATTACH DATABASE ? AS resale').run(realpathSync(filename));
    db.exec('CREATE TABLE IF NOT EXISTS resale.grant_sporting_source(mint TEXT PRIMARY KEY,filename TEXT NOT NULL)');
  }
  function bind(terms,checkPending=true) {
    const grant=db.prepare("SELECT json_extract(terms,'$.listing.grant') AS grant FROM sporting_sales WHERE reference=?")
      .get(terms.ownershipReference)?.grant;
    if (!grant) return;
    if (!filename) throw Error('Configure the sale ledger before approving loans for a grant-backed title.');
    const row=db.prepare(`SELECT g.owner FROM resale.purchase_grants g, resale.grant_market m WHERE g.mint=? AND
      g.bb=? AND g.sponsor=? AND m.genesis=?`).get(terms.mint,terms.bbMint,terms.sponsor,terms.genesis);
    if (!row || (checkPending && row.owner!==terms.ownerWallet)) throw Error('The sale ledger does not match this registered title.');
    const file=realpathSync(db.prepare("SELECT file FROM pragma_database_list WHERE name='main'").get().file);
    const existing=db.prepare('SELECT filename FROM resale.grant_sporting_source WHERE mint=?').get(terms.mint);
    if (existing && existing.filename!==file) throw Error('This title already has a different sporting register.');
    if ((checkPending || !existing) && db.prepare('SELECT 1 FROM resale.grant_sales WHERE mint=? AND receipt IS NULL').get(terms.mint))
      throw Error('Reconcile the pending purchase before confirming a loan.');
    db.prepare('INSERT OR IGNORE INTO resale.grant_sporting_source VALUES(?,?)').run(terms.mint,file);
  }
  if (filename) transaction(db,'IMMEDIATE',()=>{
    for (const row of db.prepare('SELECT terms FROM loan_agreements WHERE confirmedAt IS NOT NULL').all()) bind(JSON.parse(row.terms),false);
  });
  return bind;
}
