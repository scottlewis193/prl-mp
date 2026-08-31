## Problem Statement

The Pokemon Racing League currently presents races, leagues, racers, trainers, an exchange, wagering, and a dashboard, but those parts do not yet behave as one persistent world. Race outcomes are visible without reliably changing racer, trainer, or player statistics; finishers do not appear to receive meaningful position-based rewards; and wagering does not behave reliably from placement through settlement.

The world is also too small and static to sustain long-term play. It contains only a limited Pokemon roster and one racetrack, has no visible league standings or movement between leagues, and lacks free agency, signings, health, aging, retirement, varied race formats, or meaningful in-race moves. The dashboard therefore has little sense of consequence or narrative. Racer prices also lack enough explainable inputs to make the exchange feel like a market responding to an active sporting world.

Players need a coherent simulation in which races and world events produce durable, auditable consequences across competition, careers, finances, wagering, valuation, and news.

## Solution

Build a persistent “living league” simulation around a canonical world-event pipeline. Race completion, wager placement and settlement, roster changes, health incidents, recovery, retirement, promotion and relegation, and price changes will be processed exactly once and will atomically update all affected records. The same recorded events will drive player-facing statistics, standings, the exchange, and a creative dashboard news feed.

Populate the game with all 649 Pokemon species from Generations I–V, seed five ordered leagues with 20 active racers each, create 25 trainers with four assigned racers each, and seed an initial pool of 25 free-agent racers. These figures are configuration defaults rather than schema limits. Maintain the active league population through trainer signings and controlled free-agent replenishment.

Introduce seasons, visible league tables, configurable promotion and relegation, five or more distinct tracks, and four initial race formats: ranked League Races, multi-class Grand Prix events, unranked Exhibition Races, and Legends Exhibitions for retired racers. Add a racing-focused move system in which attacks, temporary buffs, and defensive moves create short-lived tactical effects. Standard races will not use battle-style fainting: an exhausted racer can be delayed or temporarily impaired, while a durable DNF is reserved for a separately recorded incident. This keeps racing, ranking, and wagering comprehensible while leaving room for more dangerous formats later.

Give racers a lifecycle based on both species attributes and individual traits. Health incidents, recovery, aging, and retirement will affect eligibility, performance, value, and news. Racer prices will be calculated from explainable fundamentals plus bounded event-driven adjustments, with every price movement recording its cause. The dashboard will expose recent, varied news stories generated deterministically from real events and will link those stories to the relevant racers, trainers, races, leagues, and tracks.

## User Stories

