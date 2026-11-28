import { GAME_YEAR_MS } from './world-clock.js';

const min=(a,b)=>a<b?a:b;
const denominator=BigInt(GAME_YEAR_MS)*10000n;

// Round the refundable club share down. The indivisible BB stays restricted.
export function splitReserveRefund(deposit,bursary,unused) {
  if (deposit<=0n || bursary<0n || bursary>deposit || unused<0n || unused>deposit)
    throw Error('Invalid wage reserve split.');
  const club=unused*(deposit-bursary)/deposit;
  return {club,bursary:unused-club};
}

export function refundTotals(db,sale) {
  const totals={escrow:0n,treasury:0n,club:0n,bursary:0n};
  for (const row of db.prepare('SELECT pocket,kind,amount FROM wage_refunds WHERE sale=?').all(sale)) {
    totals[row.pocket]+=BigInt(row.amount);
    totals[row.kind]+=BigInt(row.amount);
  }
  return totals;
}

// Liability outside a loan stays with the permanent owner. During a loan
// only the owner's signed share is reserved, unless the borrower bought the title.
function earned(db,terms,row,until,year) {
  let elapsed=0n,loan=0n,last=row.effectiveAt;
  if (until<last) throw Error('Reconcile inconsistent purchase dates before releasing reserves.');
  const rate=db.prepare('SELECT annualBB,startAt FROM player_wage_rates WHERE mint=? AND year=?').get(row.mint,year);
  if (until===last) return {gross:0n,loan:0n,ordinary:0n};
  if (!rate || rate.startAt!==terms.epoch+(year-1)*GAME_YEAR_MS) return null;
  const loans=db.prepare(`SELECT startAt,endAt,terms FROM loan_agreements WHERE mint=? AND confirmedAt IS NOT NULL
    AND endAt>? AND startAt<? ORDER BY startAt`).all(row.mint,last,until);
  for (const agreement of loans) {
    const from=Math.max(agreement.startAt,row.effectiveAt),end=Math.min(agreement.endAt,until);
    if (from<last) throw Error('Reconcile overlapping agreements before releasing reserves.');
    const signed=JSON.parse(agreement.terms);
    const duration=BigInt(end-from);
    elapsed+=duration;
    const bps=signed.borrower===terms.club?10000:signed.parentWageBps;
    if (!Number.isSafeInteger(bps) || bps<0 || bps>10000) throw Error('Invalid signed wage share.');
    loan+=duration*BigInt(bps);
    last=end;
  }
  const annual=BigInt(rate.annualBB), ordinary=(BigInt(until-row.effectiveAt)-elapsed)*10000n*annual;
  const roundUp=units=>(units+denominator-1n)/denominator;
  return {gross:roundUp(ordinary+loan*annual),loan:loan*annual/denominator,ordinary:roundUp(ordinary)};
}

