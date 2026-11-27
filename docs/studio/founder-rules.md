# Founder rule references

Snapshot of the founder decision log through 27 November 2026. The source includes worked examples, proposals, earlier models and subsequent corrections. The [delivery plan](README.md) records precedence. Use the ten-club payout table, revised annual wage anchors and independent-sale rule for the current funded pilot. Figures under earlier eight-club and bootstrap comparisons are historical. The original decision wording below preserves that context.

<a id="devnet-fixture"></a>

## First funded fixture · 27 November 2026

Production tasks: [S02-01](backlog.md#s02-01) · [S02-02](backlog.md#s02-02) · [S02-03](backlog.md#s02-03) · [S02-04](backlog.md#s02-04).

Northbank Athletic beat Eastport Rovers 1–0 using the merged matchday engine and its accelerated playtest clock. Both clubs submitted a valid team sheet before lock. The operator verified the final match record and paid both clubs from the test BB treasury.

Each club’s balance rose from zero to 8,000 test BB. The treasury fell from 160,000 to 144,000. One transaction finalized both transfers at slot 526849852. A fresh process recovered the original transaction. Devnet simulation rejected a separately signed duplicate at receipt creation before either transfer. [View the finalized appearance payments](https://explorer.solana.com/tx/57abjYGxQvbtLN1g4QsJQ6mCeEpovyr5fEzqxXBtP1AEiDZD9EUwGcxVxqPzfr17QTqECpADwVqBqvhzoLeJhQjL?cluster=devnet).

The pilot uses operator-held test club wallets and a dedicated test mint. Matchday determines sporting eligibility. Solana records the fixture receipt and moves the BB.

<a id="autonomy-media"></a>

## Reporting player departures · all three rules agreed

Production tasks: [S16-04](backlog.md#s16-04) · [S18-03](backlog.md#s18-03) · [S18-04](backlog.md#s18-04).

- **Public events and private concerns.** Keep role warnings, remedy progress and renewal discussions visible to the player’s club and authorised parties, including the disclosures required for a prospective buyer. Once expiry and release settle, publish the player’s departure and free-agent status in the official feed. The reason stays private unless the club chooses to disclose it.

- **Evidence for media agents.** Let an agent use the official appearance record to report the player’s minutes and draft a question about the manager’s selection. Require an approved, attributable source for a claim that the player was unhappy or that the club broke a promise. Preserve editor approval for publication and speaker approval for attributed manager quotes.

- **Consequences of coverage.** Keep pilot coverage informational. A story can invite a manager response. Role concerns, wages, development and free-agent draw odds continue to use their agreed game inputs, independent of article volume or supporter reactions.

Approved on 27 November 2026. Keep role concerns private, require attributable evidence for sensitive reporting, and leave sporting and economic decisions independent of media coverage.

<a id="after-role-refusal"></a>

## Renewal refusal and free-agent claims · all three rules agreed

Production tasks: [S16-04](backlog.md#s16-04) · [S12-03](backlog.md#s12-03).

- **Make the refusal predictable.** For the pilot, have the player decline if both the original and remedy periods missed the signed target and the concern remains open when the final renewal decision is issued. A subsequently completed review meeting the target before that decision clears the concern. Show the eligible fixtures or weeks, credited minutes or sessions, and both targets. Allow correction of a wrongly recorded event and honour the full remedy period and 72-hour final notice.

- **Give the player a genuine opportunity to leave.** Test seven real days from expiry during which the player will decline a new offer from the former control group after a role-based refusal. Independent clubs can enter the usual 24-hour claim process immediately. Ordinary contract expiry keeps the existing equal claim rights. After the seven days the former group can offer an acceptable, deliverable role through the usual process if the player is still unattached. Existing grant recovery rules continue to apply.

- **Draw among offers the player would accept.** Publish acceptable roles before claims open. Each claim must include a role the player accepts, enough available minutes or training capacity across live commitments, and the wage reserve. Give each eligible control group one entry in the existing draw. Use the same odds for every qualifying offer. Recheck capacity at settlement and release losing reservations.

Approved on 23 November 2026, including the seven-real-day former-group restriction as a pilot setting.

<a id="role-transfers"></a>

## Role promises at signing, on loan and after a sale · all three rules agreed

Production tasks: [S16-01](backlog.md#s16-01) · [S16-03](backlog.md#s16-03).

- **Check capacity before accepting a promise.** At signing or renewal, show the remaining minutes and training slots after existing commitments in overlapping review periods. Block a proposed commitment only when the available capacity makes it impossible even with a legal lineup; flag tight but achievable plans. For example, six standard 90-minute fixtures offer one goalkeeper position for 540 minutes. Two regular-keeper promises beginning together would need 720. A regular plus a rotation keeper would need exactly 540. Account for players who can cover multiple positions without double-counting the minutes.

- **Make a loan a credible remedy.** Show the borrowing club’s offered role and available capacity before the player accepts. A loan intended to resolve a playing-time concern must offer at least the outstanding opportunity over the remaining review period. Carry earned minutes, deadlines and the concern with the player. For a training promise, count the borrower’s completed sessions. The parent can see progress and a loan or return never counts as fulfilment by itself.

- **Separate club responsibility on a permanent sale.** On a genuine independent sale, disclose the role history and require a new role the player accepts. Start the buyer’s reviews at settlement. The old club’s shortfall stays in its record. A previously triggered refusal concerns renewal with that club. For a connected-club move, keep the open concern and review progress. Returning to the same control group within the original review period also preserves any unresolved obligation, subject to the existing review and appeal process.

On 23 November 2026 the founder approved capacity checks, loan remedies based on actual qualifying activity and fresh reviews for genuine independent buyers. Connected moves preserve the existing concern, progress and deadline.

<a id="playing-role-terms"></a>

## Regulars, development players and renewal · approved for playtesting

Production tasks: [S16-01](backlog.md#s16-01) · [S16-02](backlog.md#s16-02) · [S16-04](backlog.md#s16-04).

- **Regular role.** Test 360 verified league minutes per six eligible fixtures. Four full appearances or six 60-minute appearances both meet the promise. Use the same eligibility and review rules as the rotation test. Make this a promise about minutes so the manager retains discretion over starts.

- **Development role.** Test at least one completed, role-relevant focused session in four of every six eligible in-game weeks. Pause for a week when verified injury prevents all training. A session belongs to the player who actually trains. Two sessions in one week still count as one week of attention. Give a development player, including a backup keeper, six more eligible weeks to remedy a missed training block before any renewal consequence.

- **Reassess the role at renewal.** Keep the signed promise fixed for the current term. For the next term, use the median of eight weekly current-ability readings and comparable players at the same position to propose acceptable roles. Apply the same comparison to peers. A developing player who has caught the regular can ask for a rotation or regular role. Show the manager the new minimum and the supporting comparison with at least 72 real hours’ notice. Meeting the old promise counts as fulfilling it. Neither a poor league finish nor hidden potential raises the new minimum.

On 22 November 2026 the founder approved the 360-minute regular-role test, the four-of-six eligible-week development promise, and role reassessment at renewal using the eight-week median of current ability and comparable players at the same position.

<a id="player-autonomy"></a>

## Player autonomy and speculative signings · agreed for playtesting

Production tasks: [S16-01](backlog.md#s16-01) · [S16-02](backlog.md#s16-02) · [S16-04](backlog.md#s16-04).

- **Agree the role before signing.** For tradeable prospects, publish acceptable playing roles, the opportunity each role requires and the renewal consequence before the club commits a fee. Set expectations using age, position and current ability relative to the squad. Keep hidden potential out of the calculation. A manager can offer any role the player accepts. Pilot the regular and rotation roles separately from a genuine development role for young or backup players. Show the latter’s training commitment explicitly.

- **Measure the opportunity the club controls.** For a rotation outfielder, test 180 verified league minutes per six eligible fixtures. Exclude verified injury absences and fixtures the opponent or Ballerz prevents from being played. Count the club’s own avoidable forfeit as zero if the player was fit. Apply the standard even when the club loses. Count actual eligible minutes on loan, keep the record through connected-club moves, and assess backup keepers against their agreed development plan. Show the reason for any concern and progress towards resolving it.

- **Give a concern a contractual consequence.** After one missed review, the player requests more playing time or a suitable loan. Give the club the next six eligible fixtures to meet the target. If it misses again, the player may decline the next renewal under a rule published at signing. A met target clears the concern. Apply a refusal only after the full remedy window and at least 72 real hours of final notice; a short first term cannot trigger an early refusal. The current term runs to expiry. An unrenewed player follows the existing treasury free-agent process. Keep unhappiness separate from ability, potential and wage calculations. Test on new terms with explicit acceptance.

Approved on 22 November 2026. Test 180 verified league minutes per six eligible fixtures for a rotation outfielder. A first shortfall opens a six-eligible-fixture remedy period. A second consecutive shortfall gives the player the right to decline renewal under the published terms. Test a losing club that plays the prospect, a winning club that benches them, a loan and a verified injury.

<a id="youth-intake-economy"></a>

## How the youth intake works · all three rules agreed

Production tasks: [S15-03](backlog.md#s15-03) · [S15-04](backlog.md#s15-04) · [S15-05](backlog.md#s15-05).

- **Size the intake against the playing population.** For a stable 80-club pilot, test one new tradeable youth place for every retirement from the tradeable playing pool, including retirements that earn no credit. Exclude club-bound academy players from this calculation. Count existing treasury-held players in the available stock, review shortages by position, and publish the intake size and positional mix before rankings open. Budget expansion stock separately when new divisions are approved.

- **Define an elite service year for succession access.** Test a published current-ability threshold of 750 out of 1,000. Count a year when at least 26 of its 52 weekly observations meet that threshold while registered with the same club. Two qualifying years plus the existing retirement-service conditions earn priority access to the reserved prospect pool. Measure how many wingers and keepers qualify against the planned number of reserved prospects before fixing the threshold.

- **Treat the earned discount on resale.** For the pilot, let the retirement credit permanently reduce the youth signing fee. A 250,000 BB prospect costs 187,500 BB after credit. If the club later sells the player to an independent buyer for 220,000 BB, the difference is 32,500 BB before wages and other obligations. Any separately recorded starter-grant claim still follows the agreed recovery rules. Preserve the single-use restriction and common-control checks.

Approved on 22 November 2026. Replace tradeable retirees one for one during the stable pilot, test 750 ability for 26 of 52 weekly readings as an elite service year, and let clubs retain the earned youth discount on resale. Previously recorded grant recovery still applies to any separate starter-grant contribution.

<a id="retirement-pilot"></a>

## Retirement and replacing a veteran · all three rules agreed

Production tasks: [S15-02](backlog.md#s15-02) · [S15-03](backlog.md#s15-03).

- **Show the retirement risk before a commitment.** Display the published age- and position-specific chance at the next year-end on the squad, transfer and renewal screens. For example, the existing outfield test curve gives a 34-year-old a 20% chance. Show service earned and any credit the club would qualify for if retirement occurs. Keep the outcome unknown until the shared year-end check.

- **Test meaningful service.** Keep the existing trial of five in-game years with the same Team NFT and 60 competitive appearances across at least three years. Compare it with adding 2,700 verified competitive minutes for that team, equivalent to 45 minutes per appearance across 60 appearances. Count minutes actually played. Compare qualification rates separately for wingers, starting keepers and backup keepers before adopting the extra condition.

- **Price the regular youth credit.** Cover 25% of one published treasury youth signing fee, capped at 100,000 BB. A 250,000 BB signing costs the club 187,500 BB plus its full wage reserve. Apply the credit directly to the treasury fee, with no cash payout or unused balance. Record the discount once as foregone intake receipts. The existing one-credit-per-signing and regular-credit carry-forward rules continue.

Approved on 22 November 2026. The additional 2,700-minute condition is a comparative playtest with a separate check on backup keepers. The existing finite-career design provides the year-end retirement check, service history and youth-intake claim process. [Finite careers and youth intake](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0010-generate-footballers-with-finite-careers.md)

<a id="career-development"></a>

## From prospect to veteran · approved for playtesting

Production tasks: [S14-04](backlog.md#s14-04) · [S15-01](backlog.md#s15-01) · [S15-02](backlog.md#s15-02).

- **Test whether high potential is attainable.** Follow the reference winger and keeper from age 18 to retirement with continuous training and regular eligible minutes. Record peak ability and age at peak alongside the reserve and substitute paths. Test whether the regular can reach at least 648 of the committed 720 ceiling. Use this as a calibration target across full careers, including a check with retirement held constant to isolate the growth curve.

- **Age attributes separately.** Test gradual age effects by attribute family. For example, a veteran winger can lose acceleration while still improving positioning; a keeper can retain handling while reflexes decline. Avoid a single birthday-triggered deduction across all skills. Test winger and keeper curves separately before choosing rates or peak ages.

- **Handle injury and recovery.** In the first playtest, an injury changes availability and short-term match condition. A footballer earns development from work actually completed and keeps progress banked before the injury. Apply the ordinary age curve during absence. Omit an additional permanent injury deduction in this trial. Test six missed fixtures against a healthy control and show missed opportunities separately from underlying ability changes.

Approved on 22 November 2026. The six-fixture injury comparison will inform any later decision on permanent injury penalties.

<a id="development-results"></a>

## What a season of development should produce · agreed for playtesting

Production tasks: [S14-03](backlog.md#s14-03) · [S14-04](backlog.md#s14-04) · [S14-05](backlog.md#s14-05).

- **Set a reference pace.** In the matched 18-fixture comparison, use a healthy 18-year-old starting at 180 current ability with a ceiling of 720 known to the testers. Give each copy ordinary team training and one completed focused session per in-game week. Target a finishing ability of 200–210 for the reserve and 215–230 for the 90-minute regular. In each matched run the 30-minute substitute should finish between its reserve and regular. Test wingers and keepers, and simulate multiple seasons before adopting rates for live players.

- **Assign match experience by minutes in role.** Use a published role-to-skill mapping. Divide experience by verified minutes in each role, within the existing cap. For example, winger minutes can develop off-ball movement and decisions, while keeper minutes can develop positioning and decisions even in a quiet match. Raw shots, saves and touches carry no additional development credit in the pilot.

- **Show what changed each week.** Give the manager a report listing the trained skill, completed session weights, credited league minutes by role, and visible attribute changes. Retain fractions between weeks and explain when a display threshold has yet to be crossed. Keep the true ceiling and remaining headroom private through the player’s active career.

Approved on 22 November 2026 for playtesting. The season ranges are calibration targets for the reference profile. Role-based league experience and the weekly development report are approved.

<a id="focused-sessions"></a>

## Choosing and using a focused session · all three rules agreed

Production tasks: [S14-01](backlog.md#s14-01) · [S14-02](backlog.md#s14-02).

- **Choose a specific skill.** For each focused session, let a manager select one named player and one eligible technical skill. Examples include crossing or first touch for a winger and handling or distribution for a keeper. Show the target before booking. A saved plan repeats the choice and the coach can manage it within the authority already granted.

- **Test diminishing returns.** Give a player’s first completed focused session in an in-game week the normal training weight and the second 50% of its usual weight. Apply the second-session multiplier even if the skill, coach or club changes. Keep fractional progress. Compare this with two full-weight sessions during calibration. The percentage sets training weight for the playtest.

- **Agree a fallback for a missed session.** Let the manager name an optional backup player and skill. If the original player is injured or on a protected rest day before training, use the backup only if eligible and within both caps. Otherwise release the slot for the rest of that week. Only a completed session consumes the allowance; unused weekly slots expire. Show who trained or why the session was skipped in the weekly report.

Approved on 22 November 2026. The receiving player’s own completed-session count determines the weight, including when a backup takes the session.

<a id="development-playtest"></a>

## Training a signed prospect · approved for playtesting

Production tasks: [S14-01](backlog.md#s14-01) · [S14-03](backlog.md#s14-03) · [S14-04](backlog.md#s14-04).

- **Focused training capacity.** Test six free individual sessions per club per in-game week, with at most two completed sessions per permanent footballer ID across clubs, coaches and loans. Ordinary team training continues for the whole squad. A saved recurring plan uses the same allowance. Six sessions support one focus each for six players or two each for three.

- **Competitive minutes.** Test a proportional experience component for verified league minutes, up to 90 per player per in-game week across clubs. A 30-minute appearance contributes one third of the full-minute component before age and role adjustments. A brief cameo gets its proportional share. Each played minute counts once; forfeits without play and preseason qualifiers contribute zero. This measures player development separately from eligibility for club payments and the scouting appearance count.

- **Season calibration.** Compare copies of the same young player over the 52-day season with the same training, age, role, starting ability and hidden ceiling. Give them zero, 30 or 90 minutes in each of 18 league fixtures. Compare technical attributes and match-reading separately, and repeat for a reserve goalkeeper. Approve numerical growth rates after checking that training produces useful technical progress for a reserve and sustained match experience adds a visible decision-making benefit. Preserve the retirement reveal.

On 22 November 2026 the founder approved the six-session club allowance, two-session player limit, 90-minute weekly competitive experience cap and 18-match comparison for wingers and goalkeepers. Each position has three matched cases with 0, 540 or 1,620 league minutes played across the season. Compare credited minutes under the weekly cap. Numerical growth rates remain open until calibration.

<a id="scouting-evidence"></a>

## What a scouting report can tell a manager · all three rules agreed

Production tasks: [S13-02](backlog.md#s13-02) · [S13-03](backlog.md#s13-03) · [S13-04](backlog.md#s13-04).

- **Opening report.** Freeze the same free report for all clubs throughout the founding recruitment window. Show verified current ability, position-relevant attributes and a broad estimate of potential alongside the fee and wage. Label the range as an estimate of the ceiling. For example, a winger at 180 today with estimated potential of 550–750 may finish his career below 550. These numbers illustrate the display.

- **Following a player.** After recruitment, give each club one free active scouting assignment for the pilot. Test a more precise report after three distinct competitive appearances observed while the assignment is active. Preserve progress between appearances. Count a match once regardless of replay views, agents or wallets. Clubs with the same evidence receive the same assessment, without independent rolls to pool. Keep the underlying player ceiling fixed.

- **Verifying the estimate over a career.** Before the initial allocation, publish a salted commitment to the player ID and ceiling. Keep the exact ceiling hidden during the playing career, including on transfer. On retirement, reveal the value and salt so anyone can check the original commitment. Compare dated reports with the revealed ceilings across retired players to assess scouting accuracy. Compare peak ability separately to see how much potential was realised.

On 22 November 2026 the founder approved the shared opening report, one free active scouting assignment per club with three distinct competitive appearances as the playtest threshold, and disclosure of the committed ceiling and salt at retirement.

<a id="starter-allocation"></a>

## Allocating the first 80 squads · all three rules agreed

Production tasks: [S08-02](backlog.md#s08-02) · [S08-03](backlog.md#s08-03).

- **Comparable starting strength.** Prepare 80 named 18-player squads before recruitment opens. Balance the starting eleven, bench, goalkeeper cover, age mix, spread of potential and payroll across squads. Allow different tactical strengths. Allocate the squads by a reproducible draw independent of qualifier results and founding rank. Each manager sees the actual players, prices, wages and scouting ranges before approving a purchase.

- **Protected choices in a shared pool.** Hold each club’s default 18 while its manager shops. Use additional player stock for the optional swaps and scarce prospects. Release a displaced starter to the shared pool only when a replacement is confirmed, with remaining positional cover and wages checked. A lost draw leaves the original offer intact. The 1,440 players cover defaults; optional choices require additional stock.

- **Time between the draw and kickoff.** Publish the draw results after the full 48-hour recruitment window, then allow at least 24 real hours before the first lineup deadline. For example, recruitment could open Monday at noon, the draw could settle Wednesday at noon and the lineup deadline could fall Thursday at noon, all UTC. If settlement is delayed, move the affected deadline so managers still have the full day. Require explicit approval for the purchase and an explicit lineup submission, which can be made in advance.

On 22 November 2026 the founder approved the balanced starter squad draw, the hold on the original player until a replacement is confirmed, and a minimum of 24 real hours from publication of draw results to the affected clubs’ first lineup deadline.

<a id="first-live-squads"></a>

## First permanent squads · all three rules agreed

Production tasks: [S08-01](backlog.md#s08-01) · [S08-02](backlog.md#s08-02) · [S08-03](backlog.md#s08-03).

- **Reserve affordable stock before invitations.** Test the starter pool against 80 simultaneous take-ups of the one-click 18-player squad. Provide 1,440 distinct available footballers with the required position cover in total. Protect each club’s ability to field a legal eleven and bench for at most the 3.8M BB reference purchase price, with first payroll affordable from its 5M bursary. Managers can still build their own squads.

- **Equal access across tiers.** Open optional recruitment to both tiers together after the final qualifier results. Publish prices, wages and scouted potential ranges and allow at least 48 real hours before the first funded league lineup is due. The qualifying squads are temporary. Founding rank and qualifying position confer no priority in the starter pool.

- **Competing claims on scarce prospects.** For the optional prospect swap, give each eligible control group one first-round choice at a published fixed price. Check the fee and wage reserve. Use a reproducible public draw for each contested player after the window closes. A losing club keeps its affordable squad option and its reserved funds are released. Process unclaimed prospects in a later window.

The founder approved the starter squad guarantee, the minimum 48-hour recruitment window and the first-round prospect draw on 22 November 2026.

<a id="ten-club-payout"></a>

## Ten-club league payments · agreed

Production tasks: [S02-01](backlog.md#s02-01) · [S09-04](backlog.md#s09-04) · [S09-05](backlog.md#s09-05).

Both tiers pay 8,000 BB to each eligible club per scheduled league fixture. Keep the 1,000 BB result pool per completed fixture and 20,000 BB season-completion award. For the normal 18-fixture schedule, a club that finishes the season ready for at least 16 fixtures qualifies for completion and its finishing-place award. Apply the agreed forfeit and no-contest rules. Any unearned award stays in the treasury. Preseason qualifiers earn no BB.

| Place | BB | Place | BB |
| --- | --- | --- | --- |
| 1st | 14,000 | 6th | 6,000 |
| 2nd | 12,000 | 7th | 5,000 |
| 3rd | 10,000 | 8th | 3,000 |
| 4th | 9,000 | 9th | 2,000 |
| 5th | 8,000 | 10th | 1,000 |

The maximum division payout is 1.8M BB: 180 eligible club appearances × 8,000, 90 match result pools × 1,000, ten completion awards × 20,000 and 70,000 in placement prizes. A club losing all 18 completed matches earns 165,000 BB in tenth, leaving 57,400 BB after a 107,600 BB reference payroll. The founder approved the appearance rate and the full placement ladder. Founder-season model

<a id="inaugural-seeding"></a>

## Inaugural three-match qualifier · agreed

Production tasks: [S09-01](backlog.md#s09-01).

Use a one-off preseason qualifier. For the approved 80-club intake, the following draw fits the format. Lock the eligible field after the invitation window and publish the draw method, standings rules and schedule before play. Draw 20 groups of four using a published, reproducible random draw. Assign five groups to each of the four tier pairs before results are known.

Each club plays its three opponents once on neutral grounds. Use identical temporary squads, benches, fitness and preparation time. Managers choose the eleven and tactics and can submit in advance. Seed the divisions from these results alone. Qualifiers award no BB or player progression and do not count towards the 18 league fixtures or readiness. Use three preseason match dates with a reserve date for service disruptions.

A win earns three points and a draw one. Rank by points, goal difference and then goals scored; if still tied, use the published draw procedure. Play each group’s final fixtures simultaneously. The top two from each group qualify for its upper division and the other two enter its lower division. Five groups supply ten clubs to each division. Both tiers receive the same founder term and reward schedule. After the inaugural placement, use the agreed sporting moves and bottom-tier entry for newcomers.

<a id="founder-launch"></a>

## Opening the funded leagues · all three rules agreed

Production tasks: [S06-03](backlog.md#s06-03) · [S23-04](backlog.md#s23-04) · [S23-05](backlog.md#s23-05).

- **Backing the public offer.** Before confirming founder entitlements for the full 100,000, ring-fence the modelled 782.5B BB for bursaries, presentation credits and 15 seasons of rewards. During an earlier limited pilot, confirm only as many funded entitlements as the treasury can cover. Show anyone waiting whether they have an interest-list entry or a confirmed founder registration. Publish the cash and SOL operating budgets separately.

- **First live intake.** Test 80 clubs in eight ten-club divisions on the same calendar. At the approved ten-club rates, their lifetime commitments total at most 636M BB: 400M in bursaries, up to 20M in early-registration credits and 216M in league rewards. The opening season’s reward pool is 14.4M BB. Count all of this within the programme reserve.

- **First expansion.** Review expansion after the first complete season and wage rollover. As a playtest threshold, look for at least 64 of the 80 clubs ready for 16 of 18 fixtures. Reconcile all grants, earned rewards and wages, resolve material settlement discrepancies, and apply the agreed two-season expansion stress test. Set the next intake to complete divisions that the funded budget, network-fee balance and actual verification and support capacity can handle. If a condition fails, keep existing commitments and address it before issuing more invitations.

All three launch choices are approved for the pilot. The genesis supply and treasury split remain model inputs.

<a id="division-format"></a>

## Ten clubs, home and away, two up and two down · agreed

Production tasks: [S09-02](backlog.md#s09-02) · [S09-03](backlog.md#s09-03) · [S09-04](backlog.md#s09-04).

Eight is the minimum for a funded division and the baseline for the current 28-round playtest. Seven opponents played four times each gives 28 matches per club and finishes on competition day 40, leaving five reserve days. Ten clubs playing nine opponents four times would need 36 rounds and finish on day 52 at the same cadence, beyond the 45-day competition window. Ten clubs playing home and away instead gives 18 rounds and nine different opponents. [Playtest calendar](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0012-use-a-shared-compressed-world-clock.md)

For the approved 80-club launch, use eight divisions of ten with 18 rounds. The approved schedule pays 8,000 BB per eligible appearance, 1,000 per completed match for results, 20,000 per qualifying club for completion and 70,000 across ten finishing places. Fully paid, this costs 1.8M per division and 14.4M for all 80 clubs. The 85% threshold becomes 16 of 18.

The matchday PR’s pyramid design already specifies promotion and relegation at rollover, scheduled moves before vacancies, and new clubs entering at the bottom. The number of places at each boundary is published before kickoff. The 80-club pilot uses four parallel groups, each with an upper and a lower division. Promote the top two from each lower division and relegate the bottom two from its upper division. A relegated founder keeps its club and remaining funded seasons. The club count, fixture count and two automatic places each way were approved. The preseason qualifier determines inaugural tier placement. The approved launch size is 80 clubs. [League pyramid rules](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0011-fill-vacancies-through-the-league-pyramid.md)

<a id="founder-place"></a>

## A founder’s league place · all three rules agreed

Production tasks: [S07-03](backlog.md#s07-03) · [S09-03](backlog.md#s09-03).

- **First invitation.** Invite qualifying clubs in registration order once a funded division is ready. Show the schedule and give managers at least 72 real hours to accept before kickoff. If the offer expires, invite the next ready founder. Preserve the original premium and allow the manager to opt back in for a later intake. Release the grant and start season one only on accepted funded admission. An expired invitation neither consumes a season nor opens a new founding registration.

- **A season the club misses.** Count a season that Ballerz makes available on the published terms and the eligible club voluntarily skips. For example, after six completed seasons, voluntarily missing season seven leaves eight. If Ballerz cannot offer that eligible club a funded division, preserve the unused season and extend its end date. The same 15-season BB reserve covers the later place; the operating calendar may extend. Keep ordinary fixture forfeits and readiness rules within a season.

- **After season 15.** Keep the club, its history and the free league route. Publish the next funded-season decision by the start of season 15 so managers can plan renewals. Promise further BB rewards only against a separately approved, funded budget. Free participation does not waive wages already due or guarantee renewal of a paid player.

The founder approved all three league-place rules on 21 November 2026.

<a id="transfer-followup"></a>

## What carries over when a player moves · all three rules agreed

Production tasks: [S10-02](backlog.md#s10-02) · [S11-03](backlog.md#s11-03) · [S12-05](backlog.md#s12-05).

- **Transfers under common control.** If an otherwise eligible connected club buys the footballer, send the fee to the treasury up to the outstanding grant and carry any unpaid grant claim on the player. Disclose it before confirmation. With 200,000 BB outstanding and a 150,000 BB price, 50,000 BB would follow the player. A later genuine sale to an independent buyer would settle that remainder under the approved rule.

- **Unused wage reserves.** Track how much of a wage reserve came from the bursary and how much came from ordinary club funds. Allocate accrued wages proportionally and release each unused portion back to its original balance. The purchase grant claim is separate. Selling a starter early cannot convert restricted payroll BB into withdrawable proceeds.

- **Re-signing after expiry.** Preserve the existing public free-agent process and the former club’s equal right to apply. Keep a record of the unpaid purchase grant when the player returns to treasury. If the former control group wins the player back directly from that pool, restore the claim on the player. If an independent group wins legitimately, close the old grant claim and give the new club a clean registration. The outgoing club receives no fee and owes no grant shortfall.

All three rules above were approved on 21 November 2026.

<a id="grant-loss"></a>

## Independent sale below the outstanding grant · agreed

Production tasks: [S11-03](backlog.md#s11-03).

The founder rule replaces the earlier pilot requirement that the seller cover a shortfall from unrestricted BB on a genuine independent sale.

On a completed genuine sale to an independent buyer, pay the treasury the lesser of the sale price and the outstanding grant-funded purchase amount. Pay any excess to the seller. Record any unrecovered grant as a treasury loss, clear the claim on that player, and leave the club’s lifetime bursary used. With a 200,000 BB outstanding grant and a genuine 150,000 BB sale, the treasury receives 150,000 BB, the seller receives zero and the treasury writes off 50,000 BB. The sale creates no arrears or transfer ban. Accrued wages remain payable. The founder guarantee already assumes zero resale receipts.

A below-grant transfer under common control cannot trigger a write-off. If evidence suggests a related or collusive sale, hold settlement for review with a reason and an appeal. A falling price alone is insufficient to establish abuse.

<a id="founder-seasons"></a>

## Two years of founder football · approved for playtesting

Production tasks: [S06-03](backlog.md#s06-03) · [S07-03](backlog.md#s07-03) · [S09-04](backlog.md#s09-04) · [S10-01](backlog.md#s10-01).

Reserve 15 full 52-day seasons for each founder from its first funded admission. Each entitlement lasts 780 days. Staggered admissions can extend the operating calendar. Keep the 100,000 lifetime limit and count a place once through wallet recovery, inactivity or club resale. Ring-fence prospective obligations before opening places. Editable rewards, wages and treasury tests

| Approved playtest rule | Test at full participation |
| --- | --- |
| Earlier eight-club reward schedule | 5,000 BB per eligible club per fixture. Split a 1,000 BB result pool between the clubs on a draw, or pay it to the winner. Pay 20,000 for season completion at 85% readiness. Use a 48,000 BB placement pool per eight-club division, with prizes of 12,000, 10,000, 8,000, 6,000, 5,000, 4,000, 2,000 and 1,000. Apply existing completion eligibility to placement and preserve the published forfeit rules. The fully funded division costs 1.44M per season. |
| Wage anchors | Test annual BB rates of 3,000, 5,000, 10,000, 20,000 and 40,000 at ability 0, 250, 500, 750 and 1,000. Interpolate between anchors using the approved eight-week median and renewal notice. The illustrative 18-player mix (six at 200, eight at 300 and four at 400) costs 107,600 BB. Renewals depend on available funds and the new quoted wages. Free academy replacements preserve the ability to field a side. |
| Whole-cohort budget | 500B BB for ordinary bursaries, up to 12.5B for founding benefits and 270B for 15 fully rewarded seasons. Total 782.5B, leaving 117.5B out of the modelled 900B game allocation, before other commitments. Assumes the 5M bursary can pay the reference squad’s 3.8M price and first payroll. The old 100.4B wage top-up is unnecessary at the new rates. Keeping that amount ring-fenced as a contingency would leave 17.1B otherwise available. Operating cash and SOL remain separate. |

<a id="founder-claim-protections"></a>

## Approved protections against duplicate founder claims

Production tasks: [S07-02](backlog.md#s07-02) · [S07-04](backlog.md#s07-04) · [S07-05](backlog.md#s07-05).

- Keep ordinary play open. At funded registration, use a private, game-specific unique-person credential plus the common-control check. Give applicants an alternative evidence route and human review. Use a single claim record across providers, recovery and wallet changes. Publish ranking and appeal procedures, retain the verified application time for delays on Ballerz’s side, and keep identity documents off-chain.

- Route restricted grants directly to published starter prices and wage escrow. Keep kit and media credits restricted to approved treasury-priced products. Track the grant-funded share of acquired players. Give the treasury first claim on resale proceeds, including after the first season. Carry outstanding restrictions through club sales, loans and wallet recovery. This replaces the earlier pilot rule that a qualifying first season earned the purchase subsidy.

- Approve fixtures and eligibility before settlement. Disallow funded fixtures between clubs under common control, settle each club-fixture reward once and keep scheduled offline lineups eligible. Review linked signing authorities, transfers and withdrawal destinations. A shared address, network or household alone is insufficient. Give managers reasons and an appeal, hold only disputed funds and preserve ordinary fixtures. Sample approved accounts to estimate missed abuse and track false positives by appeal outcomes.

Calibrate the approved rates using actual roster ability distributions, growth, hardship cases and false exclusions during the playtest. [Identity proofing, fraud management and redress reference](https://pages.nist.gov/800-63-4/sp800-63a.html)

<a id="founding-clubs"></a>

## Founding-club admission and sliding scale · agreed

Production tasks: [S07-01](backlog.md#s07-01) · [S07-03](backlog.md#s07-03) · [S07-05](backlog.md#s07-05).

Use the first 100,000 qualifying clubs. For the modelled 5 million BB starter bursary, a restricted one-time credit falls in a straight line from 250,000 BB at rank 1 to zero at rank 100,000. The founder approved the 5% maximum, the use for club presentation and continued league participation. Editable founding-club model

Use the order of qualifying registrations, one per control group. Preserve that place while the club waits for funded admission. Activate the credit when it takes its first funded league place. A founding kit or club media package are example uses. The next intake can still use the existing free route.

| Funding question | Result at 100,000 clubs |
| --- | --- |
| What covers all founding packages? | 500B BB in ordinary bursaries, 100.4B in illustrative opening wage support and up to 12.5B in early-registration credit. Total 612.9B, leaving 287.1B from the proposed 900B game allocation. |
| Can every founder play one funded season during the two years? | At pilot reward rates, this costs a further 265.425B BB and leaves 21.675B. Stagger admissions in whole divisions. Returning clubs need a funded renewal or a free playing route. |
| Can everyone earn the pilot rewards for all 15 seasons? | Full-duration rewards and joining support cost 4.594275 trillion BB assuming zero receipts. Decide the guarantee before publishing the founding offer. |

The figures in this comparison use the earlier pilot reward and wage rates. The current founder-season proposal above prices continued participation at revised rates.

<a id="bootstrap"></a>

## Two real-world years of funding · pilot baseline

Production tasks: [S06-03](backlog.md#s06-03) · [S06-04](backlog.md#s06-04) · [S06-05](backlog.md#s06-05).

Use the first live funded season as day one for modelling. At 52 real days per season, fourteen seasons cover 728 days. If admission continues through the two-year anniversary, season 15 opens on day 729 and its promises run through day 780. Keep the two-season expansion test as a separate check before adding a division. Editable bootstrap budget · [Playtest clock](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0012-use-a-shared-compressed-world-clock.md)

**Genesis scenario.** Minting 1 trillion BB and setting aside 10% gives the main treasury 100 billion BB and leaves 900 billion BB for potential allocations. Proposed treatment: disclose a separate game reserve, ring-fence the measured runway, and leave the rest locked pending a later budget. Only release funded grants and earned rewards under the published rules. The total supply, split and reserve size are modelling inputs.

| Modelled case | BB requirement | Assumptions |
| --- | --- | --- |
| Eight clubs, first season | 69.266 million | 40 million in one-time restricted bursaries, 8.032 million in proposed first-term wage support and 21.234 million in fully funded rewards. |
| Eight clubs over 15 seasons | 366.542 million | Same clubs throughout. All fixtures and awards pay in full. No token buyers, sponsor funding, further minting or treasury receipts are needed. |
| One new qualifying club replaces one departing club each season after launch | 450.598 million | Fourteen extra entrants at 6.004 million each. Funded seats and season rewards stay constant. |
| Eight continuing clubs, full wage recycling | 119.694 million opening reserve | Illustrative sensitivity. All benchmark wages settle and are available for the following season’s rewards. Starter receipts stay restricted to future bursaries. Use the zero-receipt figure for the proposed guarantee. |

**Decisions open.** Choose the number of funded clubs to guarantee at launch and by month 24, the allowance for replacement clubs, and whether the remaining grant can fund wages with a restricted first-term top-up. Model operating cash and network fees separately. Extend those operating budgets through the end of the final advertised season. The workbook leaves actual costs open pending estimates.

<a id="pilot-treasury"></a>

## Funding the first live pilot · all four rules agreed

Production tasks: [S06-01](backlog.md#s06-01) · [S06-02](backlog.md#s06-02) · [S23-04](backlog.md#s23-04) · [S23-05](backlog.md#s23-05).

The season’s advertised rewards must be funded before enrolment. These rules govern budget priorities, spending authority and expansion during the pilot.

| Decision | Agreed pilot rule |
| --- | --- |
| 1 · Source of funds | Start the first live pilot with a finite, disclosed allocation of actual BB in the Ballerz treasury. Record its source, including any approved initial issuance. Once the pilot begins, offer no mid-pilot minting to cover shortfalls. Keep sponsor deposits, recycled club payments and fresh issuance distinct in the ledger. |
| 2 · Budget priorities | Ring-fence existing promises and respect sponsor restrictions. Before offering fresh discretionary rewards, budget for a published number of starter bursaries. Keep bursary and reward allocations distinct. Other clubs retain the agreed free playable squad route. Track the SOL network-fee budget separately. |
| 3 · Spending authority | Require two of three independent treasury signers to approve the pilot budget, a new spending category or a transfer between uncommitted budgets. Within an approved pool, let the programme settle qualifying payments under the published rules. Show each pool’s opening balance, commitments, actual payments and remaining available balance. |
| 4 · Expansion test | Before adding another funded division, model two seasons with no new sponsors, token buyers or further issuance. Count only receipts that the scenario actually settles and identify recycled BB separately. Expand funded commitments only if all existing and proposed promises can be met. Show how many bursaries and rewarded fixtures the opening reserves support. |

For example, with 100,000 BB in treasury, 60,000 already committed to prizes and 25,000 allocated to bursaries, 15,000 BB remains for new discretionary commitments.

<a id="connected-clubs"></a>

## Connected clubs and fair access · all three rules agreed

Production tasks: [S07-04](backlog.md#s07-04) · [S12-04](backlog.md#s12-04) · [S23-03](backlog.md#s23-03).

The matchday PR already limits an owner wallet to one starter bursary, one funded seat across a league’s divisions and one club still in contention in a cup edition. The following proposals address control of multiple wallets and free-agent claims. [Funding rules](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0009-fund-first-squads-with-ballerbuckz.md) · [Cup ownership rules](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0002-represent-teams-as-transferable-nfts.md)

- **Common control.** Permit ownership of multiple clubs where competition rules allow it. For pilot eligibility, treat clubs with the same ultimate decision-maker for transfers as one owner group for bursaries, funded league seats and scarce free-agent opportunities. Family ties, a shared internet connection or tactical advice alone are insufficient to link clubs.

- **Draw entries and signing limits.** Keep the approved two-signing cap per club. Add one draw entry per free agent and two signings per rolling seven real days across each commonly controlled group. The owner chooses which club claims. On a club sale, past signings still count against the club and the group that made them until their windows expire. Disclose remaining club slots to the buyer.

- **Review and recourse.** Record a reason and give the affected managers a way to correct or contest the link. During a time-sensitive dispute, allow one provisional entry for the group, release duplicate reservations and keep ordinary fixtures available. Apply a wider sanction only for established abuse under the relevant rules.

The founder approved common-control eligibility, limits across the group and the process for contesting a link.

<a id="pool-operations"></a>

## Running the free-agent pool · agreed for playtest

Production tasks: [S12-01](backlog.md#s12-01) · [S12-04](backlog.md#s12-04) · [S12-05](backlog.md#s12-05).

| Decision | Agreed playtest rule |
| --- | --- |
| 1 · Fit the notice period to the wage calendar | Fix the next wage using the latest eight weekly snapshots available when the binding quote is issued, at least 72 real hours before the scheduled renewal deadline. It takes effect with the new term. Footballers keep developing during notice. If Ballerz publishes late or raises a mistaken quote, extend the deadline so the club gets 72 hours at the final price. Treasury release waits until that deadline passes. |
| 2 · Concentration across different footballers | Test a maximum of two new free-agent signings per club in any rolling seven real days. Each outstanding wage-backed claim temporarily uses one remaining signing slot; a lost or withdrawn claim releases it. Keep the single-claim-per-club rule for each footballer. This limits accumulation by one club; linked clubs require separate integrity checks. |
| 3 · Unclaimed footballers | If the initial 24-hour window closes without an eligible claim, leave the footballer visible in treasury custody. The next eligible funded claim starts a fresh, public 24-hour window. While unattached, age and retirement continue, and club training, appearances and service credit pause. |

The founder approved all three choices. A synthetic boundary check blocked a third outstanding claim, released a slot when a claim lost, and restored slots individually 168 hours after each successful signing. This checks the proposed counting rule only. For the playtest, record blocked eligible claims, unique clubs signing, concentration of signings and footballers still unclaimed after their window. Compare caps of one, two and three against the same recorded demand before changing the pilot limit.

<a id="free-agents"></a>

## From contract expiry to a new club · all four rules agreed

Production tasks: [S12-01](backlog.md#s12-01) · [S12-02](backlog.md#s12-02) · [S12-03](backlog.md#s12-03) · [S12-04](backlog.md#s12-04).

**Agreed contract requirement.** The paid contract must encode the treasury return at expiry. The former club loses control of the NFT and the right to sell, loan or field the footballer. The NFT identity and career record persist. This requirement applies to a surviving footballer on a paid term. Retirement and the separate permanent club-bound status of the free fallback and continuity squads retain their existing rules.

**Implementation acceptance case.** Record the treasury destination, expiry and renewal conditions at signing. Provide a settlement operation that can be submitted after the deadline and safely retried. A valid, funded renewal received before cutoff preserves the club’s rights. Otherwise, settle one treasury return and publish one free-agent entry without requiring the former owner’s signature. Invalidate stale sale listings and permissions. While settlement is pending, prevent competing claims or a sale by the old club. A cleared past obligation stays cleared; an unpaid accrued obligation remains due.

| Decision | Agreed rule |
| --- | --- |
| 1 · Renewal notice | Set the paid contract’s renewal and release deadline at signing. Give the club at least three full real days (72 hours) from publication of the final renewal wage to the deadline and honour any existing renewal cap. |
| 2 · Price and eligibility | Signing a free agent carries a zero transfer fee. No sale proceeds go to the former club. Require a full reserve for the remaining wages, a human approval and eligibility under the transfer ban before accepting a claim. |
| 3 · Competing claims | Open a published 24-real-hour claim window. Hold wages for each valid claim, accept one claim per eligible club per footballer and use a published, verifiable draw if several qualify. Settle one registration, release losing reservations and apply the usual team-sheet cutoff. The former club may apply on equal terms if eligible. |
| 4 · Immediate resale | For the pilot, bar outgoing sales and loans of a newly signed free agent for seven real days from signing, including across a wage-year boundary. Display the release date before a club commits. Test whether this discourages resale farming without trapping a club in a poor sporting decision. |

All four free-agent rules and the contract-enforced treasury return are agreed. The renewal notice precedes release and the claim window follows it.

**Terminology.** “Funded game” in earlier entries means the planned live Baller Bucks economy. In the playtest, clubs use test BB with no automatic conversion at launch. In the live economy, a quoted BB payment must be covered by actual tokens in a wallet, treasury or escrow. Ordinary football remains free. A “funded season” specifically has its promised BB reward pool set aside before enrolment.

<a id="wage-growth"></a>

## Wage growth and manipulation resistance · direction agreed

Production tasks: [S10-01](backlog.md#s10-01) · [S12-01](backlog.md#s12-01).

ADR 0009 ties a paid footballer’s wage to current ability, locks the rate for the wage year and carries it through transfers. Its four illustrative annual rates are 76,000, 152,000, 304,000 and 608,000 BB, with a 304,000 BB minimum for designated wonderkids. The agreed design keeps the annual lock, uses a gradual curve and removes the special minimum. The agreed free fallback and academy continuity route remains available. [Earlier playtest wage rules](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0009-fund-first-squads-with-ballerbuckz.md)

- **Measure ability.** Take one server-recorded underlying current-ability observation per in-game week per footballer ID, whether fielded, benched, injured or on loan. Use a fixed ability calculation independent of the manager’s selected role. Exclude short-term condition and morale. Use the median of the last eight observations at annual rollover; use available history for newcomers, including a verified mint assessment when no weekly history exists. Eight weeks is a test parameter.

- **Set the rate.** Publish the ability-to-BB curve and its effective year in advance. Interpolate between anchor rates; round only the final annual figure. Example segment only: 500 ability maps to 152,000 BB and 700 to 304,000 BB. At 550 the rate is 190,000 BB. Within that segment a one-point change is 760 BB. Rising or declining underlying ability can move the rate in either direction. Remove the wonderkid wage floor so the salary cannot disclose hidden potential.

- **Apply and explain.** Reprice once per footballer at the shared rollover. Midyear transfer, loan, owner change, inactivity or re-registration cannot reset the wage year, rate or ability history. Give a newly minted footballer their initial rate once. Keep the current rate locked and show a separately labelled next-year estimate. Record the snapshots, rule version, effective year and resulting wage; reproduce a disputed calculation from those inputs.

**Abuse and balance checks.** Transfer price, bids, friendly volume, match awards and supporter activity carry no direct wage weight. Test that related-wallet sales, a last-minute formation change, short injury or late-season benching with identical underlying ability leave wages unchanged. Test that sustained genuine development or decline changes wages. Compare complete club wage bills with the funded season budget over multiple simulated seasons. The upstream development engine also needs limits and reliable input records. Verify training and competitive experience once per event and apply the agreed workload caps. A tamper-evident wage record cannot correct an inflated underlying attribute.

The founder approved a gradual wage curve, the median of eight in-game weekly ability readings for the playtest, and removal of the wonderkid wage floor. The numeric ability anchors and BB rates remain illustrative pending balance tests.

<a id="after-transfer"></a>

## After the first transfer · agreed with amended expiry rule

Production tasks: [S10-02](backlog.md#s10-02) · [S10-04](backlog.md#s10-04) · [S12-01](backlog.md#s12-01) · [S12-02](backlog.md#s12-02).

| Decision | Agreed direction |
| --- | --- |
| 1 · Renewing a paid registration | Show an advance estimate and the season-end decision deadline. Once the new wage rate is published, require the authorised manager to confirm it or use an explicit pre-approved renewal with a BB ceiling. Reserve the new term only if the rate fits the approval and eligible funds cover it. Otherwise let the previous term expire. |
| 2 · What expiry means for ownership and football | At unrenewed expiry the smart contract returns the footballer NFT to the Ballerz treasury as a free agent. The former club’s registration and sale authority end. Preserve the footballer’s career history. A subsequent signing uses the free-agent process. |
| 3 · Wage reserve on resale | At confirmed transfer, keep the old club’s accrued wage share reserved until wage settlement, release its unused future portion to that club, and fund the buyer’s remaining term separately. Example: of 30,000 BB reserved, 12,000 BB accrued stays reserved and 18,000 BB is released when the buyer funds the 18,000 BB remainder. Align the changeover with confirmed ownership. [Existing wage attribution](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0009-fund-first-squads-with-ballerbuckz.md) |
| 4 · Owner withdrawals | Start with a separate, owner-authorised withdrawal to the registered owner wallet. Display the amount available after restricted grants, sponsor restrictions, wage reserves, escrows and unpaid obligations, counting each commitment once. Block withdrawals during unresolved arrears or active recovery. Recheck available funds at confirmation and show the club’s balance after the withdrawal. |

All four rules apply to the live Baller Bucks economy. Routine expiry creates no arrears for a new term the club never accepted. The treasury return supersedes the earlier proposal for the club to retain an inactive NFT.

<a id="first-real-transfer"></a>

## The first real transfer · all five rules agreed

Production tasks: [S05-04](backlog.md#s05-04) · [S11-01](backlog.md#s11-01) · [S11-02](backlog.md#s11-02) · [S11-04](backlog.md#s11-04) · [S11-06](backlog.md#s11-06).

Worked example only: Northbank lists a tradeable winger for 100,000 BB. Eastport must fund the price and reserve 30,000 BB in remaining wages. With no marketplace fee or outstanding subsidy in this example, Eastport commits 130,000 BB, Northbank receives 100,000 BB in its club treasury and 30,000 BB stays reserved for wages. The buyer sees whether the footballer is eligible for the next fixture.

| Decision | Agreed launch rule |
| --- | --- |
| 1 · Custody, signers and proceeds | Start with club-owned footballers only. A club-controlled account holds the NFT and treasury funds. An authorised human seller approves the identified footballer, fixed price, deductions and expiry. An authorised human buyer approves the total commitment. A coach or sporting role alone conveys no signing authority. Sale proceeds go to the club treasury; personal withdrawals require a separate policy and authorisation. Restricted balances and wage reserves are unavailable to withdraw. |
| 2 · Recovery | Let the owner nominate a separate recovery signer in advance. After a device loss, notify the owner, allow a delay for challenge, then rotate the club’s signing key. Suspend new outgoing transfers and invalidate open listings from the old signer during recovery. Preserve the club, its records and already settled deals. Support can assist but cannot move an NFT on its own. |
| 3 · Fees | For the first funded pilot, use a capped Ballerz-funded SOL fee account and charge zero marketplace commission. Disclose the fee payer before signing. If sponsorship runs out, pause new sponsored trades; ordinary free football continues. Later commissions require a separate decision. |
| 4 · Listing and competing buyers | A seller may cancel before execution. A price change creates new terms. At settlement check current title, listing version, expiry, buyer’s transfer eligibility, funds, wage reserve and seller’s subsidy obligations. The first valid purchase to settle wins. Settle payment, title and required reserves as one operation. The losing buyer retains BB and has no continuing wage hold. Display gross and net proceeds if subsidy repayment or arrears apply. |
| 5 · Delays and team sheets | Give both parties one transfer reference. While settlement is uncertain, show Pending, permit status checks and reconcile the original reference before retrying. Use the recorded time of successful settlement once finality is verified. Only a transfer effective strictly before the existing team-sheet deadline can qualify the buyer’s footballer for that fixture, subject to a valid timely sheet. A deal effective exactly at or after cutoff applies to a later fixture. Process financial title and sporting eligibility as distinct records. |

The founder approved all five rules for the first funded pilot. The agreed transfer-ban rules allow a distressed seller to sell and prohibit a banned buyer from acquiring the footballer. [Transfer ban](#transfer-ban) · [Team-sheet cutoff](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0012-use-a-shared-compressed-world-clock.md)

<a id="season-decisions"></a>

## Season continuity and funding · agreed

Production tasks: [S06-02](backlog.md#s06-02) · [S08-04](backlog.md#s08-04) · [S09-05](backlog.md#s09-05) · [S10-02](backlog.md#s10-02).

PR #2 already defines fixture-only AI cover and requires a club’s own legal eleven for next-season entry. The founder-approved transfer ban permits promotion only from an already registered academy. The questions below address the gap between emergency cover today and owning an eligible squad at rollover. [Squad cover and first-season funding](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0009-fund-first-squads-with-ballerbuckz.md)

| Priority | Question | Agreed direction |
| --- | --- | --- |
| 1 · Squad continuity | How can a club in arrears meet the rollover requirement after a wave of retirements? | Maintain a small, free, club-registered academy reserve throughout the season, including goalkeeper cover. Before rollover, flag projected shortages and allow promotion of already registered prospects. Test whether clubs can field their own eligible eleven under mass retirement. Keep fixture-only AI cover under its existing rules. |
| 2 · Resale eligibility | Can the free fallback squad or reserve cover eventually be sold? | For launch, make these specific footballers permanently club-bound for individual transfers and loans. They can play, train and build a career record. A whole-club sale preserves the restriction. Standard funded starter signings and eligible intake NFTs retain their own rules. Show the restriction before selection. |
| 3 · Paid contracts | Before a manager makes a paid signing, how much of the wage commitment must be available? | Reserve the fee and wages through the end of the current wage year before confirming. Show the maximum commitment up front. At rollover, require a funded renewal before taking on a new paid term. Unrenewed paid footballers return to the treasury as free agents. Existing arrears retain their agreed treatment. |
| 4 · Season funding | What happens to ordinary fixtures if the reward treasury is short before opening day? | Publish and ring-fence the complete promised prize and match-payment budget before teams opt into a funded season. If funds fall short, offer ordinary competition with disclosed lower or zero BB rewards before enrolment. Honour already funded terms throughout the season. |

Free-agent signing, renewal notice and pool operating rules are agreed for playtesting. Supply, issuance and treasury runway need modelling before a live token economy. Growth weights, training slot counts and AI pricing need playtest evidence.

<a id="foundations"></a>

## Agreed foundations

Production tasks: [S05-03](backlog.md#s05-03) · [S06-01](backlog.md#s06-01) · [S08-01](backlog.md#s08-01) · [S08-04](backlog.md#s08-04).

| Decision | What follows from it | Basis |
| --- | --- | --- |
| Build a persistent football club | The squad changes over time. The club keeps its identity, achievements and history. | Product handover, §§2–5. |
| Core football is free | A user can found a club, field a playable squad and enter ordinary competition with an empty treasury. The exact continuity mechanism is open. | Product handover, §§3, 5–6. |
| Spendable Baller Bucks must be funded | Commercial receipts and prizes need an identifiable source of funds. Football results and follower counts can be simulated without crediting a wallet. | Product handover, §§7–10 and economy v0.2. |
| Solana is the intended settlement platform | Ownership and economic settlement need verifiable records. Match simulation can run in game services. Custody, issuance, fees and launch timing remain open. | Product handover, §§3, 22. |
| Users can enter or generate a club name | The club has a persistent identity. Reservation, review and release rules still need design. | Product handover, §§15–19. |
| Manual management and scoped delegation | A user can manage the club manually. Optional AI staff can help with named duties. Spending authority requires explicit limits and approvals. | Product handover, §14. |

<a id="manager-loop"></a>

## Decision 1 · Why managers return

Production tasks: [S03-01](backlog.md#s03-01) · [S14-05](backlog.md#s14-05) · [S17-01](backlog.md#s17-01) · [S22-01](backlog.md#s22-01).

A manager backs a footballer, gives them opportunities and follows what happens. A winger’s first assist matters now because the club is chasing promotion. It matters seasons later because the club remembers who helped it go up. Training, selection and match reports should make that connection visible. Development rates, academy rules and the match engine remain open.

<a id="scheduled-attendance"></a>

## Decision 2a · Scheduled kickoff, optional attendance

Production tasks: [S03-01](backlog.md#s03-01) · [S04-01](backlog.md#s04-01) · [S04-02](backlog.md#s04-02).

An ordinary league fixture takes place at its published time even if either or both managers are offline. Each manager can prepare in advance. Clubs in different time zones can compete without arranging a time when both users can attend.

<a id="matchday-baseline"></a>

## Matchday baseline · PR #2

Production tasks: [S03-01](backlog.md#s03-01) · [S03-02](backlog.md#s03-02) · [S03-03](backlog.md#s03-03) · [S03-04](backlog.md#s03-04) · [S03-05](backlog.md#s03-05).

Read at commit 9f2bd1d . The PR is open against main. Its two-manager playtest is executable, and all 67 Node tests passed on the reviewed snapshot. Several season-level rules are design decisions for the first live league. [Pull request](https://github.com/DarthShoge/Ballerz-NFT/pull/2) · [Matchday playtest guide](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/matchday/README.md) · [Shared clock and first league schedule](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0012-use-a-shared-compressed-world-clock.md)

| Earlier question | What the PR establishes | Evidence |
| --- | --- | --- |
| 1 · Live intervention | Managers can change roles, positions, marking and tactics during play. Substitutions take effect at eligible stoppages. Automatic changes exist. A manager-authored rule such as “bring on my winger if level after 65 minutes” remains an optional extension. | [Matchday playtest guide](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/matchday/README.md) |
| 2 · Frequency | First live league design: four daily rounds followed by two rest days, repeated seven times. The shared clock advances one game week per real day. | [Shared clock and first league schedule](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0012-use-a-shared-compressed-world-clock.md) |
| 3 · Viewing time | Two five-minute halves plus one real minute at halftime, about 11 minutes before added time. | [Matchday playtest guide](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/matchday/README.md) |
| 4 · Lock and reveal | Scheduled sheets lock 30 real minutes before kickoff. The complete opponent plan remains private until full time. The live action still shows footballers and positions. | [Matchday playtest guide](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/matchday/README.md) · [Scheduled-fixture tests](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/matchday/test/scheduled-fixtures.test.mjs) |
| 5 · Missed selection | The last valid sheet submitted for that fixture is used. One missing sheet means a 3–0 forfeit. Two missing sheets mean a double forfeit. The separate league design allows a nominated replacement for a starter who becomes unavailable before lock on a timely submission. | [Scheduled-fixture tests](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/matchday/test/scheduled-fixtures.test.mjs) · [Shared clock and first league schedule](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0012-use-a-shared-compressed-world-clock.md) |
| 6 · Tactical depth | The team sheet offers 14 formations for each phase, 11 styles and 12 team instructions, with individual roles and orders. | [Matchday playtest guide](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/matchday/README.md) |
| 7 · Viewing format | Continuous live 2D pitch, commentary, player ratings and statistics, including a shot map. Both managers see the same clock and score. | [Matchday playtest guide](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/matchday/README.md) |
| 8 · League size | Eight clubs and 28 rounds in the first league design. Seven preseason days and 45 competition and reserve days fit into a 52-real-day year. The playable branch runs individual fixtures between fixed squads. League tables and administration are later work. | [Shared clock and first league schedule](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0012-use-a-shared-compressed-world-clock.md) · [Matchday playtest guide](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/matchday/README.md) |

**Carry forward.** Retirement, service, succession claims, prospect rankings and youth allocation already have detailed design rules. Before discussing economics, reconcile the game-only BB playtest with the handover’s funded Solana currency. The target relationship between them is open. [Finite careers and youth intake](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0010-generate-footballers-with-finite-careers.md) · [First-squad funding](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0009-fund-first-squads-with-ballerbuckz.md)

<a id="development"></a>

## Footballer development and ownership

Production tasks: [S13-01](backlog.md#s13-01) · [S13-04](backlog.md#s13-04) · [S14-04](backlog.md#s14-04) · [S14-05](backlog.md#s14-05).

The career decision record distinguishes current ability from potential, generates original footballers in controlled intakes and presents scouted potential to clubs. For the founder’s example, assume 180 is current ability on a 0–1,000 scale. If 180 describes the actual potential ceiling, the proposed model caps current ability at 180. The numerical scale and examples here are design inputs for discussion.

**Who gets the footballer?** One unique NFT carries one sporting history. A sale passes that history to the next owner. Two bids for the same secondary listing can settle at most one transfer under its sale terms. For the reserved youth allocation, two teams ranking the same prospect follow the funded claim order and published tie-break already specified in [ADR 0010](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0010-generate-footballers-with-finite-careers.md). Two similar prospects can be developed concurrently because they have different IDs.

**Who develops better?** Propose a fixed individual ceiling set before allocation. For equal starting profiles, use the same versioned deterministic development rules across owners. Each in-game week, allocate a bounded gain to attributes from eligible completed training, competitive experience and readiness, with diminishing gains near the ceiling. Derive current ability from the attribute profile using fixed published weights for the comparison. Do not award points for wallet spending, transfer frequency, friendly volume or simply opening the app. Retain fractional gains internally.

**Illustrative week only.** Two otherwise identical young wingers start at 180 with a ceiling of 720. After applying the same development rule, A receives two overall-equivalent points from completed focused training and one from suitable competitive experience, finishing at 183. B completes the same training and has no eligible competitive minutes, finishing at 182. A reserve can grow from training. This example isolates a difference in opportunity; age, workload and career pace require season-level balancing before fixing weights.

**Buyer verification.** Before assignment, commit to each entrant’s ID, starting profile and ceiling with a salted hash. Disclose the rules for intake generation and allocation. Commitments help detect later alterations; they cannot by themselves establish an unbiased original draw. Keep a versioned off-chain development history with input event IDs, prior and new attribute values, and the rule version. Periodically anchor a batch digest on Solana and make records and inclusion proofs available. A checkpoint can establish that a record has not been rewritten since anchoring. Replaying the calculation also needs its inputs, and a private ceiling needs later disclosure or a separate proof to let a buyer verify enforcement. Transfers preserve all accumulated state and the last processed period.

**Agreed.** In the worked example, 180 is current ability at mint. Each footballer has a separate individual ceiling and buyers see a scouted range. In the first version, equal starting profiles and identical sporting histories produce identical development. The exact weights, scouting accuracy and verification mechanism remain open.

<a id="coaching"></a>

## Coaching capacity · first-release direction agreed

Production tasks: [S14-01](backlog.md#s14-01) · [S14-02](backlog.md#s14-02) · [S19-04](backlog.md#s19-04).

**Proposal.** Every club receives free team training and a limited number of focused sessions it can assign each in-game week. A session authorises work with a named footballer on a specific skill. The existing development rules determine any gain. The club can set a repeating plan because the first playtest advances one in-game week per real day.

**Coach assignment.** If coaches become ownable, the owner can commit a coach to a squad or hire their time out to another club. Each appointment occupies a dated slot in the coach’s calendar. A transfer or hire cannot refresh used capacity. A club may pay Baller Bucks to the provider for a specialist plan or delegated coaching, subject to the same club and footballer limits as free manual training. A free user can select the same focus and achieve the same outcome from the same work.

**Alternative considered.** A tradeable token generated by staked coaches and consumed for extra training would let purchasing power increase either one footballer’s development rate or the number of saleable prospects a club can develop. A cap on each footballer alone leaves the second advantage intact. Economy v0.2 names Baller Bucks as the sole monetary unit. A non-transferable training allowance is a gameplay limit; a bought coach appointment is a service with a payer and provider.

**Agreed direction.** Keep Baller Bucks as the only currency. Give each club a free weekly allowance for focused training. Cap the training a single footballer can receive across owners, loans and coaches. A separate manager-set BB budget is an option if paid coaching is introduced.

**Proposed accounting.** Count completed sessions against the permanent footballer ID in each game week. Reserve the club and footballer capacity together when booking, release a cancelled booking and count a completed session only once. Unused sessions expire. Ordinary team training continues.

**Example for balancing.** With a test limit of two individual sessions per footballer per game week, a winger who used both before a transfer has zero left for that week at the new club. Two is illustrative. If optional paid coaching launches, a manager can also set a maximum BB coaching budget per footballer per period. The budget limits authorised payments; free or discounted sessions still use the same workload allowance.

**Why one currency.** If a scarce second token buys progress for a tradeable footballer, managers have a reason to buy and accumulate it. A low issue price or token burn does not guarantee a low resale price. Club-bound expiring sessions deliver the intended scarcity without an extra wallet balance. Coach appointments can still be bought with BB if approved. The numeric limits, coach ownership and paid coaching rollout remain open.

<a id="training-close"></a>

## Recurring training, experience and loans · agreed

Production tasks: [S11-05](backlog.md#s11-05) · [S14-01](backlog.md#s14-01) · [S14-03](backlog.md#s14-03).

- **Offline training.** Let a manager save a recurring plan. In each game week, it uses the same allowances as a manually entered plan and skips footballers who are unavailable. This matters because one game week passes per real day in the first playtest.

- **Training versus match experience.** Let reserves improve technical skills in training. Give competitive experience more weight for match-reading and decision-making, with opportunities appropriate to the footballer’s age and role. Test it with reserve goalkeepers as well as outfield prospects.

- **Development on loan.** The borrowing club controls training during the loan and uses its own club allowance. The parent club can see the development report. The footballer keeps one shared workload limit across both clubs.

The weekly slot counts are now set for the playtest. Growth weights and coach prices remain open.

<a id="club-progression"></a>

## Long-term club progression · direction agreed

Production tasks: [S17-01](backlog.md#s17-01) · [S17-02](backlog.md#s17-02) · [S17-03](backlog.md#s17-03).

Team history, competition place and outstanding succession claims already follow the Team NFT on sale. The disclosed squad travels under the existing transfer rules. This round covers what founders can build during their tenure. [Team ownership decision](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0002-represent-teams-as-transferable-nfts.md)

| Question | Agreed direction |
| --- | --- |
| 1 · How does a club acquire an identity? | Let it emerge from results and choices. An academy reputation comes from graduates playing meaningful minutes over several seasons. Allow that identity to change as a new generation takes over. |
| 2 · What long-term decision does the founder make? | Choose one major club project at a time, with a free route to completion over multiple fixtures. Examples include an academy programme, a scouting department and a matchday experience for supporters. |
| 3 · What should a facility upgrade actually do? | Unlock a useful capability. A scouting department might let a user follow a prospect across several fixtures and narrow the estimate of their potential. The individual ceiling and training cap still apply. |
| 4 · How should reputation be shown? | Show separate records for sporting achievement, talent development and supporter following. Show recent form alongside the permanent record so a newly promoted rival can earn attention immediately. |

The founder agreed to all four directions. The academy, scouting and supporter projects are examples. Specific facility effects, costs, thresholds and project duration remain open.

<a id="founding"></a>

## Founding a club and the first session · agreed

Production tasks: [S08-01](backlog.md#s08-01) · [S08-02](backlog.md#s08-02) · [S17-02](backlog.md#s17-02).

The first-squad decision record gives a qualifying owner wallet one starter bursary when its team accepts its first league place. The club chooses footballers from a shared starter pool, with an affordable one-click squad available. The existing matchday branch offers a one-click AI friendly with fixed squads. [Starter funding](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0009-fund-first-squads-with-ballerbuckz.md) · [Matchday playtest](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/matchday/README.md)

- **Before a league place opens.** Offer an optional practice friendly with a demo squad. A practice result earns no progression or assets and leaves the bursary trigger at admission.

- **First recruitment decision.** Show the affordable starter squad and offer one optional comparison: an established starter versus a prospect in the same position. Show current ability, scouted potential range, fee, wages and remaining bursary before confirmation. Allow a user to keep the suggested squad or choose from the full pool.

- **First competitive deadline.** Offer a suggested eligible team sheet. Ask the manager to review and submit it, then show the server’s receipt, opponent and local deadline for revisions. A friendly lineup is never a competitive submission.

- **First institutional project.** Offer it after the founder has seen their squad play. Let them defer it without blocking their first competitive fixture.

The founder agreed to all four first-session choices. The optional demo friendly is distinct from a competitive fixture and its team-sheet deadline.

<a id="funded-launch"></a>

## Ownership and the first funded season · launch direction agreed

Production tasks: [S06-06](backlog.md#s06-06) · [S08-04](backlog.md#s08-04) · [S10-03](backlog.md#s10-03) · [S11-02](backlog.md#s11-02).

The matchday funding decision uses game-only BB for the first competitive playtest and blocks next-season entry while wage arrears remain. Economy v0.2 requires funded spendable balances, free sporting continuity and prepaid or escrowed optional obligations. The founder approved the following launch rules for moving between those settings. [Playtest funding and wages](https://github.com/DarthShoge/Ballerz-NFT/blob/9f2bd1dde88822520a399910e84a65cafd1b4b4e/docs/adr/0009-fund-first-squads-with-ballerbuckz.md) · [Funded economy v0.2](https://github.com/DarthShoge/Ballerz-NFT/blob/b6d3dc8e33bfa9980d1f1c1863e9e4aafa98e6ce/docs/BALLERZ_ECONOMY_AND_TOKENOMICS_V0.2.md)

- **Playtest transition.** Preserve club identity and sporting history. Label test BB from day one and give it no automatic conversion into spendable launch BB. Any launch grant requires a separately funded allocation.

- **Financial distress.** An uncovered payment due triggers an incoming transfer ban until arrears are settled. The club may sell footballers, promote registered academy footballers and compete with an eligible squad. New paid signings require a wage reserve through the current wage year.

- **Empty starter pool budget.** If a league place is available but no funded bursary remains, offer a free playable squad with no immediate resale rights and admit the club. Distinguish footballing eligibility from market eligibility; do not promise later conversion.

- **First real trade.** Trial a fixed-price transfer of one eligible footballer between two clubs. Disclose the asset, buyer, seller, total and fees, and tie payment and ownership transfer to one settlement. Update sporting registration under the existing team-sheet cutoff. Add conditional fees and multi-asset deals later.

All four launch directions are agreed for the funded game. The existing playtest still blocks next-season entry until arrears clear. Launch fallback footballers and continuity reserves are permanently club-bound for individual sales and loans.

<a id="transfer-ban"></a>

## Incoming transfer ban · agreed for the funded game

Production tasks: [S10-03](backlog.md#s10-03) · [S08-04](backlog.md#s08-04).

**Agreed.** A club that runs out of money cannot bring in footballers until its books are balanced.

- **Trigger and release.** Apply the ban when a payment due cannot be covered. A zero balance with all obligations covered is balanced. Release the ban when all overdue obligations are settled, then check affordability for any new deal.

- **Transactions and squad continuity.** Block incoming purchases, free-agent signings and new loans in, even at a zero fee. Allow outgoing sales and promotion of footballers already registered in the club’s academy. A newly acquired academy footballer would still be an arrival.

- **Competition access.** The club can play and enter the next season with an eligible squad it already holds. The ban continues across season rollover until overdue payments are settled.

<a id="ai-staff"></a>

## The first AI staff appointment · direction agreed

Production tasks: [S19-01](backlog.md#s19-01) · [S19-02](backlog.md#s19-02) · [S19-03](backlog.md#s19-03) · [S19-04](backlog.md#s19-04).

Manual play, revocable permissions and a record of agent actions are established requirements. The current matchday branch already runs a computer opponent in friendlies. This round concerns an assistant appointed by a human manager to carry out work for their own club.

- **First job.** Start with a development coach. The manager can specify a footballer, a goal and a constraint, for example improving crossing while keeping a winger fresh for Saturday. The coach uses recorded workload and fixtures to propose a plan.

- **Standing sporting authority.** Once authorised, the coach can schedule and adjust individual sessions for named footballers within the club’s allowance and the manager’s workload limits. The manager can reserve a rest day or lock an assignment. A suggested competitive XI stays a draft for the manager to submit in the first version.

- **Market authority.** Let staff scout, shortlist and prepare fixed-price deals. For the first funded release, an authorised human approves the exact terms before any binding offer, payment or sale.

- **Reporting.** Give the manager one weekly account of changes, reasons and observed outcomes, with links to the footballers and fixtures involved. Interrupt sooner when an exception needs a decision before a deadline. Keep the audit history for individual actions.

All four AI staff choices are agreed. Prices and service tiers remain open.

<a id="supporters"></a>

## Supporters and community · free access and trial rules agreed

Production tasks: [S18-01](backlog.md#s18-01) · [S18-05](backlog.md#s18-05) · [S18-06](backlog.md#s18-06).

The product already calls for club following, match viewing and optional funded memberships. Follower counts and simulated attendance generate no spendable BB. The proposals below cover the first supporter experience.

- **Joining.** Let a user join solely as a supporter, follow multiple clubs for free and choose a favourite. Club ownership and a funded wallet are unnecessary to follow a club.

- **Match access.** Make ordinary league fixtures, the public live 2D match view and replays free to watch. Publish fixtures, results, lineups once public and season records. Keep private team sheets and staff reports within the club.

- **Match awards.** The match engine calculates the official Player of the Match. Supporter voting is outside the first release. A later club trial can name a separate Supporters’ Player of the Match under the [agreed poll rules](#voting-review).

- **Club incentives.** Each club decides whether to offer extras, such as a Q&A, a programme or recognition for long-standing supporters. It can offer them free. Any paid extra is optional and club-led. Ballerz requires no paid membership to follow clubs or watch ordinary league matches.

<a id="media-round"></a>

## Media, creators and sponsorship · direction agreed

Production tasks: [S18-02](backlog.md#s18-02) · [S18-03](backlog.md#s18-03) · [S18-05](backlog.md#s18-05).

- **Independent outlets.** A user can run an outlet without owning a club. Each story shows the outlet and byline so supporters can distinguish independent reporting from an official statement.

- **Media agents.** Begin with recaps and interview questions drafted from public match events. An outlet editor approves publication; a manager approves any answer attributed to them.

- **Sponsorship.** A sponsor can buy a clearly labelled placement, such as sponsorship of a match programme. Payment goes to the club or outlet delivering it under disclosed terms. The sponsor receives no authority over official statistics, supporter votes or selection.

Public match access remains free regardless of the publisher or sponsor.

<a id="voting-review"></a>

## Player of the Match and supporter polls · agreed

Production tasks: [S03-04](backlog.md#s03-04) · [S18-06](backlog.md#s18-06).

The match engine calculates the official **Player of the Match**. The first release excludes supporter voting. If a club runs a later trial, its fans may choose a separate **Supporters’ Player of the Match** under three rules.

- **Participation.** Each club opts in. Voting is free, with one ballot per eligible account that followed the club before kickoff.

- **Presentation and consequences.** Use the supporters’ award label and show turnout. The poll has no effect on the engine’s award, official honours, development, payouts or match outcomes.

- **Disputes.** A disputed poll may close without a winner. The engine’s official award stands independently.
