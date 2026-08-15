import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRaceSettlement, orderRaceFinishers } from '../src/lib/server/raceSettlement';
import type { Race, Racer } from '../src/lib/types';

test('orders finishers by finish time and uses racer ID as a deterministic tie-breaker', () => {
	const racers = [
		{ id: 'racer-c', currentRace: { finishedAt: '2026-08-14T12:00:02.000Z' } },
		{ id: 'racer-b', currentRace: { finishedAt: '2026-08-14T12:00:01.000Z' } },
		{ id: 'racer-a', currentRace: { finishedAt: '2026-08-14T12:00:01.000Z' } }
	] as Racer[];

	assert.deepEqual(
		orderRaceFinishers(racers).map((racer) => racer.id),
		['racer-a', 'racer-b', 'racer-c']
	);
});

test('builds progression and configured rewards for every finisher', () => {
	const race = { id: 'race-1', status: 'finished' } as Race;
	const racers = [
		settlementRacer('racer-b', '2026-08-14T12:00:02.000Z', {
			wins: 1,
			totalRaces: 2,
			averageFinishPosition: 2,
			totalEarnings: 8,
			ranking: 7
		}),
		settlementRacer('racer-a', '2026-08-14T12:00:01.000Z', { ranking: 12 })
	];

	const settlement = buildRaceSettlement(race, racers, [4, 2]);

	assert.deepEqual(settlement.race, {
		id: 'race-1',
		status: 'settled',
		winner: 'racer-a',
		endTime: '2026-08-14T12:00:02.000Z',
		finishingOrder: ['racer-a', 'racer-b'],
		awardedPrizes: [
			{ racerId: 'racer-a', position: 1, amount: 4 },
			{ racerId: 'racer-b', position: 2, amount: 2 }
		]
	});
	assert.deepEqual(
		settlement.racers.map((racer) => ({
			id: racer.id,
			race: racer.race,
			ranking: racer.stats.ranking,
			history: racer.raceHistory,
			totalEarnings: racer.financials.totalEarnings,
			earningsPerShare: racer.financials.earningsPerShare
		})),
		[
			{
				id: 'racer-a',
				race: '',
				ranking: 7,
				history: {
					wins: 1,
					totalRaces: 1,
					averageFinishPosition: 1,
					races: [
						{
							raceId: 'race-1',
							position: 1,
							prizeMoney: 4,
							date: '2026-08-14T12:00:02.000Z'
						}
					]
				},
				totalEarnings: 4,
				earningsPerShare: 0.004
			},
			{
				id: 'racer-b',
				race: '',
				ranking: 12,
				history: {
					wins: 1,
					totalRaces: 3,
					averageFinishPosition: 2,
					races: [
						{
							raceId: 'old-race',
							position: 2,
							prizeMoney: 8,
							date: '2026-08-13T12:00:00.000Z'
						},
						{
							raceId: 'race-1',
							position: 2,
							prizeMoney: 2,
							date: '2026-08-14T12:00:02.000Z'
						}
					]
				},
				totalEarnings: 10,
				earningsPerShare: 0.01
			}
		]
	);
});

function settlementRacer(
	id: string,
	finishedAt: string,
	existing: {
		wins?: number;
		totalRaces?: number;
		averageFinishPosition?: number;
		totalEarnings?: number;
		ranking?: number;
	} = {}
): Racer {
	const hasHistory = (existing.totalRaces ?? 0) > 0;
	return {
		id,
		race: 'race-1',
		league: 'league-1',
		currentRace: { finished: true, finishedAt },
		stats: { ranking: existing.ranking ?? 99 },
		raceHistory: {
			wins: existing.wins ?? 0,
			totalRaces: existing.totalRaces ?? 0,
			averageFinishPosition: existing.averageFinishPosition ?? 0,
			races: hasHistory
				? [
						{
							raceId: 'old-race',
							position: 2,
							prizeMoney: 8,
							date: '2026-08-13T12:00:00.000Z'
						}
					]
				: []
		},
		ownership: { totalShares: 1000 },
		financials: { totalEarnings: existing.totalEarnings ?? 0 }
	} as Racer;
}
