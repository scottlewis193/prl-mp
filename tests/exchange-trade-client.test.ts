import assert from 'node:assert/strict';
import test from 'node:test';
import type PocketBase from 'pocketbase';
import { executeAndRefreshTrade } from '../src/lib/exchangeTradeClient';

test('confirmed trade refreshes canonical account, holding, and supply state', async () => {
	const sent: Array<{ path: string; body: unknown }> = [];
	const client = {
		send: async (path: string, options: { body: unknown }) =>
			sent.push({ path, body: options.body }),
		filter: () => 'racer = "racer"',
		collection: (name: string) => {
			if (name === 'users')
				return { authRefresh: async () => ({ record: { id: 'player', balance: 80 } }) };
			if (name === 'holdings') {
				return {
					getFirstListItem: async () => ({
						id: 'holding',
						player: 'player',
						racer: 'racer',
						quantity: 2,
						costBasis: 20
					})
				};
			}
			return { getOne: async () => ({ financials: { outstandingShares: 998 } }) };
		}
	} as unknown as PocketBase;

	const refreshed = await executeAndRefreshTrade(client, 'racer', {
		side: 'buy',
		quantity: 2,
		idempotencyKey: 'request-id',
		expectedUnitPrice: 10
	});

	assert.deepEqual(sent, [
		{
			path: '/api/prl/economy/trade',
			body: {
				racerId: 'racer',
				side: 'buy',
				quantity: 2,
				idempotencyKey: 'request-id',
				expectedUnitPrice: 10
			}
		}
	]);
	assert.deepEqual(refreshed, {
		user: { id: 'player', balance: 80 },
		holding: {
			id: 'holding',
			player: 'player',
			racer: 'racer',
			quantity: 2,
			costBasis: 20
		},
		availableSupply: 998
	});
});
