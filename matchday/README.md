# Ballerz Matchday

Two managers take charge of Northbank Athletic and Eastport Rovers. Each club has 17 fictional players. Inspect their attributes, pick an XI, and decide where each player goes with and without the ball. Watch both halves on the live 2D pitch and make touchline decisions as the server plays the match.

## Play locally

Choose **Play AI** to kick off immediately with the team sheet shown in the match centre. Expand **Schedule a fixture** to choose a kickoff time for a multiplayer playtest. Eastport selects a starting XI by position and opens in a counterattacking 4-4-2. Its manager reviews the score and fatigue at 55, 69 and 80 minutes, adjusts the team instructions and can queue a like-for-like substitution at a stoppage. **Invite a manager** starts a two-manager friendly.

From this folder, use Node.js 22.13 or newer. There are no package dependencies.

```sh
node server.js
```

Open http://127.0.0.1:4173 and create a friendly to manage Northbank. Copy the away invitation and open it in another browser profile to manage Eastport. Each browser remembers its own manager key. Keep the fixture URL bookmarked to revisit the report with that browser profile.

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

The server validates club membership, formation and eleven unique selections. Unsubmitted tactics stay in the manager's browser. In friendlies, each team sheet locks on submission and the match starts when both managers are ready. Locked team sheets stay hidden from the opponent until full time. A version check protects simultaneous submissions, so both managers see the same result.

Both modes use two fixed squads. Scheduled playtest fixtures are individual matches and have no league standings, BB settlement or outage rescheduling. League administration, transfers and Solana ownership belong to later development.
