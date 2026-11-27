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

The two club keys and the sponsor sign the closing terms. The listing's displayed expiry is its last valid block height. A fresh two-signature SPL multisig identifies each listing version. The seller can revoke the current delegate or replace it with a new listing. The transaction signatures bind the buyer, seller, asset, price, wages and blockhash. Both official club token accounts and the payroll account are checked in the transaction. The demo uses distinct test wallets operated locally and assumes a tradeable player, eligible clubs and zero deductions. Production permissions, wage disbursement, grant recovery and sporting registration remain tracked in the marketplace epic.

The signed messages are saved in the private Devnet key directory before either is submitted. Repeating `play` reconciles those exact signatures. `node scripts/first-transfer.mjs status` reads the purchase signature without submitting anything. Keep the signed journal private while the offer is live. A finalized receipt reports both token mints, title, each BB balance change and the effective block time. [Marketplace epic](https://github.com/DarthShoge/Ballerz-NFT/issues/63)

## How the match engine works

The server resolves one action at a time on a 105 × 68 metre pitch. Each action advances the match clock. A successful action can keep possession across several passes. An interception, tackle, restart or shot can change who controls the ball. Formation, work rate, condition and pressing affect how players take up space and when they close down.

Passing options compete on distance, progress, the receiver and whether a defender can reach the lane in time. Build-up changes how players weigh the trade-offs. At a shot, the engine records distance, angle, visible goal, pressure and shot type. The reporting xG estimate uses that snapshot. Shot execution also uses the shooter's and goalkeeper's attributes to resolve the outcome. See the [research and benchmark notes](../docs/match-simulation-research.md).

The referee assesses contact from the approach, tackling, decisions and condition. Wide players can choose a high cross, low cross or cutback. The ball's path after a defender's touch decides whether it stays in play, goes out for a throw-in or goes behind for a corner. Corner routines assign takers, targets and defenders from the players on the pitch. Build-up influences delivery choice. A corner can end in contested first contact, a goalkeeper claim, a clearance or a second ball.

A forward through on goal can carry into range, finish or square to a teammate with a better chance. The keeper can come out to narrow the angle. An advancing keeper offers a chipped finish if the striker has room to lift the ball. Shots carry their strike and impact positions into the pitch replay. Ground passes, high deliveries, blocks and deflections each have their own movement. A successful defensive challenge is a dispossession of the ball carrier. Intercepting a pass or gathering a loose ball counts separately.

The report includes a shot map, the actions leading to a selected shot, chance quality, incidents and player performances. The timeline shows why each corner was awarded and who won a second ball after a clearance. Detailed stats include crosses, corners taken, corners leading to a shot, claims, clearances, quick shots after a clearance and advantages won. Each completed match retains its action log and engine version. Earlier reports can still be reopened.

The fixture uses a single starting formation per team with moving attacking and defending shapes. Players outside the starting eleven are available for automatic substitutions. The server uses up to five replacements across three stoppages and handles forced goalkeeper cover. In-match injuries and red cards affect the current fixture. Match reports preserve the score at stoppage and the administrative result when play is abandoned. [IFAB Law 3](https://www.theifab.com/laws/latest/the-players/) · [IFAB Law 7](https://www.theifab.com/laws/latest/the-duration-of-the-match/) · [Ballerz fixture rules](../docs/adr/0003-schedule-league-fixtures.md)

## Development

```sh
node --test
node scripts/benchmark.mjs 120 20261201
```

To run the payout integration suite on x86-64 Linux or WSL, install the locked Node dependencies and run `bash scripts/test-payouts.sh` from this directory. It provisions an isolated validator, checksum-verifies the Solana programs, plays fixtures and starts separate settlement processes. Each run uses temporary keys, ledger and SQLite files. Set `SOLANA_TEST_VALIDATOR` to reuse an installed Agave 4.4.1 validator. GitHub requires both **Matchday regression tests** and **Solana payout integration** on pull requests to `main`.

The server validates club membership, formation and eleven unique selections. Unsubmitted tactics stay in the manager's browser. In friendlies, each team sheet locks on submission and the match starts when both managers are ready. Locked team sheets stay hidden from the opponent until full time. A version check protects simultaneous submissions, so both managers see the same result.

Both modes use two fixed squads. Scheduled playtest fixtures support optional operator-approved Devnet appearance payments. League standings, outage rescheduling, transfers and Solana club ownership belong to later development.
