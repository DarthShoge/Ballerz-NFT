export function wageStatementMessage(origin,wallet,{nonce,expiresAt}) {
  return ['View my Ballerz club loan wages',origin,'Wallet: '+wallet,'Request: '+nonce,
    'Expires: '+new Date(expiresAt).toISOString(),'Read one wage year for my club. No payment is authorized.'].join('\n');
}
