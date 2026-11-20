# Ballerz — Solana Economy & Tokenomics (working v0.2)
**20 November 2026 · Design proposal; not implemented or audited**

## Confirmed product requirements
- **Ballerz** is the free-to-play football-management game; **Baller Bucks** is its sole in-game monetary unit (working names).
- A **user** is a human account; a **player** is a footballer asset.
- Monetary economics are **real**, not simulated: spendable Baller Bucks must be held in funded accounts, wallets or escrows. No fabricated wages, gate receipts, account balances, yields or payouts.
- Baller Bucks is intended as a **Solana-native, DEX-tradeable token**, exchangeable for SOL or other tokens where liquidity exists. There is no issuer commitment to redeem for fiat. Its value may fluctuate and appreciation is not promised.
- Clubs, players, stadiums, leagues and potentially federations are envisaged as ownable/transferable digital assets. The entire club—not just its squad—is an object of development and commercial value.
- Free participation must remain viable without buying tokens. AI assistant managers are a potential optional paid service.
- Supporters may follow, subscribe to and watch clubs' matches; subscriptions can influence verified engagement and attendance-related mechanics.
- Users should be able to earn real Baller Bucks from genuine trades and commercial activity, without guaranteed returns.

## Economic invariant: funded flows
Every spendable Baller Bucks receipt must be either (a) a transfer from an existing funded wallet/treasury/escrow or (b) an explicit, auditable issuance under monetary policy. A simulated match attendance, follower count, win or academy promotion does **not** mint a payment.

### Income and spending channels
| Activity | Payer/source | Recipient | Monetary consequence |
|---|---|---|---|
| Player NFT sale | Buyer wallet | Seller wallet, less disclosed fees | Existing tokens transfer |
| Club NFT / bundled asset sale | Buyer escrow | Seller and specified counterparties | Existing tokens transfer |
| Supporter membership | Subscriber wallet | Club treasury, platform, other agreed shares | Existing tokens transfer |
| Match viewing / digital ticket | Viewer wallet | Rights holders / league / club under disclosed split | Existing tokens transfer |
| Sponsorship | Sponsor-funded escrow | Club/league upon contractual milestones | Existing tokens transfer |
| Stadium event / hosting | Organiser or ticket buyers | Stadium operator and rights holders | Existing tokens transfer |
| League prize | Pre-funded league/sponsor prize pool | Eligible club | Existing tokens transfer |
| Academy / free onboarding | Protocol's controlled issuance quota for footballer assets | User's club | **No Baller Bucks automatically minted** |
| Optional AI services | User via Baller Bucks payment or external checkout | Service provider | Funded revenue, not a token subsidy |

### Attendance and supporters
Separate three measurements:
1. **Verified audience:** real users following, watching or subscribing; Sybil-weighted, deduplicated and subject to privacy constraints.
2. **Football attendance/atmosphere mechanic:** can be influenced by genuine supporters, stadium capacity and engagement; does not create currency.
3. **Actual paid receipts:** only real ticket, viewing, membership and sponsorship transfers, or finite pre-funded league distributions, enter club treasury.
A paying supporter must not be allowed to self-cycle payments through many wallets to trigger uncapped rewards. Rewards, if any, must have an explicit source, caps and anti-wash-trading protections.

### Club as a composite digital business
The club NFT anchors a persistent identity and history, competitive record, supporter community, academy and commercial rights. The club may also control or contract with separately owned player NFTs, stadium NFTs, league memberships and funded treasuries. Club valuation is **market-discovered**, not a guaranteed sum of synthetic scores. Value may arise from:
- Team quality, academy and talent-development pipeline
- Club identity, honours, supporter retention and reputation
- Facilities, stadium ownership or hosting contracts
- Funded subscriptions, content rights, sponsorships and league activity
- Operational quality, governance, contracts, and verifiable treasury balances
Transfer contracts must explicitly identify bundled assets, liabilities, restricted funds, subscriber terms and continuing obligations; ownership of a club NFT alone should not automatically sweep unrelated wallets.

### Profitability for users
Potential economic roles: club builder and seller; talent developer/trader; stadium operator; league organiser; match broadcaster/creator; sponsor/brand partner. All profit requires a willing paying counterparty, funded contract, or sustainable business margin. A club can have sporting success and zero financial revenue. Token market price and NFT resale value are uncertain. Do not market guaranteed user earnings.

