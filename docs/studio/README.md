# Ballerz studio delivery plan

**Planning baseline · 27 November 2026.** The first deliverable is a reliable two-club fixture. The next economic transaction is a single fixed-price footballer transfer. The first cohort release is a funded season for 80 clubs. An advertised commitment to 100,000 founders requires its own funding decision.

[Production backlog — 23 epics and 111 tasks](backlog.md) · [Mandatory testing policy](../../CONTRIBUTING.md) · [Founder decisions and worked examples](founder-rules.md)

The [live studio project](https://github.com/users/DarthShoge/projects/1) tracks repository issues under their parent epics. The [first iteration](https://github.com/users/DarthShoge/projects/1/views/3) runs from 27 November through 10 December 2026. [PR #71](https://github.com/DarthShoge/Ballerz-NFT/pull/71) carries the payout recovery, rollback and duplicate-payment work. The [main-branch ruleset](https://github.com/DarthShoge/Ballerz-NFT/rules/28231045) requires the matchday and Solana checks before merge.

## What already exists

Matchday PR #2 supplied the server-run match, two tactical phases, fixture scheduling, submissions, AI practice, live management, match reports, replay and SQLite persistence. Preserve its normal entry points and test against them. The subsequent local implementation at `3e81fe3` settled one fixture on Solana Devnet with standard System, SPL Token and Memo programs. Six of the 73 tests at that baseline cover appearance rules and receipt verification. Automated recovery currently uses a simulated RPC response. Public Devnet verified a real payment and duplicate handling. A custom programme for custody, transfers, expiry, payroll and funded reward enforcement is future work. Legacy Solidity/Truffle code is historical reference for this Solana roadmap. [Matchday](../../matchday/README.md) · [Merged work](https://github.com/DarthShoge/Ballerz-NFT/pull/2) · [Finalized Devnet fixture](https://explorer.solana.com/tx/57abjYGxQvbtLN1g4QsJQ6mCeEpovyr5fEzqxXBtP1AEiDZD9EUwGcxVxqPzfr17QTqECpADwVqBqvhzoLeJhQjL?cluster=devnet)

## Roadmap and release decisions

Gate numbers give dependency order. Within a gate the producer pulls the smallest playable slice through design, implementation and QA. The gates below are proposed studio milestones. Dates and named assignees depend on team capacity. Optional feature experiments can progress alongside the critical path with their own owners.

| Gate | Playable or operational outcome | Evidence required to exit | Accountable review |
| --- | --- | --- | --- |
| G0 · Production setup | A contributor can take a rule from a decision to a reproducible test result. | Board and issue template usable, baseline reproducible in CI, required checks proven on a test PR, missing suites assigned. | Producer, engineering lead, QA |
| G1 · Reliable matchday | Two managers play, get a report and see the correct payment even after a worker restarts. | Reuse the existing engine. Test live RPC locally, single-/double-forfeit, rollback, race, restart and a second legitimate fixture. Retain a Devnet release receipt. | Gameplay lead, chain engineer, QA |
| G2 · Club and first transfer | A manager signs an identified footballer at a fixed price and can see whether they can field that player. | Free club identity, rights, fee sponsorship, treasury sub-balances, funded wages and registration cutoff work together. Two buyers, one sale, no stranded wage holds. Verify on Devnet with test assets. | Product, economy, chain, QA |
| G3 · Closed season alpha | A test cohort can qualify, recruit, play 18 fixtures, develop and renew or release players and enter the next season. | Run an accelerated full season plus rollover and a human-paced deadline trial. Include zero-BB continuity, fair claims, role remedies, retirement and season accounting. Demo club, coach, spectator and media journeys separately. | Game director, producer, discipline leads, QA |
| G4 · Funded 80-club pilot | Eight ten-club divisions can be admitted, supported and paid under published terms. | Verify reserve and operating budgets, reconciliation, keys, support, rollback, unresolved integrity findings and capacity. Test first 80 before expanding. Funding and release each require explicit approval. | Founder, treasury signers, production and QA |
| G5 · Expansion and later products | Existing commitments remain funded as additional complete divisions or products open. | Apply the season/rollover expansion criteria, approve new stock, funds and support capacity. Run separate discovery and release reviews for cups, commercial venues, federation and optional supporter voting. | Founder, economy, live operations |

**Critical path:** quality harness → repeatable fixture settlement → club custody and available funds → wage-backed transfer → renewal/treasury return → full-season reconciliation → funded admission. Calendar and gameplay work can proceed alongside custody. Scouting and training use match evidence; an assistant coach becomes useful after training works manually. Publishing depends on public match events and permissions. Cups, paid extras and venues can ship on independent milestones.

## Recommended work tracker

Use **GitHub Projects with GitHub Issues and Actions**. The code and matchday PR already live on GitHub. A producer can open the milestone roadmap, a designer can read the decision and acceptance cases, and QA can follow the same issue to its PR, test run and release evidence. Use one project for the studio. The repository owns versioned rules and test policy; the board owns assignments, iteration, status and delivery dates. [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects)

1. Create a project named **Ballerz Production**. Create G0–G5 repository milestones. Add one parent issue per epic and one sub-issue per task using the backlog ID in the title. Paste the row's acceptance case and test codes, link its source rule, and give each active task one named owner. Materialize the first iteration first; the full portfolio is available locally.
2. Use fields for status, priority, iteration, discipline, decision state and test evidence. Use the built-in milestone, assignee and PR links. Record direct blockers as issue dependencies. If a task spans multiple releases, split it before putting it into an iteration. An epic dependency identifies an integration dependency, not a requirement to finish every optional task in that epic.
3. Create four views: **Milestones** (roadmap by gate), **Current iteration** (board by status), **Design and balancing** (open decisions and playtest targets), and **QA and release** (missing evidence, unverified integrations and release blockers). Keep a production bug linked to the rule and test that failed.
4. Use **Backlog → Ready → In progress → Review → Verification → Done**. Track blocked work with the actual dependency. Prioritise lost funds, wrong title, duplicate payouts, private-data exposure and inability to field a free club above new functionality. Configure branch protection once the checks actually run. [GitHub project quickstart](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/quickstart-for-projects) · [Required status checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

## Production lifecycle

| Stage | Work product | Exit decision |
| --- | --- | --- |
| Discovery | Designer states the player problem, actor, known rule, abuse case and open question. Producer checks the founder log and existing implementation. | Founder confirms a new rule or designer identifies an already agreed rule and a bounded experiment. |
| Specification | Engineer and QA write an observable example, state transitions, permissions, clock, data ownership and failure cases. Designer identifies UX, balance and accessibility evidence. | Ready when acceptance, dependencies, owner and test environments are clear. Any unsettled policy is a decision ticket. |
| Build | Start with an executable example. Implement the smallest player journey through the real API. Review interface, asset changes, migrations and telemetry. | Linked PR passes the applicable checks and review against the source rule. |
| Verification | QA replays edge cases, regression tests and relevant human playtests. Economy reviews the inputs, seed and distributions for tuneable rules. | Evidence on the issue covers each affected layer, with a reviewer and version. |
| Release | Producer prepares release notes, migration, canary, monitoring, pause/restore procedure and participant communications. Chain engineer verifies cluster, authority, deployed version and reconciliation. | Record gate, build, signer/approval where applicable and release evidence. Pause on unresolved critical discrepancies. |
| Live operations | Review incidents, rejected claims, pay failures, fairness and player feedback. Keep decisions, parameter changes and their effective dates in version control. | Fixes get regression tests; a changed rule gets a new decision and a migration/replay case. |

**Proposed cadence.** Run two-week iterations, weekly design/economy review and a playable demo plus retrospective at iteration end. QA joins design before code is written. Review funding and release separately from the sprint demo. Estimate only ready tasks with the assigned team. Forecast milestone dates from observed throughput after two iterations. A producer can cover several roles on a small team; the owner of disputed financial evidence should get a second review.

## First iteration

**Objective:** recover a finalized fixture on a clean worker and demonstrate that an unsuccessful payout cannot leave one club paid. Use a disposable local validator and temporary SQLite database. This work fits before the first marketplace implementation.

| Order | Task | Deliverable for the demo |
| --- | --- | --- |
| 1 | S01-01, S01-02 | Baseline matchday tests run on a PR. QA can point from the appearance rule to the enforcing function, test case and outstanding runtime gap. |
| 2 | S01-03, S02-01 | Fresh local keys and cluster, both managers submit, final report generated, known BB opening and closing balances. Keep the normal Devnet command pinned to Devnet. |
| 3 | S02-02 | Force a worker exit after finalization, recover the same signature in a new process and restore the public receipt. |
| 4 | S02-03 | Fund the vault with only 8,000 against a 16,000 liability. Prove unchanged BB balances and absence of a receipt, then fund and settle once. |
| 5 | S02-04 | Race two workers, then play a distinct second fixture. Verify the first cannot pay twice and the second can pay both clubs. |

The first two economic design questions to bring to the founder are who can authorize or rotate the pilot result signer and which Solana custody model should enforce a paid player's treasury return. S02-06 and S05-05 own these decisions. Each proposal must demonstrate its effect on past receipts, existing assets and loss of a signer.

## Risks to review at milestone demos

| Risk and owner | Signal to inspect | Response |
| --- | --- | --- |
| Duplicate payout or stranded asset · chain lead | Token deltas, custody and receipt disagree with the signed fixture or transfer. | Pause the affected operation, reconcile by original reference, rehearse recovery before resuming. |
| Unfunded promises · economy lead | A budget cannot cover existing commitments at full participation with zero new inflows, or SOL cannot cover sponsored fees. | Preserve existing obligations, close new funded admissions and keep free play open. |
| Unfair development or scarce-player access · game designer | Paired seeds diverge without a sporting cause, keepers underdevelop, or awards and intakes concentrate beyond model assumptions. | Rerun matched controls, review weights and publish the effective season for an approved change. |
| Duplicate claims or unfair exclusion · trust lead | Linked groups capture multiple grants, or successful appeals expose bad exclusions. | Review private evidence, preserve one provisional entry where applicable, restore wrongly withheld access and measure false positives. |
| Privacy or unauthorised agent action · product lead | Spectator, outlet or coach can act on private concerns, hidden potential, team sheets or stale delegated authority. | Enforce permissions at the read and command boundary, revoke access and verify with cross-role tests. |
| A functioning system still feels like work · producer | Users abandon recruitment, miss deadlines unknowingly or cannot explain a payment, player concern or development report. | Observe a fresh manager completing the journey, capture the failure point and repeat the playtest after a targeted change. |

## Scope, source precedence and change control

| Product area | Backlog |
| --- | --- |
| Manager loop, matchday, tactics, competition and deadlines | S03, S04, S09, S20, S22 |
| Founding, naming, identity, assets, projects and whole-club sales | S05, S07, S08, S17, S21 |
| Scouting, training, finite careers, academy and player autonomy | S13–S16 |
| Bursaries, reserves, rewards, wage growth, transfers, loans, renewal and withdrawal | S02, S06, S07, S09–S12 |
| AI staff, media agents, supporters, awards and commercial activity | S18, S19, S21, S22 |
| Test engineering, build, operations, security, support and release | S01, S02, S23 |

Use the dated founder decisions for the funded pilot, and the ADRs for underlying sporting rules. Apply the latest decision about the **same mode and rule**. For example, the launch uses ten clubs, eighteen fixtures and two automatic moves; eight was an earlier baseline and remains a minimum in the vacancy design. Earned youth discounts and restricted starter purchase grants have different resale rules. The annual wage curve uses the revised founder-season anchors. A transfer ban leaves an eligible club able to compete. ADR 0008 supersedes ADR 0007 for cup sanctions. Capture any remaining conflict as a decision issue before implementing it.

The 1T supply and 10% main treasury split are economic scenarios. The 100,000 lifetime founder target, 5% maximum presentation credit and 80-club pilot are distinct decisions. Development targets, injury comparisons, youth-credit parameters and role review thresholds need playtest evidence. The first release excludes supporter voting; a later club trial has agreed constraints. DEX liquidity, live issuance, fee/operating budgets, agent pricing, venue economics, commercial rights and a real-value prediction product require separate decisions. The source archive preserves older examples for comparison. [Founder references](founder-rules.md) · [Tokenomics](../BALLERZ_ECONOMY_AND_TOKENOMICS_V0.2.md) · [Naming](../BALLERZ_IDENTITY_NAMING_REGISTRY_V0.1.md) · [ADRs](../adr)

For each new decision, append or supersede the versioned rule, link its issue and effective release, update impacted backlog rows and regression cases, and publish any player-facing change before it takes effect. Deterministic replay uses the rule version in force when the event occurred.