1. As a player, I want every completed race to update durable statistics, so that results have lasting consequences.
2. As a player, I want racer wins, starts, finishing history, average finish, earnings, form, and ranking points to update after settlement, so that I can judge performance accurately.
3. As a player, I want trainer starts, wins, podiums, earnings, roster changes, and championships to update, so that trainers develop meaningful careers.
4. As a player, I want my wager and investment totals to update from ledgered transactions, so that my account record matches my activity.
5. As a player, I want a race to settle only once, so that retries cannot duplicate statistics, prizes, payouts, or news.
6. As a player, I want every finisher’s prize to be based on finishing position and race configuration, so that placing higher is financially meaningful.
7. As a player, I want the prize structure visible before a race, so that I understand what racers are competing for.
8. As a player, I want cancelled or invalid races to produce no ranking or prize changes, so that incomplete events do not corrupt careers.
9. As a player, I want all Pokemon species from Generations I–V available as source species, so that the racing world has broad variety.
10. As an administrator, I want Pokemon imports to be repeatable and keyed by National Pokedex number, so that reseeding does not create duplicates.
11. As a player, I want each racer to be an individual derived from a species rather than the species record itself, so that multiple racers can have distinct careers and traits.
12. As a player, I want five ordered leagues with 20 active racers in each, so that the competition has a clear initial structure.
13. As an administrator, I want league, trainer, active-racer, and free-agent counts to be configurable, so that the world can be rebalanced without schema changes.
14. As a player, I want racers assigned to trainers, so that each racer belongs to a recognisable stable.
15. As a player, I want trainer rosters to have a configurable capacity, so that signings require meaningful choices.
16. As a player, I want an initial pool of free-agent racers, so that trainers can replace and improve their rosters.
17. As a player, I want unsigned racers clearly identified as free agents, so that their availability is unambiguous.
18. As a player, I want trainers to sign free agents according to roster need, budget, league suitability, value, and potential, so that transfers feel plausible.
19. As a player, I want signings and releases recorded in roster history, so that ownership changes are auditable.
20. As a player, I want the free-agent pool replenished when it becomes too small, so that retirements and signings do not empty the market.
21. As a player, I want racers to possess individual durability, resilience, temperament, consistency, potential, and longevity traits, so that two racers of the same species can develop differently.
22. As a player, I want species stats and individual traits to influence race performance and lifecycle probabilities, so that racer identity matters.
23. As a player, I want racers to become injured or ill at plausible rates, so that careers have risk and variation.
24. As a player, I want every health condition to have a severity, start time, expected recovery window, and eligibility effect, so that its consequences are understandable.
25. As a player, I want injured or ill racers excluded from races when their condition makes them ineligible, so that scheduling remains consistent.
26. As a player, I want racers to recover over time, so that most health incidents are setbacks rather than permanent removals.
27. As a player, I want racer age and career load to influence health and retirement probabilities, so that careers have a natural arc.
28. As a player, I want retirements to be recorded permanently while preserving career history, so that retired stars remain part of the world.
29. As a player, I want retired racers excluded from ordinary leagues and free agency, so that active competition remains valid.
30. As a player, I want the dashboard to show a league-wide news feed, so that I can understand what has happened without opening every screen.
31. As a player, I want news about results, records, moves, incidents, recoveries, signings, releases, promotions, relegations, retirements, and price changes, so that the world feels active.
32. As a player, I want articles to use varied headlines, summaries, tone, and contextual details, so that the feed resembles genuine sports reporting.
33. As a player, I want every news item tied to a recorded event and linked entities, so that stories are factual and navigable.
34. As a player, I want duplicate processing to avoid duplicate news stories, so that the feed remains trustworthy.
35. As a player, I want important stories prioritised above routine stories, so that major events are easy to spot.
36. As a player, I want news to explain significant racer price movements, so that market changes have context.
37. As an investor, I want racer prices to reflect performance, form, league, age, health, potential, popularity, earnings, and supply, so that values respond to the world.
38. As an investor, I want event-driven price changes bounded and rounded consistently, so that one event cannot destabilise the economy.
39. As an investor, I want every price point to include a timestamp and reason, so that price history is auditable.
40. As an investor, I want prices recalculated exactly once per triggering event, so that retries cannot manipulate value.
41. As a player, I want at least five distinct tracks, so that races do not all feel identical.
42. As a player, I want tracks to have documented characteristics such as length, width, surface, hazards, cornering demand, and speed bias, so that racer suitability varies.
43. As a player, I want race schedules to rotate through eligible tracks, so that the calendar offers variety.
44. As a player, I want the race viewer to load any configured track without track-specific code, so that new tracks can be added safely.
45. As a player, I want a visible table for each league, so that I can see position, points, starts, wins, podiums, recent form, and movement zone.
46. As a player, I want ranked League Races to award season points by finishing position, so that standings measure league performance.
47. As a player, I want standings to use deterministic tie-breakers, so that equal points still produce a stable order.
48. As a player, I want promotion and relegation to occur at a clear season boundary, so that league movement is predictable.
49. As a player, I want the top four eligible racers promoted and bottom four relegated by default, so that each 20-racer league changes while retaining its size.
50. As a player, I want the top and bottom leagues to handle their one-sided movement correctly, so that no racer moves beyond the league structure.
51. As a player, I want league movement, season awards, and reset standings recorded in history, so that previous seasons remain viewable.
52. As a player, I want standard League Races to include all eligible racers in one league, so that standings are based on direct competition.
53. As a player, I want a multi-class Grand Prix to put multiple leagues on the same track while scoring racers within their own league class, so that the event feels like endurance multi-class racing.
54. As a player, I want Grand Prix results to distinguish overall and class positions, so that mixed fields remain understandable.
55. As a player, I want unranked Exhibition Races with lower prizes, so that racers can compete without affecting league standings.
56. As a player, I want Legends Exhibitions limited to retired racers, so that notable careers can return for special events.
57. As a player, I want every race format to state its eligibility, ranking effect, prize scale, wagering availability, and move rules, so that consequences are clear before entry.
58. As a player, I want racers to perform attacks, temporary buffs, and defensive moves during races, so that races include tactical interactions.
59. As a player, I want move availability derived from a curated racing move catalogue rather than the full battle ruleset, so that the system remains balanceable.
60. As a player, I want moves to have explicit targeting, accuracy, duration, cooldown, potency, and resource cost, so that their effects are predictable.
61. As a player, I want attacks to impose temporary racing penalties rather than direct battle damage, so that racing remains the primary contest.
62. As a player, I want defensive moves to prevent or reduce eligible negative effects, so that racers can respond tactically.
63. As a player, I want buffs and debuffs to expire deterministically, so that temporary effects cannot become permanent accidentally.
64. As a player, I want move selection influenced by trainer tactics, racer temperament, race position, track conditions, and cooldowns, so that decisions feel contextual.
65. As a player, I want important move events visible in the race viewer and post-race summary, so that position changes make sense.
66. As a player, I want standard races to avoid battle-style fainting, so that a single attack cannot arbitrarily eliminate a wagered racer.
67. As a player, I want severe incidents and DNFs handled as explicit, rare race events, so that non-finishes remain possible and auditable.
68. As a player, I want to place a wager only on an eligible market before its cutoff, so that wagering rules are enforced.
69. As a player, I want the displayed odds and potential payout frozen when my wager is accepted, so that settlement matches the terms I saw.
70. As a player, I want my stake deducted atomically when a wager is accepted, so that my balance cannot be overspent.
71. As a player, I want repeated submission of the same wager request to create only one wager and one debit, so that retries are safe.
72. As a player, I want winning wagers paid and losing wagers closed automatically when the race settles, so that no manual step is required.
73. As a player, I want wagers refunded when a race or market is void, so that I do not lose money on an invalid event.
74. As a player, I want my open wagers, settled history, stake, odds, result, payout, and ledger entries to agree, so that I can trust the wagering system.
75. As a player, I want wagering disabled for formats or racers whose outcomes cannot be settled unambiguously, so that unsupported markets are not offered.
76. As an administrator, I want every simulation probability, population target, reward curve, points table, movement count, price weight, and safety bound versioned in configuration, so that balance changes are controlled.
77. As an administrator, I want a world reconciliation report, so that missing assignments, invalid league sizes, stale race links, unresolved wagers, and duplicate event effects can be detected.
78. As an administrator, I want population seeding and scheduled world processing to be idempotent, so that restarts and retries are safe.

