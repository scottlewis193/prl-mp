import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRaceCompletion, shouldFinishRace } from '../src/lib/server/raceCompletion';
import type { Racer } from '../src/lib/types';

test('does not finish a race with no racers', () => {
	assert.equal(shouldFinishRace([]), false);
});

test('records deterministic completion metadata after every racer finishes', () => {
	const racers = [
		{ id: 'racer-b', currentRace: { finished: true, finishedAt: '2026-08-14T12:00:01Z' } },
		{ id: 'racer-a', currentRace: { finished: true, finishedAt: '2026-08-14T12:00:01Z' } }
	] as Racer[];

	assert.deepEqual(buildRaceCompletion('race-1', racers), {
		id: 'race-1',
		status: 'finished',
		winner: 'racer-a',
		endTime: '2026-08-14T12:00:01Z',
		finishingOrder: ['racer-a', 'racer-b']
	});
});

test('completes after every racer reaches a terminal finish or DNF outcome', () => {
	const racers = [
		{
			id: 'racer-a',
			currentRace: { finished: true, outcome: 'finished', finishedAt: '2026-08-14T12:00:02Z' }
		},
		{
			id: 'racer-b',
			currentRace: { finished: true, outcome: 'dnf', finishedAt: '2026-08-14T12:00:01Z' }
		}
	] as Racer[];

	assert.deepEqual(buildRaceCompletion('race-dnf', racers), {
		id: 'race-dnf',
		status: 'finished',
		winner: 'racer-a',
		endTime: '2026-08-14T12:00:02Z',
		finishingOrder: ['racer-a'],
		nonFinishers: [{ racerId: 'racer-b', occurredAt: '2026-08-14T12:00:01Z', reason: 'incident' }]
	});
});
