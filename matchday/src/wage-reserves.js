import { GAME_YEAR_MS } from './world-clock.js';
import { Transaction } from '@solana/web3.js';
import { decodeTerms } from './registration-index.js';
import { grantSettlement, verifyTransfer } from './player-transfer.js';

export function clubReserves(db,terms,year,asOf,statement) {
  const start = terms.epoch+(year-1)*GAME_YEAR_MS, end=start+GAME_YEAR_MS;
  const rows=db.prepare(`SELECT s.reference,s.terms,s.effectiveAt,p.mint,
      (SELECT n.effectiveAt FROM sporting_sales n WHERE n.player=s.player AND n.status='finalized'
       AND (n.slot,n.position)>(s.slot,s.position) ORDER BY n.slot,n.position LIMIT 1) AS soldAt
    FROM sporting_sales s JOIN sporting_players p USING(player)
    WHERE s.status='finalized' AND s.buyer=? AND s.effectiveAt>=? AND s.effectiveAt<? AND
      p.genesis=? AND p.bb=? AND p.sponsor=? AND json_extract(s.terms,'$.listing.wages')>0
    ORDER BY s.slot,s.position`).all(terms.club,start,end,terms.genesis,terms.mint,terms.sponsor);
  return rows.map(row=>{
    const sale=JSON.parse(row.terms);
    const share=statement(terms.club,year,asOf,{mint:row.mint,startAt:row.effectiveAt,endAt:row.soldAt??end}).total;
    if (!share) throw Error('Publish the wage rate for the reserved player.');
    const deposited=BigInt(sale.listing.wages), owed=BigInt(share.wholeBB);
    return {reference:row.reference,year,sale,limit:deposited<owed?deposited:owed};
  });
}

export function clubProceeds(db,terms) {
  const rows=db.prepare(`SELECT s.reference,s.terms FROM sporting_sales s JOIN sporting_players p USING(player)
    WHERE s.status='finalized' AND s.seller=? AND s.effectiveAt>=? AND p.genesis=? AND p.bb=? AND p.sponsor=?
    AND json_type(s.terms,'$.listing.price')='integer' ORDER BY s.slot,s.position`)
    .all(terms.club,terms.epoch,terms.genesis,terms.mint,terms.sponsor);
  return rows.map(row=>{
    const sale=JSON.parse(row.terms),{grant,price,seller}=sale.listing;
    const net=grant?grantSettlement(price,grant.claim,grant.relationship).sellerProceeds:price;
    return {reference:row.reference,sale,owner:seller,limit:BigInt(net)};
  });
}

export async function verifyFundingSale(rpc,reserve,terms) {
  const {listing,buyer}=decodeTerms(reserve.sale);
  const record=await rpc.getTransaction(reserve.reference,{commitment:'finalized',maxSupportedTransactionVersion:0});
  if (record?.transaction.signatures[0]!==reserve.reference || String(listing.sponsor)!==terms.sponsor ||
      String(listing.bbMint)!==terms.mint) throw Error('Unverified purchase wage reserve.');
  const signed=Transaction.populate(record.transaction.message,record.transaction.signatures);
  const proof=verifyTransfer(record,signed,listing,buyer);
  if (BigInt(proof.wageReserve.after)-BigInt(proof.wageReserve.before)!==BigInt(listing.wages))
    throw Error('Purchase reserve funding differs from the registered sale.');
}

export function remainingReserveCustody(db,terms) {
  const deposits=db.prepare(`SELECT json_extract(s.terms,'$.listing.wages') AS amount FROM sporting_sales s
    JOIN sporting_players p USING(player) WHERE s.status='finalized' AND p.genesis=? AND p.bb=? AND p.sponsor=?
    AND json_type(s.terms,'$.listing.wages')='integer'`).all(terms.genesis,terms.mint,terms.sponsor);
  const spent=db.prepare("SELECT amount FROM wage_collections WHERE sale<>''").all();
  const sum=rows=>rows.reduce((total,row)=>total+BigInt(row.amount),0n);
  return sum(deposits)-sum(spent);
}
