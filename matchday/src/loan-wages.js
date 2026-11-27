import { GAME_YEAR_MS } from './world-clock.js';

const denominator = BigInt(GAME_YEAR_MS) * 10000n;

// Attribute the signed term only. The original owner's verified sale anchors the
// ownership history. A late-indexed resale takes effect at its finalized block time.
export function accrueLoanWages(terms, through, rates, sales) {
  const amounts = new Map();
  let owner = terms.parent;
  let saleIndex = 0;
  let cursor = terms.startAt;
  function credit(club, annualBB, elapsed, bps) {
    const units = BigInt(annualBB) * BigInt(elapsed) * BigInt(bps);
    amounts.set(club, (amounts.get(club) ?? 0n) + units);
  }
  for (const rate of rates) {
    if (cursor >= through) break;
    if (rate.startAt > cursor) return null;
    const until = Math.min(through, rate.startAt + GAME_YEAR_MS);
    while (cursor < until) {
      const sale = sales[saleIndex];
      if (sale && sale.effectiveAt <= cursor) {
        owner = sale.buyer;
        saleIndex++;
        continue;
      }
      const next = Math.min(until, sale?.effectiveAt ?? until);
      credit(terms.borrower, rate.annualBB, next - cursor, terms.borrowerWageBps);
      credit(owner, rate.annualBB, next - cursor, terms.parentWageBps);
      cursor = next;
    }
  }
  if (cursor < through) return null;
  return [...amounts].map(([club, units]) => ({
    club, wholeBB: String(units / denominator), remainder: String(units % denominator)
  }));
}

export function loanWages(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS player_wage_rates (
    mint TEXT NOT NULL, year INTEGER NOT NULL, startAt INTEGER NOT NULL,
    annualBB INTEGER NOT NULL CHECK(annualBB >= 0), PRIMARY KEY(mint,year)) STRICT;`);
  const rate = db.prepare('SELECT year,startAt,annualBB FROM player_wage_rates WHERE mint=? AND year=?');
  const ratesDuring = db.prepare(`SELECT year,startAt,annualBB FROM player_wage_rates
    WHERE mint=? AND startAt>? AND startAt<? ORDER BY year`);
  const salesSince = db.prepare(`SELECT s.effectiveAt,s.buyer FROM sporting_sales s JOIN sporting_sales anchor
    ON anchor.reference=? AND anchor.player=s.player WHERE s.status='finalized'
    AND (s.slot,s.position)>(anchor.slot,anchor.position) ORDER BY s.slot,s.position`);
  function publish(config, {mint, year, annualBB}) {
    const player = config.players?.[mint];
    if (!player || !db.prepare(`SELECT 1 FROM sporting_players p WHERE mint=? AND player=? AND genesis=? AND bb=?
      AND sponsor=? AND EXISTS(SELECT 1 FROM sporting_sales s WHERE s.player=p.player AND status='finalized')`)
      .get(mint,player,config.genesis,config.bbMint,config.sponsor))
      throw Error('Publish a rate for a registered player in this pilot.');
    if (!Number.isSafeInteger(year) || year < 1 || !Number.isSafeInteger(annualBB) || annualBB < 0)
      throw Error('Choose a positive wage year and a non-negative whole-BB annual rate.');
    const epoch = db.prepare('SELECT start_at FROM world_clock WHERE id=1').get()?.start_at;
    if (epoch === undefined) throw Error('Set the shared world clock before publishing rates.');
    const startAt = epoch + (year - 1) * GAME_YEAR_MS;
    if (!Number.isFinite(new Date(startAt + GAME_YEAR_MS).getTime())) throw Error('Invalid wage year.');
    db.prepare(`INSERT INTO player_wage_rates VALUES(?,?,?,?) ON CONFLICT(mint,year) DO NOTHING`)
      .run(mint,year,startAt,annualBB);
    const stored = rate.get(mint,year);
    if (stored.annualBB !== annualBB || stored.startAt !== startAt) throw Error('The published wage rate is locked for this year.');
    return stored;
  }
  function report(terms, confirmed, now) {
    const rates = ratesDuring.all(terms.mint,terms.startAt-GAME_YEAR_MS,terms.endAt);
    const through = Math.min(Math.max(now,terms.startAt),terms.endAt);
    const clubs = confirmed ? accrueLoanWages(terms,through,rates,salesSince.all(terms.ownershipReference)) : [];
    return {rates, through:confirmed ? through : null, clubs, denominator:String(denominator)};
  }
  return {publish,report};
}
