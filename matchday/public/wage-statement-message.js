export function wageStatementMessage(origin,wallet,{nonce,expiresAt,scope}) {
  return ['View my Ballerz club loan wages',origin,'Wallet: '+wallet,'Request: '+nonce,
    'Expires: '+new Date(expiresAt).toISOString(),'Wage year: '+scope,'Read-only statement. No payment is authorized.'].join('\n');
}
