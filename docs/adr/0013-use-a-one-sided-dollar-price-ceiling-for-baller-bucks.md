# Use a one-sided dollar price ceiling for Baller Bucks

Date: 2026-11-27  
Status: Proposed (founder review)

## Context

Ballerz is a football-management game with a genuine, funded economy. Managers should experience the sporting and financial consequences of running a club, including difficult transfer decisions, wage obligations, relegation and rebuilding. They should not need to risk substantial personal wealth or speculate on the currency to compete.

Baller Bucks (BB) remains the sole in-game monetary unit and is intended to be transferable on Solana where external liquidity exists. The value worth building should reside principally in football clubs, their players, history, academy, facilities and commercial relationships, not in an expectation that BB will appreciate.

The [economy and tokenomics specification](../BALLERZ_ECONOMY_AND_TOKENOMICS_V0.2.md) currently recommends investigating a floating utility token and leaves supply, emissions and liquidity open. The [founder rules](../studio/founder-rules.md) also model a one-trillion-BB genesis scenario and require a finite, funded pilot without mid-pilot issuance to cover shortfalls. This ADR proposes a change in monetary-policy direction without changing existing funded promises, playtest balances or implementing a live token.

## Decision proposed

Use a nominal US-dollar-denominated upper price target for BB, with no lower price target. Allow external prices below the target, including substantial declines. Do not promise fiat redemption, a minimum exchange rate, returns, or a hard external-market peg.

Provide a transparent, permissionless primary sale facility on Solana that sells BB from a dedicated intervention vault in exchange for USDC at a published price at or slightly below the target. An arbitrageur can buy BB from the facility and sell into external markets when the spread exceeds execution costs. A price above the target should therefore attract additional supply rather than justify increasing the target.

Do not buy BB back merely because its external price falls. Do not spend the operating cash budget defending a minimum price. The USD reference is intentional: accept the nominal dollar's changing purchasing power and foreign-exchange rates rather than operate a separate CPI-indexed monetary regime. A future target change would require a new reviewed decision, not an automatic inflation adjustment.

The facility quotes USDC, not guaranteed redeemable bank dollars. USDC/USD deviations, network and venue outages, fees, slippage, available inventory and market fragmentation can cause external prices to exceed the target. The enforceable commitment is the published official offer while stock and settlement are available, not a guaranteed cap on every trade.

## Calibration for modelling

Use the following provisional inputs, not a launch allocation or promises of market value.

| Input | Reference scenario |
| --- | ---: |
| Nominal upper price target | USD 0.00001 per BB |
| Conversion at target | 100,000 BB = USD 1 |
| Generational/elite footballer reference price | 10,000,000 BB = USD 100 |
| Candidate total lifetime supply for fixed-supply scenario | 100,000,000,000,000 BB (100 trillion) |
| Implied fully diluted valuation at target | USD 1 billion |
| Alternative supply sensitivity | 1 quadrillion BB (USD 10 billion at target) |

Prefer the USD 1 billion notional ceiling scenario over the USD 10 billion scenario for modelling. Neither valuation is a fundraising or adoption target. Market capitalisation equals circulating BB multiplied by market price; fully diluted valuation uses the relevant total supply. Neither implies cash reserves, executable liquidity or proceeds. If additional issuance above the modelled supply is later authorised, the corresponding notional valuation boundary changes unless a separate hard maximum is imposed.

Retain football-scale nominal numbers while making real-world entry affordable. Illustrative balancing anchors:

| Football economy item | BB | USD equivalent at target |
| --- | ---: | ---: |
| Young prospect | 100,000 | 1 |
| Established footballer | 1,000,000 | 10 |
| World-class footballer | 5,000,000 | 50 |
| Generational talent | 10,000,000 | 100 |
| Elite club transfer budget | 100,000,000 | 1,000 |
| Elite club squad valuation | 200,000,000 | 2,000 |

These are indicative reference values, not minimum prices, appraisals, individual spending limits or enforceable transfer caps. A peer-to-peer auction can exceed a reference price. If a binding USD 100 maximum for any footballer is required, separately specify and test a BB transfer-price limit (including all consideration and fees), anti-circumvention and treatment of external NFT transfers. The currency ceiling alone cannot enforce that limit or prevent aggregate overspending.

Do not mechanically multiply existing bursaries, wages or rewards by the new maximum supply. Rebalance the entire economy against these affordability anchors. Admit funded clubs in cohorts; do not release the full modelled supply into circulation on day one. Preserve free entry, club-bound continuity, the incoming-transfer ban for arrears and prepaid or escrowed optional obligations.

## Intervention reserve and issuance

Separate four accounting pools: funded gameplay commitments, uncommitted intervention BB, operating cash/SOL, and primary-sale USDC proceeds. Treat DEX liquidity as a separately budgeted use of capital and tokens. Never allocate the same BB to both promised club rewards and intervention.

For the finite pilot, pre-fund the intervention vault if real trading is separately approved. No mid-pilot minting to meet shortfalls or replenish a depleted vault; preserve the existing funded-pilot governance. If the vault empties, disclose the suspension and loss of price protection. Test an intervention facility with the separate test mint before any real-market deployment.

A provisional official quote of USD 0.0000097 per BB (assuming USDC near USD 1) leaves 3% of the target as gross headroom for arbitrage costs. Calibrate the buffer from execution costs, DEX depth and market conditions; do not assume arbitrage is always profitable or instantaneous.

