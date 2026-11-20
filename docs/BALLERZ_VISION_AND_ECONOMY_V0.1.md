# Ballerz: Product Vision, Digital Football Economy & Tokenomics

> **Superseded economic assumptions (20 November 2026):** The founder has since confirmed free-to-play core gameplay, real funded Baller Bucks monetary flows (not simulated budgets or receipts), Solana-native DEX trading against SOL/other available assets, development of the whole club as an economic asset, and hybrid identity naming. See [Economy & Tokenomics v0.2](BALLERZ_ECONOMY_AND_TOKENOMICS_V0.2.md) and [Naming Registry v0.1](BALLERZ_IDENTITY_NAMING_REGISTRY_V0.1.md). Earlier illustrative mechanics and unresolved choices below are historical design exploration, not current decisions.

**Status:** Working design draft v0.1 — 20 November 2026  
**Purpose:** Preserve founder ideas, distinguish decisions from hypotheses, and give future design, engineering and funding work a common reference. This is a proposal, not a description of a finished or deployed product.

## 1. The thesis

**Ballerz is the game. Baller Bucks is its proposed in-game currency/token.** The names are working labels and may change.

Build an affordable, persistent football-management universe in which football entities—players, clubs, stadiums, competitions, and potentially governing federations—can have digital ownership and transferability. Club managers should be able to manage manually or employ genuinely useful AI assistant managers to advise on and execute tasks. The business should primarily earn money by providing a valuable game and AI service, **not** from engineering a token to appreciate or by relying on speculation.

### Founder-stated objectives (captured from conversation)

- A club should be inexpensive to operate over time. Roughly **£100 per year** was floated as a target for ordinary participation, not a committed price or universal cost cap.
- Baller Bucks is the currency; Ballerz is the game. The names may change.
- The economy should be vibrant, but not intentionally structured as a get-rich-quick mechanism. Token value *might* rise with adoption; it is not a promise or primary product objective.
- AI assistant managers should perform actual delegated work, not merely chat. Monetising them could be a more durable business than relying on token economics.
- Ownable/transferrable NFTs are envisioned for teams, leagues, stadiums, and perhaps a federation hierarchy analogous to national and continental football bodies.
- Clubs should potentially receive in-game gate receipts and sponsorship support, including a Baller Bucks bursary for promising or resource-constrained clubs.
- The economy needs controls against both runaway inflation and extreme operating costs.

### Working product principles (proposed)

1. **Game first, financial instrument second (or not at all).** Good football decisions, competition and community must be the reason to participate.
2. **Cheap core play.** No pay-to-win requirement to afford a competitive team.
3. **Pay for convenience and capability.** AI assistants sell saved time and richer simulation, not guaranteed results.
4. **Value from utility.** An NFT must confer an actual game capability, meaningful identity, governance role, or transfer right; token scarcity alone is insufficient.
5. **Constrained supply and credible sources of funds.** Never create new Baller Bucks simply because an in-game ledger needs to show gate receipts.
6. **Transparent ownership and rules.** Buying a league or team does not permit arbitrary confiscation of player assets or rewriting standings.
7. **Simulate frequently; settle selectively.** Keep high-frequency gameplay off-chain; put verifiable ownership and material transfers on-chain when justified.

## 2. The football-world hierarchy

A proposed hierarchy—not necessarily one blockchain NFT per relationship:

```
Federation / Association (NFT-controlled governance rights)
  └── Competition / League (NFT or governed registry)
        ├── Season, fixtures, rules, table (versioned simulation state)
        └── Clubs / Teams (NFT ownership)
              ├── Players (NFTs, if transfer economics warrant)
              ├── Stadium (NFT property/use right)
              ├── Staff: AI assistant managers (subscription/service entitlement)
              └── Supporters, sponsors, training and finances (mostly off-chain state)
```

**Important distinction:** The owner of a league NFT should own the *rights explicitly encoded by the protocol*—for example, operating a sanctioned competition and receiving a defined operator fee—not unrestricted control over other people’s clubs. The system needs a federation-level charter and transparent rules for league admission, relegation, transfers, promotion, disputes and misconduct.

### Core NFT archetypes

