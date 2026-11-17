# Ballerz Matchday

Two managers take charge of Northbank Athletic and Eastport Rovers. Each club has 17 fictional players. Choose an XI, set a formation and decide whether to press, counterattack or play a balanced game. When both managers lock their team sheets, the server plays 90 simulated minutes and saves one shared match report.

## Play locally

From this folder, use Node.js 22.13 or newer. There are no package dependencies.

```sh
node server.js
```

Open http://127.0.0.1:4173 and create a fixture to manage Northbank. Copy the away invitation and open it in another browser profile to manage Eastport. Each browser remembers its own manager key. Keep the fixture URL bookmarked to revisit the report with that browser profile.

To play with another device on the same trusted network, start the server in PowerShell with the following commands. Open the host computer's LAN address on port 4173 **before** creating the fixture so the copied invitation points to a reachable address.

```powershell
$env:HOST = '0.0.0.0'
node server.js
```

The local server uses SQLite in `data/fixtures.sqlite`. Restarting it preserves submitted team sheets, manager access and results. `PORT` and `FIXTURE_DB` override the listening port and database path.

## Development

```sh
node --test
```

The server validates club membership, formation and eleven unique selections. Unsubmitted tactics stay in the manager's browser. Locked team sheets stay hidden from the opponent until full time. A version check protects simultaneous submissions, so both managers see the same result.

This milestone covers single fixtures. The two squads are fixed for each game. A season table, transfers and Solana ownership belong to later league development.
