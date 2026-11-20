# FM26 role coverage in Ballerz

The FM26 PC build contains **40 in-possession roles and 39 out-of-possession roles**. Before this change, Ballerz v10 offered 32 attacking roles and 19 defensive roles. Eight attacking jobs had no equivalent. In defence several positions shared one Ballerz role, so subtracting 19 from 39 would give a misleading list of omissions. A tracking forward and a splitting outlet, for example, defend the same nominal position but leave the team in different shapes for the next attack.

The first reference image uses the older role-and-duty system. In FM26 each player has a job in each phase. Some familiar names changed. Three examples are Shadow Striker → Second Striker, Target Man → Target Forward and Libero → Advanced Centre-Back. FM26’s Free Role has a demonstration referenced by an asset still named `Trequartista`. Legacy translation entries for Mezzala, Regista and Enganche also survive in the installation. Their names have no separate entry in the inspected FM26 PC role lists. [Sports Interactive’s FM26 tactics overview](https://www.footballmanager.com/fm26/features/possession-out-possession-fm26s-new-tactical-evolution)

## Measured defensive behaviour in Ballerz

Northbank played Eastport in 50 full matches for each of the six role choices below. In each pair the same starter, lineups, team instructions and seeds were used. The observer sampled the selected player's position immediately after the engine moved both teams, before resolving the pass or changing possession. Samples were weighted by simulated movement duration within each match, then averaged across matches. A change of role can change where later attacks happen, so eligible minutes can differ between runs.

| Comparison | Eligible open-play situation | Ballerz result |
|---|---|---|
| Screening versus pressing defensive midfielder in a 4-3-3 DM | The away outfield carrier was within 65 m of Northbank's goal. | The screening DM finished 4.75% of weighted movements within 3 m of the carrier. The pressing DM reached that distance in 20.14%. |
| Wide midfielder versus tracking wide midfielder in a 4-4-2 | The away carrier was on the midfielder’s flank, with another away outfielder in that wide channel. | The average gap to the nearest eligible wide runner fell from 10.80 m to 7.59 m. |
| Stopping versus covering left centre-back in a 3-5-2 | A teammate was actively pressing the away carrier within 65 m of Northbank's goal. | The stopper averaged 4.45 m behind the presser along the length of the pitch. The covering centre-back averaged 18.27 m behind. |

Reproduce the 300 matches with `node matchday/scripts/benchmark-defending.mjs 50 20261201` from the repository root. The accompanying controlled tests use the same positions in both attacking directions and check assignments against named, eligible players. These results measure Ballerz’s behaviour for the two test squads. FM26’s live marking distances and decision weights remain unknown.

## All 39 out-of-possession jobs

Each row gives the English job names within one positional family. The final column describes the choices available **before** this expansion. The groupings identify the football jobs and their associated demonstration positions. Exact slot eligibility in every FM formation remains unverified.

Counting one entry per FM position and job, v10 had **17 direct equivalents, 15 partial equivalents and seven missing jobs**. A direct equivalent offered that position’s core task. A partial equivalent borrowed another position’s role or offered an outlet without control over its route. The seven missing jobs were the three wide centre-backs, Dropping Defensive Midfielder, Splitting Outlet Attacking Midfielder, Inside Outlet Winger and Splitting Outlet Centre Forward. A broad job is credited only once as a direct equivalent where a single Ballerz selection served multiple lines.

| Position | Jobs found in FM26 | Ballerz v10 coverage and gaps |
|---|---|---|
| Goalkeeper | Goalkeeper, Line-Holding Goalkeeper, Sweeper Keeper | All three behaviours represented. |
| Centre-back | Centre-Back, Covering Centre-Back, Stopping Centre-Back | All three represented. Stopping changes who steps out. Covering prioritises the space behind the line. |
| Wide centre-back | Wide Centre-Back, Covering Wide Centre-Back, Stopping Wide Centre-Back | All three wide variants missing. The two outer centre-backs previously used the central jobs. |
| Full-back | Full-Back, Holding Full-Back, Pressing Full-Back | All three represented. |
| Wing-back | Wing-Back, Holding Wing-Back, Pressing Wing-Back | The selection reused full-back jobs and a tracking winger. No distinct wing-back jobs. |
| Defensive midfield | Defensive Midfielder, Dropping Defensive Midfielder, Pressing Defensive Midfielder, Screening Defensive Midfielder, Wide Covering Defensive Midfielder | Shared the central midfielder’s base, press, screen and flank cover. The drop into the back line was missing. |
| Central midfield | Central Midfielder, Pressing Central Midfielder, Screening Central Midfielder, Wide Covering Central Midfielder | All four broad jobs represented. Flank cover moved towards the ball. The picker used the same IDs as defensive midfield. |
| Wide midfield | Wide Midfielder, Tracking Wide Midfielder, Wide Outlet Wide Midfielder | Had a base role plus generic tracker and outlet. The latter two lacked distinct wide-midfield assignments. |
| Attacking midfield | Attacking Midfielder, Tracking Attacking Midfielder, Central Outlet Attacking Midfielder, Splitting Outlet Attacking Midfielder | Shared base/track jobs from other lines and one generic outlet. A manager could not choose between a central and a splitting outlet. |
| Winger | Winger, Tracking Winger, Wide Outlet Winger, Inside Outlet Winger | Had a wide-midfield base, a tracking winger and one generic outlet. No choice between staying outside and moving inside. |
| Centre forward | Centre Forward, Tracking Centre Forward, Central Outlet Centre Forward, Splitting Outlet Centre Forward | Base and tracking jobs existed. One generic outlet lacked separate central and splitting routes. Ballerz also had a custom pressing-forward option. |

The tracking and outlet jobs illustrate why position matters. A tracking forward recovers towards midfield. A wide outlet winger stays available ahead of the block and can leave space behind. SI’s example pairs that winger with a wide-covering central midfielder who helps the full-back when an opponent attacks down the flank. [FM26 two-striker example](https://www.footballmanager.com/the-dugout/dominate-dual-strikers-fm26) · [FM26 wide-forward example](https://www.footballmanager.com/the-dugout/mastering-wide-forward-fm26)

## All 40 in-possession jobs

Each registry entry appears once below. A manager may be able to select a role from more than one slot. The right column lists the eight jobs missing from v10.

| Family | Already represented in Ballerz v10, using the FM26 name | Missing in v10 |
|---|---|---|
| Goalkeeper | Goalkeeper, Ball-Playing Goalkeeper, No-Nonsense Goalkeeper | — |
| Centre-back | Centre-Back, Ball-Playing Centre-Back, Advanced Centre-Back, Overlapping Centre-Back | No-Nonsense Centre-Back, Wide Centre-Back |
| Full-back and wing-back | Full-Back, Wing-Back, Inside Wing-Back, Playmaking Wing-Back | Inside Full-Back, Advanced Wing-Back |
| Defensive and central midfield | Defensive Midfielder, Central Midfielder, Half Back, Deep-Lying Playmaker, Box-to-Box Midfielder, Channel Midfielder | Box-to-Box Playmaker, Midfield Playmaker, Wide Central Midfielder |
| Wide midfield and wing | Wide Midfielder, Winger, Inside Winger, Playmaking Winger, Inside Forward | Wide Forward |
| Attacking midfield | Attacking Midfielder, Advanced Playmaker, Free Role, Second Striker | — |
| Centre forward | Centre Forward, Channel Forward, Deep-Lying Forward, False Nine, Poacher, Target Forward | — |

## Ballerz assignment IDs

The API stores the role ID within each player's phase pair. Read each row in the same order as the corresponding FM26 list above. The family and ID together identify a defensive assignment. For example, a screening midfielder can use the same stored ID in two lines while the formation supplies a different starting position. Existing additional choices such as Pressing Forward and the general Counterattacking Outlet remain available.

| Out-of-possession family | Ballerz assignment IDs, in FM26 table order |
|---|---|
| Goalkeeper | `line-keeper`, `stay-home-keeper`, `sweeper-keeper` |
| Centre-back | `central-defender`, `covering-centre-back`, `stopper` |
| Outer centre-back of a back three | `defending-wide-centre-back`, `covering-wide-centre-back`, `stopping-wide-centre-back` |
| Full-back | `defending-full-back`, `holding-full-back`, `pressing-full-back` |
| Wing-back | `defending-full-back`, `holding-wing-back`, `pressing-wing-back` |
| Defensive midfield | `central-cover`, `dropping-defensive-midfielder`, `pressing-midfielder`, `screening-midfielder`, `wide-cover-midfielder` |
| Central midfield | `central-cover`, `pressing-midfielder`, `screening-midfielder`, `wide-cover-midfielder` |
| Wide midfield | `wide-defender`, `tracking-winger`, `wide-outlet` |
| Attacking midfield | `central-cover`, `tracking-forward`, `central-outlet`, `splitting-outlet-centre-forward` |
| Winger | `wide-defender`, `tracking-winger`, `wide-outlet`, `inverting-outlet-winger` |
| Centre forward | `front-line`, `tracking-forward`, `central-outlet`, `splitting-outlet-centre-forward` |

| In-possession family | Existing Ballerz IDs in table order | Eight new IDs |
|---|---|---|
| Goalkeeper | `goalkeeper`, `ball-playing-keeper`, `direct-keeper` | — |
| Centre-back | `centre-back`, `ball-playing-defender`, `libero`, `overlapping-centre-back` | `no-nonsense-centre-back`, `wide-centre-back` |
| Full-back and wing-back | `full-back`, `wing-back`, `inside-wing-back`, `playmaking-wing-back` | `inside-full-back`, `advanced-wing-back` |
| Defensive and central midfield | `defensive-midfielder`, `central-midfielder`, `half-back`, `deep-lying-playmaker`, `box-to-box`, `channel-midfielder` | `box-to-box-playmaker`, `midfield-playmaker`, `wide-central-midfielder` |
| Wide midfield and wing | `wide-midfielder`, `winger`, `inverted-winger`, `wide-playmaker`, `inside-forward` | `wide-forward` |
| Attacking midfield | `attacking-midfielder`, `advanced-playmaker`, `free-role`, `second-striker` | — |
| Centre forward | `centre-forward`, `channel-forward`, `deep-lying-forward`, `false-nine`, `poacher`, `target-forward` | — |

## Evidence and interpretation

1. REA identified the installed `ui-staticdataentries_assets_all.bundle` as UnityFS. Its SHA-256 is `d74425d8481daf381d2dd4ae5d8e8f02ad6293e02bb8bef065d2a70d2623dc27`. The container inspection is `ev_218f85d2cd6874fb50993da0f60118e30f8539deef7436ffe4b00d28602cb616`. The role schema inspection of IL2CPP metadata is `ev_21a64ef433e3c7d47c5c250e92b9c2ca3a4e8dc6259d846bb10fa1ef37d51c72`. It exposes phase IDs, the demonstration, movement hints and player instruction accessors.
2. Using UnityPy 1.25.4, resolve both lists in `Assets/ScriptableObjects/StaticData/Tactics/Roles/RolesData.asset`. Join each local `m_PathID` to the referenced serialized object. Read `m_roleID`, `m_pitchGIF`, `m_roleLabelIcons` and `m_roleMovementIconStyleClass`. This recovers all 79 entries, including entries with an empty demonstration field. The reference lists determine membership.
3. Cross-check the English strings in the installed `data/game_simulation/templates/user_folder/languages/example.ltf`. Keys 688068–688106 cover most defensive role names. Key 696138 calls the internal `OPInvertingOutletWinger` the **Inside Outlet Winger**. Keys 688107, 688115, 688116 and 688141 identify Inside Full-Back, Advanced Centre-Back, Ball-Playing Centre-Back and Playmaking Winger. The corresponding internal names include `InvertedFullBack`, `Libero`, `BallPlayingDefender` and `WidePlaymaker`. This distinction preserves historical Ballerz role IDs when the displayed label changes.
4. The authored tooltips at keys 688543–688548 describe a dropping defensive midfielder moving into central defence, a central midfielder stepping out to press, a central midfielder covering the flank, an outlet winger coming inside, an outlet forward splitting wide, and an attacking midfielder tracking back. These establish direction and intent. Press distances, opponent selection for marking and the live FM26 action weights remain unknown. The Ballerz engine can measure those effects independently. [Earlier visualiser and full-match measurements](match-simulation-research.md#ballerz-role-behaviour-in-full-matches)
