import assert from 'node:assert/strict';
import test from 'node:test';

import {
	applyLeagueRaceResult,
	pointsForRaceSettlement,
	orderLeagueStandings,
	type LeagueStanding
} from '../src/lib/leagueStandings';

function standing(
	racerId: string,
	overrides: Partial<Omit<LeagueStanding, 'racerId'>> = {}
): LeagueStanding {
	return {
		racerId,
		points: 0,
		starts: 0,
		wins: 0,
		podiums: 0,
		bestFinish: 0,
		recentForm: [],
		...overrides
	};
}

test('a ranked league result updates every visible standing statistic', () => {
	assert.deepEqual(
		applyLeagueRaceResult(
			standing('racer-1', {
				points: 18,
				starts: 2,
				wins: 1,
				podiums: 2,
				bestFinish: 1,
				recentForm: [1, 3]
			}),
			{ position: 2, points: 15 }
		),
		standing('racer-1', {
			points: 33,
			starts: 3,
			wins: 1,
			podiums: 3,
			bestFinish: 1,
			recentForm: [2, 1, 3]
		})
	);

	assert.deepEqual(
		applyLeagueRaceResult(standing('new-racer'), { position: 6, points: 0 }),
		standing('new-racer', {
			starts: 1,
			bestFinish: 6,
			recentForm: [6]
		})
	);
});

test('recent form retains the five latest league finishes', () => {
	assert.deepEqual(
		applyLeagueRaceResult(
			standing('racer-1', { starts: 5, bestFinish: 1, recentForm: [5, 4, 3, 2, 1] }),
			{ position: 6, points: 0 }
		).recentForm,
		[6, 5, 4, 3, 2]
	);
});

test('standings resolve ties by points, wins, podiums, best finish, then racer ID', () => {
	const ordered = orderLeagueStandings([
		standing('racer-id-z', { points: 30, wins: 1, podiums: 2, bestFinish: 2 }),
		standing('racer-best-finish', { points: 30, wins: 1, podiums: 2, bestFinish: 1 }),
		standing('racer-podiums', { points: 30, wins: 1, podiums: 3, bestFinish: 3 }),
		standing('racer-wins', { points: 30, wins: 2, podiums: 2, bestFinish: 2 }),
		standing('racer-points', { points: 40, wins: 0, podiums: 0, bestFinish: 0 }),
		standing('racer-id-a', { points: 30, wins: 1, podiums: 2, bestFinish: 2 })
	]);

	assert.deepEqual(
		ordered.map((entry) => entry.racerId),
		['racer-points', 'racer-wins', 'racer-podiums', 'racer-best-finish', 'racer-id-a', 'racer-id-z']
	);
});

test('season points apply only to a valid ranked League Race snapshot', () => {
	assert.deepEqual(
		pointsForRaceSettlement(
			{ type: 'league_race', ranked: true, rulesVersion: 'league-race-v1' },
			[10, 6, 3],
			2
		),
		[10, 6]
	);
	assert.equal(
		pointsForRaceSettlement(
			{ type: 'exhibition', ranked: false, rulesVersion: 'exhibition-v1' },
			[999],
			1
		),
		null
	);
	assert.equal(pointsForRaceSettlement(undefined, [999], 1), null);
	assert.throws(
		() =>
			pointsForRaceSettlement(
				{ type: 'league_race', ranked: true, rulesVersion: 'league-race-v1' },
				[10],
				2
			),
		/points curve/i
	);
});

test('Grand Prix points use class positions only when its snapshot explicitly enables ranking', () => {
	assert.deepEqual(
		pointsForRaceSettlement(
			{ type: 'grand_prix', ranked: true, rulesVersion: 'grand-prix-v1' },
			[10, 6],
			[1, 1, 2, 2]
		),
		[10, 10, 6, 6]
	);
	assert.equal(
		pointsForRaceSettlement(
			{ type: 'grand_prix', ranked: false, rulesVersion: 'grand-prix-v1' },
			[10, 6],
			[1, 1, 2, 2]
		),
		null
	);
});