## Implementation Decisions

- A durable world event is the canonical input for cross-domain changes. Event types include race settled, race voided, wager placed, wager resolved, signing completed, racer released, health incident started, racer recovered, racer retired, season completed, racer promoted, racer relegated, and valuation changed.
- Each event has a stable idempotency key, occurrence time, type, linked entities, structured facts, processing version, and importance. Processing an event and updating its affected records occurs in one PocketBase transaction.
- Aggregate statistics are projections of durable facts. Racer, trainer, and player summaries may be stored for efficient reads, but they must be reproducible from race histories, roster histories, account ledgers, wagers, holdings, seasons, and world events.
- Race settlement remains the authoritative boundary for finishing order. It updates the race, every participant’s career record and prize earnings, trainer aggregates, league points when applicable, valuations, eligible wagers, and associated news exactly once.
- Prize money uses a configurable per-format finishing-position curve multiplied by the league or event prize scale. The full curve is stored on the race when it is scheduled so later configuration changes cannot alter settlement.
- Ranked progression uses season points rather than repeatedly swapping racers’ numeric ranking values. League-table position is derived from points, then wins, podiums, best finish, and finally racer ID as a deterministic tie-breaker.
- Seasons have explicit start and end boundaries. The initial default is five ordered leagues of 20 active racers. At season end, four racers move across each adjacent boundary: the upper league’s bottom four exchange with the lower league’s top four. Movement counts remain configurable.
- League movement respects eligibility. A retired racer leaves active competition; an injured racer retains their earned position but may be replaced for future race eligibility according to configured roster rules. Replacement and vacancy policy must preserve a complete audit trail.
- Pokemon species and racer instances remain separate concepts. The species catalogue contains National Pokedex number, generation, types, canonical base stats, and curated race-eligible moves. Racer instances contain individual traits, career state, trainer, league, health, form, valuation, and ownership.
- The initial species catalogue covers National Pokedex numbers 001–649. Imports are versioned and idempotent. Source provenance and licensing are documented with the imported dataset; artwork availability is tracked independently from species data so missing bespoke animation cannot block the catalogue.
- Initial population defaults are 25 trainers, 100 assigned active racers, five leagues, 20 active racers per league, four racers per trainer, and 25 free agents. These values are configuration, not database constraints.
- Trainer assignment is optional for a free agent and required for an active league racer. A racer has at most one current trainer, with signings and releases stored as dated roster history.
- Automated signings score candidates by roster need, trainer budget, league suitability, health, age, value, recent form, and potential. Random choice uses a seeded generator so simulation runs can be reproduced in tests.
- The free-agent pool has configurable minimum and target sizes. Replenishment creates new racer instances from eligible species and does not silently resurrect retired racers.
- Racer lifecycle introduces immutable birth/career-start data, accumulated career load, and individual durability, resilience, temperament, consistency, potential, and longevity traits. Traits use bounded scales and are generated from a recorded seed.
- Health conditions are separate records or structured durable entries rather than a pair of booleans. They include kind, severity, cause, onset, expected recovery, actual recovery, eligibility effect, and linked race/event where applicable.
- Injury, illness, recovery, and retirement probabilities are computed by pure, versioned rules using relevant species stats, individual traits, age, career load, current health, track/event risk, and seeded randomness. The chosen inputs and resulting roll are retained for auditability.
- Retired racers preserve all history, holdings, and pricing records. They cannot enter standard competition or free agency, but can be invited to Legends Exhibitions.
- The news feed is generated from recorded world events using versioned story templates and deterministic variation. It does not call an external generative model during normal simulation. Templates can use factual context, sporting language, rivalry/record context, and importance to produce varied headlines and summaries without inventing outcomes.
- News items store their rendered headline and body, source event, linked entities, category, importance, and publication time. Regeneration is optional; what a player previously saw does not silently change when templates change.
- Racer valuation has two layers: a configurable fundamental value derived from performance, league, earnings, age, health, potential, popularity, and share supply; and bounded event adjustments for new information. Prices have a floor, optional ceiling, maximum percentage movement per event, consistent money rounding, and a reason linked to the triggering event.
- Price changes are not driven directly by prose. The structured world event changes the valuation and the news item explains that already-recorded change.
- At least five tracks ship initially. Track configuration exposes geometry plus racing characteristics including length, width, surface, hazards, cornering demand, speed bias, risk, and allowed formats. Scheduling rotates compatible tracks and avoids unnecessary immediate repetition.
- The renderer consumes the existing generic racetrack model. New tracks must not require per-track rendering branches; any new characteristic used by simulation is data-driven.
- Race format is explicit on every race. Initial formats are League Race, Grand Prix, Exhibition Race, and Legends Exhibition. Each format stores eligibility, classes, points curve, prize curve, move policy, risk level, and wagering policy at scheduling time.
- A League Race contains every eligible active racer in one league and affects that season’s table. A Grand Prix runs multiple league classes in the same world race and records both overall and class results; its default points policy is configurable rather than assumed to match a League Race.
- An Exhibition Race is unranked and uses a substantially reduced configurable prize scale. A Legends Exhibition is unranked, accepts retired racers, and has its own health-risk and wagering policy.
- Moves are a curated racing mechanic, not a reimplementation of Pokemon battle combat. Every move belongs to attack, buff, or defence and declares eligible targets, accuracy, potency, duration, cooldown, resource cost, and counter tags.
- Attacks apply temporary racing effects such as speed loss, impaired handling, resource drain, or forced line change. Buffs improve bounded racing capabilities temporarily. Defences prevent, reduce, or clear compatible effects.
- Standard race moves do not reduce battle HP and cannot directly cause fainting. Resource depletion produces a bounded slowdown or recovery window. Rare DNFs are explicit incident events governed by the race format’s risk model, not an implicit consequence of ordinary move damage.
- Move decisions are deterministic for a given simulation seed and state. Inputs include learned move set, cooldown, resource, trainer tactics, racer temperament, relative position, nearby targets, track segment, and active effects.
- The race event stream records tactically significant move attempts and outcomes for viewer playback and summaries without persisting every simulation frame.
- Wagering remains play-money only and initially supports fixed-odds winner markets. Odds, selections, cutoff, and payout terms are frozen on market publication and the accepted wager.
- Wager placement validates authentication, balance, market eligibility, selection, stake precision, cutoff, and idempotency inside one server-owned transaction. It creates one wager, debits one stake, and writes one ledger entry.
- Race settlement resolves every open eligible wager in the same authoritative completion workflow. A valid settled outcome pays winners and closes losers; cancellation, invalid completion, or an explicitly void market refunds stakes. Resolution is idempotent.
- The dashboard combines account and portfolio summaries with league tables and a paginated news feed. News can be filtered by category and can link to racers, trainers, races, leagues, and tracks.
- Balancing constants are versioned configuration. Records that require stable historical interpretation retain the configuration/rules version or a snapshot of the applied curve.
- Existing records are migrated without discarding race, financial, holding, or wager history. Reconciliation identifies legacy inconsistencies and repairs only cases with sufficient durable evidence; ambiguous repairs are reported for administrative review.

