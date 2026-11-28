# Ballerz Matchday

Two managers take charge of Northbank Athletic and Eastport Rovers. Each club has 17 fictional players. Inspect their attributes, pick an XI, and decide where each player goes with and without the ball. Watch both halves on the live 2D pitch and make touchline decisions as the server plays the match.

## Play locally

Choose **Play AI** to kick off immediately with the team sheet shown in the match centre. Expand **Schedule a fixture** to choose a kickoff time for a multiplayer playtest. Eastport selects a starting XI by position and opens in a counterattacking 4-4-2. Its manager reviews the score and fatigue at 55, 69 and 80 minutes, adjusts the team instructions and can queue a like-for-like substitution at a stoppage. **Invite a manager** starts a two-manager friendly.

From this folder, use Node.js 22.13 or newer. The match engine and web server use Node built-ins. The optional Devnet settlement CLI uses the Solana packages in the lockfile.

```sh
node server.js
```

Open http://127.0.0.1:4173 and create a friendly to manage Northbank. Copy the away invitation and open it in another browser profile to manage Eastport. Each browser remembers its own manager key. Keep the fixture URL bookmarked to revisit the report with that browser profile.

### Run a funded Devnet fixture

Run these commands in `matchday`. Install the locked packages, then print the public fee-payer address and supply it with Devnet SOL for transaction fees and account rent. The observed setup and first match used less than 0.01 Devnet SOL.

```sh
pnpm install --frozen-lockfile
node scripts/devnet-appearances.mjs wallet
node scripts/devnet-appearances.mjs play
node scripts/devnet-appearances.mjs settle FIXTURE_ID
```

`play` creates the demo treasury if needed, schedules one new two-manager fixture, submits both default sheets, and uses the existing playtest clock to reach full time. It prints the fixture ID before kickoff. It settles that fixture and immediately repeats settlement. After a crash or restart, use `settle` with the original ID. Each invocation of `play` creates a different fixture.

For browser play, run `node scripts/devnet-appearances.mjs setup` once, start the local match server, schedule a two-manager fixture, and run `node scripts/devnet-appearances.mjs approve FIXTURE_ID` before lineup lock. Both commands must use the same key directory and `FIXTURE_DB` as the corresponding demo or local server. Have the managers submit their teams. After full time, run `settle FIXTURE_ID` and refresh the match report to see the public receipt.

The CLI pins the Devnet genesis hash. It keeps three dedicated test keys under `%LOCALAPPDATA%/Ballerz/matchday-devnet` on Windows or `~/.local/share/Ballerz/matchday-devnet` elsewhere. `BALLERZ_DEVNET_KEYS` overrides the directory and `BALLERZ_DEVNET_RPC` can select a different Devnet RPC. Keep the private files local. The payer acts as the match operator and test treasury authority. Each named club has its own wallet and token account. Setup atomically issues 160,000 whole test BB to the treasury and revokes mint authority. Minting is a one-time test setup and earns a club no appearance payment.

The match runs on the matchday server. The trusted operator binds the clubs before kickoff and attests its final result. Solana executes the SPL Token transfers. One atomic transaction creates a permanent zero-data receipt owned by the Memo program at a deterministic address for the fixture and operator, pays 8,000 BB per eligible side and records the result in a memo. The receipt creation cannot succeed twice. Only timely submitted sheets qualify. A single pre-kickoff forfeit pays the ready side; a double forfeit pays zero. Abandonments use per-side engine evidence under the existing seven-player rule. Settlement fails closed on incomplete legacy evidence.

Verification checks the finalized transaction, signer, receipt creation, memo, mint, recipients and exact pre/post token-balance changes. A retry recovers the original finalized signature from the receipt history. Use the same treasury identity across restarts. This pilot trusts the operator’s signing key and fixture database; deployed standard Solana programs enforce the transaction, while the operator authorizes the sporting outcome.

To play with another device on the same trusted network, start the server in PowerShell with the following commands. Open the host computer's LAN address on port 4173 **before** creating the fixture so the copied invitation points to a reachable address.

