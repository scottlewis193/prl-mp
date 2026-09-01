import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyRacePositions } from '../src/lib/raceProgress';

test('live Grand Prix positions distinguish overall order from snapshotted class order', () => {
	assert.deepEqual(
		classifyRacePositions(
			['racer-a', 'racer-b', 'racer-c', 'racer-d'],
			[
				{ racerId: 'racer-a', classId: 'premier', className: 'Premier' },
				{ racerId: 'racer-b', classId: 'challenger', className: 'Challenger' },
				{ racerId: 'racer-c', classId: 'premier', className: 'Premier' },
				{ racerId: 'racer-d', classId: 'challenger', className: 'Challenger' }
			]
		),
		[
			{ racerId: 'racer-a', overallPosition: 1, classPosition: 1, className: 'Premier' },
			{ racerId: 'racer-b', overallPosition: 2, classPosition: 1, className: 'Challenger' },
			{ racerId: 'racer-c', overallPosition: 3, classPosition: 2, className: 'Premier' },
			{ racerId: 'racer-d', overallPosition: 4, classPosition: 2, className: 'Challenger' }
		]
	);
});
