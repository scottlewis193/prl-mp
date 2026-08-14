import assert from 'node:assert/strict';
import test from 'node:test';

import { mutateWatchlist } from '../src/lib/watchlistMutation';

test('watchlist mutation publishes optimistic state and then the saved state', async () => {
	const states: string[][] = [];
	const result = await mutateWatchlist({
		current: ['racer-1'],
		racerId: 'racer-2',
		apply: (watchlist) => states.push([...watchlist]),
		persist: async (watchlist) => [...watchlist, 'server-added']
	});

	assert.deepEqual(states, [
		['racer-1', 'racer-2'],
		['racer-1', 'racer-2', 'server-added']
	]);
	assert.deepEqual(result, ['racer-1', 'racer-2', 'server-added']);
});

test('watchlist mutation rolls optimistic state back and reports persistence failures', async () => {
	const states: string[][] = [];

	await assert.rejects(
		mutateWatchlist({
			current: ['racer-1'],
			racerId: 'racer-1',
			apply: (watchlist) => states.push([...watchlist]),
			persist: async () => {
				throw new Error('network unavailable');
			}
		}),
		/network unavailable/
	);
	assert.deepEqual(states, [[], ['racer-1']]);
});