```powershell
$env:HOST = '0.0.0.0'
node server.js
```

The local server uses SQLite in `data/fixtures.sqlite`. Restarting it preserves submitted team sheets, manager access, live match progress and results. `PORT` and `FIXTURE_DB` override the listening port and database path.

## Try a scheduled fixture

From this folder, start a fresh test world in PowerShell.

```powershell
$env:FIXTURE_DB = 'data/playtest.sqlite'
$env:WORLD_START_UTC = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
node server.js
```

The database saves the world start on first launch. On subsequent launches, use the same start or clear the environment variable with `Remove-Item Env:WORLD_START_UTC`. Use a fresh database to try a different start.

Open the match centre, choose a local kickoff more than 30 minutes away, and select **Schedule fixture**. Send the invitation to the away manager. Both managers can submit and revise their team sheets until 30 minutes before kickoff. The server starts the fixture at kickoff even if neither browser is open. A missing sheet results in a forfeit. The calendar advances one in-game week per real day.

Set `BALLERZ_PLAYTEST_CONTROLS=1` before starting the server to give the home manager time controls. **Kick off now** starts a scheduled fixture once both sheets have been submitted. In a live fixture, **Fast-forward 10 min** advances the shared simulation by ten match minutes or until halftime or full time. **Resume second half** skips the remaining halftime wait.

## On the touchline

The team sheet offers 14 formations for each phase, 11 tactical styles, and 12 team instructions. Select a shirt on the pitch or choose a starter in **Player selection** directly underneath. You can bring in a reserve, switch two starters, inspect a profile and set both phase roles there. Try a false nine beside a poacher, or put a stopping wide centre-back and a covering wide centre-back on opposite sides of a three. The optional pitch preview uses the match engine to show where the team settles with the ball in each third.

A friendly starts when both team sheets are locked. New fixtures advance at nine match seconds per real second. Each half takes five real minutes before added time, with a one-minute halftime break. Both managers see the same score, clock and positions. Use **Touchline** to change roles, the defensive shape, or instructions during play. Changes take effect on the next action. A same-position substitute takes over the outgoing shirt’s role pair and duty at the next eligible stoppage. After a manual substitution, the manager controls subsequent discretionary changes. The engine still handles forced injury and goalkeeper cover.

Ratings start at 6.6 on a 1–10 scale and update with recorded contributions such as goals, assists, chances created, saves and possession regains. The final report uses the same scale. The pitch displays the server's positions and interpolates the movement between actions. [FM26 matchday reference](https://www.footballmanager.com/the-dugout/maximising-your-match-days-fm26)

Live commentary runs directly underneath the pitch. The main match page shows shots, shots on target, xG, challenges won, set pieces and a selectable shot map. On a wide screen the comparisons sit beside the pitch. On a phone they follow the pitch and commentary. **Ratings** opens each player’s shooting and defensive totals.

During open play, **Ratings → Roles** also shows the latest defensive assignment. A player pressing the carrier, marking a receiver, screening a passing lane or covering a teammate can have a different target on the next action. The role comparison lists the assignments available by position. [FM26 and Ballerz role coverage](../docs/fm26-role-coverage.md)

Select an outfield shirt under **Player selection** or in **Touchline** to adjust its marking, pressing and tackling independently. Standard follows the role. An individual instruction stays with the tactical position when a replacement takes over. **Ratings → Defending** shows each player's regains and fouls. Use the other team's shots and xG in the main match stats to see the chances your side has conceded. [Individual instructions and measured outcomes](../docs/fm26-player-instructions.md)

During a stoppage, players run from their current positions into the restart setup. Throw-ins bring short passing options to the touchline, defenders can form a wall near goal, and corner targets and markers prepare their runs. The ball stays at the restart spot until play resumes.

## First player transfer on Devnet

With the three dedicated matchday Devnet demo keys in place and SOL in the fee payer, run `node scripts/first-transfer.mjs play`. Northbank lists a newly issued, single-supply test winger. Eastport approves 100,000 trial BB to Northbank and 30,000 to the operator-controlled payroll account. Title, fee and wage reserve settle in one transaction. The trial BB mint is separate from fixture rewards. Both trial mints revoke minting and have zero decimals and no freeze authority.