## Testing Decisions

- The primary test seam is the PocketBase service boundary. A test submits or triggers one world event and verifies the complete externally observable persisted outcome across all affected collections after the transaction commits.
- Tests verify behaviour rather than private helper structure. They assert state transitions, durable history, ledger balance, standings, eligibility, valuation history, news facts, and API/view output.
- The most important contract test completes a race through the service boundary and verifies race settlement, racer and trainer statistics, prize earnings, league points, valuation events, wager results, player balances, ledger entries, and news publication together.
- Atomicity tests inject a failure during a multi-record event and verify that none of its effects commit.
- Idempotency tests repeat settlement, wager placement, signing, health processing, season completion, and news projection with the same key and verify that no effect is duplicated.
- Pure deterministic rule tests cover finishing order, prize curves, points and tie-breakers, seeded population generation, signing selection, lifecycle probability, move selection/effects/expiry, promotion and relegation, valuation, and news-template selection.
- Property-style tests cover invariants: league size targets, one current trainer at most, no ineligible race entrants, non-negative balances, conserved wager debits/payouts, valid holding quantities, bounded prices, and deterministic results for a fixed seed.
- Migration and seed tests run imports twice and verify 649 unique species, configured trainer/racer counts, exactly 20 active racers per initial league, 25 initial free agents, valid relations, and no duplicate history.
- Wager integration tests cover successful placement, insufficient balance, invalid precision, closed market, duplicate request, winner payout, loser closure, void refund, concurrent attempts, and agreement among wager, balance, and ledger.
- League integration tests cover race points, tie-breakers, season completion, every adjacent promotion/relegation boundary, top/bottom league edges, retired vacancies, and history preservation.
- Lifecycle integration tests cover injury and illness creation, eligibility, recovery, retirement, roster replacement, free-agent replenishment, price response, and corresponding factual news.
- Move simulation tests use fixed seeds and assert only significant observable events and race consequences, not frame-by-frame implementation details.
- Track contract tests load and simulate every shipped track through the same generic interfaces and verify valid geometry, checkpoints, characteristics, and format compatibility.
- Dashboard tests verify pagination, importance ordering, filters, entity links, factual story content, league-table summaries, and immediate reflection of committed world events.
- Existing race-completion, race-settlement, wagering, scheduler, dashboard aggregation, exchange, racer-update, race-viewer, and track-rendering tests provide prior art. They should be extended toward the service-level seam rather than replaced with tests of internal implementation.

