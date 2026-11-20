# Use a shared compressed world clock

All live leagues share one server-run in-game calendar that advances while managers are offline. Leagues schedule fixtures within that calendar. Keep the compression rate fixed for the whole live wage year and announce any rate change before the next wage year starts.

Publish each competitive team-sheet deadline in the manager's local time. In v1, schedule successive competitive deadlines for the same team at least 24 real hours apart. Managers can submit in advance and the server runs fixtures at their scheduled kickoffs.

Use the same timing rules in an isolated test world where the tester can advance to the next lineup deadline or year-end. Test human participation separately at the intended live pace.

A wage year has 52 weeks of seven in-game days. In the first live playtest, the clock advances one in-game week per 24 real hours, so a wage year takes 52 real days. One wage year also counts as one year of footballer ageing and service.

Team sheets lock 30 real minutes before the scheduled kickoff. Use the last valid team sheet Ballerz receives before the deadline.

Derive year, week and day from one published UTC start time. The first live league plays one season per wage year. Reserve the first seven real days for preseason and the following 45 for competition and reserve dates.

At the shared year-end, finalise season results and pay prizes before settling the outgoing year's wages. Run retirement checks using each footballer's age in the closing year. Then age continuing footballers by one year, open the next intake and publish the new wage rates.

Validate the submitted starting eleven against eligibility immediately before the team-sheet deadline. A transfer effective exactly at the deadline applies to later fixtures.

A manager who submits on time may nominate a fallback. Use their nominated eligible replacement if a starter becomes unavailable before the lock. Apply the existing AI cover rules if the team cannot field a legal eleven with its own available footballers.

The shared clock continues through outages. When an outage only delays simulation and both sheets locked successfully, resolve the fixture from those locked sheets in the original event order. If the outage prevents submissions, move the fixture to a reserve date and give both teams a fresh deadline.

If a verified disruption prevents a fair league fixture before year-end, close it as a no contest with no points or change to goal difference. Pay base BB to teams whose readiness can be verified. Exclude the fixture from both teams' season-completion calculations.

Allow permanent transfers throughout the first live season. The team-sheet cutoff determines when a new signing can play. Transfer windows are a future option, with the choice between gating transfer settlement and sporting registration still open.

For the first eight-team live playtest, schedule four daily rounds followed by two rest days, repeated seven times within the 45-day competition window. Round 28 falls on competition day 40. Keep competition days 41 through 45 clear for reserve fixtures and publish the full schedule before the season starts.

Injury recovery takes effect at the start of the footballer's published in-game recovery day. The footballer can be selected if recovery takes effect before the team-sheet deadline and the other eligibility rules are satisfied.
