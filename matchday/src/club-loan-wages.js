import { GAME_YEAR_MS } from './world-clock.js';
import { accrueLoanWages } from './loan-wages.js';
import { LoanError } from './loan-agreements.js';
import { clubWallets } from './club-wallets.js';
import { walletProof } from './loan-inbox.js';
import { wageStatementMessage } from '../public/wage-statement-message.js';
import { clubs } from './football.js';

const names=new Map(clubs.flatMap(c=>c.squad.map(p=>[p.id,p.name])));
const denominator=BigInt(GAME_YEAR_MS)*10000n;
const amount=units=>({wholeBB:String(units/denominator),remainder:String(units%denominator)});

export function clubLoanWages(db,loadConfig,clock=Date.now) {
  const wallets=clubWallets(db),proof=walletProof(wageStatementMessage,clock);
  const loans=db.prepare(`SELECT a.terms,r.annualBB FROM loan_agreements a JOIN sporting_players p USING(mint)
    LEFT JOIN player_wage_rates r ON r.mint=a.mint AND r.year=?
    WHERE a.confirmedAt IS NOT NULL AND a.startAt<? AND a.endAt>? AND p.genesis=? AND p.bb=? AND p.sponsor=?
    ORDER BY a.startAt,p.player,a.id`);
  const sales=db.prepare(`SELECT s.effectiveAt,s.buyer FROM sporting_sales s JOIN sporting_sales anchor
    ON anchor.reference=? AND anchor.player=s.player WHERE s.status='finalized'
    AND (s.slot,s.position)>(anchor.slot,anchor.position) ORDER BY s.slot,s.position`);
  function manager(config,wallet) {
    const club=config.wallets?.[wallet];
    return club && config.loanManagers?.[club]===wallet && wallet!==config.sponsor && wallets.matches(wallet,club)?club:null;
  }
  function calendar(requested,now) {
    const epoch=db.prepare('SELECT start_at FROM world_clock WHERE id=1').get()?.start_at;
    if (epoch===undefined || now<epoch) throw new LoanError('The shared wage calendar has not started.');
    const currentYear=1+Math.floor((now-epoch)/GAME_YEAR_MS),year=requested===undefined?currentYear:requested;
    if (!Number.isSafeInteger(year) || year<1 || year>currentYear) throw new LoanError('Choose a wage year that has started.',400);
    const start=epoch+(year-1)*GAME_YEAR_MS,end=start+GAME_YEAR_MS,asOf=Math.min(now,end);
    return {year,currentYear,start,end,asOf};
  }
  function statement(club,requested,now=clock()) {
    const config=loadConfig(),{year,currentYear,start,end,asOf}=calendar(requested,now);
    if (db.prepare('SELECT 1 FROM sporting_players WHERE genesis<>? OR bb<>? OR sponsor<>? LIMIT 1')
      .get(config.genesis,config.bbMint,config.sponsor)) throw new LoanError('The sporting register belongs to a different wage market.');
    const lines=[];
    let total=0n,complete=true;
    for (const row of loans.all(year,end,start,config.genesis,config.bbMint,config.sponsor)) {
      const terms=JSON.parse(row.terms),from=Math.max(start,terms.startAt),until=Math.min(end,terms.endAt);
      const history=sales.all(terms.ownershipReference);
      const through=Math.min(asOf,until);
      if (through<=from) {
        const parent=history.filter(s=>s.effectiveAt<=from).at(-1)?.buyer ?? terms.parent;
        if (terms.borrower===club || parent===club)
          lines.push({player:terms.player,name:names.get(terms.player) ?? terms.player,from,until,status:'scheduled',amount:amount(0n)});
        continue;
      }
      // A unit annual rate yields this club's exact fraction of a wage year.
      // An unpublished rate matters only for a club with nonzero exposure.
      const share=accrueLoanWages({...terms,startAt:from},through,[{startAt:start,annualBB:1}],history)
        .find(entry=>entry.club===club);
      if (!share) continue;
      const fraction=BigInt(share.wholeBB)*denominator+BigInt(share.remainder);
      const units=row.annualBB===null && fraction>0n?null:fraction*BigInt(row.annualBB ?? 0);
      if (units===null) complete=false;
      else total+=units;
      lines.push({player:terms.player,name:names.get(terms.player) ?? terms.player,from,until,
        status:units===null?'rate unavailable':'accrued',amount:units===null?null:amount(units)});
    }
    return {club,year,currentYear,start,end,asOf,denominator:String(denominator),total:complete?amount(total):null,lines};
  }
  return {statement,challenge(wallet,origin,requested) {
    const {year}=calendar(requested,clock());
    return proof.challenge(wallet,origin,Boolean(manager(loadConfig(),wallet)),year);
  },read(input,origin) {
    const year=proof.verify(input,origin);
    if (input.year!==undefined && input.year!==year) throw new LoanError('Sign for the selected wage year.',403);
    db.exec('BEGIN DEFERRED');
    try {
      const club=manager(loadConfig(),input.wallet);
      if (!club) throw new LoanError('Use the current manager wallet for this club.',403);
      const result=statement(club,year);db.exec('COMMIT');return result;
    }
    catch(error) {db.exec('ROLLBACK');throw error;}
  }};
}
