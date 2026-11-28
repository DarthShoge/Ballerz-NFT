import { createHash } from 'node:crypto';
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount, createTransferCheckedInstruction,
  createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';
import bs58 from 'bs58';
import { clubProceeds, clubReserves, remainingReserveCustody, verifyFundingSale } from './wage-reserves.js';

const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const minimum = (...amounts) => amounts.reduce((a,b)=>a<b?a:b);

export async function collectionTransaction(terms,source,claim,block,rent) {
  const owner=new PublicKey(source);
  const seed=createHash('sha256').update(JSON.stringify(['ballerz-collection-v1',terms,claim.sale,claim.income,claim.offset])).digest('hex').slice(0,32);
  const marker=await PublicKey.createWithSeed(owner,seed,memoProgram);
  const mint=new PublicKey(terms.mint),holder=new PublicKey(claim.holder),treasury=new PublicKey(terms.treasury);
  const from=getAssociatedTokenAddressSync(mint,holder),to=getAssociatedTokenAddressSync(mint,treasury);
  const tx=new Transaction({feePayer:owner,...block}).add(SystemProgram.createAccountWithSeed({
    fromPubkey:owner,basePubkey:owner,seed,newAccountPubkey:marker,space:0,lamports:rent,programId:memoProgram
  }),createTransferCheckedInstruction(from,mint,to,owner,BigInt(claim.amount),0),
  createAssociatedTokenAccountIdempotentInstruction(owner,from,holder,mint),
  createAssociatedTokenAccountIdempotentInstruction(owner,to,treasury,mint),
  new TransactionInstruction({programId:memoProgram,keys:[],data:Buffer.from(
    ['ballerz-collection-v1',terms.club,claim.sale||claim.income||'payroll',claim.year,claim.offset].join('/'))}));
  return {tx,marker};
}

function verifyCollection(record,tx,terms,source,amount) {
  if (!record.meta || record.meta.err || record.transaction.signatures[0]!==bs58.encode(tx.signature) ||
      !Buffer.from(record.transaction.message.serialize()).equals(tx.serializeMessage()) || !tx.verifySignatures())
    throw Error('Finalized collection differs from the signed payment.');
  for (const [owner,delta] of [[source,-amount],[terms.treasury,amount]]) {
    const ata=getAssociatedTokenAddressSync(new PublicKey(terms.mint),new PublicKey(owner));
    const index=record.transaction.message.accountKeys.findIndex(key=>key.equals(ata));
    function balance(rows) {
      const row=rows?.find(r=>r.accountIndex===index && r.mint===terms.mint && r.owner===owner && r.uiTokenAmount.decimals===0);
      if (!row) throw Error('Missing collection balance evidence.');
      return BigInt(row.uiTokenAmount.amount);
    }
    if (balance(record.meta.postTokenBalances)-balance(record.meta.preTokenBalances)!==delta)
      throw Error('Collection balance change differs from the approved amount.');
  }
}