The two club keys and the sponsor sign the closing terms. The listing's displayed expiry is its last valid block height. A fresh two-signature SPL multisig identifies each listing version. The seller can revoke the current delegate or replace it with a new listing. The transaction signatures bind the buyer, seller, asset, price, wages and blockhash. Both official club token accounts and the payroll account are checked in the transaction. The demo uses distinct test wallets operated locally and assumes a tradeable player, eligible clubs and zero deductions. Grant-funded players use the separate grant ledger described below. Production permissions, wage disbursement and sporting registration remain tracked in the marketplace epic.

The signed messages are saved in the private Devnet key directory before either is submitted. Repeating `play` reconciles those exact signatures. `node scripts/first-transfer.mjs status` reads the purchase signature without submitting anything. Keep the signed journal private while the offer is live. A finalized receipt reports both token mints, title, each BB balance change and the effective block time. [Marketplace epic](https://github.com/DarthShoge/Ballerz-NFT/issues/63)

## How the match engine works

The server resolves one action at a time on a 105 × 68 metre pitch. Each action advances the match clock. A successful action can keep possession across several passes. An interception, tackle, restart or shot can change who controls the ball. Formation, work rate, condition and pressing affect how players take up space and when they close down.

Passing options compete on distance, progress, the receiver and whether a defender can reach the lane in time. Build-up changes how players weigh the trade-offs. At a shot, the engine records distance, angle, visible goal, pressure and shot type. The reporting xG estimate uses that snapshot. Shot execution also uses the shooter's and goalkeeper's attributes to resolve the outcome. See the [research and benchmark notes](../docs/match-simulation-research.md).

The referee assesses contact from the approach, tackling, decisions and condition. Wide players can choose a high cross, low cross or cutback. The ball's path after a defender's touch decides whether it stays in play, goes out for a throw-in or goes behind for a corner. Corner routines assign takers, targets and defenders from the players on the pitch. Build-up influences delivery choice. A corner can end in contested first contact, a goalkeeper claim, a clearance or a second ball.

A forward through on goal can carry into range, finish or square to a teammate with a better chance. The keeper can come out to narrow the angle. An advancing keeper offers a chipped finish if the striker has room to lift the ball. Shots carry their strike and impact positions into the pitch replay. Ground passes, high deliveries, blocks and deflections each have their own movement. A successful defensive challenge is a dispossession of the ball carrier. Intercepting a pass or gathering a loose ball counts separately.

The report includes a shot map, the actions leading to a selected shot, chance quality, incidents and player performances. The timeline shows why each corner was awarded and who won a second ball after a clearance. Detailed stats include crosses, corners taken, corners leading to a shot, claims, clearances, quick shots after a clearance and advantages won. Each completed match retains its action log and engine version. Earlier reports can still be reopened.

The fixture uses a single starting formation per team with moving attacking and defending shapes. Players outside the starting eleven are available for automatic substitutions. The server uses up to five replacements across three stoppages and handles forced goalkeeper cover. In-match injuries and red cards affect the current fixture. Match reports preserve the score at stoppage and the administrative result when play is abandoned. [IFAB Law 3](https://www.theifab.com/laws/latest/the-players/) · [IFAB Law 7](https://www.theifab.com/laws/latest/the-duration-of-the-match/) · [Ballerz fixture rules](../docs/adr/0003-schedule-league-fixtures.md)

## Development

### Manager transfer listings (Devnet)

Open **Transfer listings** in the match centre. The current owner of the trial winger connects a Solana wallet, enters a whole-BB price, reviews proceeds, wage reserve, restrictions and block expiry, then approves the exact listing transaction in their wallet. A replacement or cancellation needs its own approval. The public view follows the finalized title delegate. The original signed transaction is recoverable after a restart.

To enable the pilot, set `BALLERZ_LISTING_SPONSOR` to the path to the capped Devnet fee payer used to provision the first-transfer assets, then run `node server.js`. The server needs only the sponsor key. Keep the seller key in the manager's wallet. The page uses an injected Solana wallet that supports `signTransaction`. Optional settings are `BALLERZ_DEVNET_RPC` and `BALLERZ_LISTING_DB`. The isolated fixed-supply trial winger has zero commission, grant recovery and arrears and a 30,000 test BB wage reserve. Buyer settlement still needs the buyer and seller to approve the sale. [First-transfer rules](../docs/studio/founder-rules.md) · [S11-01](../docs/studio/backlog.md#s11-01)

Install the test browser with `pnpm exec playwright install --with-deps chromium` before running the validator suite. It drives the seller page in Chromium against a fresh local validator using a disposable wallet.

### Sporting registration for scheduled matchday fixtures

Run `node scripts/register-transfers.mjs operator.json` to reconcile signed purchases into the local matchday SQLite database. Add `--watch` to poll every 15 seconds. The operator config identifies the same `fixtureDb` used by the matchday server, the approved public `sponsor` and `bbMint`, the `players` map (title mint to existing matchday player ID), and the `wallets` map (wallet address to Northbank or Eastport club ID). Use `northbank` and `eastport` as the IDs. Supply `journals` as an array of signed trial file paths or `grantLedger` as the grant database path. Paths resolve relative to the config. Keep the file and financial journals private. The worker reads the financial source and Devnet without a signer. For a local validator, pin `validatorGenesis` and set `BALLERZ_DEVNET_RPC` to its loopback RPC URL.

Both managers see the same purchase reference in their scheduled fixture. Registration requires finalized transfer evidence for the exact signed terms and the single player title. The block time determines the settlement time. A timely verified sale updates the squads of open fixtures, and a manager whose submitted XI becomes invalid must submit a valid replacement before lock. A late index update leaves locked squads and recorded matches intact. The first eligible fixture is the earliest scheduled sheet that actually received that registration. Reloading the worker recovers pending references from the matchday database. [Founder team-sheet rule](../docs/studio/founder-rules.md) · [S11-04](../docs/studio/backlog.md#s11-04)

### Grant-funded transfers (closed pilot)

The grant ledger records the purchase bursary against a player mint. A signed sale pays the treasury up to the outstanding claim, pays the seller any surplus and funds payroll separately in one Solana transaction. An independent sale records the shortfall as a treasury loss. A connected sale carries it into the buyer's next sale. The original allocation can only be registered once. [Founder decision](../docs/studio/founder-rules.md#grant-loss) · [S11-03 acceptance cases](../docs/studio/backlog.md#s11-03)

The operator keeps a private JSON configuration with `ledger` (SQLite path), `treasury` (a dedicated public wallet), `controlGroups` (verified wallet-to-group map), and optional `reviewHolds` (entries with `clubs` and an appealable `reason`). Keep one authoritative ledger and back it up with the signing service. Unknown clubs and held pairs require operator review. The current browser rehearsal uses the original grant-free winger. Grant-bearing sales use the operator flow below. A direct SPL title transfer outside the pilot does not settle a grant. A subsequent sale by an unrecorded owner requires reconciliation.

- Record an actual funded allocation with `node scripts/grant-sale.mjs register operator.json allocation.json`. Supply public `playerMint`, `bbMint`, `seller`, `sponsor` and whole-BB `claim`. Registration records the funding event and does not disburse BB.
- Review the split before approval with `node scripts/grant-sale.mjs review operator.json terms.json`. Supply the same public accounts plus `buyer`, `price` and `wages`. The review shows both the treasury write-off and the claim the buyer would inherit.
- The closed trial's `signTrial` takes the ledger and the full reviewed terms. It rechecks the outstanding claim and club relationship before signing. It binds the split to both clubs' signatures and reserves the sale before returning the signed journal. The operator submits it with `node scripts/grant-sale.mjs settle operator.json signed-trial.json`. Quarantine a database or chain discrepancy before issuing more signatures.
- After a restart or unknown RPC outcome, run `node scripts/grant-sale.mjs recover operator.json PLAYER_MINT` to use the reserved signatures. A finalized purchase updates the owner, remaining claim and receipt together; a retry returns the stored receipt. An expired or failed purchase can release the reservation after reconciliation.

The browser checks the token instructions, player mint, delegate, fee payer and signed terms before opening the wallet. Offer expiry stops purchases. If a delegate remains on the title account, the seller can still revoke it. The desk defaults to 12 sponsored requests per trial mint across restarts in the same database, with one slot reserved for cancellation. Failed and expired submissions count because they can incur fees. Set `BALLERZ_LISTING_REQUEST_LIMIT` to change the pilot allowance; keep the same ledger when restarting.

```sh
node --test
node scripts/benchmark.mjs 120 20261201
```

### Ordinary loan agreements

From the match centre choose **Loans**, then **Open my inbox**. Connect the designated Solflare account and sign the short-lived read-only request. Select an agreement to review the player, dates, wage shares and counterparty. **Approve loan terms** is a separate signature. Managers with a private invitation can paste the link or reference on the same Loans screen. The operator issues offers using the procedure below.

Run `node scripts/review-loan.mjs operator.json proposed-loan.json` for a read-only preview. Supply `player` (matchday ID), `borrower` (club ID), `startAt` and `endAt` (UTC epoch milliseconds). The pilot minimum is four in-game weeks. Optional `borrowerWageBps` defaults to 10000 for the full wage. The command reads the latest verified purchase and checks the owner's title account and mint together at a finalized slot. [Loan rules](../docs/adr/0003-schedule-league-fixtures.md) · [Wage split](../docs/adr/0009-fund-first-squads-with-ballerbuckz.md) · [S11-05](../docs/studio/backlog.md#s11-05)

1. In the sporting operator file, set `loanManagers` to a map from each club ID to its designated public wallet. The existing `wallets` and `players` bindings must agree. The parent signs with the wallet holding the title.
2. Set `BALLERZ_LOAN_OPERATOR` to the operator file and `FIXTURE_DB` to its existing sporting database. Run `node server.js`. Both managers must reach the same matchday service and database.
3. Run `node scripts/propose-loan.mjs operator.json proposed-loan.json`. Give both managers the returned `reviewPath` on that service. Anyone with the link can read the terms. Reissuing identical pending terms returns the same agreement. A revised offer supersedes overlapping pending offers and requires two fresh approvals. A confirmed agreement reserves its full period.
4. Each manager opens the link in their Ballerz Solflare profile, connects and reviews the player, wallets, dates, wage shares and training club. **Approve loan terms** signs the displayed text. Both signatures must arrive before the start. Use **Refresh agreement** to recover the recorded result after an interrupted response.

The pilot records the two approvals and one confirmation in SQLite. It rechecks finalized Solana ownership and current club authority before accepting each signature. The agreement becomes active at the inclusive start and ends at the exclusive end. Wallet signing costs zero SOL and the parent retains the title.

Scheduled team sheets use the registration effective immediately before their deadline. A start or return exactly at lock applies to the next eligible sheet. The second approval updates open squads. A sale during the loan changes the parent, and the borrower keeps its registration for the term. A manager whose submitted XI becomes invalid can select a replacement and resubmit before lock.

In an operator-approved fixture, a borrower’s locked starter or a substitute who already took the pitch can finish the match across the return date. Other clubs regain selection at a deadline after the last such fixture resolves. An unused reserve loses substitution eligibility on return to another club. The existing pre-lock fixture approval authorizes cross-club effects. A self-scheduled rehearsal can exercise the lineup flow without delaying another club or earning loan minutes.

Both managers can refresh the agreement to see verified minutes from the match engine’s final performance report. A fixture credits the agreement once, including time actually played before abandonment. A pre-kickoff forfeit contributes zero.

### Accrued wages on loan

With the shared world clock initialized, the operator can publish a player's approved annual test rate using `node scripts/publish-wage-rate.mjs operator.json rate.json`. Supply the registered `mint`, the one-based wage `year` and `annualBB` as a whole number. Publishing the same rate again returns the original record. A different rate for that mint and year is rejected. Each year starts on the shared calendar and lasts 52 in-game weeks. Rate calculation from ability history is tracked under S10-01.

The agreement shows the published rates and the accrual over the confirmed loan term in test BB. For example, at 52,000 BB per year, a four-week loan accrues 4,000 BB. With a 75% borrower share and a sale halfway through, the borrower accrues 3,000 BB, the old parent 500 BB and the new parent 500 BB. If the borrower buys the player, its two obligations appear under one club. A delayed index uses the finalized sale's effective time. A fixture that runs past the agreed return cannot extend wage accrual.

Liabilities are reconstructed from the signed shares, immutable rates and finalized ownership history. The report keeps exact fractions per club and displays whole BB. A missing rate for elapsed time makes the total unavailable until the operator supplies it. [S11-05](https://github.com/DarthShoge/Ballerz-NFT/issues/68) · [Wage timing](../docs/adr/0009-fund-first-squads-with-ballerbuckz.md) · [Founder wage rules](../docs/studio/founder-rules.md)

### Club loan wage statements

The club-wide loan wage statement is available under **Match centre → Loans → Club loan wages**. Open a wage year using the designated manager’s Solflare wallet. The read-only signature names the selected year. The statement shows accrued wages and, after reconciliation, the billed, paid and outstanding amounts at the operator’s last checkpoint. [Wage timing and ownership](../docs/adr/0009-fund-first-squads-with-ballerbuckz.md)

### Year-end loan payroll

The pilot allocates prepaid test BB to closed wage years, oldest first. In the operator JSON set `wageSettlement.treasury` to the dedicated wage treasury public key and `wageSettlement.payroll.northbank` and `wageSettlement.payroll.eastport` to the separate club payroll public keys. Use previously unused payroll wallets and provision the ordinary associated test BB token accounts for the treasury and paying clubs. Each paying wallet needs Devnet SOL for its own transaction fee. Preparing the first payment or running the first reconciliation pins the accounts, currency, network, sponsor and calendar to this fixture database.

1. Run `node scripts/reconcile-loan-wages.mjs operator.json prepare eastport 40` for a 40 test BB prepayment. The command prints the public terms and an unsigned transaction. The club payroll wallet reviews, signs and submits this transfer separately. Keep its signature for recovery.
2. Run `node scripts/reconcile-loan-wages.mjs operator.json reconcile eastport SIGNATURE` to admit the finalized payment. Repeating the command recovers the same credit. The operator must submit each payment signature. A payment awaiting import is excluded from the displayed checkpoint.
3. Run `node scripts/reconcile-loan-wages.mjs operator.json reconcile eastport` at year-end, after match rewards and sporting transfers are reconciled, and after any late ownership correction. Repeat for Northbank. The operator can admit payments before year-end. Unapplied funds remain club-specific, and whole BB from accumulated fractions carry into later bills.

### Automatic wage collection

Run `node scripts/collect-loan-wages.mjs operator.json eastport reserve /private/path/to/custody-key.json --watch` for the local pilot. The worker polls every 15 seconds and collects one eligible payment per pass. Omit `--watch` for one pass. The CLI loads the signer in the worker process. The matchday HTTP server only serves the manager’s read-only statement. Use a single durable fixture database for each market and back it up with SQLite’s backup mechanism.

| Source argument | Signer | Funds available to settle closed wage bills |
| --- | --- | --- |
| `reserve` | Transfer pilot custody sponsor | Buyer-funded wage deposits verified against the original finalized player purchase. The maximum is that player's whole accrued share during the buyer's ownership in the purchase year, the unspent deposit and the club's outstanding bill for that year. |
| `proceeds` | Club’s dedicated payroll wallet | Finalized sale proceeds after grant recovery. The seller authorizes a bounded SPL token allowance to the payroll wallet on its test BB account. The worker checks the current delegate, remaining allowance, net proceeds, available BB and club arrears. Revocation takes effect on chain. |
| `income` | Club’s dedicated payroll wallet | Same-mint BB available in the club payroll account, capped at remaining arrears. This includes ordinary club wage funding and income routed directly to that wallet. The original appearance and transfer trial currencies are distinct. |

General collections leave room for eligible purchase reserves in the oldest outstanding bill. A late sale correction can restrict how much of an earlier reserve payment still applies. Excess from that payment stays attributed to its purchase in treasury custody. Unspent deposits stay in their original custody. Grant-funded wage bursaries, proportional refunds and competition-entry enforcement are separate release work.

Each payment carries an on-chain receipt marker. A worker journals the signed transaction before sending, verifies finalized token-balance changes and posts the receipt once. Restart the same command to recover an interrupted submission. A missing finalized history for an existing marker requires recovery of the original journal. Set a cumulative lamport cap per signing public key in `wageSettlement.collectionBudgetLamports`. The worker reserves the fee and marker rent in the database before submission, including across clubs sharing the sponsor. Expired or failed attempts still consume the operator budget. Recovery of the same signed transaction consumes it once. The source signer also needs enough Devnet SOL. An SPL delegate can spend up to its approved allowance, so use only an allowance intended for this pilot, and keep the worker keys private.

### Focused training on loan

Players can also be managed through **Match centre → Loans → Focused training**. Open the report with the designated club wallet. A confirmed borrower can see the start date before taking training control. During the term the borrower reserves sessions and the current parent can read the weekly report. At the exclusive end date control returns to the current registered owner. A sale during the term preserves the borrower's reservations.

Each manual booking reserves a club slot and a player slot in the shared game week. The caps are six and two respectively. The manager can cancel a reservation from the report. The pilot operator verifies availability, attendance and skill, then runs `node scripts/finish-training.mjs operator.json RESERVATION_ID completed` (or `skipped`). Find the ID in the operator's sporting SQLite table `focused_sessions`. A completed session carries 100% weight for the player's first weekly session and 50% for the second, across clubs. Cancellation, a missed session, loss of training authority or a week rollover releases an unused reservation. This pilot records session evidence. Attribute progression, recurring plans and automatic injury or rest checks are separate development work. [Loan training decision](../docs/studio/founder-rules.md#training-close)

### Buying a player on loan

From **Match centre → Transfer listings → Review loan and suspension terms**, select a registered player to see the borrower, agreed dates, outstanding return and wage split. A registered buying wallet can acknowledge the terms with a Solflare message. The financial worker requires a separate signed purchase. The grant-backed listing and purchase include the digest of that buyer's acknowledgement. A new reservation compares the latest report, and recovery of an existing reservation uses the original signed journal. [Loan resale decision](../docs/adr/0003-schedule-league-fixtures.md)

Set `saleLedger` in the loan operator configuration to the existing grant settlement SQLite file. Keep this file and the sporting register at stable paths. At startup the desk links previously confirmed grant-backed loans. A new grant-backed loan or verified suspension also links that title. Until disciplinary service is automated, the operator records a checked count with `node scripts/record-suspension.mjs operator.json PLAYER_MINT MATCHES`. An unknown count blocks acknowledgement. Each newly completed operator-approved competitive fixture requires reconciliation in the two-club pilot.

To run the payout integration suite on x86-64 Linux or WSL, install the locked Node dependencies and run `bash scripts/test-payouts.sh` from this directory. It provisions an isolated validator, checksum-verifies the Solana programs, plays fixtures and starts separate settlement processes. Each run uses temporary keys, ledger and SQLite files. Set `SOLANA_TEST_VALIDATOR` to reuse an installed Agave 4.4.1 validator. GitHub requires both **Matchday regression tests** and **Solana payout integration** on pull requests to `main`.

The server validates club membership, formation and eleven unique selections. Unsubmitted tactics stay in the manager's browser. In friendlies, each team sheet locks on submission and the match starts when both managers are ready. Locked team sheets stay hidden from the opponent until full time. A version check protects simultaneous submissions, so both managers see the same result.

Both modes use two fixed squads. Scheduled playtest fixtures support optional operator-approved Devnet appearance payments. League standings, outage rescheduling, transfers and Solana club ownership belong to later development.