| Asset | What the owner can do | Dynamic attributes | Important guardrails |
|---|---|---|---|
| Club / Team | Rename or brand within policy, appoint manager, enter eligible competitions, sell/transfer club | Record, squad valuation, supporters, reputation, honours | Transfer cannot strand other users' unrelated assets or cancel liabilities |
| Player | Transfer, loan, develop or train player under contract rules | Stats, form, age, injuries, contract, history | Prevent unauthorised minting, exploitative stat edits and contract abuse |
| Stadium | Host home fixtures, improve facilities, set ticket policy, earn simulated matchday allocation | Capacity, quality, maintenance, demand, atmosphere | No automatic passive yield; revenue must come from modelled economic sources |
| League | Run a defined competition, set bounded rules, distribute prizes and fees | Members, schedule, quality, media interest, operating history | Rule changes versioned; neutral officiating; withdrawal and appeal mechanisms |
| Federation | Authorise competition hierarchy, enforce integrity and shared format | Affiliations, competitions, reputation | Governance constraints; avoid claiming association with real-life FA/UEFA/CONCACAF |

Not every attribute should be on-chain. Mutable data such as injuries, live tactics and simulation ticks are better in a signed/versioned game-state service; the token points to a canonical state or metadata snapshot.

## 3. A coherent in-game economy

### 3.1 Sources of Baller Bucks and value

Distinguish three different things:

- **Purchasing / earning Baller Bucks:** A player purchases tokens or receives an allocation from a defined, funded treasury or reward pool.
- **Spending / transferring Baller Bucks:** Transfers between clubs, sponsors, federation treasuries, leagues, and game-service providers. These do **not** increase total token supply.
- **Minting / burning Baller Bucks:** Protocol-level supply changes. These should follow a published emissions/minting policy with governance limits, monitoring and auditability.

**Invariant:** Every payment is either a transfer of existing balances or an explicitly accounted-for mint. A “virtual” receipt is not money created from nowhere.

### 3.2 The spending and revenue loop

```
Players and sponsors buy/earn Baller Bucks
          │
          ▼
Club treasuries / user wallets
   ├── Transfers and loans ──► Other clubs
   ├── Stadium and training ─► Builders/service pools
   ├── League fees ──────────► Competition treasury
   ├── Matchday/sponsors ◄─── Funded fan/league/sponsor pools
   └── Selected sinks ───────► Burn or governed protocol reserve
```

Potential token sinks: competition-entry fees, optional stadium upgrades, transfer registration, cosmetics and club customisation, user-driven marketplace transaction fees, tournament hosting, name changes, and selected treasury-funded services. **Never make essential participation depend on ever-increasing token amounts.** Consider a fee waiver for new and low-resource clubs.

### 3.3 Stadium gate receipts (proposed mechanic)

Model match demand using stadium capacity, supporters, home form, opponent attraction, competition level, ticket price, accessibility and local/community engagement. Sample calculation:

- Capacity: 20,000; modelled demand: 16,000; occupancy: 16,000.
- Price index: 2 virtual units per occupied seat; gross simulated gate receipts: 32,000 **game accounting units**.
- Operating costs, revenue sharing and matchday costs reduce net receipts.

**Critical:** Those 32,000 are a **simulation score**, not 32,000 newly minted Baller Bucks. Conversion into spendable Baller Bucks requires funding from an existing matchday economy reserve, user ticket expenditure, league prize pool, sponsor pool or pre-budgeted emissions. A bounded **matchday reward budget** can apportion funds according to each club's share of modelled performance. Publish the cap and avoid allocating unbounded token rewards to the biggest clubs.

The system should reward engagement but avoid fake follower farming. Fan following may affect demand, but weight real activity, reputation and diversity; cap influence from low-quality duplicate activity.

### 3.4 Sponsorship and bursaries

Two complementary pathways:

1. **Market sponsorship:** A person, business or project funds a club, league, stadium event or season. Payment arrives through an actual funded transfer (fiat into treasury or existing Baller Bucks), and sponsor receives defined branding/activation benefits.
2. **Bursary / community support:** A bounded, published treasury pool subsidises new clubs, lower-division participation or youth development. Eligibility can depend on transparent participation and anti-Sybil checks.

A sponsorship agreement might specify: budget, term, branding rights, milestones, prohibited content, termination conditions, and payment schedule. Funds should be escrowed and released by verifiable events rather than silently minted. Make disclosure visible so sponsorship is never mistaken for a no-strings grant.

### 3.5 Balance and anti-inflation controls

- Fix a **budget** for seasonal rewards, sponsorship subsidy and prize distributions; keep total subsidy within it.
- Distinguish **supply inflation** from **player affordability**: simply minting more tokens may lower unit price but does not guarantee cheaper gameplay.
- Adjust in-game fee quantities to target an affordable *real-world* cost, rather than fixing huge Baller Bucks fees during volatile market periods.
- Use spending sinks conservatively and transparently; do not manufacture demand merely to prop up price.
- Include progression that does not depend on buying stadiums or scarce assets.
- Consider league revenue-sharing, capped matchday rewards, and lower-division solidarity funding to avoid entrenched wealth.
- Monitor token velocity, concentration, circulating supply, treasury runway, net sinks, active users and cost-per-club, not just token market price.

