import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWinnerMarket, quoteWager } from '../src/lib/wager';

test('an upcoming race exposes a winner market with fixed odds and a clear cutoff', () => {
	const market = buildWinnerMarket(
		[
			{ racerId: 'racer-a', ranking: 1 },
			{ racerId: 'racer-b', ranking: 3 }
		],
		'2026-08-15T14:00:00.000Z'
	);

	assert.deepEqual(market, {
		type: 'winner',
		name: 'Race winner',
		cutoff: '2026-08-15T14:00:00.000Z',
		selections: [
			{ racerId: 'racer-a', odds: 1.33 },
			{ racerId: 'racer-b', odds: 4 }
		]
	});
});

test('a valid wager quote freezes selection, stake, odds, and potential payout', () => {
	const quote = quoteWager({
		market: {
			type: 'winner',
			name: 'Race winner',
			cutoff: '2026-08-15T14:00:00.000Z',
			selections: [{ racerId: 'racer-a', odds: 2.5 }]
		},
		selection: 'racer-a',
		stake: 12.34,
		now: '2026-08-15T13:59:59.999Z'
	});

	assert.deepEqual(quote, {
		market: 'winner',
		selection: 'racer-a',
		stake: 12.34,
		odds: 2.5,
		potentialPayout: 30.85
	});
});

test('wager quoting rejects invalid stakes, selections, and placement at or after cutoff', () => {
	const market = {
		type: 'winner' as const,
		name: 'Race winner',
		cutoff: '2026-08-15T14:00:00.000Z',
		selections: [{ racerId: 'racer-a', odds: 2.5 }]
	};

	for (const stake of [0, -1, 1.001, Number.NaN]) {
		assert.throws(
			() => quoteWager({ market, selection: 'racer-a', stake, now: '2026-08-15T13:00:00Z' }),
			/positive amount in whole cents/i
		);
	}
	assert.throws(
		() => quoteWager({ market, selection: 'racer-b', stake: 1, now: '2026-08-15T13:00:00Z' }),
		/available selection/i
	);
	for (const now of ['2026-08-15T14:00:00.000Z', '2026-08-15T14:00:00.001Z']) {
		assert.throws(() => quoteWager({ market, selection: 'racer-a', stake: 1, now }), /closed/i);
	}
});
