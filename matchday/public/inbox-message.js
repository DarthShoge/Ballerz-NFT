export function inboxMessage(origin,wallet,{nonce,expiresAt}) {
  return ['View my Ballerz loan agreements',origin,'Wallet: '+wallet,
    'Request: '+nonce,'Expires: '+new Date(expiresAt).toISOString(),
    'Read-only access. This message does not approve a loan or move any assets.'].join('\n');
}
