export function trainingAccess(origin,wallet,{nonce,expiresAt}) {
  return ['View my Ballerz training report',origin,'Wallet: '+wallet,'Request: '+nonce,
    'Expires: '+new Date(expiresAt).toISOString(),'Read-only access.'].join('\n');
}

export function trainingOrder(origin,order) {
  return ['Ballerz focused training v1',origin,order.action==='book'?'Reserve one free session':'Cancel this reservation',
    'Manager: '+order.wallet,'Club: '+order.club,'Solana genesis: '+order.genesis,'Pilot sponsor: '+order.sponsor,
    'Footballer: '+order.player,'Player mint: '+order.mint,'Skill: '+order.skill,
    'Week starting: '+new Date(order.week).toISOString(),'Training authority: '+order.authority,
    'Reservation: '+order.id].join('\n');
}