## Out of Scope

- Pokemon from Generation VI onward.
- A complete reproduction of canonical Pokemon battle rules, damage formulas, abilities, held items, breeding, evolution, or the complete canonical move catalogue.
- Battle-style fainting caused directly by ordinary moves in standard races. A dangerous combat-racing format can be designed separately later.
- Real-money wagering, deposits, withdrawals, cash prizes, or regulatory gambling functionality.
- Player-controlled trainer management, manual contract negotiation, racer breeding, or user-created racers unless separately specified.
- Live multiplayer control of racers during a simulation; initial move choice remains simulator-controlled.
- Runtime dependence on an external large-language model for news generation.
- Bespoke animated artwork for every Generation I–V species as a blocker for importing their data. Asset expansion may proceed incrementally with documented fallbacks.
- Exact final balance values for probabilities, reward curves, point tables, price weights, or move potency. This spec defines their shape, safety bounds, versioning, and testability; playtesting will tune the configured values.

## Further Notes

- The current codebase already has concepts for species, racers, trainers, leagues, tracks, race histories, racer financials, holdings, account ledgers, schedules, fixed-odds winner wagers, settlement, and dashboard aggregation. This specification deepens and connects those concepts instead of introducing a separate simulation stack.
- Existing settlement rules already calculate a position-based amount and update some racer fields in isolation. The reported behaviour indicates that correctness must be verified at the running PocketBase boundary, including hook registration, persisted JSON changes, settlement triggering, live client updates, and seed/configuration values.
- “Player statistics” in this spec means derived account activity such as wagers placed/won, wager profit/loss, trades, portfolio performance, and watched-racer activity. It does not imply that human players directly race Pokemon.
- “Ranking” is separated into all-time career metrics, current league-table position, and current-season points. Each UI must label the intended meaning instead of presenting one overloaded number.
- The initial population numbers are deliberate defaults for ticket planning: 25 trainers × 4 assigned racers = 100 league racers, plus 25 free agents. Later balancing can alter these without changing the model.
- The initial promotion/relegation default is four racers at each boundary per season, but the configuration mechanism must allow playtesting to reduce or increase that number.
- A future ticket breakdown should begin with correctness and the world-event/settlement seam, then standings and seasons, lifecycle/valuation/news, population and content expansion, tracks/formats, and finally move mechanics. This ordering prevents large seed and presentation work from being built on unstable consequences.