export function wageCollector(db,rpc,market,statement,reconcile,config) {
  const pending=club=>db.prepare('SELECT * FROM wage_collection_pending WHERE club=?').get(club);
  function quote(terms,closing,mode,balance,income='') {
    const prior=(sale,income='')=>db.prepare('SELECT amount FROM wage_collections WHERE club=? AND sale=? AND income=?').all(terms.club,sale,income)
      .reduce((sum,row)=>sum+BigInt(row.amount),0n);
    if (mode!=='reserve') {
      let debt=0n;
      for (const year of closing.years) {
        const outstanding=BigInt(year.arrears);
        if (!outstanding) continue;
        let earmarked=0n;
        for (const reserve of clubReserves(db,terms,year.year,closing.asOf,statement)) {
          const remaining=reserve.limit-prior(reserve.reference);
          if (remaining>0n) earmarked+=remaining;
        }
        debt+=outstanding-minimum(outstanding,earmarked);
        // General BB is posted oldest first. Preserve this year's reserved share
        // before admitting a general collection for a later wage year.
        if (earmarked>0n) break;
      }
      const proof=income?clubProceeds(db,terms).find(p=>p.reference===income):null;
      if (income && !proof) return null;
      const offset=prior('',income),amount=minimum(balance,debt,proof?proof.limit-offset:balance);
      return amount>0n?{amount:String(amount),sale:'',income,holder:proof?.owner??terms.payroll,year:0,offset:String(offset),proof}:null;
    }
    for (const y of closing.years) {
      if (y.arrears==='0') continue;
      for (const reserve of clubReserves(db,terms,y.year,closing.asOf,statement)) {
        const offset=prior(reserve.reference);
        const amount=minimum(balance,BigInt(y.arrears),reserve.limit-offset);
        if (amount>0n) return {amount:String(amount),sale:reserve.reference,income:'',holder:terms.sponsor,year:y.year,offset:String(offset),proof:reserve};
      }
    }
    return null;
  }
  async function recover(row,terms) {
    const details=JSON.parse(row.details);
    const {source,bytes,block,amount,rent}=details;
    const expectedSource=details.sale?terms.sponsor:terms.payroll;
    const {tx:expected,marker}=await collectionTransaction(terms,source,details,block,rent);
    const signed=Transaction.from(Buffer.from(bytes,'base64'));
    if (source!==expectedSource || !signed.verifySignatures() || bs58.encode(signed.signature)!==row.signature ||
        !expected.serializeMessage().equals(signed.serializeMessage())) throw Error('Stored collection terms changed.');
    const read=()=>rpc.getTransaction(row.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
    let record=await read();
    if (!record && await rpc.getBlockHeight('finalized')>block.lastValidBlockHeight) {
      record=await read();
      if (!record) {
        if (await rpc.getAccountInfo(marker,'finalized')) throw Error('Collection marker exists. Restore its finalized receipt before retrying.');
        db.prepare('DELETE FROM wage_collection_pending WHERE signature=?').run(row.signature);
        return {status:'expired',signature:row.signature};
      }
    }
    if (!record) {
      await rpc.sendRawTransaction(signed.serialize(),{preflightCommitment:'confirmed'});
      await rpc.confirmTransaction({...block,signature:row.signature},'finalized');
      record=await read();
      if (!record) throw Error('Waiting for finalized collection evidence.');
    }
    if (record.meta?.err) {
      if (await rpc.getAccountInfo(marker,'finalized')) throw Error('Another collection used this marker. Verify its payment.');
      db.prepare('DELETE FROM wage_collection_pending WHERE signature=?').run(row.signature);
      throw Error('The automatic wage collection failed on chain.');
    }
    verifyCollection(record,signed,terms,details.holder,BigInt(amount));
    const result=await reconcile(terms.club,undefined,{verified:{signature:row.signature,slot:record.slot}});
    return {status:'collected',signature:row.signature,amount,source:details.sale?'purchase reserve':details.income?'sale proceeds':'club payroll',result};
  }
  return async function collect(club,mode,signer) {
    if (!['income','proceeds','reserve'].includes(mode)) throw Error('Choose income, proceeds or reserve collection.');
    const {terms}=market(club);
    if (await rpc.getGenesisHash()!==terms.genesis) throw Error('Wrong payroll network.');
    const source=mode==='reserve'?terms.sponsor:terms.payroll;
    if (String(signer.publicKey)!==source) throw Error('Use the configured collection source signer.');
    const existing=pending(club);
    if (existing) return recover(existing,terms);
    const closing=await reconcile(club);
    if (closing.years.every(year=>year.arrears==='0')) return {status:'no arrears'};
    const mint=new PublicKey(terms.mint);
    const sources=mode==='proceeds'?clubProceeds(db,terms):[{owner:source,reference:''}];
    let candidate,balance;
    for (const funding of sources) {
      if (funding.limit===0n || (funding.reference && !quote(terms,closing,mode,funding.limit,funding.reference))) continue;
      const owner=new PublicKey(funding.owner),address=getAssociatedTokenAddressSync(mint,owner);
      const account=await rpc.getAccountInfo(address,'finalized');
      if (!account) continue;
      const tokens=unpackAccount(address,account);
      if (!tokens.owner.equals(owner) || !tokens.mint.equals(mint) || tokens.isFrozen) continue;
      balance=tokens.amount;
      if (mode==='reserve' && balance<remainingReserveCustody(db,terms))
        throw Error('Reconcile the shortfall in pooled purchase reserves before collecting wages.');
      if (mode==='proceeds') {
        if (!tokens.delegate?.equals(signer.publicKey)) continue;
        balance=minimum(balance,tokens.delegatedAmount);
      }
      candidate=quote(terms,closing,mode,balance,funding.reference);
      if (candidate) break;
    }
    if (!candidate) return {status:'no eligible funds'};
    const {proof,...claim}=candidate;
    if (proof) await verifyFundingSale(rpc,proof,terms);
    const block=await rpc.getLatestBlockhash('finalized'),rent=await rpc.getMinimumBalanceForRentExemption(0);
    const {tx,marker}=await collectionTransaction(terms,source,claim,block,rent);
    if (await rpc.getAccountInfo(marker,'finalized')) throw Error('Collection marker already exists. Recover the original journal.');
    const fee=(await rpc.getFeeForMessage(tx.compileMessage(),'finalized')).value;
    if (!Number.isSafeInteger(fee) || fee<0 || !Number.isSafeInteger(rent) || rent<=0 || !Number.isSafeInteger(fee+rent))
      throw Error('A current collection cost in lamports is required.');
    tx.sign(signer);
    const signature=bs58.encode(tx.signature);
    const details={...claim,source,block,rent,bytes:tx.serialize().toString('base64')};
    await reconcile(club,undefined,{after(latest,current) {
      if (pending(club)) return;
      const revised=quote(current,latest,mode,balance,claim.income);
      if (JSON.stringify(terms)!==JSON.stringify(current) || !revised || revised.sale!==claim.sale ||
          revised.amount!==claim.amount || revised.offset!==claim.offset) throw Error('Collection changed. Retry with current evidence.');
      const cap=config().wageSettlement.collectionBudgetLamports?.[source];
      const spent=db.prepare('SELECT COALESCE(SUM(lamports),0) AS total FROM wage_collection_costs WHERE signer=?').get(source).total;
      if (!Number.isSafeInteger(cap) || cap-spent<fee+rent) throw Error('Collection exceeds the configured signer fee and rent budget.');
      db.prepare('INSERT INTO wage_collection_costs VALUES(?,?,?)').run(signature,source,fee+rent);
      db.prepare('INSERT INTO wage_collection_pending VALUES(?,?,?)').run(club,signature,JSON.stringify(details));
    }});
    const next=pending(club);
    return next?recover(next,terms):{status:'reconciled by another worker'};
  };
}
