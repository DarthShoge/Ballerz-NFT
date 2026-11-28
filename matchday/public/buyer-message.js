export function buyerMessage(report,wallet) {
  const loans=report.loans.map(loan=>
    loan.borrower+' | '+new Date(loan.startAt).toISOString()+' to '+new Date(loan.endAt).toISOString()+
    ' | borrower '+(loan.borrowerWageBps/100).toFixed(2)+'% | parent '+(loan.parentWageBps/100).toFixed(2)+'%'+
    (loan.returnPending?' | return pending':''));
  return ['Ballerz buyer sporting review v1','Review only. No purchase, payment or title transfer.',
    'Reviewing wallet: '+wallet,'Network: '+report.genesis,'Player: '+report.player+' / '+report.mint,
    'Currency: '+report.bbMint,'Pilot sponsor: '+report.sponsor,'Registered parent: '+report.parent+' / '+report.owner,
    'Finalized sale: '+report.reference,'Inherited loan terms (UTC):',...(loans.length?loans:['No confirmed commitments.']),
    'Suspension remaining: '+(report.suspension ? report.suspension.remaining+' matches, checked '+
      new Date(report.suspension.checkedAt).toISOString()+' (revision '+report.suspension.revision+')' : 'unverified')].join('\n');
}
