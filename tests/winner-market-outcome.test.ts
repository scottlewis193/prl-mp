import assert from 'node:assert/strict';
import test from 'node:test';

import settlementRules from '../pocketbase/pb_hooks/raceSettlement.cjs';

test('winner market settles to the first classified finisher and voids all-DNF races', () => {
	assert.deepEqual(
		settlementRules.resolveWinnerMarketOutcome({
			winnerId: 'racer-a',
			finishingOrder: ['racer-a']
		}),
		{ outcome: 'settled', winnerId: 'racer-a' }
	);
	assert.deepEqual(
		settlementRules.resolveWinnerMarketOutcome({ winnerId: '', finishingOrder: [] }),
		{ outcome: 'void', winnerId: '' }
	);
});

test('winner market rejects an ambiguous stored outcome', () => {
	assert.throws(
		() =>
			settlementRules.resolveWinnerMarketOutcome({
				winnerId: 'racer-b',
				finishingOrder: ['racer-a']
			}),
		/invalid winner outcome/i
	);
});
