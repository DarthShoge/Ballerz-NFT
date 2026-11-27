## Behaviour and decision

Link the studio task and source rule. Describe the observable change.

## Verification

- [ ] Tests cover the affected rules and failure boundaries through normal entry points.
- [ ] Integration tests exercise the affected permissions, persistence, concurrency and retry paths.
- [ ] For chain-backed changes, link transaction-runtime and real RPC/validator evidence, including final balances or title.
- [ ] For client or balance changes, link the applicable browser journey or seeded playtest evidence.

Name any inapplicable layer and why. Link the exact commands or CI runs, configuration and results. Identify remaining release-specific evidence.

## Security evidence

Identify any changed trust boundary and link the `security` issue, relevant rejection or recovery tests and their results. For financial changes, record the expected signers, approved terms, destination and outcome after retry. Give remaining findings and their owners. If no boundary changed, say why.

## Release and recovery

Record compatibility and migration effects, rollout signals, and how an operator recovers from partial failure.
