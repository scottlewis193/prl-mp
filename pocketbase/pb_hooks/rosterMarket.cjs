const ROSTER_MARKET_RULES = Object.freeze({
	version: 'roster-market-v1',
	priceFloor: 1,
	priceCeiling: 1000,
	signingPricePercent: 5,
	releasePricePercent: -5
});

function hashSeed(value) {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

function seededUnit(seed) {
	let value = hashSeed(seed) + 0x6d2b79f5;
	value = Math.imul(value ^ (value >>> 15), 1 | value);
	value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
	return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function generateRosterRacerTraits(speciesKey, generationSeed) {
	if (!speciesKey || !generationSeed) {
		throw new Error('Free-agent traits require a species and generation seed');
	}
	let seed = hashSeed(`racer-traits-v1:${speciesKey}:${generationSeed}`);
	const random = () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
	const trait = () => Math.floor(random() * 100) + 1;
	return {
		durability: trait(),
		resilience: trait(),
		temperament: trait(),
		consistency: trait(),
		potential: trait(),
		longevity: trait()
	};
}

function bounded(value, minimum, maximum) {
	return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function round(value, places = 4) {
	const scale = 10 ** places;
	return Math.round((value + Number.EPSILON) * scale) / scale;
}

function candidateFactors(input, candidate) {
	const capacity = Math.max(1, Math.floor(Number(input.trainer.rosterCapacity) || 1));
	const rosterSize = Math.max(0, Math.floor(Number(input.rosterSize) || 0));
	const budget = Math.max(0, Number(input.trainer.budget) || 0);
	const price = Math.max(0, Number(candidate.price) || 0);
	const minRanking = Math.max(1, Number(input.league.minRanking) || 1);
	const maxRanking = Math.max(minRanking, Number(input.league.maxRanking) || minRanking);
	const ranking = Math.max(1, Number(candidate.ranking) || maxRanking);
	const recentFinishes = (Array.isArray(candidate.recentFinishes) ? candidate.recentFinishes : [])
		.map(Number)
		.filter((position) => Number.isInteger(position) && position > 0)
		.slice(-5);
	const averageFinish = recentFinishes.length
		? recentFinishes.reduce((total, position) => total + position, 0) / recentFinishes.length
		: maxRanking;
	const ageDays = Math.max(0, Math.floor(Number(candidate.ageDays) || 0));
	const leagueSuitability =
		ranking >= minRanking && ranking <= maxRanking
			? 15
			: 15 *
				(1 -
					bounded(
						Math.min(Math.abs(ranking - minRanking), Math.abs(ranking - maxRanking)) / 100,
						0,
						1
					));
	return {
		rosterNeed: round((Math.max(0, capacity - rosterSize) / capacity) * 20),
		capacity: rosterSize < capacity ? 5 : 0,
		value: round(15 * (1 - bounded(price / Math.max(1, budget), 0, 1))),
		health: candidate.healthEligible === false ? 0 : 15,
		leagueSuitability: round(leagueSuitability),
		recentForm: round(15 * (1 - bounded((averageFinish - 1) / 19, 0, 1))),
		potential: round((bounded(candidate.potential, 0, 100) / 100) * 15),
		age: round(10 * (1 - bounded(Math.abs(ageDays - 1095) / 3650, 0, 1))),
		budget: price <= budget ? 5 : 0
	};
}

function selectSigningCandidate(input) {
	if (!input?.trainer?.id || !input?.league?.id || !input.seed) {
		throw new Error('Signing selection requires a trainer, league, and seed');
	}
	const capacity = Math.max(1, Math.floor(Number(input.trainer.rosterCapacity) || 1));
	if (Math.max(0, Number(input.rosterSize) || 0) >= capacity) return null;
	const budget = Math.max(0, Number(input.trainer.budget) || 0);
	const eligible = (Array.isArray(input.candidates) ? input.candidates : [])
		.filter(
			(candidate) =>
				candidate.id &&
				!candidate.trainerId &&
				!candidate.leagueId &&
				!candidate.retired &&
				candidate.healthEligible !== false &&
				Number(candidate.price) > 0 &&
				Number(candidate.price) <= budget
		)
		.sort((left, right) => left.id.localeCompare(right.id));
	if (!eligible.length) return null;
	const scored = eligible.map((candidate) => {
		const factors = candidateFactors(input, candidate);
		const baseScore = Object.values(factors).reduce((total, value) => total + value, 0);
		const seededTieBreak = round(
			seededUnit(`${ROSTER_MARKET_RULES.version}:${input.seed}:${input.trainer.id}:${candidate.id}`)
		);
		return {
			candidateId: candidate.id,
			factors,
			baseScore: round(baseScore),
			seededTieBreak,
			score: round(baseScore + seededTieBreak),
			inputs: {
				rosterSize: Math.max(0, Math.floor(Number(input.rosterSize) || 0)),
				rosterCapacity: Math.max(1, Math.floor(Number(input.trainer.rosterCapacity) || 1)),
				trainerBudget: Math.max(0, Number(input.trainer.budget) || 0),
				league: {
					id: input.league.id,
					minRanking: Number(input.league.minRanking) || 0,
					maxRanking: Number(input.league.maxRanking) || 0
				},
				candidate: { ...candidate }
			}
		};
	});
	scored.sort(
		(left, right) => right.score - left.score || left.candidateId.localeCompare(right.candidateId)
	);
	return {
		...scored[0],
		eligibleCandidateIds: eligible.map((candidate) => candidate.id),
		rulesVersion: ROSTER_MARKET_RULES.version
	};
}

function buildRosterPricePoint(input) {
	if (
		!['signing', 'release'].includes(input.transition) ||
		!input.trainerId ||
		!input.sourceEvent ||
		!Number.isFinite(Date.parse(input.occurredAt))
	) {
		throw new Error('Roster valuation requires a valid transition, trainer, event, and time');
	}
	const previousPrice = Number(input.previousPrice);
	if (!Number.isFinite(previousPrice) || previousPrice <= 0) {
		throw new Error('Roster valuation requires a positive current price');
	}
	const appliedPercent =
		input.transition === 'signing'
			? ROSTER_MARKET_RULES.signingPricePercent
			: ROSTER_MARKET_RULES.releasePricePercent;
	const price = round(
		bounded(
			previousPrice * (1 + appliedPercent / 100),
			ROSTER_MARKET_RULES.priceFloor,
			ROSTER_MARKET_RULES.priceCeiling
		),
		2
	);
	const change = round(price - previousPrice, 2);
	return {
		timestamp: new Date(input.occurredAt).toISOString(),
		previousPrice: round(previousPrice, 2),
		price,
		change,
		changePercent: round((change / previousPrice) * 100, 2),
		reason: {
			type: 'roster_change',
			transition: input.transition,
			trainerId: input.trainerId,
			appliedPercent
		},
		rulesVersion: ROSTER_MARKET_RULES.version,
		sourceEvent: input.sourceEvent
	};
}

function planFreeAgentReplenishment(input) {
	const current = Math.max(0, Math.floor(Number(input.currentPoolSize) || 0));
	const minimum = Math.max(0, Math.floor(Number(input.minimumPoolSize) || 0));
	const target = Math.max(minimum, Math.floor(Number(input.targetPoolSize) || minimum));
	if (current >= minimum) return [];
	const needed = Math.max(0, target - current);
	const speciesIds = [
		...new Set(Array.isArray(input.eligibleSpeciesIds) ? input.eligibleSpeciesIds : [])
	]
		.filter(Boolean)
		.sort();
	if (speciesIds.length === 0) return [];
	const existingIdentityKeys = new Set(
		(Array.isArray(input.existingRacerIdentities) ? input.existingRacerIdentities : [])
			.filter((identity) => identity?.speciesId && identity?.generationSeed)
			.map((identity) => `${identity.speciesId}:${identity.generationSeed}`)
	);
	const candidates = [];
	const seedFingerprint = `${hashSeed(input.seed).toString(36)}${hashSeed(`seed:${input.seed}`).toString(36)}`;
	for (let instanceIndex = 1; candidates.length < needed; instanceIndex += 1) {
		for (const speciesId of speciesIds) {
			const generationSeed = `free-agent:${seedFingerprint}:${speciesId}:${instanceIndex}`;
			const identityKey = `${speciesId}:${generationSeed}`;
			if (existingIdentityKeys.has(identityKey)) continue;
			candidates.push({
				speciesId,
				generationSeed,
				instanceIndex,
				identityHash: `${hashSeed(identityKey).toString(36)}${hashSeed(`identity:${identityKey}`).toString(36)}`,
				order: seededUnit(`${ROSTER_MARKET_RULES.version}:${input.seed}:replenish:${identityKey}`)
			});
		}
	}
	return candidates
		.sort(
			(left, right) =>
				left.order - right.order ||
				left.speciesId.localeCompare(right.speciesId) ||
				left.instanceIndex - right.instanceIndex
		)
		.slice(0, needed)
		.map(({ speciesId, generationSeed, instanceIndex, identityHash }) => ({
			speciesId,
			generationSeed,
			instanceIndex,
			identityHash
		}));
}

module.exports = {
	ROSTER_MARKET_RULES,
	buildRosterPricePoint,
	generateRosterRacerTraits,
	planFreeAgentReplenishment,
	selectSigningCandidate
};