## 4. The unresolved Baller Bucks token design

**Repository evidence:** The older `DarthShoge/foundry-ballerbucks-stablecoin` project describes a collateral-backed algorithmic stablecoin pegged to GBP, with token name `BallerBucksStablecoin` and symbol `BBSC`. That is an existing code experiment, **not evidence that the final game currency must be a GBP-pegged stablecoin**.

There is a material design choice:

| Candidate | Benefit | Drawback |
|---|---|---|
| A. Stable Baller Bucks or fixed-value game credit | Predictable £ cost, simpler budgeting | A pegged unit is not designed to appreciate; collateral, reserves and regulation add complexity if transferable/redeemable |
| B. Floating Baller Bucks token | Demand-driven market valuation may emerge | Volatility, affordability risks, token speculation, more complex game fee indexing |
| C. Two-layer economy: stable game credits + optional transferable governance/utility token | Separates user affordability from market volatility | More complex messaging, design and compliance; could confuse users |

**Preliminary recommendation for research:** Prototype the game with a stable, off-chain **accounting unit** and configurable treasury ledger, while evaluating whether a blockchain token is necessary at launch. If transferable Baller Bucks is essential, choose the economic role first—stable payment asset vs volatile utility/governance asset—before adapting the existing BBSC smart contract. Do not promise appreciation, passive income or buybacks. Commission legal/regulatory review before real-money sales or tradeable asset issuance, including UK consumer protection, cryptoasset promotion and gambling/loot-box implications where applicable.

## 5. AI assistant managers as a paid product

Assistant managers are first-class **AI agents** with bounded responsibilities in club operations. The manager remains accountable and can revoke delegation.

### Autonomy levels

- **Advisor:** analyses line-ups, tactics, fixtures, player form and transfer options; recommends actions. No writes to game state.
- **Delegate:** executes specific tasks with granular permissions, budgets and approval limits (e.g., training schedules and scouting).
- **Autonomous operations:** pursues goals such as “build a top-five defence this season” within a signed task scope, capped resources and irreversible-action approvals.

### Specialist roles (optional evolution)

- Tactical analyst: opponent scouting, shape and match-plan suggestions.
- Recruitment/scouting lead: player search, shortlists and valuation.
- Academy director: youth development and training pathways.
- Sporting director: squad planning, wage budget and succession.
- Commercial lead: sponsor prospecting and stadium operations, limited to in-game simulated counterparties/approved tools.

A single general-purpose assistant with optional specialists is probably a safer MVP than requiring multiple paid subscriptions from day one.

### Monetisation model (illustrative, not committed pricing)

- **Free/base:** all essential club-control features and fair gameplay are available manually; a small allowance of AI advice may be included.
- **Advisor tier:** approximately £4.99 per month for recommendations, scouting briefs and conversational assistance.
- **Delegate tier:** approximately £7.99 per month for a defined number of authorised autonomous workflows and additional usage.
- **Optional team plan:** multiple specialist assistants, pooled limits and advanced analytics only if demand and compute margins justify it.

A user of the £7.99 tier is buying *time saving* and decision support, not superior player stats, match outcomes or guaranteed profitability. Avoid token-value-dependent AI subscription prices; bill consistently in fiat or stable credits and expose AI budgets and limits.

Example arithmetic: **10,000 monthly active clubs × 20% paid conversion × £7.99/month = £15,980 monthly gross subscription revenue** (£191,760 annualised), **not profit**, before AI inference, orchestration, fraud, payment, taxes and infrastructure. This is a scenario, not a forecast.

### Safe implementation architecture

```
User natural-language instruction
    ▼
Task interpreter / capability selection
    ▼
Permission, budget and policy gate
    ▼
Read-only game-state / analytics APIs
    ▼
AI planning and deterministic simulation tools
    ▼
Proposed actions + explanation + cost
    ├─ Read-only: reply
    ├─ Reversible, in-scope: execute through audited game API
    └─ Transfers, spending, lineup lock, trading or NFT actions: explicit approval
    ▼
Audit log, outcome summary and rollback/compensation where supported
```

AI should **never** hold unrestricted wallet keys or bypass game rules. Separate intent interpretation from deterministic game mechanics and canonical state. Log delegated decisions so players can understand or undo them.

## 6. Sustainable revenue beyond the token

The primary business can combine:

- AI assistant subscriptions and optional specialist seat/usage add-ons.
- Conventional premium conveniences such as enhanced analytics and expanded customisation (without pay-to-win performance advantages).
- Small, transparent marketplace fees on real asset transfers when such a marketplace exists.
- Sponsored leagues, branded competitions and opt-in advertising clearly identified as sponsorship.
- Tournament administration and creator/operator tools for trusted community leagues.