### Footballer lifecycle and supply
- Players have unique NFT identities but need not have unique names.
- Active footballers age, develop, decline and retire. Their permanent career history remains accessible as a legacy/collectible NFT; **retirement does not guarantee retained market value**.
- Clubs need an ongoing **free playable squad and academy continuity path** when players retire, without forced token purchases.
- A retiring elite footballer must not automatically regenerate into an equally elite prospect. Controlled global talent issuance, cohort distributions, retirement rates and academy progression protect scarcity.
- New-user starter squads may be low-value and eventually tradable, but immediately extractable free assets create Sybil incentives. Consider time/participation/reputation-based transfer eligibility plus global issuance caps; recognise gameplay farming can be automated.
- Distinguish total player NFT count, active player population, elite talent share, free starter entitlement and tradeable float.

### Solvency, debt and permissions
- No unsecured club credit or personal financial liability from gameplay. Clubs cannot spend unavailable Baller Bucks.
- Optional paid contracts should be prepaid/escrowed and automatically expire or pause when funds run out.
- Free baseline gameplay, youth intake and squad continuity survive an empty club treasury.
- Restricted sponsorships and grant funds cannot be withdrawn as unrestricted owner profit.
- No AI agent may hold unrestricted wallet authority. Approvals, budgets, revocation and audit logs are required for purchases/transfers.

### Baller Bucks monetary policy — still to decide
**Working recommendation:** investigate a floating Solana utility token with explicit capped emissions and transparent treasury management, but do not finalise total supply, emissions schedule, allocation, vesting, burns or liquidity provisioning before simulations and legal review. The historic EVM/GBP-pegged BBSC experiment is not the target economic specification.
- Track total vs circulating supply, treasury unlocks, ownership concentration, net emissions, burns, velocity, DEX depth, slippage, market-maker inventory and runway.
- DEX swaps are not guaranteed liquidity or fiat redemption; large sellers may experience significant price impact.
- Separate protocol revenue (real customer/sponsor payments) from token treasury transfers, token valuation and secondary-market volume.
- Any fee burn or token sink must not make free core gameplay unaffordable.

## Stress tests to model before parameters are chosen
1. 1,000 to 1,000,000 users: starter squad issuance, elite talent supply, infrastructure and treasury cost.
2. 100,000 Sybil accounts: economic extractability of starter and academy NFTs, wash trading, paid supporter farming.
3. 50% of active footballers retire: squad continuity and academy supply; retired NFT value not guaranteed.
4. 100x token price increase / 90% collapse: free play, optional service affordability, treasury solvency, DEX slippage.
5. Concentration: a small group owns most stadiums, leagues, elite players or subscribers; can entrants compete?
6. No sponsors or paying supporters: ensure no unfunded matchday payouts.
7. Withdrawal run: clubs and holders seek SOL exits simultaneously; distinguish token balances from real exit liquidity.
8. Bot-operated clubs with paid AI: inference costs, task permission abuse and on-chain security.
9. Stadium or club NFT bundle sale with ongoing subscriptions and liabilities: correct transfer and consent.
10. Thin liquidity and oracle manipulation: fee quotation, DEX execution, TWAP/reference prices, circuit breakers.

## Open questions
- Token issuance cap, initial allocations, vesting, emissions schedule and governance?
- Which operations settle on-chain versus signed off-chain game state?
- Which revenue shares go to clubs, league operators, creators, stadiums and Ballerz?
- Which paid match content is exclusive versus free-to-watch?
- How does ownership of a club NFT interact with its independently owned player and stadium NFTs?
- What does a non-paying user own and when can those assets be sold?
- What withdrawal limits, reserves and escrow rules protect subscribers/sponsors?
- What rights are needed for broadcasts, brands and third-party football IP?
- What is the regulatory treatment of token sales, marketplace assets, paid prize competitions and any future betting?
- **Real-value betting is not an MVP feature**: licensing, age restrictions, match integrity and insider controls require separate design and legal work.

## Relationship to earlier docs
This supersedes the simulated gate-receipt and £100/year baseline participation assumptions in `BALLERZ_VISION_AND_ECONOMY_V0.1.md`. Free core play, real funded Baller Bucks flows, and DEX trading are founder-confirmed; mechanisms above are recommendations unless otherwise marked.
