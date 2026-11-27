// This UTF-8 text is both the review shown to the manager and the wallet payload.
export function loanMessage(terms) {
  return [
    'Ballerz ordinary loan approval v1',
    'Agreement: ' + terms.id,
    'Solana genesis: ' + terms.genesis,
    'Pilot operator: ' + terms.sponsor,
    'BB mint: ' + terms.bbMint,
    'Player: ' + terms.player,
    'Player mint: ' + terms.mint,
    'Finalized purchase: ' + terms.ownershipReference,
    'Parent club and title holder: ' + terms.parent + ' / ' + terms.ownerWallet,
    'Borrowing club and manager: ' + terms.borrower + ' / ' + terms.borrowerWallet,
    'Starts (UTC): ' + new Date(terms.startAt).toISOString(),
    'Ends (UTC, exclusive): ' + new Date(terms.endAt).toISOString(),
    'Parent wage share: ' + (terms.parentWageBps / 100).toFixed(2) + '%',
    'Borrower wage share: ' + (terms.borrowerWageBps / 100).toFixed(2) + '%',
    'Training club during the loan: ' + terms.trainingClubDuringLoan,
    'Both managers must approve before the start. The parent retains the player title.'
  ].join('\n');
}
