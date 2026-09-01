const CHECKED_DOMAINS = [
	'species',
	'trainers',
	'racers',
	'free_agents',
	'leagues',
	'seasons',
	'races',
	'tracks',
	'wagers',
	'ledger',
	'trainer_results',
	'standings',
	'roster_history',
	'health',
	'valuation',
	'news'
];

function roundMoney(value) {
	return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function auditWorld(world, targets) {
	const findings = [];
	const add = (code, domain, repairability, recordIds, message, repair) => {
		const ids = [...new Set(recordIds.filter(Boolean))].sort();
		findings.push({
			id: `${code}:${ids.join(',') || 'world'}`,
			code,
			domain,
			repairability,
			recordIds: ids,
			message,
			repair: repair || null
		});
	};
	const duplicateGroups = (records, keyOf) => {
		const groups = new Map();
		for (const record of records) {
			const key = keyOf(record);
			if (!key) continue;
			groups.set(key, [...(groups.get(key) || []), record]);
		}
		return [...groups.entries()].filter(([, recordsForKey]) => recordsForKey.length > 1);
	};

	if (world.species.length !== targets.speciesCount) {
		add(
			'invalid_species_population',
			'species',
			'review',
			world.species.map(({ id }) => id),
			`Expected ${targets.speciesCount} species but found ${world.species.length}.`
		);
	}
	if (world.trainers.length !== targets.trainerCount) {
		add(
			'invalid_trainer_population',
			'trainers',
			'review',
			world.trainers.map(({ id }) => id),
			`Expected ${targets.trainerCount} trainers but found ${world.trainers.length}.`
		);
	}

	const activeRacers = world.racers.filter((racer) => !racer.retired && racer.leagueId);
	const freeAgents = world.racers.filter(
		(racer) => !racer.retired && !racer.leagueId && !racer.trainerId
	);
	if (activeRacers.length !== targets.activeRacerCount) {
		add(
			'invalid_active_racer_population',
			'racers',
			'review',
			activeRacers.map(({ id }) => id),
			`Expected ${targets.activeRacerCount} active racers but found ${activeRacers.length}.`
		);
	}
	if (freeAgents.length !== targets.freeAgentCount) {
		add(
			'invalid_free_agent_population',
			'free_agents',
			'review',
			freeAgents.map(({ id }) => id),
			`Expected ${targets.freeAgentCount} free agents but found ${freeAgents.length}.`
		);
	}

	const invalidAssignments = world.racers.filter((racer) => {
		if (racer.retired) return Boolean(racer.leagueId || racer.trainerId);
		return Boolean(racer.leagueId) !== Boolean(racer.trainerId);
	});
	if (invalidAssignments.length) {
		add(
			'invalid_racer_assignment',
			'racers',
			'review',
			invalidAssignments.map(({ id }) => id),
			'Active racers require both a trainer and league; free agents require neither.'
		);
	}

	for (const trainer of world.trainers) {
		const roster = activeRacers.filter((racer) => racer.trainerId === trainer.id);
		if (roster.length !== trainer.rosterCapacity) {
			add(
				'invalid_trainer_roster_size',
				'trainers',
				'review',
				[trainer.id, ...roster.map(({ id }) => id)],
				`Trainer ${trainer.id} has ${roster.length} active racers; capacity is ${trainer.rosterCapacity}.`
			);
		}
	}
	for (const league of world.leagues) {
		const members = activeRacers.filter((racer) => racer.leagueId === league.id);
		if (members.length !== league.maxPlayers) {
			add(
				'invalid_league_size',
				'leagues',
				'review',
				[league.id, ...members.map(({ id }) => id)],
				`League ${league.id} has ${members.length} active racers; configured size is ${league.maxPlayers}.`
			);
		}
	}

	const activeSeasons = world.seasons.filter(({ status }) => status === 'active');
	if (activeSeasons.length !== 1) {
		add(
			'invalid_active_season_count',
			'seasons',
			'review',
			activeSeasons.map(({ id }) => id),
			`Expected exactly one active season but found ${activeSeasons.length}.`
		);
	} else {
		const season = activeSeasons[0];
		const standingByRacer = new Map(
			world.standings
				.filter((standing) => standing.seasonId === season.id)
				.map((standing) => [standing.racerId, standing])
		);
		const invalidStandings = activeRacers.filter((racer) => {
			const standing = standingByRacer.get(racer.id);
			return !standing || standing.leagueId !== racer.leagueId;
		});
		if (invalidStandings.length) {
			add(
				'invalid_season_assignment',
				'seasons',
				'review',
				[season.id, ...invalidStandings.map(({ id }) => id)],
				'Active-season standings do not agree with current league assignments.'
			);
		}
	}

	const raceById = new Map(world.races.map((race) => [race.id, race]));
	const staleByRace = new Map();
	const ineligibleByRace = new Map();
	for (const racer of world.racers) {
		if (!racer.raceId) continue;
		const race = raceById.get(racer.raceId);
		if (!race || ['settled', 'cancelled'].includes(race.status)) {
			const key = racer.raceId || 'missing';
			staleByRace.set(key, [...(staleByRace.get(key) || []), racer.id]);
		} else if (racer.retired || racer.healthEligible === false) {
			ineligibleByRace.set(race.id, [...(ineligibleByRace.get(race.id) || []), racer.id]);
		}
	}
	for (const [raceId, racerIds] of staleByRace) {
		add(
			'stale_race_link',
			'races',
			'safe',
			[raceId, ...racerIds],
			`Racers still reference terminal or missing race ${raceId}.`,
			{ action: 'clear_racer_race_links', racerIds }
		);
	}
	for (const [raceId, racerIds] of ineligibleByRace) {
		add(
			'ineligible_race_entrant',
			'races',
			'review',
			[raceId, ...racerIds],
			`Race ${raceId} contains retired or ineligible entrants.`
		);
	}
	for (const race of world.races) {
		if (!race.trackId) {
			add('missing_race_track', 'races', 'review', [race.id], `Race ${race.id} has no track.`);
		}
		const duplicatePrizes = duplicateGroups(race.awardedPrizes || [], (prize) => prize.racerId);
		if (duplicatePrizes.length) {
			add(
				'duplicate_event_effect',
				'races',
				'review',
				[race.id, ...duplicatePrizes.flatMap(([, prizes]) => prizes.map(({ racerId }) => racerId))],
				`Race ${race.id} awards more than one prize effect to the same racer.`
			);
		}
	}

	for (const racer of world.racers) {
		const raceHistory = racer.raceHistory || {};
		const results = Array.isArray(raceHistory.races) ? raceHistory.races : [];
		const distinctRaceIds = new Set(results.map(({ raceId }) => raceId).filter(Boolean));
		const distinctWins = new Set(
			results
				.filter((result) => result.outcome !== 'dnf' && Number(result.position) === 1)
				.map(({ raceId }) => raceId)
				.filter(Boolean)
		);
		if (
			distinctRaceIds.size !== results.filter(({ raceId }) => raceId).length ||
			Number(raceHistory.totalRaces) > distinctRaceIds.size ||
			Number(raceHistory.wins) > distinctWins.size
		) {
			add(
				'duplicate_event_effect',
				'racers',
				'review',
				[racer.id, ...distinctRaceIds],
				`Racer ${racer.id} race history or career statistics include repeated race effects.`
			);
		}
	}

	for (const [, results] of duplicateGroups(world.trainerResults || [], (result) =>
		result.raceId && result.racerId ? `${result.raceId}:${result.racerId}` : ''
	)) {
		add(
			'duplicate_event_effect',
			'trainer_results',
			'review',
			results.map(({ id, raceId, racerId }) => id || raceId || racerId),
			'The same racer start is recorded more than once for a trainer race result.'
		);
	}

	for (const event of world.events) {
		const seasonPoints = Array.isArray(event.facts?.seasonPoints) ? event.facts.seasonPoints : [];
		const duplicateStandingEffects = duplicateGroups(seasonPoints, (effect) => effect.racerId);
		if (duplicateStandingEffects.length) {
			add(
				'duplicate_event_effect',
				'standings',
				'review',
				[
					event.id,
					...duplicateStandingEffects.flatMap(([, effects]) =>
						effects.map(({ racerId }) => racerId)
					)
				],
				`Event ${event.id} applies league-standing points more than once to the same racer.`
			);
		}
	}
	const standingEffects = [];
	for (const event of world.events) {
		if (event.type !== 'RaceSettled') continue;
		const race = raceById.get(event.facts?.raceId);
		for (const effect of Array.isArray(event.facts?.seasonPoints) ? event.facts.seasonPoints : []) {
			standingEffects.push({ ...effect, eventId: event.id, seasonId: race?.seasonId });
		}
	}
	for (const standing of world.standings) {
		const effectsByEvent = new Map(
			standingEffects
				.filter(
					(effect) => effect.seasonId === standing.seasonId && effect.racerId === standing.racerId
				)
				.map((effect) => [effect.eventId, effect])
		);
		const expectedPoints = [...effectsByEvent.values()].reduce(
			(total, effect) => total + Number(effect.points || 0),
			0
		);
		const expectedWins = [...effectsByEvent.values()].filter(
			(effect) => effect.outcome !== 'dnf' && Number(effect.position) === 1
		).length;
		const expectedPodiums = [...effectsByEvent.values()].filter(
			(effect) => effect.outcome !== 'dnf' && Number(effect.position) <= 3
		).length;
		if (
			Number(standing.starts) > effectsByEvent.size ||
			Number(standing.points) > expectedPoints ||
			Number(standing.wins) > expectedWins ||
			Number(standing.podiums) > expectedPodiums
		) {
			add(
				'duplicate_event_effect',
				'standings',
				'review',
				[standing.id, standing.racerId, ...effectsByEvent.keys()],
				`Standing ${standing.id} contains more race statistics or points than its distinct settlement events support.`
			);
		}
	}

	for (const [sourceEventId, histories] of duplicateGroups(
		world.rosterHistory || [],
		(history) => history.sourceEventId
	)) {
		add(
			'duplicate_event_effect',
			'roster_history',
			'review',
			[sourceEventId, ...histories.map(({ id }) => id)],
			`Event ${sourceEventId} produced more than one roster-history transition.`
		);
	}

	for (const transitionField of ['sourceEventId', 'recoveryEventId']) {
		for (const [eventId, conditions] of duplicateGroups(
			world.healthConditions || [],
			(condition) => condition[transitionField]
		)) {
			add(
				'duplicate_event_effect',
				'health',
				'review',
				[eventId, ...conditions.map(({ id }) => id)],
				`Health event ${eventId} was applied to more than one condition transition.`
			);
		}
	}

	if (world.tracks.length < targets.minimumTrackCount) {
		add(
			'invalid_track_population',
			'tracks',
			'review',
			world.tracks.map(({ id }) => id),
			`Expected at least ${targets.minimumTrackCount} tracks but found ${world.tracks.length}.`
		);
	}
	for (const track of world.tracks) {
		if (
			track.checkpointCount < 2 ||
			track.length <= 0 ||
			track.width <= 0 ||
			!track.surface ||
			track.compatibleFormatCount === 0
		) {
			add(
				'invalid_track_configuration',
				'tracks',
				'review',
				[track.id],
				`Track ${track.id} has incomplete geometry or format characteristics.`
			);
		}
	}

	const unresolvedWagers = world.wagers.filter((wager) => {
		const race = raceById.get(wager.raceId);
		return wager.status === 'open' && (!race || ['settled', 'cancelled'].includes(race.status));
	});
	if (unresolvedWagers.length) {
		add(
			'unresolved_wager',
			'wagers',
			'review',
			unresolvedWagers.map(({ id }) => id),
			'Open wagers remain linked to terminal or missing races.'
		);
	}
	for (const [key, wagers] of duplicateGroups(world.wagers, (wager) => wager.idempotencyKey)) {
		add(
			'duplicate_event_effect',
			'wagers',
			'review',
			[key, ...wagers.map(({ id }) => id)],
			`Wager request ${key} produced more than one wager.`
		);
	}
	for (const [sourceKey, entries] of duplicateGroups(world.ledger, (entry) => entry.sourceKey)) {
		add(
			'duplicate_event_effect',
			'ledger',
			'review',
			[sourceKey, ...entries.map(({ id }) => id)],
			`Ledger source ${sourceKey} produced more than one account effect.`
		);
	}
	for (const [wagerId, entries] of duplicateGroups(
		world.ledger.filter((entry) => ['wager_payout', 'wager_refund'].includes(entry.type)),
		(entry) => entry.wagerId
	)) {
		add(
			'duplicate_event_effect',
			'ledger',
			'review',
			[wagerId, ...entries.map(({ id }) => id)],
			`Wager ${wagerId} has more than one payout or refund ledger effect.`
		);
	}

	for (const user of world.users) {
		const ledger = world.ledger.filter((entry) => entry.playerId === user.id);
		const projectedBalance = roundMoney(
			ledger.reduce((total, entry) => total + Number(entry.balanceDelta || 0), 0)
		);
		if (projectedBalance !== roundMoney(user.balance)) {
			add(
				'ledger_disagreement',
				'ledger',
				'review',
				[user.id, ...ledger.map(({ id }) => id)],
				`Account ${user.id} balance does not agree with its durable ledger.`
			);
		}
	}

	for (const racer of world.racers) {
		const history = Array.isArray(racer.priceHistory) ? racer.priceHistory : [];
		const sourceCounts = new Map();
		for (const point of history) {
			if (!point || !point.sourceEvent) continue;
			sourceCounts.set(point.sourceEvent, (sourceCounts.get(point.sourceEvent) || 0) + 1);
		}
		if ([...sourceCounts.values()].some((count) => count > 1)) {
			add(
				'duplicate_event_effect',
				'valuation',
				'review',
				[racer.id],
				`Racer ${racer.id} has multiple valuation effects from one event.`
			);
		}
		if (history.length) {
			const latest = history[history.length - 1];
			if (
				!Number.isFinite(Number(latest.price)) ||
				roundMoney(latest.price) !== roundMoney(racer.price)
			) {
				add(
					'valuation_disagreement',
					'valuation',
					'review',
					[racer.id],
					`Racer ${racer.id} current price does not agree with its latest price history.`
				);
			}
		} else if (!Number.isFinite(Number(racer.price)) || Number(racer.price) <= 0) {
			add(
				'invalid_valuation',
				'valuation',
				'review',
				[racer.id],
				`Racer ${racer.id} has no valid price.`
			);
		}
	}

	const eventIds = new Set(world.events.map(({ id }) => id));
	const newsByEvent = new Map();
	for (const story of world.news) {
		if (!eventIds.has(story.sourceEventId)) {
			add(
				'invalid_news_source',
				'news',
				'review',
				[story.id],
				`News ${story.id} has no durable source event.`
			);
		}
		newsByEvent.set(story.sourceEventId, [
			...(newsByEvent.get(story.sourceEventId) || []),
			story.id
		]);
	}
	for (const [eventId, storyIds] of newsByEvent) {
		if (storyIds.length > 1) {
			add(
				'duplicate_event_effect',
				'news',
				'review',
				[eventId, ...storyIds],
				`Event ${eventId} produced more than one news story.`
			);
		}
	}
	const newsEventTypes = new Set([
		'RaceSettled',
		'HealthOnset',
		'HealthRecovery',
		'RacerRetired',
		'RacerSigned',
		'RacerReleased',
		'SeasonCompleted'
	]);
	for (const event of world.events) {
		if (newsEventTypes.has(event.type) && !newsByEvent.has(event.id)) {
			add(
				'missing_news_effect',
				'news',
				'review',
				[event.id],
				`Event ${event.id} has no projected news story.`
			);
		}
	}

	return findings.sort(
		(left, right) => left.code.localeCompare(right.code) || left.id.localeCompare(right.id)
	);
}

module.exports = { CHECKED_DOMAINS, auditWorld };