Reserve requirement is a token-flow problem: opening BB reserve should cover the maximum cumulative net vault outflow under the selected stress path, plus a safety buffer. Count only unencumbered, actually received and authorised replenishments. At the illustrative quote, without recycling:

| Cumulative primary-sale demand (USDC) | Required BB, rounded up |
| --- | ---: |
| 10,000 | 1,030,927,836 |
| 100,000 | 10,309,278,351 |
| 1,000,000 | 103,092,783,506 |

For example, 10 billion BB of intervention stock supports 97,000 USDC of gross purchases; that is an illustrative stress-test starting point, not a final reserve recommendation. A fixed percentage of total supply is not a substitute for modelling net demand, concentrated buying and time to exhaustion. Sale capacity is not guaranteed revenue. Sustained primary purchases can consume a finite reserve even when secondary prices remain below the target.

Compare two post-pilot policies before finalising the mint:
- Fixed lifetime supply with a pre-funded reserve and replenishment from eligible, unencumbered treasury receipts. No unconditional perpetual ceiling; inventory can exhaust.
- Retained, programme-controlled mint authority with explicit issuance purposes, auditable limits and governance, potentially minting against paid primary sales after reserve depletion. This reduces inventory risk but can dilute holders, increases governance/security risk and may invalidate the notional valuation boundary. No discretionary unlimited issuance or minting simply to fund sporting rewards.

Do not irrevocably revoke mint authority or commit to an inflationary backstop before this comparison and security review. Publish the selected authority, issuance limits, treasury vesting/release policy, remaining sell inventory and any emergency controls. Keep the pilot's two-of-three treasury governance and ring-fenced commitments intact.

## Implementation constraints

- Use integer base-unit arithmetic with explicit rounding and atomic USDC payment/BB delivery. Validate canonical mints and token accounts; reject invalid or duplicate settlement; define minimum purchase size, maximum per transaction, fees and reconciliation. Rate limits or pauses can weaken the ceiling and must be disclosed.
- SPL token supply is represented in unsigned 64-bit base units. A 100 trillion whole-BB maximum can support at most five decimal places; one quadrillion at most four, before exceeding the base-unit limit. Check every balance, issuance and intermediate arithmetic operation; use wider checked arithmetic for calculations where needed. The decimal choice and programme architecture are not final. See [Solana token documentation](https://solana.com/docs/tokens).
- Publish vault balance, actual circulating supply, primary-sale quote, cumulative issuance, net reserve flows and settlement history; distinguish official price, executed market price, indicative USD equivalents and actual executable exit value.
- Threat-model vault depletion, bots/front-running, concentrated ownership, manipulated pools/oracles, USDC depegging, outages, compromised authority, grant farming, wash trading and cross-venue price dislocations. Avoid using a thin spot quote to control issuance. Define emergency suspension, audit and recovery procedures before deployment.
- Preserve meaningful football decisions without allowing unlimited personal spending to determine results: no personal liability for club arrears, no unsecured gameplay credit, consider account-level spending controls and financial fair play for external injections, and retain free sporting continuity. A cheap token is not by itself a pay-to-win or consumer-protection safeguard.

## Alternatives considered

- Freely floating BB: simpler issuance, but unlimited upside can make gameplay expensive and currency speculation central.
- Two-sided stablecoin: a redemption or buyback commitment requires a different reserve and regulatory model, creates run risk and is contrary to accepting lower market prices.
- One-cent price with the same football figures: a 10 million BB player would cost USD 100,000 at that price. Redenominating prices or using display-only units could address this but the proposed smaller BB unit retains a single understandable football currency.
- Closed, non-tradeable game credits: stronger control over real-world spending and market pricing, but does not meet the current externally tradeable BB direction.

## Consequences and validation before mainnet trading

Model the founding cohort of 100,000 clubs over 15 seasons (including the current 782.5 billion BB funding reference under its existing, unrecalibrated assumptions), smaller pilot cohorts, and growth cases. Test zero new sponsor revenue, player and wage distributions, grants, recycling, club insolvency, demand shocks, prolonged primary-sale purchases, reserve exhaustion and a 90–99% market-price decline. Compare fixed and controlled-issuance cases using the same economic paths.

Track circulation, velocity, balances by club tier, real-world entry/transfer costs, reward runway, treasury receipts, reserve drawdowns, price overshoots, DEX depth, concentration, operating cash runway and free-play continuity. Estimate seed liquidity, network fees, development and independent audit costs separately. Neither supply target nor reserve budget is validated yet.

Before enabling publicly tradable BB or marketing the price policy, obtain specialist legal and compliance review of the token, sale facility, UK and other applicable cryptoasset/financial-promotion requirements, consumer protections, and any paid competitions, random rewards or cash-out mechanics. Do not describe BB as a guaranteed stablecoin, investment, or guaranteed USD equivalent.

If accepted, update the economy specification and founder funding workbook/backlog with the new policy direction and calibrated numbers through separate reviewed changes. The existing [first-squad funding ADR](0009-fund-first-squads-with-ballerbuckz.md), funded commitments, test-token separation and single-currency direction remain in force unless explicitly superseded.

Success means managers care about building a successful football club and can afford to play even if BB becomes popular. Currency appreciation is not a product goal.
