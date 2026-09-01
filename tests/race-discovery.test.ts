import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyRaces, formatRaceSchedule, presentRace } from '../src/lib/raceDiscovery';
import type { Race, Racer, RaceTrackType } from '../src/lib/types';

const track = {
	id: 'track-1',
	name: 'Indigo Circuit',
	length: 1_200,
	totalLength: 1_200,
	width: 40,
	surface: 'grass',
	hazards: [{ type: 'tight-turn', severity: 0.25, checkpointIndex: 2 }],
	corneringDemand: 0.35,
	speedBias: 0.2,
	risk: 0.15,
	compatibleFormats: ['circuit']
} as RaceTrackType;

const trackCharacteristics = {
	length: 1_200,
	width: 40,
	surface: 'grass',
	hazards: [{ type: 'tight-turn', severity: 0.25, checkpointIndex: 2 }],
	corneringDemand: 0.35,
	speedBias: 0.2,
	risk: 0.15,
	compatibleFormats: ['circuit'],
	surfaceLabel: 'Grass',
	hazardLabels: ['Tight Turn'],
	formatLabels: ['Circuit'],
	corneringDemandPercent: 35,
	speedBiasPercent: 20,
	riskPercent: 15
};
const racers = [
	{ id: 'racer-1', name: 'Bolt', race: 'race-live' },
	{ id: 'racer-2', name: 'Dash', race: 'race-live' },
	{ id: 'racer-3', name: 'Comet', race: '' }
] as Racer[];

function race(id: string, status: Race['status'], startTime: string): Race {
	return {
		id,
		name: `${status} race`,
		status,
		racetrack: track.id,
		winner: '',
		finishingOrder: [],
		startTime: new Date(startTime),
		endTime: new Date(startTime),
		totalLaps: 3
	} as Race;
}

test('race discovery separates upcoming, live and completed races in useful order', () => {
	const races = [
		race('settled', 'settled', '2026-08-15T10:00:00Z'),
		race('later', 'pending', '2026-08-15T14:00:00Z'),
		race('live', 'running', '2026-08-15T12:00:00Z'),
		race('sooner', 'countdown', '2026-08-15T13:00:00Z'),
		race('finished', 'finished', '2026-08-15T11:00:00Z')
	];

	const groups = classifyRaces(races);
	assert.deepEqual(
		groups.upcoming.map((item) => item.id),
		['sooner', 'later']
	);
	assert.deepEqual(
		groups.live.map((item) => item.id),
		['live']
	);
	assert.deepEqual(
		groups.completed.map((item) => item.id),
		['finished', 'settled']
	);
});

test('race presentation resolves track, participants, winner and finishing results', () => {
	const completed = race('race-finished', 'settled', '2026-08-15T10:00:00Z');
	completed.winner = 'racer-3';
	completed.finishingOrder = ['racer-3', 'racer-1', 'missing-racer'];
	completed.prizeCurve = [30, 20, 10];
	completed.awardedPrizes = [
		{ racerId: 'racer-3', position: 1, amount: 30 },
		{ racerId: 'racer-1', position: 2, amount: 20 },
		{ racerId: 'missing-racer', position: 3, amount: 10 }
	];

	assert.deepEqual(presentRace(completed, racers, [track]), {
		race: completed,
		trackName: 'Indigo Circuit',
		trackCharacteristics,
		participants: [racers[2], racers[0]],
		participantCount: 2,
		winnerName: 'Comet',
		prizeStructure: [
			{ position: 1, amount: 30 },
			{ position: 2, amount: 20 },
			{ position: 3, amount: 10 }
		],
		results: [
			{ position: 1, racerId: 'racer-3', racerName: 'Comet', prizeMoney: 30 },
			{ position: 2, racerId: 'racer-1', racerName: 'Bolt', prizeMoney: 20 },
			{
				position: 3,
				racerId: 'missing-racer',
				racerName: 'Unknown racer',
				prizeMoney: 10
			}
		]
	});
});

test('race presentation treats a null PocketBase finishing order as no results', () => {
	const pending = race('race-pending', 'pending', '2026-08-15T14:00:00Z');
	pending.finishingOrder = null as unknown as string[];

	assert.deepEqual(presentRace(pending, racers, [track]), {
		race: pending,
		trackName: 'Indigo Circuit',
		trackCharacteristics,
		participants: [],
		participantCount: 0,
		winnerName: undefined,
		prizeStructure: [],
		results: []
	});
});

test('race schedule gives an exact time and a useful countdown', () => {
	assert.equal(
		formatRaceSchedule('2026-08-15T13:02:05Z', new Date('2026-08-15T13:00:00Z')),
		'15 Aug 2026, 13:02 UTC · Starts in 2m 5s'
	);
	assert.equal(formatRaceSchedule('invalid', new Date('2026-08-15T13:00:00Z')), 'Time TBC');
});
