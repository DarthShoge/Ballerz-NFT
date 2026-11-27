// Verify the wallet request independently of the server's quote seal. Only the
// pilot's two listing operations are permitted to reach signTransaction.
export async function reviewedListing(web3, quote, desk, intent) {
  const {PublicKey, SystemProgram, SystemInstruction, Transaction, SYSVAR_RENT_PUBKEY} = web3;
  const token = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  const associated = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
  const memo = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
  function check(condition) {
    if (!condition) throw new Error('The wallet request differs from the reviewed listing. Refresh and review again.');
  }
  check(quote.asset===desk.asset && quote.seller===intent.seller && quote.action===intent.action
    && quote.price===intent.price && quote.revision===desk.revision && quote.expiry>=desk.height
    && quote.wages===desk.policy.wages && quote.total===quote.price+quote.wages
    && quote.net===quote.price-desk.policy.commission-desk.policy.grantRecovery-desk.policy.arrears
    && JSON.stringify(quote.policy)===JSON.stringify(desk.policy));
  const tx=Transaction.from(Uint8Array.from(atob(quote.wire),c=>c.charCodeAt(0)));
  const payer=new PublicKey(desk.sponsor), seller=new PublicKey(intent.seller);
  const mint=new PublicKey(desk.asset), version=new PublicKey(quote.version);
  const source=owner=>PublicKey.findProgramAddressSync([owner.toBytes(),token.toBytes(),mint.toBytes()],associated)[0];
  const publishing=quote.action==='list';
  check(tx.instructions.length===4 && tx.feePayer.equals(payer) && !seller.equals(payer));
  const expectedSigners=publishing?[payer,seller,version]:[payer,seller];
  check(tx.signatures.length===expectedSigners.length && expectedSigners.every(
    key=>tx.signatures.some(s=>s.publicKey.equals(key))));
  function instruction(index, program, accounts, bytes) {
    const ix=tx.instructions[index];
    check(ix.programId.equals(program) && ix.keys.length===accounts.length
      && accounts.every((key,i)=>ix.keys[i].pubkey.equals(key)));
    if (bytes) check(ix.data.length===bytes.length && bytes.every((value,i)=>ix.data[i]===value));
    return ix;
  }
  if (publishing) {
    const create=SystemInstruction.decodeCreateAccount(instruction(0,SystemProgram.programId,[payer,version]));
    check(create.space===355 && create.programId.equals(token));
    instruction(1,token,[version,SYSVAR_RENT_PUBKEY,seller,payer],[2,2]); // InitializeMultisig, two signers
    instruction(2,token,[source(seller),mint,version,seller],[13,1,0,0,0,0,0,0,0,0]); // ApproveChecked, one title
  } else {
    check(quote.action==='cancel' && desk.delegated?.version===quote.version);
    instruction(0,associated,[payer,source(payer),payer,mint,SystemProgram.programId,token],[1]);
    instruction(1,token,[source(seller),mint,source(payer),version,seller,payer],[12,0,0,0,0,0,0,0,0,0]);
    instruction(2,token,[source(seller),seller],[5]); // Revoke
  }
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(quote.policy)));
  const disclosures=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  const expectedMemo={v:1,action:quote.action,listing:quote.version,bb:desk.bbMint,
    price:quote.price,wages:quote.wages,expires:quote.expiry,disclosures};
  check(new TextDecoder().decode(instruction(3,memo,[]).data)===JSON.stringify(expectedMemo));
  return tx;
}
