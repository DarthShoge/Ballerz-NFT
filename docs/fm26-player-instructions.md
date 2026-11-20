# Individual defensive instructions in FM26 and Ballerz

In the installed FM26 PC build, a player's out-of-possession role and their instructions are distinct selections. Pressing controls when they leave their position to close the carrier. Marking controls how much room they give a receiver. Tackling controls how readily they commit once they can challenge. These choices can complement each other or leave a gap for a teammate to cover.

## FM26 evidence

The shipped Unity asset `Assets/ScriptableObjects/StaticData/Tactics/PlayerInstructions/PlayerInstructionEntry.asset` contains 15 instruction groups. Its local object ID is `8095377543312338436`. Reading the option entries in the installed `ui-staticdataentries_assets_all.bundle` gives the following selections. The numbers in brackets are instruction IDs.

| Group | Options | Consequence described in FM26's English UI |
|---|---|---|
| 11 · Trigger Press | More Often (29), Less Often (30), Standard (0) | Earlier pressure gives the opponent less time. A player who steps out can open space behind them. |
| 12 · Marking | Mark Tighter (33), Standard (0) | Closing the gap limits a receiver’s space. A mobile opponent can turn or drag their marker away. |
| 13 · Tackling | Tackle Harder (31), Ease Off Tackles (32), Standard (0) | An aggressive challenge can break up an attack early and increases the risk of conceding a free kick. A defender easing off tries to stay goal-side. |

FM26 stores the marking **target** in group 14. Selecting a particular opponent or opposition position is a separate decision from how closely to mark. The English template includes a padlock for instructions fixed by role or position and an unavailable state for incompatible instructions. Twelve of the 39 shipped defensive role records contain role-instruction text references, including pressing defensive midfielder, screening defensive midfielder, stopping centre-back and covering centre-back. A text reference alone does not tell us which selector is locked. The full role-by-role lock matrix and the numerical engine weights remain unverified.

The REA metadata inspection found the instruction-group and option classes in `FM.UI` (`ev_d730e338195a99d7f2ba595bb723443428ccb48bf5d80b6e0652a81cbbd38f6a`). The method inventory exposes group IDs, option IDs, labels, descriptions, pros, cons and pitch illustrations (`ev_1a18bb9c742af9ffe7a74521c037c2657b2c2d905c5a1a21316e089ac7136468`). The UnityFS container identity is recorded in `ev_218f85d2cd6874fb50993da0f60118e30f8539deef7436ffe4b00d28602cb616`. The exact options above come from parsing the serialized entries using UnityPy 1.25.4. The corresponding English explanations appear in `data/game_simulation/templates/user_folder/languages/example.ltf`, including keys 703079–703082, 703086–703091, 703100–703107 and 706567–706568. Lock messages use keys 690428 and 694097.

## How the Ballerz implementation uses them

- **Pressing** adjusts the selected player's engagement radius and priority inside the team block. More frequent pressing can draw them away from their line. Extra pressing work costs condition while they are actually closing down.
- **Marking** brings a marker closer to an eligible receiver. A screening midfielder stays in the passing lane but moves nearer its target. A covering defender still protects an engaged teammate when cover is needed. A designated outlet keeps their outlet job. The engine chooses the receiver from the players on the pitch.
- **Tackling** changes how often the defender attempts a close challenge and the likelihood of illegal contact. A legal contest still depends on the defender and dribbler's attributes, position and fatigue. A booked defender retains their existing restraint.

Ballerz uses its own movement distances and contest probabilities. Controlled tests exercise both directions of attack, the press boundary, the distance to a marked receiver, the screening assignment and the relative foul risk at equal skill.

## Full-match results in Ballerz v12

Northbank played a balanced 4-3-3 DM against Eastport’s balanced 4-4-2. Only one outfield position received an individual instruction. Each of the seven settings was run across the same 160 seeds for the defensive midfielder, then for the left-back: 2,240 fixture simulations. The validation seeds differed from calibration. Regains and fouls are attributed to the selected shirt, including its replacement. Shots and expected goals against count all opponents’ chances, including set pieces, throughout the match.

| Instruction | DM regains | DM fouls | Shots against | xG against | LB regains | LB fouls | Shots against | xG against |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Standard | 20.24 | 0.35 | 11.42 | 1.304 | 3.22 | 0.10 | 11.42 | 1.304 |
| Mark tighter | 20.17 | 0.91 | 11.47 | 1.293 | 4.13 | 0.19 | 11.27 | 1.294 |
| Press more often | 20.88 | 0.36 | 11.76 | 1.379 | 3.39 | 0.13 | 11.33 | 1.312 |
| Press less often | 19.47 | 0.36 | 11.88 | 1.316 | 3.10 | 0.11 | 11.57 | 1.304 |
| Tackle harder | 20.01 | 0.63 | 11.65 | 1.352 | 3.23 | 0.19 | 11.37 | 1.300 |
| Ease off tackles | 20.29 | 0.16 | 11.76 | 1.342 | 3.20 | 0.04 | 11.28 | 1.290 |
| Tighter, more pressing and harder tackles | 20.38 | 1.76 | 11.24 | 1.294 | 4.42 | 0.33 | 11.46 | 1.287 |

Tighter marking added 0.91 regains per match at left-back (approximate paired 95% interval +0.55 to +1.27). At defensive midfield the same instruction added 0.56 fouls (+0.40 to +0.73). The midfielder’s extra regains when pressing more often remained uncertain (+0.64, interval −0.31 to +1.59). Every paired interval for shots and xG against included zero in these two setups. A single player changing their behaviour can make a measurable personal difference while the effect on team chance prevention is harder to distinguish.

From the repository root, run `node matchday/scripts/benchmark-player-instructions.mjs 160 20270309 DM` and repeat with `LB`. Each run prints the per-match means and intervals. [Sports Interactive’s FM26 tactics overview](https://www.footballmanager.com/fm26/features/possession-out-possession-fm26s-new-tactical-evolution)

## Marking a particular player or position

FM26's installed English template identifies the two menu options with keys 348187 and 450282. Keys 706454 and 706460 describe following the selected opponent or whoever occupies the selected position in open play. The descriptions explicitly exclude set pieces. Keys 706462 and 706463 describe the defensive risk when attackers exchange positions. The player-instruction registry in the shipped Unity bundle contains group 14 with option IDs 34, 35 and 0. REA identified the UnityFS container under evidence ID `ev_8db76ff224330911106bc4509fc795e783c4bd3b889afb479067a0259cab1269`; UnityPy exposed the serialized registry bytes. These observations establish the choices and their intended behaviour. The fallback after a substitution is a Ballerz design decision. FM26's runtime handling of that event was not verified.

Ballerz resolves each assignment on every open-play movement step against active opponents and their current attacking slots. A defender following a named striker can be drawn across the pitch when the strikers switch sides. A defender assigned to LS picks up the new left striker instead. If the named player leaves, the defender resumes their usual role. A position target picks up the incoming substitute as soon as they enter that slot. If the position is vacant the defender resumes their usual role until someone occupies it. A defender can also be prepared to mark an opposition substitute before that player comes on. Mark tighter controls the gap to the chosen opponent. Restart routines retain their own assignments.

The matchday regression tests exercise both directions of play, including a striker interchange, an actual substitution, a bench target entering and leaving, dismissal, vacancy, live edits, checkpoint reload and clearing an order. Run `node --test test/marking-targets.test.mjs` from the matchday directory.
