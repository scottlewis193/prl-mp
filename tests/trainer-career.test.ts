import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTrainerCareer, loadAllTrainerRaceResults } from '../src/lib/server/trainerCareer';

test('rebuilds trainer career aggregates and recent results from durable race results', () => {
	const career = buildTrainerCareer(
		[
			{
				id: 'result-old',
				raceId: 'race-old',
				racerId: 'racer-a',
				trainerId: 'trainer-1',
				position: 3,
				earnings: 4,
				occurredAt: '2026-08-13T12:00:00.000Z'
			},
			{
				id: 'result-new',
				raceId: 'race-new',
				racerId: 'racer-b',
				trainerId: 'trainer-1',
				position: 1,
				earnings: 12,
				occurredAt: '2026-08-14T12:00:00.000Z'
			}
		],
		[{ id: 'championship-1', trainerId: 'trainer-1', occurredAt: '2026-08-15T12:00:00.000Z' }]
	);

	assert.deepEqual(career, {
		starts: 2,
		wins: 1,
		podiums: 2,
		earnings: 16,
		championships: 1,
		recentResults: [
			{
				resultId: 'result-new',
				raceId: 'race-new',
				racerId: 'racer-b',
				position: 1,
				earnings: 12,
				occurredAt: '2026-08-14T12:00:00.000Z'
			},
			{
				resultId: 'result-old',
				raceId: 'race-old',
				racerId: 'racer-a',
				position: 3,
				earnings: 4,
				occurredAt: '2026-08-13T12:00:00.000Z'
			}
		]
	});
});

test('keeps only the ten most recent results and rejects malformed durable facts', () => {
	const results = Array.from({ length: 5_001 }, (_, index) => ({
		id: `result-${index}`,
		raceId: `race-${index}`,
		racerId: `racer-${index}`,
		trainerId: 'trainer-1',
		position: index + 1,
		earnings: index,
		occurredAt: new Date(Date.UTC(2026, 7, index + 1)).toISOString()
	}));

	const career = buildTrainerCareer(results);
	assert.equal(career.starts, 5_001);
	assert.equal(career.earnings, 12_502_500);
	assert.equal(career.recentResults.length, 10);
	assert.equal(career.recentResults[0].resultId, 'result-5000');
	assert.throws(
		() => buildTrainerCareer([{ ...results[0], position: 0 }]),
		/valid trainer race result/i
	);
});

test('loads every trainer result in deterministic pages beyond the database batch size', () => {
	const calls: Array<{ limit: number; offset: number }> = [];
	const rows = Array.from({ length: 5_001 }, (_, index) => ({ id: `result-${index}` }));
	const app = {
		findRecordsByFilter(
			_collection: string,
			_filter: string,
			_sort: string,
			limit: number,
			offset: number
		) {
			calls.push({ limit, offset });
			return rows.slice(offset, offset + limit);
		}
	};

	assert.equal(loadAllTrainerRaceResults(app as never, 'trainer-1').length, 5_001);
	assert.deepEqual(calls, [
		{ limit: 1_000, offset: 0 },
		{ limit: 1_000, offset: 1_000 },
		{ limit: 1_000, offset: 2_000 },
		{ limit: 1_000, offset: 3_000 },
		{ limit: 1_000, offset: 4_000 },
		{ limit: 1_000, offset: 5_000 }
	]);
});
