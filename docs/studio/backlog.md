# Ballerz production backlog

27 November 2026 · 23 epics · 111 tasks

Start with the [delivery plan](README.md) for the critical path, first iteration and release gates. Use the [contribution and testing policy](../../CONTRIBUTING.md) when implementing any row. Each task ID stays stable when copied into an issue. The epic supplies the default owner role, dependencies and target milestone. Tasks can start with a test double while their dependency is in development; their integration gate requires the real dependency.

**Reading the rows.** Baseline means existing code to retain and verify. Build means work to deliver. Tune means an agreed trial whose settings need measured evidence. Design and Decide produce a reviewed specification or decision. Later means deferred from the first release. All are backlog dispositions, not issue completion states. Test codes name required evidence when implementing the behaviour. For a discovery item they identify the experiment or downstream acceptance suite.

**Evidence codes:** U — unit, boundary and property tests; I — API, database, job and service integration; S — signed transaction execution in LiteSVM; V — end-to-end RPC against a local validator; E — browser journeys, accessibility and human UX review; B — seeded balance, simulation and longitudinal comparisons; D — Devnet release evidence; O — operational, integrity or release rehearsal.

| Epic | Target | Accountable discipline | Outcome |
| --- | --- | --- | --- |
| [S01 · Studio delivery and quality](#s01) | G0 | Producer + QA | Set a testable release contract and make every shipped behaviour traceable. |
| [S02 · Reliable fixture settlement](#s02) | G1 | Solana engineer + QA | Recover a paid fixture after any worker restart and reconcile the exact club balances. |
| [S03 · Match engine and manager experience](#s03) | G1 | Gameplay + client | Preserve the merged two-manager experience and supply trustworthy match evidence to other systems. |
| [S04 · Shared calendar, registrations and outages](#s04) | G2 | Backend + gameplay | Offline managers and clubs in different time zones get the same fair deadlines. |
| [S05 · Club identity, access and custody](#s05) | G2 | Backend + Solana + UX | A club survives rename, wallet recovery and a change of manager. |
| [S06 · Treasury, token policy and bootstrap](#s06) | G2 | Economy + Solana | Every BB promise has a source, an owner, a reserve and a reconciliation path. |
| [S07 · Founder admission and common control](#s07) | G3 | Product + trust | A qualifying founder receives one funded entitlement and can recover or appeal it. |
| [S08 · Club founding, starter recruitment and continuity](#s08) | G3 | Gameplay + economy + UX | Every admitted club can field a side, including a manager with zero spendable BB. |
| [S09 · League, rewards and season rollover](#s09) | G3 | Competition + economy | Finish and reconcile a ten-club season, including moves and exceptional fixtures. |
| [S10 · Wages, solvency and withdrawals](#s10) | G2 | Economy + Solana | Quote and reserve a wage, settle what is due and preserve free sporting continuity. |
| [S11 · Footballer marketplace and loans](#s11) | G2 | Solana + backend | Sell one eligible footballer exactly once and carry wages, grants and registration correctly. |
| [S12 · Renewal, expiry and free agency](#s12) | G3 | Solana + gameplay | An expiring NFT has one rightful custodian and at most one next registration. |
| [S13 · Footballer identity, potential and scouting](#s13) | G2 | Gameplay + data | A manager can evaluate a unique prospect and later verify their original ceiling. |
| [S14 · Training and development](#s14) | G3 | Gameplay + QA | Managers can explain why similarly gifted footballers develop differently. |
| [S15 · Careers, retirement and youth succession](#s15) | G3 | Gameplay + economy | A career can end fairly and yield a verifiable youth intake while the club can still play. |
| [S16 · Player roles, concerns and autonomy](#s16) | G3 | Gameplay + contracts | A player can enforce a disclosed opportunity promise through renewal and moves. |
| [S17 · Club progression, facilities and whole-club sales](#s17) | G3 | Club design + Solana | The club builds a sporting identity and its disclosed rights and obligations survive sale. |
| [S18 · Supporters, media and sponsorship](#s18) | G3 | Community + UX | A supporter can follow and watch for free, and can distinguish an official record from a story. |
| [S19 · AI staff and delegated work](#s19) | G3 | AI + gameplay | A development coach can execute a bounded plan with the same sporting limits as manual play. |
| [S20 · Cups, competition ownership and integrity](#s20) | G5 | Competition + trust | Operate a joint cup, resolve exceptional ties and preserve rights through ownership changes. |
| [S21 · Stadiums, federation and commercial services](#s21) | G5 | Product + economy | Decide which venue, federation and service rights warrant a funded prototype. |
| [S22 · Client journeys and design system](#s22) | G2 | UX + client + QA | Managers, supporters and staff can complete their key journeys with accessible, accurate feedback. |
| [S23 · Operations, reconciliation and release](#s23) | G4 | Platform + QA + producer | Operate an 80-club pilot with auditable funding, recoverable data and measured expansion. |

<a id="s01"></a>

## S01 · Studio delivery and quality

Set a testable release contract and make every shipped behaviour traceable. **Target** G0. **Lead** Producer + QA. **Depends on** no prior epic.

[devnet-fixture](founder-rules.md#devnet-fixture)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s01-01"></a>**S01-01** Map decisions to tests | Design | Each rule has a stable issue, enforcing layer, acceptance cases, test path and baseline commit. Mark missing suites explicitly. | U, I |
| <a id="s01-02"></a>**S01-02** Protect the merge path | Build | Install locked packages and run applicable checks on PRs. Demonstrate that a deliberately failing assertion blocks the test branch, then restore it. | I, O |
| <a id="s01-03"></a>**S01-03** Create repeatable test worlds | Build | One command creates a temporary database, isolated wallets and a local validator. Capture clock, rule version and seed. Parallel runs cannot share state. | I, V |
| <a id="s01-04"></a>**S01-04** Build the quality dashboard | Build | Publish CI results, artifacts and flaky-test owners. An uncovered behaviour stays open until a test demonstrates it. | I, O |
| <a id="s01-05"></a>**S01-05** Run studio reviews and triage | Build | Use the lifecycle in the delivery plan for one issue from pitch through release and post-playtest review. Record approver and evidence at each gate. | O |

<a id="s02"></a>

## S02 · Reliable fixture settlement

Recover a paid fixture after any worker restart and reconcile the exact club balances. **Target** G1. **Lead** Solana engineer + QA. **Depends on** S01.

[devnet-fixture](founder-rules.md#devnet-fixture) · [ten-club-payout](founder-rules.md#ten-club-payout) · [ADR 0001](../adr/0001-run-matches-on-the-game-server.md) · [ADR 0009](../adr/0009-fund-first-squads-with-ballerbuckz.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s02-01"></a>**S02-01** Verify the existing fixture and receipt | Baseline | Reproduce the two-manager match from commit 3e81fe3. From finalized token metadata verify the mint, both club accounts, +8,000 each and −16,000 BB to treasury. | U, I, V, D |
| <a id="s02-02"></a>**S02-02** Recover after payment but before saving SQLite | Build | Stop the worker between finalization and the receipt write. Restart with the same fixture and recover the original signature and report exactly once. | I, V |
| <a id="s02-03"></a>**S02-03** Roll back an underfunded payout | Build | Owe 16,000 while holding 8,000 BB. After failure both club balances and the BB vault are unchanged and no receipt exists. Fund and retry once. | S, V |
| <a id="s02-04"></a>**S02-04** Exercise duplicate workers and distinct fixtures | Build | Race independent blockhashes on one fixture, then settle another fixture with the same clubs. Observe one successful receipt per fixture and 16,000 per club across both. | S, V |
| <a id="s02-05"></a>**S02-05** Bind authority, mint and recipients | Build | Missing or changed approvals, wrong network, signer, mint or destination fail closed. Test confirmation timeout, unavailable history and later reconciliation by reference. | U, I, S, V |
| <a id="s02-06"></a>**S02-06** Move from operator pilot to a funded programme | Decide | Specify who attests a result, custody, identity across signer rotation, authorised funds and upgrades. Demonstrate rotated signers cannot repay a fixture before funded release. | I, S, V, D |

<a id="s03"></a>

## S03 · Match engine and manager experience

Preserve the merged two-manager experience and supply trustworthy match evidence to other systems. **Target** G1. **Lead** Gameplay + client. **Depends on** S01.

[devnet-fixture](founder-rules.md#devnet-fixture) · [ADR 0001](../adr/0001-run-matches-on-the-game-server.md) · [ADR 0003](../adr/0003-schedule-league-fixtures.md) · [ADR 0009](../adr/0009-fund-first-squads-with-ballerbuckz.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s03-01"></a>**S03-01** Retain the existing manager match flow | Baseline | Run two independent sessions from invite through ready, kickoff, halftime and report. Offline return and server restart show the same fixture. Test AI practice separately. | I, E |
| <a id="s03-02"></a>**S03-02** Protect tactics and lineup controls | Baseline | Exercise formation, both phases, individual roles/orders, instructions, set pieces, substitutions and live changes through public APIs. Reject duplicate or invalid selections. | U, I, E |
| <a id="s03-03"></a>**S03-03** Verify simulation and reporting | Baseline | Use fixed seeds for action sequences, injuries, cards, minimum seven, emergency keeper and substitutions. Reconcile score, minutes, xG, events, replay and player stats. | U, I, B |
| <a id="s03-04"></a>**S03-04** Publish authoritative match events and awards | Build | Version events and official Player of the Match with deterministic ties. A replay, clock fast-forward or repeated delivery adds no minutes, awards or development. | U, I, E |
| <a id="s03-05"></a>**S03-05** Separate sporting and reward eligibility | Build | Exercise completed, home/away/double forfeit, injury-only and disciplinary abandonment, no contest, AI/friendly and stand-in limits. Assert points, player stats, readiness, BB independently. | U, I, S |

<a id="s04"></a>

## S04 · Shared calendar, registrations and outages

Offline managers and clubs in different time zones get the same fair deadlines. **Target** G2. **Lead** Backend + gameplay. **Depends on** S03.

[division-format](founder-rules.md#division-format) · [season-decisions](founder-rules.md#season-decisions) · [ADR 0003](../adr/0003-schedule-league-fixtures.md) · [ADR 0012](../adr/0012-use-a-shared-compressed-world-clock.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s04-01"></a>**S04-01** Schedule on the world clock | Baseline | Freeze the UTC epoch. Test one week per real day, 52-day year, seven preseason days, 45 competition days, local display and daylight-saving transitions. | U, I, E |
| <a id="s04-02"></a>**S04-02** Lock eligibility and team sheets | Build | Use the last valid submission strictly before the 30-minute lock. Test just before, exactly at and after, fallback availability, 24-hour spacing and effective ownership time. | U, I, E |
| <a id="s04-03"></a>**S04-03** Recover disrupted league fixtures | Build | Replay locked sheets in event order after downtime. If submissions were prevented, reschedule both clubs fairly. If no reserve date remains, verify no-contest accounting. | U, I, B |
| <a id="s04-04"></a>**S04-04** Orchestrate year-end | Build | Run results and prizes, wages, retirement and subsequent registration steps in the specified order. Interrupt each boundary and resume without repeating an event. | I, V, B |

<a id="s05"></a>

## S05 · Club identity, access and custody

A club survives rename, wallet recovery and a change of manager. **Target** G2. **Lead** Backend + Solana + UX. **Depends on** S01.

[founding](founder-rules.md#founding) · [first-real-transfer](founder-rules.md#first-real-transfer) · [ADR 0002](../adr/0002-represent-teams-as-transferable-nfts.md) · [Naming registry](../BALLERZ_IDENTITY_NAMING_REGISTRY_V0.1.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s05-01"></a>**S05-01** Create club identity and names | Build | Offer generated and custom names with immutable asset IDs, unique normalized handles and aliases. Competing claims yield one winner; matching human names can represent distinct footballers. | U, I, S, E |
| <a id="s05-02"></a>**S05-02** Operate protected-name review | Build | Exercise reservation expiry, review, dispute, release, cooldown, Unicode, protected brands, appeals and rate limits. Renames preserve sporting records and property. | U, I, E |
| <a id="s05-03"></a>**S05-03** Model members, signers and club custody | Build | Distinguish owner, manager, coach and spectator. Check permissions on each command, isolate personal and club balances, and revoke stale sessions on ownership change. | U, I, S, V |
| <a id="s05-04"></a>**S05-04** Recover a signer | Build | Nominate a separate recovery signer, notify and allow challenge. During recovery freeze outgoing transactions and invalidate old listings. Test a pending deal and restart. | I, S, V, E |
| <a id="s05-05"></a>**S05-05** Choose asset standards and wallet journey | Decide | Prototype free entry, fee sponsorship, club-controlled holdings, metadata updates and recovery. Record NFT standard, key responsibilities and upgrade authority before custodial launch. | I, V, E |

<a id="s06"></a>

## S06 · Treasury, token policy and bootstrap

Every BB promise has a source, an owner, a reserve and a reconciliation path. **Target** G2. **Lead** Economy + Solana. **Depends on** S02.

[bootstrap](founder-rules.md#bootstrap) · [pilot-treasury](founder-rules.md#pilot-treasury) · [founder-seasons](founder-rules.md#founder-seasons) · [founder-launch](founder-rules.md#founder-launch) · [ADR 0009](../adr/0009-fund-first-squads-with-ballerbuckz.md) · [Tokenomics v0.2](../BALLERZ_ECONOMY_AND_TOKENOMICS_V0.2.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s06-01"></a>**S06-01** Keep a funded ledger | Build | Track restricted, unrestricted, reserved and accrued amounts with immutable references. Reconcile treasury, club, escrow and SOL fees independently; test zero inflows. | U, I, S, V |
| <a id="s06-02"></a>**S06-02** Approve budgets and enforce restricted uses | Build | Require two of three independent signers for pool creation and reallocations. Automatic payments stay within an approved pool. A sponsor-restricted balance cannot pay wages by accident. | U, S, V |
| <a id="s06-03"></a>**S06-03** Model founder runway | Tune | Reproduce the 1T/10% scenario, 100k cohort, 500B bursaries, up to 12.5B credits and 270B rewards. The full commitment totals 782.5B. Model 15 seasons and separate cash/SOL costs. | U, B |
| <a id="s06-04"></a>**S06-04** Stress real economic flows | Tune | Test zero sponsors and new buyers, retirement shock, 100k duplicate applications, ownership concentration, withdrawal pressure, fee spikes, 100× appreciation and 90% fall. Publish solvency and free-play outcomes. | U, B, O |
| <a id="s06-05"></a>**S06-05** Decide live token and liquidity policy | Decide | Compare fixed supply, treasury unlocks, vesting, issuance, sinks, circulation, fee funding and BB/SOL liquidity. Model slippage and valuation independently of available BB. Record decision before live deployment. | B, O |
| <a id="s06-06"></a>**S06-06** Keep test and live balances distinct | Build | Show test BB on wallet and receipts, carry identity/history, and start any live grant from a new funded allocation. Verify migration issues zero automatic convertible BB. | I, V, E |

<a id="s07"></a>

## S07 · Founder admission and common control

A qualifying founder receives one funded entitlement and can recover or appeal it. **Target** G3. **Lead** Product + trust. **Depends on** S05, S06.

[founding-clubs](founder-rules.md#founding-clubs) · [founder-place](founder-rules.md#founder-place) · [founder-seasons](founder-rules.md#founder-seasons) · [connected-clubs](founder-rules.md#connected-clubs)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s07-01"></a>**S07-01** Order first 100,000 qualifying registrations | Build | One claim per control group. Freeze verified admission time including service delays. Credit decreases linearly from 250,000 to zero; verify ranks 1, 100,000 and the next entrant. | U, I, B |
| <a id="s07-02"></a>**S07-02** Verify unique people and linked control | Build | Exercise credential alternatives, recovery, multi-wallet ownership and human review; shared household alone cannot exclude. Keep identifying evidence private and publish appeal outcomes in aggregate. | U, I, E, O |
| <a id="s07-03"></a>**S07-03** Issue funded invitations and count entitlements | Build | Use registration order, at least 72 hours to accept, and activation on acceptance. Voluntarily missed offered seasons count; unavailable funded seasons extend. Preserve history and free route after 15. | U, I, B |
| <a id="s07-04"></a>**S07-04** Police connected-club competition and claims | Build | Reject funded matches inside one control group; aggregate limits, release overlapping holds, admit a provisional claim under dispute and restore a corrected link without double issuance. | U, I, S, V |
| <a id="s07-05"></a>**S07-05** Activate grants and presentation credits | Build | Pay starter prices and eligible wage escrow directly. Restrict the 5% benefit to approved presentation products. Freeze unused funds on applicable exit and preserve claim lineage through recovery. | U, I, S, V |

<a id="s08"></a>

## S08 · Club founding, starter recruitment and continuity

Every admitted club can field a side, including a manager with zero spendable BB. **Target** G3. **Lead** Gameplay + economy + UX. **Depends on** S04, S05, S06.

[founding](founder-rules.md#founding) · [first-live-squads](founder-rules.md#first-live-squads) · [starter-allocation](founder-rules.md#starter-allocation) · [season-decisions](founder-rules.md#season-decisions) · [funded-launch](founder-rules.md#funded-launch) · [ADR 0009](../adr/0009-fund-first-squads-with-ballerbuckz.md) · [ADR 0010](../adr/0010-generate-footballers-with-finite-careers.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s08-01"></a>**S08-01** Onboard a free manager | Build | Demo friendly is optional and earns no assets. Show one-click squad, starter-versus-prospect comparison and full pool. An explicit competitive sheet yields a dated receipt. | I, E |
| <a id="s08-02"></a>**S08-02** Generate and reserve starter stock | Build | Generate 80 named squads of 18 unique players, plus optional stock. Verify position/keeper cover, mix, strength and payroll; default fee ≤3.8M and first payroll fits the 5M grant. | U, I, B |
| <a id="s08-03"></a>**S08-03** Run balanced draws and swaps | Build | Publish seed, offer both tiers 48 hours and one first-round choice per control group. A lost draw leaves original player and funds intact. Keep ≥24 hours after settlement before lineup lock. | U, I, V, E |
| <a id="s08-04"></a>**S08-04** Enable free squad and academy continuity | Build | Fallback and reserve players remain club-bound on sale or loan attempts. Use already-registered academy and keeper cover to field an owned XI after mass retirement, even under transfer ban. | U, I, S, B |
| <a id="s08-05"></a>**S08-05** Limit fixture-only AI cover | Build | Distinguish team AI from individual stand-ins. Test two stand-ins/four rewarded fixtures and two extra qualifying verified-injury fixtures, 13 registered, position cover and independent opponent eligibility. | U, I, B |

<a id="s09"></a>

## S09 · League, rewards and season rollover

Finish and reconcile a ten-club season, including moves and exceptional fixtures. **Target** G3. **Lead** Competition + economy. **Depends on** S02, S04, S06, S08.

[ten-club-payout](founder-rules.md#ten-club-payout) · [division-format](founder-rules.md#division-format) · [inaugural-seeding](founder-rules.md#inaugural-seeding) · [founder-place](founder-rules.md#founder-place) · [founder-launch](founder-rules.md#founder-launch) · [ADR 0003](../adr/0003-schedule-league-fixtures.md) · [ADR 0009](../adr/0009-fund-first-squads-with-ballerbuckz.md) · [ADR 0011](../adr/0011-fill-vacancies-through-the-league-pyramid.md) · [ADR 0012](../adr/0012-use-a-shared-compressed-world-clock.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s09-01"></a>**S09-01** Place the 80 inaugural clubs | Build | Publish 20 four-club groups, three neutral fixtures and equal temporary squads. Rank by points, goal difference, goals scored and published draw. Simultaneous final round, two per group to each tier. Zero progression/BB for qualifiers. | U, I, B |
| <a id="s09-02"></a>**S09-02** Schedule four pairs of divisions | Build | Each division has ten teams, 90 matches, 18 per club, one home and away per opponent. Publish deadlines and reserve dates without double-booking a club. | U, I, B |
| <a id="s09-03"></a>**S09-03** Compute standings and pyramid rollover | Build | Exercise tiebreaks, two up/two down, boundary tiers, vacancies after moves, bottom-entry queue, withdrawal and disbandment. Replay the rollover and compare standings. | U, I, B |
| <a id="s09-04"></a>**S09-04** Pay result, completion and rank awards | Build | Test 1,000 result pool, 20,000 completion and 16/18 readiness. Winner takes the result pool; on a draw each gets 500. Verify the 70,000 ladder (14/12/10/9/8/6/5/3/2/1 thousand), no-contest denominator and unearned funds remaining. | U, I, S, V |
| <a id="s09-05"></a>**S09-05** Close and reconcile a funded season | Build | Reconcile a full division up to 1.8M BB and eight up to 14.4M. Test bottom place losing 18 completed fixtures and earning 165,000 before payroll. Publish table and payment references. | I, V, B, E |

<a id="s10"></a>

## S10 · Wages, solvency and withdrawals

Quote and reserve a wage, settle what is due and preserve free sporting continuity. **Target** G2. **Lead** Economy + Solana. **Depends on** S04, S05, S06.

[wage-growth](founder-rules.md#wage-growth) · [transfer-ban](founder-rules.md#transfer-ban) · [after-transfer](founder-rules.md#after-transfer) · [founder-seasons](founder-rules.md#founder-seasons) · [ADR 0009](../adr/0009-fund-first-squads-with-ballerbuckz.md) · [ADR 0012](../adr/0012-use-a-shared-compressed-world-clock.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s10-01"></a>**S10-01** Capture wage observations and quote a year | Tune | Take one underlying reading per player/week, including injury, loan and bench. Use eight-week median, newcomer fallback, annual lock and published interpolation. Test 0/250/500/750/1,000 → 3k/5k/10k/20k/40k BB. No hidden-potential floor. | U, I, B |
| <a id="s10-02"></a>**S10-02** Reserve and allocate wages by time and source | Build | Hold price plus remaining wages before signing. Accrue by effective ownership and loan split, preserve restricted funding proportions, release unused funds to their source. Reconcile across year-end. | U, I, S, V |
| <a id="s10-03"></a>**S10-03** Enforce incoming transfer bans | Build | An uncovered due payment creates arrears. Zero available BB with all dues covered stays balanced. Block purchases, free-agent arrivals and loans in. Allow sales, registered promotions and eligible next-season play. | U, I, V, E |
| <a id="s10-04"></a>**S10-04** Handle owner withdrawals | Build | Owner signs a separate payment to the registered wallet. Recompute available funds after commitments, without double-counting. Block recovery/arrears. Race a withdrawal against a signing. | U, I, S, V |

<a id="s11"></a>

## S11 · Footballer marketplace and loans

Sell one eligible footballer exactly once and carry wages, grants and registration correctly. **Target** G2. **Lead** Solana + backend. **Depends on** S05, S06, S10.

[first-real-transfer](founder-rules.md#first-real-transfer) · [grant-loss](founder-rules.md#grant-loss) · [transfer-followup](founder-rules.md#transfer-followup) · [training-close](founder-rules.md#training-close) · [ADR 0002](../adr/0002-represent-teams-as-transferable-nfts.md) · [ADR 0003](../adr/0003-schedule-league-fixtures.md) · [ADR 0009](../adr/0009-fund-first-squads-with-ballerbuckz.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s11-01"></a>**S11-01** Publish a fixed-price listing | Build | Human seller approves asset, terms, price, expiry and deductions. Edited terms require new consent; cancel or expiry invalidates the old listing. Disclose risk, restrictions, gross and net proceeds. | U, I, E |
| <a id="s11-02"></a>**S11-02** Settle the first independent transfer | Build | A 100,000 fee plus 30,000 wage hold commits 130,000. Atomically move title, funds and reserve, reject stale approvals and leave a competing buyer whole. Use existing receipt recovery pattern. | U, I, S, V, D |
| <a id="s11-03"></a>**S11-03** Recover purchase grants on sale | Build | Independent 150,000 sale against a 200,000 claim sends 150,000 to treasury and clears the rest without club debt. A connected sale carries 50,000. Test surplus, zero and repeated sales. | U, I, S, V |
| <a id="s11-04"></a>**S11-04** Register the new owner for sport | Build | Show one pending reference; finality and effective time decide the first eligible fixture. Locked sheets and past events remain intact. Test a delayed indexer, stale listing and wallet change. | U, I, V, E |
| <a id="s11-05"></a>**S11-05** Operate loans | Build | Record owner, borrower, dates, wage shares, training control, real minutes, sale while on loan and return. Default borrower share 100%. Check no reset of training/session/service limits. | U, I, S, V |
| <a id="s11-06"></a>**S11-06** Sponsor pilot fees and queue future deal types | Build | Pilot marketplace commission zero, capped SOL budget. When exhausted, disclose and pause sponsored trades while ordinary football continues. Scope future conditional fees, bundles and windows separately. | I, V, E |

<a id="s12"></a>

## S12 · Renewal, expiry and free agency

An expiring NFT has one rightful custodian and at most one next registration. **Target** G3. **Lead** Solana + gameplay. **Depends on** S07, S10, S11.

[after-transfer](founder-rules.md#after-transfer) · [free-agents](founder-rules.md#free-agents) · [pool-operations](founder-rules.md#pool-operations) · [connected-clubs](founder-rules.md#connected-clubs) · [transfer-followup](founder-rules.md#transfer-followup) · [ADR 0009](../adr/0009-fund-first-squads-with-ballerbuckz.md) · [ADR 0012](../adr/0012-use-a-shared-compressed-world-clock.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s12-01"></a>**S12-01** Issue binding renewal offers | Build | Give ≥72 real hours at the final price, extend on late or increased quote. Require funds and explicit confirmation or prior approval under a ceiling; partial or late approval cannot renew. | U, I, S, V |
| <a id="s12-02"></a>**S12-02** Return an expired player to treasury | Build | After the deadline any permitted caller can settle once without the former owner. End old field/sale/loan rights, void stale listings and publish one free-agent entry. Race renewal at cutoff. | U, I, S, V, D |
| <a id="s12-03"></a>**S12-03** Allocate contested free agents | Build | Fee zero; human approval, wage reserve, accepted role and capacity required. One entry per group, public 24-hour draw. Release losing holds, former club equal unless role-refusal restriction applies. | U, I, S, V |
| <a id="s12-04"></a>**S12-04** Limit capture and resale | Tune | Two signings per rolling seven real days for club and control group. Claims occupy slots, loss releases them. Block resale/loans seven days after signing. Test sale of club and wage rollover. | U, I, S, V, B |
| <a id="s12-05"></a>**S12-05** Handle unclaimed or reacquired players | Build | Restart a fresh public 24-hour window after next eligible claim. Age in treasury without club service. Restore grant on direct reacquisition by former group, clear on genuine independent claim. | U, I, S, V |

<a id="s13"></a>

## S13 · Footballer identity, potential and scouting

A manager can evaluate a unique prospect and later verify their original ceiling. **Target** G2. **Lead** Gameplay + data. **Depends on** S03, S05.

[development](founder-rules.md#development) · [scouting-evidence](founder-rules.md#scouting-evidence) · [ADR 0010](../adr/0010-generate-footballers-with-finite-careers.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s13-01"></a>**S13-01** Mint distinct footballers with a committed ceiling | Build | Create permanent ID, original name, attributes, age, current ability and hidden ceiling before allocation. Equal starting ability can produce distinct individuals; one listing transfers one asset. | U, I, S, V |
| <a id="s13-02"></a>**S13-02** Publish the shared opening report | Build | Show verified current ability, broad scouted range, fees, wage and relevant attributes. All clubs see the same opening evidence. Inspect public API, export and UI for premature ceiling disclosure. | U, I, E |
| <a id="s13-03"></a>**S13-03** Observe a prospect across fixtures | Tune | One free active assignment. After three distinct competitive appearances narrow the estimate. Replays, wallet changes or agents add no observations. Equal evidence yields equal assessment. | U, I, B, E |
| <a id="s13-04"></a>**S13-04** Verify sporting provenance | Decide | Prototype rule-versioned events, replay and salted commitments. At retirement reveal salt and ceiling and compare dated estimates and realized peak. Decide checkpoint cadence, proof format and data retention. | U, I, S, V, B |

<a id="s14"></a>

## S14 · Training and development

Managers can explain why similarly gifted footballers develop differently. **Target** G3. **Lead** Gameplay + QA. **Depends on** S04, S13.

[coaching](founder-rules.md#coaching) · [training-close](founder-rules.md#training-close) · [focused-sessions](founder-rules.md#focused-sessions) · [development-playtest](founder-rules.md#development-playtest) · [development-results](founder-rules.md#development-results) · [career-development](founder-rules.md#career-development) · [ADR 0010](../adr/0010-generate-footballers-with-finite-careers.md) · [ADR 0012](../adr/0012-use-a-shared-compressed-world-clock.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s14-01"></a>**S14-01** Schedule free recurring training | Tune | Offer ordinary team training plus six focused sessions per club/week and two per player across owners. One player and skill per booking. Release cancellations and expire unused slots without producing tokens. | U, I, B |
| <a id="s14-02"></a>**S14-02** Apply weekly weights and backups | Tune | First completed session at full weight, second at 50%. Use optional eligible backup and skill. Prove retry, transfer, loan or coach change adds no capacity or duplicate development. | U, I, B |
| <a id="s14-03"></a>**S14-03** Credit role-based competitive minutes | Tune | Cap credited experience at 90 per footballer per in-game week across clubs. Split verified minutes by actual role. Compare winger/keeper in quiet and busy matches; no reward for stat padding or friendlies. | U, I, B |
| <a id="s14-04"></a>**S14-04** Calibrate full careers with matched controls | Tune | Run matched winger and keeper starting at 180/720 over 18 matches. Reserve 200–210, regular 215–230, 30-minute sub between; test full-career regular reaching 648. Publish seeds and distribution. | U, B |
| <a id="s14-05"></a>**S14-05** Explain weekly changes | Build | Report skills, weights, minutes and fractions below display precision. Same histories yield same attributes regardless of spend. Transfer midweek preserves the last processed event. | U, I, E |

<a id="s15"></a>

## S15 · Careers, retirement and youth succession

A career can end fairly and yield a verifiable youth intake while the club can still play. **Target** G3. **Lead** Gameplay + economy. **Depends on** S10, S13, S14.

[career-development](founder-rules.md#career-development) · [retirement-pilot](founder-rules.md#retirement-pilot) · [youth-intake-economy](founder-rules.md#youth-intake-economy) · [season-decisions](founder-rules.md#season-decisions) · [ADR 0010](../adr/0010-generate-footballers-with-finite-careers.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s15-01"></a>**S15-01** Age and injure by position and attribute | Tune | Compare winger pace and positioning with keeper handling and reflexes. Run six missed fixtures against a healthy control; bank prior gains, apply normal ageing, isolate missed opportunity. | U, B |
| <a id="s15-02"></a>**S15-02** Run retirement and service checks | Tune | Show year-end risk on squad, purchase and renewal screens. Roll once per eligible year and persist through owner change. Test five years, 60 appearances across ≥3 years, compare adding 2,700 minutes for backups separately. Preserve identity and honours. | U, I, B, E |
| <a id="s15-03"></a>**S15-03** Issue earned youth signing credits | Tune | 25% of one treasury signing fee, max 100,000 BB. At 250,000 pay 187,500 plus full wages. Redeem once, carry regular eligibility as specified; on resale keep the earned discount. | U, I, S, V |
| <a id="s15-04"></a>**S15-04** Size and allocate the intake | Tune | One tradeable entrant per tradeable retiree, count treasury stock, exclude club-bound players, budget expansion separately. Publish positional mix, ranked choices and tie-break. Test five of ten wonderkids reserved, one pick per pass, oldest funded claim first, surplus released to regular market and unfilled priority carried. | U, I, B |
| <a id="s15-05"></a>**S15-05** Award elite succession access | Tune | Test 750 ability for ≥26/52 weeks with same club, two qualifying years plus service. Compare keeper and winger access. After three eligible unfunded intakes reserved priority lapses but the regular credit remains. A funded miss never counts as a skip. | U, I, B |

<a id="s16"></a>

## S16 · Player roles, concerns and autonomy

A player can enforce a disclosed opportunity promise through renewal and moves. **Target** G3. **Lead** Gameplay + contracts. **Depends on** S11, S12, S14.

[player-autonomy](founder-rules.md#player-autonomy) · [playing-role-terms](founder-rules.md#playing-role-terms) · [role-transfers](founder-rules.md#role-transfers) · [after-role-refusal](founder-rules.md#after-role-refusal) · [autonomy-media](founder-rules.md#autonomy-media)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s16-01"></a>**S16-01** Agree and capacity-check roles | Tune | Publish acceptable roles from observable attributes and squad. Test rotation 180/6, regular 360/6, development training in 4/6 weeks. Reject two regular keepers needing 720 of 540 minutes; permit 360+180. | U, I, E |
| <a id="s16-02"></a>**S16-02** Review a promise and remedy | Build | Exclude verified injuries and opponent/service losses; own avoidable forfeit counts zero. Show reason and next review, clear concern on meeting target; compare results on winning and losing teams. | U, I, B, E |
| <a id="s16-03"></a>**S16-03** Preserve obligations through loans and sales | Build | Loan remedy uses actual credited work. Independent buyer agrees fresh role, connected buyer and return to group keep deadline. Record seller history and disclose only authorised detail. | U, I, V, E |
| <a id="s16-04"></a>**S16-04** Resolve refusal and restricted re-signing | Tune | Second miss plus unresolved concern can produce refusal after full remedy and final notice. Use eight-week median at renewal. Test seven-day former-group exclusion, corrections and expiry draw. | U, I, S, V, E |

<a id="s17"></a>

## S17 · Club progression, facilities and whole-club sales

The club builds a sporting identity and its disclosed rights and obligations survive sale. **Target** G3. **Lead** Club design + Solana. **Depends on** S05, S08, S11.

[club-progression](founder-rules.md#club-progression) · [founding](founder-rules.md#founding) · [season-decisions](founder-rules.md#season-decisions) · [transfer-followup](founder-rules.md#transfer-followup) · [ADR 0002](../adr/0002-represent-teams-as-transferable-nfts.md) · [ADR 0004](../adr/0004-represent-competitions-as-transferable-nfts.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s17-01"></a>**S17-01** Track club identity and reputation | Build | Show permanent honours plus recent sporting form, academy graduates’ meaningful minutes and supporter following as separate records. Preserve history after relegation or owner change. | U, I, E |
| <a id="s17-02"></a>**S17-02** Run one long-term club project | Tune | Offer first project after watching a match, allow deferral and a free multi-fixture completion route. Compare academy, scouting and supporter capabilities. Decide costs, duration and effects via playtest. | I, B, E |
| <a id="s17-03"></a>**S17-03** Sell an entire club | Build | Present inventory, contracts, grants, liquid funds, arrears, memberships, facilities and exclusions. Require buyer acceptance and reconcile custody, successor claim dates and wage arrears. Release seller reservations; buyer re-funds accepted rankings or carries claims. Revoke former manager and preserve locked sheets. | U, I, S, V, E |
| <a id="s17-04"></a>**S17-04** Handle entry rights and disbandment | Build | Carry competition slots and edition restrictions through sales or gifts. Conflicts block atomic closing. Disbandment preserves past results, forfeits remaining fixtures and vacates place at rollover. | U, I, S, V |

<a id="s18"></a>

## S18 · Supporters, media and sponsorship

A supporter can follow and watch for free, and can distinguish an official record from a story. **Target** G3. **Lead** Community + UX. **Depends on** S03, S05.

[supporters](founder-rules.md#supporters) · [media-round](founder-rules.md#media-round) · [voting-review](founder-rules.md#voting-review) · [autonomy-media](founder-rules.md#autonomy-media)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s18-01"></a>**S18-01** Follow clubs and watch fixtures | Build | Supporter-only entry, multiple follows and favourite. Public schedule, live 2D view and replay work free; private sheets remain private until release. Duplicate views earn no BB. | I, E |
| <a id="s18-02"></a>**S18-02** Create a club or independent media outlet | Build | Show publisher, byline, source fixture, publication status and corrections. Test official statement versus independent report and media accounts without club ownership. | I, E |
| <a id="s18-03"></a>**S18-03** Draft recaps and interviews with agents | Build | Ground recaps and questions in public events. Editor approves publication; manager approves attributed answers. Unapproved quotes, private role concerns and fabricated statistics fail review. | U, I, E |
| <a id="s18-04"></a>**S18-04** Disclose departures and promotions | Build | Publish verified free-agent status. Sensitive reasons require attributable authorised evidence. Corrections reach readers; article volume has zero effect on wages, draws or development. | U, I, E |
| <a id="s18-05"></a>**S18-05** Deliver club extras and sponsored placements | Decide | Club may offer free perks, programmes or Q&A. For optional paid memberships, content and sponsorship define delivery, cancellation, actual payer/payee, escrow and refunds before taking funds. | I, S, V, E |
| <a id="s18-06"></a>**S18-06** Trial a supporter award after first release | Later | Free opt-in poll, one ballot per eligible pre-kickoff follower; publish turnout and separate award. A dispute can yield no winner. Official engine award, honours and rewards remain independent. | U, I, E |

<a id="s19"></a>

## S19 · AI staff and delegated work

A development coach can execute a bounded plan with the same sporting limits as manual play. **Target** G3. **Lead** AI + gameplay. **Depends on** S13, S14.

[ai-staff](founder-rules.md#ai-staff) · [coaching](founder-rules.md#coaching) · [media-round](founder-rules.md#media-round)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s19-01"></a>**S19-01** Appoint a development coach | Build | Manager supplies player, goal and workload constraints. Compare recommendations to a manually attainable plan. Verify a paid tier gives no training-cap or sporting advantage. | U, I, B, E |
| <a id="s19-02"></a>**S19-02** Delegate bounded coaching and revoke it | Build | Allow named-player scheduling within constraints, locked assignments and rest days. Recheck permissions at execution. Revocation cancels pending authority; a suggested XI remains a draft. | U, I, E |
| <a id="s19-03"></a>**S19-03** Prepare scouting and market work | Build | Agent may shortlist and prepare a deal. Exact human approval required for binding sale, offer or spend. Exercise expired and changed terms and inspect the audit trail. | U, I, S, V |
| <a id="s19-04"></a>**S19-04** Report work and cost | Decide | Weekly summary links each action to a fixture/player and explains exceptions before deadlines. Compare inference cost, optional tiers, coach hire calendar, quotas and manager-set budgets before pricing. | I, B, E |

<a id="s20"></a>

## S20 · Cups, competition ownership and integrity

Operate a joint cup, resolve exceptional ties and preserve rights through ownership changes. **Target** G5. **Lead** Competition + trust. **Depends on** S04, S05, S09.

[division-format](founder-rules.md#division-format) · [ADR 0002](../adr/0002-represent-teams-as-transferable-nfts.md) · [ADR 0004](../adr/0004-represent-competitions-as-transferable-nfts.md) · [ADR 0005](../adr/0005-resolve-unplayed-knockout-ties.md) · [ADR 0006](../adr/0006-seed-and-publish-joint-cup-draws.md) · [ADR 0007](../adr/0007-review-match-fixing-independently.md) · [ADR 0008](../adr/0008-use-bans-for-deliberate-match-throwing.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s20-01"></a>**S20-01** Operate a transferable league or cup | Later | Owner appoints admins; rules and obligations travel with sale. Joint organisers approve quotas, dates and format; nominated owners confirm. Exercise declines and reserve replacements. | U, I, S, V |
| <a id="s20-02"></a>**S20-02** Draw a joint cup | Later | Eight slots, four per league; at least six entrants and two per league. Reproduce seeding, interleague pairings, byes and draw publication; changing ownership cannot redraw the bracket. | U, I, B |
| <a id="s20-03"></a>**S20-03** Resolve knockout exceptions | Later | Test withdrawals, double forfeits, empty slots, final with one or zero ready teams, walkover statistics, outage and reserve deadlines. | U, I, B |
| <a id="s20-04"></a>**S20-04** Review deliberate match throwing | Later | Apply ADR 0008 team and responsible-wallet sanctions, evidence and correction. Test proxy-control proof, once-only bracket hold, restored future eligibility and title preservation. | U, I, E |

<a id="s21"></a>

## S21 · Stadiums, federation and commercial services

Decide which venue, federation and service rights warrant a funded prototype. **Target** G5. **Lead** Product + economy. **Depends on** S06, S17, S18.

[club-progression](founder-rules.md#club-progression) · [media-round](founder-rules.md#media-round) · [ADR 0004](../adr/0004-represent-competitions-as-transferable-nfts.md) · [Tokenomics v0.2](../BALLERZ_ECONOMY_AND_TOKENOMICS_V0.2.md)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s21-01"></a>**S21-01** Define stadium and facility ownership | Decide | Specify venue booking, optional upgrades, usage rights, rental and sale with active bookings. Test overlapping fixtures, third-party property and zero attendance receipts without a payer. | U, I, S, V |
| <a id="s21-02"></a>**S21-02** Define federation and operator governance | Decide | Prototype rights, league membership, calendar conflicts, dispute review and limits on rule changes. Demonstrate operator changes cannot edit settled results or confiscate a club. | I, S, V |
| <a id="s21-03"></a>**S21-03** Price services and allocate revenue | Decide | Model creators, coach hire, sponsorship, venue operators and league contracts, splits, refunds and receipts. Test sponsor cancellation and service delivery after a club or venue sale. | I, S, V, B |
| <a id="s21-04"></a>**S21-04** Review optional predictions and rights | Later | Scope free predictions separately. Record rights/licensing, territorial, age and integrity questions for any real-value feature. That feature is outside pilot scope pending a separate decision. | I, O |

<a id="s22"></a>

## S22 · Client journeys and design system

Managers, supporters and staff can complete their key journeys with accessible, accurate feedback. **Target** G2. **Lead** UX + client + QA. **Depends on** S03, S05.

[founding](founder-rules.md#founding) · [scouting-evidence](founder-rules.md#scouting-evidence) · [after-transfer](founder-rules.md#after-transfer) · [media-round](founder-rules.md#media-round)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s22-01"></a>**S22-01** Build the manager workspace | Build | Use the researched club dashboard, inbox, calendar, squad lists, asset profiles, tactics/training editors and finance ledger. Each view explains state, next action and permitted actor. | I, E |
| <a id="s22-02"></a>**S22-02** Test recruitment and finance journeys | Build | Keyboard and mobile users can compare a prospect, review total cost, sign, recover pending status and inspect eligibility or arrears. Exercise empty, offline, pending, rejected and settled states. | I, V, E |
| <a id="s22-03"></a>**S22-03** Create reusable match, club and media components | Build | Validate pitch, table, timeline, draw, event card, finance receipt, alert, approval and private/public variant. Confirm contrast, focus order, locale, time zone and screen-reader labels. | U, E |
| <a id="s22-04"></a>**S22-04** Review visual direction and information architecture | Design | Walk founder, delegated manager, supporter, editor and buyer through the nine template families using original Ballerz assets. Record usability findings and approved designs before further UI build. | E, O |

<a id="s23"></a>

## S23 · Operations, reconciliation and release

Operate an 80-club pilot with auditable funding, recoverable data and measured expansion. **Target** G4. **Lead** Platform + QA + producer. **Depends on** S02, S06, S09, S12, S15, S16.

[founder-launch](founder-rules.md#founder-launch) · [pilot-treasury](founder-rules.md#pilot-treasury) · [founder-seasons](founder-rules.md#founder-seasons)

| Task | Disposition | Acceptance evidence | Tests |
| --- | --- | --- | --- |
| <a id="s23-01"></a>**S23-01** Operate ledger and event reconciliation | Build | Monitor fixture freshness, duplicate/pending settlements, BB conservation, rent/fee runway and indexer lag. Script recovery from finality gaps, key loss and snapshot restore using disposable ledgers. | I, V, O |
| <a id="s23-02"></a>**S23-02** Stage the 80-club rehearsal | Build | Race admissions, draws, deadline submissions and settlement; simulate one full season plus rollover. Record p95 latencies, eligible squad coverage, fairness, insolvency and per-club support load. | I, V, B, O |
| <a id="s23-03"></a>**S23-03** Review reward and economy integrity | Build | Monitor connected trades, grant recycling, free-agent concentration and false positives. Hold disputed funds only, log reasons and appeal outcomes; report eligibility errors separately from suspected abuse. | U, I, B, O |
| <a id="s23-04"></a>**S23-04** Release a funded cohort | Build | Demonstrate 636M BB maximum lifetime commitment for 80, separate 14.4M opening rewards within it, SOL/cash runway, fixed rules, privacy review, signer drill, rollback and signed go/no-go. | I, V, D, O |
| <a id="s23-05"></a>**S23-05** Evaluate expansion or hold | Tune | After full season and wage rollover, ≥64/80 ready for ≥16/18, reconciled obligations, two-season no-new-inflows stress and staff capacity. If any gate fails, honour existing terms and defer invitations. | I, B, O |
| <a id="s23-06"></a>**S23-06** Support players through live operations | Build | Publish incident ownership and response, service status, dispute routes and change notices. Rehearse missed deadline and disputed transfer, restore only off-chain projections and reconcile finalized assets. | I, V, E, O |