export function refundPositions(db,terms,closing) {
  if (db.prepare("SELECT 1 FROM sporting_sales WHERE status='pending' LIMIT 1").get())
    throw Error('Reconcile pending sporting transfers before releasing reserves.');
  const rows=db.prepare(`SELECT s.reference,s.terms,s.effectiveAt,s.slot,p.mint,p.player,n.effectiveAt soldAt,n.slot soldSlot,
      json_extract(n.terms,'$.listing.wages') replacement,json_extract(n.terms,'$.listing.seller') nextSeller
    FROM sporting_sales s JOIN sporting_players p USING(player) LEFT JOIN sporting_sales n ON n.reference=(
      SELECT later.reference FROM sporting_sales later WHERE later.player=s.player AND later.status='finalized'
       AND (later.slot,later.position)>(s.slot,s.position) ORDER BY later.slot,later.position LIMIT 1)
    WHERE s.status='finalized' AND s.buyer=?
      AND s.effectiveAt>=? AND p.genesis=? AND p.bb=? AND p.sponsor=? AND json_extract(s.terms,'$.listing.wages')>0
    ORDER BY s.slot,s.position`).all(terms.club,terms.epoch,terms.genesis,terms.mint,terms.sponsor);
  const debt=new Map(closing.years.map(y=>[y.year,BigInt(y.arrears)]));
  const result=[];
  for (const row of rows) {
    if (row.slot>closing.slot || row.soldSlot>closing.slot) continue;
    const year=1+Math.floor((row.effectiveAt-terms.epoch)/GAME_YEAR_MS);
    const end=terms.epoch+year*GAME_YEAR_MS,until=Math.min(end,row.soldAt??end);
    if (closing.asOf<until) continue;
    const exposure=earned(db,terms,row,until,year);
    if (!exposure) continue;
    const sale=JSON.parse(row.terms),deposit=BigInt(sale.listing.wages);
    if (row.soldAt!==null && row.nextSeller!==sale.buyer) continue;
    const bursary=BigInt(sale.listing.grant?.wageBursary?.bb??0), returned=refundTotals(db,row.reference);
    const spent=db.prepare('SELECT amount FROM wage_collections WHERE sale=?').all(row.reference)
      .reduce((v,r)=>v+BigInt(r.amount),0n);
    if (closing.asOf<end && BigInt(row.replacement??0)<deposit-min(deposit,exposure.gross)) continue;
    const inTreasury=spent-returned.treasury, inEscrow=deposit-spent-returned.escrow;
    if (inTreasury<0n || inEscrow<0n) throw Error('Reserve custody does not balance.');
    let retain=min(deposit,exposure.gross);
    if (debt.has(year)) {
      const loanCap=min(inTreasury+inEscrow,exposure.loan),applied=min(inTreasury,loanCap);
      const outstanding=min(loanCap-applied,debt.get(year));
      debt.set(year,debt.get(year)-outstanding);
      // The year-end wage ledger carries fractional loan BB into the next year.
      retain=min(deposit,exposure.ordinary+applied+outstanding);
    }
    const refundable=splitReserveRefund(deposit,bursary,deposit-retain);
    const surplus=inEscrow+inTreasury>retain?inEscrow+inTreasury-retain:0n;
    // Preserve custody for each obligation. Treasury over-remittances above
    // the loan share may be returned; earned non-loan wages stay in escrow.
    const treasuryExtra=inTreasury>exposure.loan?inTreasury-exposure.loan:0n;
    const treasury=min(surplus,treasuryExtra);
    result.push({reference:row.reference,sale,player:row.player,year,deposit,bursary,returned,refundable,
      pockets:{escrow:min(inEscrow,surplus-treasury),treasury}});
  }
  return result;
}

export function refundClaim(db,terms,closing,pocket,balance) {
  for (const position of refundPositions(db,terms,closing)) {
    for (const kind of ['bursary','club']) {
      const owed=position.refundable[kind]-position.returned[kind];
      const amount=min(balance,min(position.pockets[pocket],owed));
      if (amount<=0n) continue;
      const recipient=kind==='club'?position.sale.buyer:position.sale.listing.grant.wageBursary.owner;
      return {sale:position.reference,income:'',year:position.year,refund:kind,pocket,recipient,
        holder:pocket==='escrow'?terms.sponsor:terms.treasury,offset:String(position.returned[kind]),amount:String(amount),proof:position};
    }
  }
  return null;
}

export function reserveSourceStatement(db,club,start,end) {
  const entries=db.prepare(`SELECT reference,player,terms FROM sporting_sales WHERE status='finalized' AND buyer=?
    AND effectiveAt>=? AND effectiveAt<? AND json_extract(terms,'$.listing.wages')>0 ORDER BY slot,position`).all(club,start,end);
  return entries.map(row=>{
    const {listing}=JSON.parse(row.terms), total=BigInt(listing.wages), bursary=BigInt(listing.grant?.wageBursary?.bb??0);
    const refunds=refundTotals(db,row.reference);
    const remitted=db.prepare('SELECT amount FROM wage_collections WHERE sale=?').all(row.reference)
      .reduce((sum,r)=>sum+BigInt(r.amount),0n)-refunds.treasury;
    const unspent=splitReserveRefund(total,bursary,total-remitted);
    const source=(kind,funded)=>({source:kind,funded:String(funded),remitted:String(funded-unspent[kind]),refunded:String(refunds[kind])});
    const sources=[];
    if (total>bursary) sources.push(source('club',total-bursary));
    if (bursary>0n) sources.push(source('bursary',bursary));
    return {player:row.player,sources};
  });
}
