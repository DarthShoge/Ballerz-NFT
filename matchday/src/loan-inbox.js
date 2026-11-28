import { randomUUID } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { ed25519 } from '@noble/curves/ed25519';
import { inboxMessage } from '../public/inbox-message.js';
import { LoanError } from './loan-agreements.js';
import { clubs } from './football.js';

export function walletProof(message,clock=Date.now) {
  const pending=new Map();
  function challenge(wallet,origin,retain=true,scope) {
    let valid=false;
    if (typeof wallet==='string' && wallet.length<=44) {
      try { valid=new PublicKey(wallet).toBase58()===wallet && PublicKey.isOnCurve(wallet); } catch { /* invalid address */ }
    }
    if (!valid)
      throw new LoanError('Choose a valid manager wallet.',400);
    const now=clock();
    const ticket={nonce:randomUUID(),expiresAt:now+120000,...(scope===undefined?{}:{scope})};
    if (!retain) return ticket;
    for (const [id,item] of pending) {
      if (item.expiresAt<=now) pending.delete(id);
      else if (item.wallet===wallet && item.origin===origin && item.scope===scope)
        return {...ticket,nonce:item.nonce,expiresAt:item.expiresAt};
    }
    if (pending.size>=512) throw new LoanError('The loan inbox is busy. Try again shortly.',429);
    pending.set(ticket.nonce,{...ticket,wallet,origin});
    return ticket;
  }
  function verify({wallet,nonce,signature},origin) {
    const ticket=pending.get(nonce);
    if (!ticket || ticket.origin!==origin || ticket.wallet!==wallet || ticket.expiresAt<=clock() ||
      typeof signature!=='string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature) ||
      !ed25519.verify(Buffer.from(signature,'base64'),Buffer.from(message(origin,wallet,ticket)),
        new PublicKey(wallet).toBytes(),{zip215:false})) throw new LoanError('Verify this wallet again.',403);
    pending.delete(nonce);
    return ticket.scope;
  }
  return {challenge,verify};
}

export function loanInbox(db,clock=Date.now) {
  const proof=walletProof(inboxMessage,clock);
  db.exec(`CREATE INDEX IF NOT EXISTS parent_inbox ON loan_agreements(json_extract(terms,'$.ownerWallet'));
    CREATE INDEX IF NOT EXISTS borrower_inbox ON loan_agreements(json_extract(terms,'$.borrowerWallet'));`);
  const agreements=db.prepare(`SELECT id,terms,startAt,endAt,confirmedAt,parentSignature IS NOT NULL AS parentApproved,
    borrowerSignature IS NOT NULL AS borrowerApproved FROM loan_agreements WHERE superseded=0 AND
    (json_extract(terms,'$.ownerWallet')=? OR json_extract(terms,'$.borrowerWallet')=?) ORDER BY startAt DESC`);
  function list(input,origin) {
    proof.verify(input,origin);
    const {wallet}=input;
    const now=clock();
    return agreements.all(wallet,wallet).map(row=>{
      const terms=JSON.parse(row.terms);
      const parent=terms.ownerWallet===wallet;
      const player=clubs.flatMap(club=>club.squad).find(player=>player.id===terms.player);
      const clubName=id=>clubs.find(club=>club.id===id)?.name ?? id;
      let status='Awaiting your approval';
      if (row.confirmedAt!==null) status=now<row.startAt?'Scheduled':now<row.endAt?'Active':'Ended';
      else if (now>=row.startAt) status='Expired';
      else if (parent?row.parentApproved:row.borrowerApproved) status='Awaiting the other manager';
      return {id:row.id,player:player?.name ?? terms.player,from:clubName(terms.parent),to:clubName(terms.borrower),
        role:parent?'Parent club':'Borrowing club',startAt:row.startAt,status};
    });
  }
  return {challenge:proof.challenge,list};
}