Do **not** count protocol treasury token emissions as company revenue. Revenue is revenue from real purchasers, subscribed service users and contractual sponsors; treasury assets, token market cap and marketplace volume are different metrics.

## 7. Suggested release sequence

**Phase 0 — playable core and economy in a spreadsheet/simulator:** match engine, squads, club progression, accounts, bounded season-based economy. Use internal credits, not transferable tokens.

**Phase 1 — helpful AI:** launch an advisor with retrieval over actual game state, cost meters and evaluation fixtures. Validate AI usefulness and inference margins before pricing.

**Phase 2 — delegation:** add training/scouting workflows, permissions, approval UX, logs and task limits. Charge for real labour saved, not expected wins.

**Phase 3 — club and stadium ownership:** persist transferable digital rights, stadium capex/operating models, balanced matchday funds and sponsorship contracts. Test market concentration.

**Phase 4 — league operators and federations:** community-created leagues, licences, scheduling, operator fees, prize pools, dispute mechanisms, interoperable club transfer policies.

**Phase 5 — on-chain settlement if justified:** audit contracts, tokenomics and risk before a public transferable Baller Bucks launch. Ensure blockchain costs don't violate the accessibility goal.

## 8. Measurement and financial modelling

Track **DAU/MAU and club retention**, active leagues, completed seasons, manual vs delegated tasks, useful-action rate, AI cost per paid user, conversion/churn, average annual cost per club, Baller Bucks circulation/velocity, treasury outflows vs inflows, concentration of club income and NFT ownership, matchday reward distribution, fraud/bot incidence and sponsor renewal.

Key stress tests:

1. A hundred-player league with minimal paid conversion: can free players compete, and can the operator sustain compute and game infrastructure?
2. A tenfold rise in token price: can a new club still play for roughly the intended real-world spend?
3. 50% of users acquire expensive stadium NFTs: does revenue compound into an unstoppable rich-get-richer loop?
4. A sponsor withdraws: can contractual obligations be honored without printing Baller Bucks?
5. An AI manager issues an expensive or malicious instruction: can permissions and spending limits block it?
6. One league owner tries to change rules mid-season: is state integrity and an appeal route preserved?

## 9. Open decisions — do not silently assume answers

1. Is Baller Bucks intended as a GBP-pegged payment asset, floating utility token, or accounting credit? Is `BBSC` part of the new plan?
2. Which chain (if any) is intended? Earlier repos use Solidity/EVM; this draft does **not** assume that the modern game must remain on EVM.
3. Is the rough £100 annual participation target inclusive of paid AI, NFTs and transaction fees, or just baseline club operations?
4. Which entities truly require transferable NFTs at launch, and what legal/contractual rights do those NFTs convey?
5. Is the matchday economy entirely simulated and pool-funded, or will supporters purchase real tickets/digital passes?
6. Can club NFTs transfer together with roster contracts, stadium rights and league membership, or are these separately owned?
7. What decisions may an AI assistant execute without explicit confirmation?
8. Do league owners receive a capped operations fee, variable ticket share or other contractual income—and from which funded source?
9. How should grassroots/poor clubs remain competitive against asset-rich clubs?
10. Should sponsorships be real third-party commercial contracts, in-game fictional firms, or both?

## 10. Repository alignment and provenance

Checked on 20 November 2026 through the connected GitHub account:

- [`DarthShoge/Ballerz-NFT`](https://github.com/DarthShoge/Ballerz-NFT): historic early Solidity/Truffle player-NFT implementation; README identifies it as a foundation for an on-chain football-management simulation. Latest **commit** observed dated 5 October 2021. The API repository metadata showed a later push timestamp, but no newer commit in the first returned commit list.
- [`DarthShoge/foundry-baller-nft`](https://github.com/DarthShoge/foundry-baller-nft): Foundry/Solidity ERC-721 Baller NFT work.
- [`DarthShoge/foundry-ballerbucks-stablecoin`](https://github.com/DarthShoge/foundry-ballerbucks-stablecoin): experimental GBP-pegged, collateralised Baller Bucks stablecoin (`BBSC`).

Write permissions were confirmed for `Ballerz-NFT`; **the founder confirmed this repository as canonical on 20 November 2026**, so these design notes should be reviewed before committing them to a repository. No code or token contract has been changed.

---

**Status conventions:** “Founder-stated” = directly expressed in discussion; “proposed” = assistant-generated design hypothesis; “open” = unresolved. This draft intentionally does not treat any token appreciation or asset yield as guaranteed or as an investment proposition.