import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { ed25519 } from '@noble/curves/ed25519';
import { clubs } from './football.js';
import { GAME_WEEK_MS } from './world-clock.js';
import { LoanError } from './loan-agreements.js';
import { clubWallets } from './club-wallets.js';
import { walletProof } from './loan-inbox.js';
import { trainingAccess,trainingOrder } from '../public/training-message.js';

const squad=new Map(clubs.flatMap(c=>c.squad.map(player=>[player.id,player])));
const playerLimit=2, clubLimit=6;
const technicalSkills=position=>position==='GK'?['handling','reflexes','passing']:['crossing','firstTouch','passing','finishing','dribbling','tackling'];

export function loanTraining(db,loadConfig,clock=Date.now) {
  db.exec(`CREATE TABLE IF NOT EXISTS focused_sessions (
    id TEXT PRIMARY KEY, player TEXT NOT NULL, mint TEXT NOT NULL, week INTEGER NOT NULL,
    club TEXT NOT NULL, wallet TEXT NOT NULL, authority TEXT NOT NULL, skill TEXT NOT NULL,
    booking TEXT NOT NULL, status TEXT NOT NULL, weight INTEGER, createdAt INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS training_week ON focused_sessions(week,club,player);`);
  const ownership=db.prepare(`SELECT s.reference,s.buyer AS club,json_extract(s.terms,'$.buyer') AS wallet,
    p.player,p.genesis,p.bb,p.sponsor FROM sporting_players p JOIN sporting_sales s USING(player)
    WHERE p.mint=? AND s.status='finalized' ORDER BY s.slot DESC,s.position DESC LIMIT 1`);
  const loan=db.prepare(`SELECT id,terms,startAt,endAt FROM loan_agreements WHERE mint=? AND confirmedAt IS NOT NULL
    AND endAt>? ORDER BY startAt LIMIT 1`);
  const wallets=clubWallets(db),proof=walletProof(trainingAccess,clock);
  const byId=db.prepare('SELECT * FROM focused_sessions WHERE id=?');
  function transaction(mode,fn) {
    db.exec('BEGIN '+mode);
    try { const value=fn(); db.exec('COMMIT'); return value; }
    catch (error) {db.exec('ROLLBACK');throw error;}
  }
  function snapshot() {
    const now=clock(), config=loadConfig();
    const epoch=db.prepare('SELECT start_at FROM world_clock WHERE id=1').get()?.start_at;
    if (epoch===undefined || now<epoch) throw new LoanError('Training opens when the shared season starts.');
    const week=epoch+Math.floor((now-epoch)/GAME_WEEK_MS)*GAME_WEEK_MS;
    const titles=new Map();
    for (const [mint,player] of Object.entries(config.players ?? {})) {
      const owner=ownership.get(mint);
      if (!owner || !squad.has(player) || owner.player!==player || owner.genesis!==config.genesis ||
          owner.bb!==config.bbMint || owner.sponsor!==config.sponsor) continue;
      const term=loan.get(mint,now), terms=term && JSON.parse(term.terms);
      const active=term && term.startAt<=now;
      const club=active?terms.borrower:owner.club, wallet=active?terms.borrowerWallet:owner.wallet;
      const authority=createHash('sha256').update(JSON.stringify(active?['loan',term.id]:['title',owner.reference])).digest('hex');
      titles.set(mint,{owner,club,wallet,authority,term,terms});
    }
    return {now,config,week,titles};
  }
  function designated(config,wallet,club) {
    return config.loanManagers?.[club]===wallet && config.wallets?.[wallet]===club &&
      wallet!==config.sponsor && wallets.matches(wallet,club);
  }
  function valid(row,world) {
    const title=world.titles.get(row.mint);
    return row.week===world.week && title?.authority===row.authority && title.wallet===row.wallet &&
      title.club===row.club && designated(world.config,row.wallet,row.club);
  }
  function sessions(world) {
    return db.prepare('SELECT * FROM focused_sessions WHERE week=? ORDER BY createdAt,rowid').all(world.week)
      .map(row=>({...row,status:row.status==='reserved' && !valid(row,world)?'released':row.status}));
  }
  const counts=row=>row.status==='completed' || row.status==='reserved';
  function releaseInvalid(world) {
    const pending=db.prepare("SELECT * FROM focused_sessions WHERE status='reserved'").all();
    const release=db.prepare("UPDATE focused_sessions SET status='released' WHERE id=?");
    for (const row of pending) if (!valid(row,world)) release.run(row.id);
  }
  function report(wallet,world) {
    const rows=sessions(world),players=[];
    const mapped=world.config.wallets?.[wallet];
    const club=mapped && designated(world.config,wallet,mapped)?mapped:null;
    if (club) for (const [mint,title] of world.titles) {
      const parent=title.owner.wallet===wallet && title.owner.club===club;
      const borrower=title.terms?.borrowerWallet===wallet && title.terms.borrower===club;
      if (!parent && !borrower) continue;
      const player=title.owner.player, ownRows=rows.filter(row=>row.player===player);
      const controlling=title.wallet===wallet && title.club===club;
      players.push({mint,player,name:squad.get(player).name,skills:technicalSkills(squad.get(player).position),
        controller:title.club,canBook:controlling,authority:title.authority,
        loan:title.term && {borrower:title.terms.borrower,startAt:title.term.startAt,endAt:title.term.endAt},
        available:playerLimit-ownRows.filter(counts).length,
        sessions:ownRows.filter(row=>row.wallet===wallet || (row.status==='completed' && (parent || controlling)))
          .map(row=>({club:row.club,skill:row.skill,status:row.status,weight:row.weight,
            ...(row.wallet===wallet && row.status==='reserved' ? {id:row.id} : {})}))});
    }
    return {wallet,club:club ?? null,genesis:world.config.genesis,sponsor:world.config.sponsor,week:world.week,
      available:clubLimit-rows.filter(row=>counts(row) && row.club===club).length,players};
  }
  function submit(order,signature,origin) {
    if (!order || !['book','cancel'].includes(order.action) || !Number.isSafeInteger(order.week) ||
        !['id','player','mint','wallet','authority','club','skill','genesis','sponsor'].every(k=>typeof order[k]==='string') ||
        Object.keys(order).length!==11 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(order.id) ||
        !Number.isFinite(new Date(order.week).getTime())) throw new LoanError('Invalid training order.',400);
    const message=trainingOrder(origin,order);
    let verified=false;
    try { verified=typeof signature==='string' && /^[A-Za-z0-9+/]{86}==$/.test(signature) &&
      ed25519.verify(Buffer.from(signature,'base64'),Buffer.from(message),new PublicKey(order.wallet).toBytes(),{zip215:false}); }
    catch { /* Invalid key or signature. */ }
    if (!verified) throw new LoanError('Sign the exact training order with your manager wallet.',403);
    if (!designated(loadConfig(),order.wallet,order.club)) throw new LoanError('This wallet cannot manage training for this club.',403);
    return transaction('IMMEDIATE',()=>{
      const world=snapshot(),title=world.titles.get(order.mint);
      releaseInvalid(world);
      const existing=byId.get(order.id);
      if (existing?.booking===trainingOrder(origin,{...order,action:'book'})) {
        if (order.action==='cancel' && existing.status==='reserved')
          db.prepare("UPDATE focused_sessions SET status='cancelled' WHERE id=?").run(order.id);
        return {status:byId.get(order.id).status};
      }
      if (existing || order.action!=='book') throw new LoanError('Reservation reference does not match this order.');
      if (!title || !valid(order,world) || order.player!==title.owner.player ||
          world.config.genesis!==order.genesis || world.config.sponsor!==order.sponsor)
        throw new LoanError('Training control or game week changed. Reopen the report.',403);
      if (!technicalSkills(squad.get(order.player).position).includes(order.skill)) throw new LoanError('Choose an eligible technical skill.',400);
      const used=sessions(world).filter(counts);
      if (used.filter(row=>row.club===order.club).length>=clubLimit || used.filter(row=>row.player===order.player).length>=playerLimit)
        throw new LoanError('The weekly training allowance is full.');
      db.prepare(`INSERT INTO focused_sessions VALUES(?,?,?,?,?,?,?,?,?,'reserved',NULL,?)`)
        .run(order.id,order.player,order.mint,order.week,order.club,order.wallet,order.authority,order.skill,message,world.now);
      return {status:'reserved'};
    });
  }
  function finish(id,outcome) {
    if (!['completed','skipped'].includes(outcome)) throw new LoanError('Choose completed or skipped.');
    return transaction('IMMEDIATE',()=>{
      const row=byId.get(id);
      if (!row) throw new LoanError('Unknown training reservation.',404);
      if (row.status!=='reserved') return {status:row.status,weight:row.weight};
      const world=snapshot(), status=valid(row,world)?outcome:'released';
      const completed=db.prepare("SELECT count(*) AS n FROM focused_sessions WHERE player=? AND week=? AND status='completed'").get(row.player,row.week).n;
      const weight=status==='completed'?(completed===0?100:50):null;
      db.prepare('UPDATE focused_sessions SET weight=?,status=? WHERE id=?').run(weight,status,id);
      return {status,weight};
    });
  }
  return {challenge(wallet,origin) {
    const config=loadConfig(),club=config.wallets?.[wallet];
    return proof.challenge(wallet,origin,Boolean(club && designated(config,wallet,club)));
  },read(input,origin) {
    proof.verify(input,origin);
    return transaction('DEFERRED',()=>report(input.wallet,snapshot()));
  },submit,finish};
}
