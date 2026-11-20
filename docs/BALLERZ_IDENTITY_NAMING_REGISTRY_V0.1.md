# Ballerz — Identity & Naming Registry (working v0.1)
**20 November 2026 · Proposed design for Solana**

## Confirmed direction
Hybrid naming: users may create club identities or choose procedurally generated names. Real-world football brands must not be impersonated; a protected-name registry should prevent registration of names such as "Arsenal" where likely to mislead or infringe rights. This is a design proposal, not an assertion of ownership of those names.

## Identity and namespace model
- Every club, player, stadium, league and federation asset has an immutable **asset ID / Solana mint or equivalent identity**. Names never serve as ownership keys.
- Club: mutable `display_name`, unique normalised `handle`, short name, optional match code, locale, history, owner authority and moderation state.
- Display names need not be globally unique; handles must be unique within the Ballerz club namespace.
- Asset IDs remain stable through rename, sale, retirement and league changes.
- Separate namespaces for clubs, leagues, federations and stadiums prevent accidental cross-type conflicts. Reserve potentially confusing cross-namespace brands.
- Footballer NFTs may share personal names; each is identified by a unique asset ID and career record. Avoid deceptive representation of actual footballers.

## Registration state machine
`AVAILABLE → HELD (short reservation) → REGISTERED`; exceptions `RESERVED`, `UNDER_REVIEW`, `DISPUTED`, `RELEASED/COOLDOWN`.
1. User enters original name or selects generated suggestion; client displays candidate handle.
2. Canonicalise handle; validate length, allowed characters, confusables, prohibited content, reserved terms, and likely brand collisions.
3. Query current on-chain handle registry and off-chain protected-name index. Availability check is advisory until atomic registration.
4. Temporarily reserve the handle with a short expiry; apply rate limits and anti-Sybil eligibility.
5. Mint/register the club and claim its handle in a single controlled transaction or atomic programme operation.
6. Emit identity-created/renamed events and maintain indexed searchable history.
7. On club transfer, the registered handle and associated rights transfer with the club; any independent assets or obligations must be separately specified.
8. On rename, retain historical aliases with cooldown/anti-impersonation controls; do not allow immediate hostile reclamation.

## Protected-name registry
Categories: professional clubs and nicknames, leagues, competitions, federations, official abbreviations, confusing variants, existing Ballerz identities, impersonation and prohibited content.
Each protected entry needs canonical text, aliases, scope, jurisdiction/context, evidence, reason, status, reviewer and appeal/audit history.
- Examples: Arsenal FC, Manchester United, UEFA Champions League and FIFA as high-priority review/reservation candidates.
- Avoid blanket blocking generic words such as "United", "City" or "Arsenal" in unrelated contexts.
- Apply Unicode NFKC, case folding, punctuation/whitespace canonicalisation, confusable-script detection and fuzzy matching; **fuzzy matches should usually trigger review rather than automatic rejection**.
- Distinguish exact reserved handles from contextual display-name review.
- Allow rights holders to submit evidence; provide transparent appeals and proportionate remedies (rename or de-listing instead of confiscating unrelated NFT assets).
- Protected-name data can be versioned off-chain, with material registry changes auditable/on-chain-anchored.

## Generated naming
- Use geographic and linguistic templates with culturally plausible combinations; do not stereotype or infer nationality solely from names.
- Examples of *unverified candidate names*: South London Rovers, Setagaya Phoenix, Ibadan Sporting Club, Obsidian Athletic.
- Every suggestion passes the same live availability, protected-name and safety checks as a user-created name.
- Avoid copyrighted logos, official crests, protected league names and real-player likenesses without appropriate rights.

## Player names
- Generate plausible names from diverse locale-informed dictionaries/distributions; support diacritics and multiple naming conventions.
- Multiple players can share the same name. Permanent NFT identity, career stats, origin and records disambiguate.
- Do not mint celebrity impersonations or imply licensed associations.
- Naming does not confer rarity or sporting skill. Retired player identity and achievements remain attached to the same historical asset.

## Squatting, Sybil and abuse
- Basic club registration and naming are free.
- Limit unverified users' active registrations and temporary reservations; use account reputation, cooldowns and rate limits.
- Avoid creating a standalone tradable name-token market in MVP.
- Consider a per-user club entitlement policy but do not pretend one wallet equals one human.
- Handle transfer follows verified club NFT ownership; name claims cannot be separated and sold independently in MVP.
- Prevent account factories from exhausting attractive names; moderate coordinated attacks and wash transfers.

## Solana architecture (proposed)
- Club NFT: immutable asset identity, current authority and reference to mutable canonical metadata.
- Naming Registry programme: derive PDA from namespace + canonical handle; enforce unique claims, registered ownership, transfer/rename authority and events.
- Off-chain identity service: generated candidates, trademark evidence, fuzzy matching, moderation, appeals and search.
- Indexer: immutable history of aliases, transfers and disputed states.
- Maintain a clear emergency process for fraudulent public-facing names without confiscating the NFT itself; governance and appeal rules must be specified.
- Metadata pointers should be tamper-evident where appropriate, but avoid storing large mutable text dictionaries on-chain.

## Acceptance tests
- `arsenal`, `ArsenaI` (capital I), punctuation variants and confusable scripts cannot bypass appropriate protections.
- Two users cannot atomically claim the same canonical handle.
- Identical player names do not collide.
- Rename preserves all club sporting and financial history.
- Selling club transfers handle and defined identity rights, not arbitrary third-party assets.
- A banned public-facing display name can be remediated without confiscating unrelated property.
- Automated accounts cannot reserve unlimited names for free.
- Generated names undergo identical checks and are not assumed available.
- International names and diacritics render correctly and do not cause false duplicate claims.

## Open design decisions
- Which namespaces and minimum/maximum handle lengths?
- Are club display-name duplicates permitted in the same league?
- How many clubs may a user create for free?
- What cooldown applies after rename or abandonment?
- Who adjudicates trademark disputes and how are appeals funded?
- Should verified real-world brands ever license official names and logos?
- What is the cost and custody model for Solana NFT minting when user gameplay is free?

**Status:** Hybrid naming is agreed; the detailed registry mechanisms are recommendations pending implementation review.
