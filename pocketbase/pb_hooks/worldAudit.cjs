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
