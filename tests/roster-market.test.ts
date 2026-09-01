import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildRosterPricePoint,
	generateRosterRacerTraits,
	planFreeAgentReplenishment,
	selectSigningCandidate
} from '../src/lib/server/rosterMarket';
import { buildRosterStory } from '../src/lib/server/rosterNews';
import { generateRacerTraits, RACER_TRAIT_RULES_VERSION } from '../src/lib/server/racerLifecycle';

const trainer = { id: 'trainer-misty', budget: 80, rosterCapacity: 2 };
const league = { id: 'league-one', minRanking: 1, maxRanking: 100 };

test('seeded signing selection explains every roster and candidate input', () => {
	const candidates = [
		{
			id: 'steady',
			trainerId: '',
			leagueId: '',
			price: 30,
			healthEligible: true,
			ageDays: 500,
			ranking: 55,
			recentFinishes: [2, 3, 2],
			potential: 70,
			retired: false
		},
		{
			id: 'expensive',
			trainerId: '',
			leagueId: '',
			price: 120,
			healthEligible: true,
			ageDays: 300,
			ranking: 20,
			recentFinishes: [1, 1],
			potential: 95,
			retired: false
		},
		{
			id: 'injured',
			trainerId: '',
			leagueId: '',
			price: 10,
			healthEligible: false,
			ageDays: 200,
			ranking: 45,
			recentFinishes: [1],
			potential: 100,
			retired: false
		}
	];

	const first = selectSigningCandidate({
		trainer,
		league,
		rosterSize: 1,
		candidates,
		seed: 'roster-day-1'
	});
	const repeated = selectSigningCandidate({
		trainer,
		league,
		rosterSize: 1,
		candidates: [...candidates].reverse(),
		seed: 'roster-day-1'
	});

	assert.equal(first?.candidateId, 'steady');
	assert.deepEqual(repeated, first);
	assert.deepEqual(Object.keys(first?.factors ?? {}).sort(), [
		'age',
		'budget',
		'capacity',
		'health',
		'leagueSuitability',
		'potential',
		'recentForm',
		'rosterNeed',
		'value'
	]);
	assert.deepEqual(first?.eligibleCandidateIds, ['steady']);
	assert.equal(first?.inputs.trainerBudget, 80);
	assert.equal(first?.inputs.rosterCapacity, 2);
	assert.equal(first?.inputs.candidate.id, 'steady');
	assert.equal(
		first?.score,
		Number(((first?.baseScore ?? 0) + (first?.seededTieBreak ?? 0)).toFixed(4))
	);
	assert.equal(first?.rulesVersion, 'roster-market-v1');
	assert.equal(
		selectSigningCandidate({ trainer, league, rosterSize: 2, candidates, seed: 'full' }),
		null
	);
});

test('roster valuation records bounded signing and release causes', () => {
	assert.deepEqual(
		buildRosterPricePoint({
			transition: 'signing',
			previousPrice: 10,
			occurredAt: '2026-09-01T00:00:00.000Z',
			sourceEvent: 'event-signing',
			trainerId: 'trainer-misty'
		}),
		{
			timestamp: '2026-09-01T00:00:00.000Z',
			previousPrice: 10,
			price: 10.5,
			change: 0.5,
			changePercent: 5,
			reason: {
				type: 'roster_change',
				transition: 'signing',
				trainerId: 'trainer-misty',
				appliedPercent: 5
			},
			rulesVersion: 'roster-market-v1',
			sourceEvent: 'event-signing'
		}
	);
	assert.equal(
		buildRosterPricePoint({
			transition: 'release',
			previousPrice: 1,
			occurredAt: '2026-09-01T00:00:00.000Z',
			sourceEvent: 'event-release',
			trainerId: 'trainer-misty'
		}).price,
		1
	);
});

test('free-agent replenishment reaches the target with unique eligible species', () => {
	const planned = planFreeAgentReplenishment({
		currentPoolSize: 1,
		minimumPoolSize: 2,
		targetPoolSize: 4,
		seed: 'pool-day-1',
		existingSpeciesIds: ['species-a', 'species-retired'],
		retiredSpeciesIds: ['species-retired'],
		eligibleSpeciesIds: ['species-d', 'species-b', 'species-a', 'species-c', 'species-retired']
	});

	assert.equal(planned.length, 3);
	assert.deepEqual(
		new Set(planned.map((entry) => entry.speciesId)),
		new Set(['species-b', 'species-c', 'species-d'])
	);
	assert.deepEqual(
		planFreeAgentReplenishment({
			currentPoolSize: 2,
			minimumPoolSize: 2,
			targetPoolSize: 4,
			seed: 'pool-day-1',
			existingSpeciesIds: [],
			retiredSpeciesIds: [],
			eligibleSpeciesIds: ['species-a']
		}),
		[]
	);
});

test('replenished racers use the canonical versioned lifecycle trait rules', () => {
	assert.deepEqual(
		generateRosterRacerTraits('species-pikachu', 'pool-day-1:free-agent:1'),
		generateRacerTraits({
			speciesKey: 'species-pikachu',
			generationSeed: 'pool-day-1:free-agent:1',
			rulesVersion: RACER_TRAIT_RULES_VERSION
		})
	);
});

test('roster news states only the recorded signing facts', () => {
	assert.deepEqual(
		buildRosterStory({
			eventId: 'event-signing',
			occurredAt: '2026-09-01T00:00:00.000Z',
			transition: 'signing',
			racer: { id: 'racer-pika', name: 'Bolt' },
			trainer: { id: 'trainer-misty', name: 'Misty' },
			league: { id: 'league-one', name: 'Premier League' },
			price: 10.5
		}),
		{
			headline: 'Misty signs Bolt',
			summary: "Bolt joined Misty's roster for ₽10.50 and will compete in Premier League.",
			category: 'signing',
			importance: 60,
			publishedAt: '2026-09-01T00:00:00.000Z',
			templateVersion: 'roster-story-v1',
			links: [
				{ kind: 'racer', id: 'racer-pika', label: 'Bolt', href: '/exchange' },
				{ kind: 'trainer', id: 'trainer-misty', label: 'Misty', href: '/trainers' },
				{ kind: 'league', id: 'league-one', label: 'Premier League', href: '/' }
			]
		}
	);
});
