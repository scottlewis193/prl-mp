import assert from 'node:assert/strict';
import test from 'node:test';

import { createSubscriptionRepository } from '../src/lib/server/subscriptionRepository';

const refreshedSubscription = {
	endpoint: 'https://push.example/shared-endpoint',
	expirationTime: null,
	keys: { p256dh: 'refreshed-key', auth: 'refreshed-auth' }
};

test('saving a renewed subscription refreshes the existing server record', async () => {
	const calls: unknown[] = [];
	const collection = {
		getFirstListItem: async () => ({ id: 'subscription-1', user: 'player-1' }),
		update: async (id: string, value: unknown) => calls.push({ operation: 'update', id, value }),
		create: async (value: unknown) => calls.push({ operation: 'create', value }),
		delete: async (id: string) => calls.push({ operation: 'delete', id })
	};
	const repository = createSubscriptionRepository({ collection: () => collection } as never);

	await repository.save('player-1', refreshedSubscription);

	assert.deepEqual(calls, [
		{
			operation: 'update',
			id: 'subscription-1',
			value: { ...refreshedSubscription, user: 'player-1' }
		}
	]);
});

test('players can remove only their own stored endpoint', async () => {
	const calls: unknown[] = [];
	const collection = {
		getFirstListItem: async (filter: string) => {
			calls.push({ operation: 'find', filter });
			return { id: 'subscription-1' };
		},
		delete: async (id: string) => calls.push({ operation: 'delete', id })
	};
	const repository = createSubscriptionRepository({ collection: () => collection } as never);

	await repository.remove('player-1', refreshedSubscription.endpoint);

	assert.deepEqual(calls, [
		{
			operation: 'find',
			filter: 'user="player-1" && endpoint="https://push.example/shared-endpoint"'
		},
		{ operation: 'delete', id: 'subscription-1' }
	]);
});

test('delivery failures can remove an invalid endpoint and players can detect its absence', async () => {
	const calls: unknown[] = [];
	const collection = {
		getFirstListItem: async (filter: string) => {
			calls.push({ operation: 'find', filter });
			if (filter.startsWith('user=')) throw new Error('missing');
			return { id: 'subscription-1' };
		},
		delete: async (id: string) => calls.push({ operation: 'delete', id })
	};
	const repository = createSubscriptionRepository({ collection: () => collection } as never);

	assert.equal(await repository.has('player-1', refreshedSubscription.endpoint), false);
	await repository.removeEndpoint(refreshedSubscription.endpoint);
	assert.deepEqual(calls.at(-1), { operation: 'delete', id: 'subscription-1' });
});
