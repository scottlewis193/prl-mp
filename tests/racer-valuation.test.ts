import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRacePricePoint } from '../src/lib/server/racerValuation';

test('race valuation records a rounded, bounded and explainable price movement', () => {
	assert.deepEqual(
		buildRacePricePoint({
			raceId: 'race-25',
			position: 1,
			fieldSize: 4,
			previousPrice: 12.34,
			recentFinishes: [1, 2],
			occurredAt: '2026-09-01T15:00:00.000Z',
			sourceEvent: 'event-race-25'
		}),
		{
			timestamp: '2026-09-01T15:00:00.000Z',
			previousPrice: 12.34,
			price: 13.57,
			change: 1.23,
			changePercent: 9.97,
			reason: {
				type: 'race_result',
				raceId: 'race-25',
				position: 1,
				fieldSize: 4,
				performancePercent: 8,
				recentFormPercent: 3,
				uncappedPercent: 11,
				appliedPercent: 10
			},
			rulesVersion: 'race-valuation-v1',
			sourceEvent: 'event-race-25'
		}
	);
});

test('DNF valuation records the incident rather than inventing a finishing position', () => {
	const point = buildRacePricePoint({
		raceId: 'race-dnf',
		outcome: 'dnf',
		incidentReason: 'oil-slick',
		fieldSize: 4,
		previousPrice: 12.5,
		recentFinishes: [1, 2],
		occurredAt: '2026-09-01T15:00:00.000Z',
		sourceEvent: 'event-race-dnf'
	});

	assert.equal(point.price, 11.25);
	assert.deepEqual(point.reason, {
		type: 'race_result',
		raceId: 'race-dnf',
		outcome: 'dnf',
		incidentReason: 'oil-slick',
		fieldSize: 4,
		performancePercent: -10,
		recentFormPercent: 0,
		uncappedPercent: -10,
		appliedPercent: -10
	});
});
