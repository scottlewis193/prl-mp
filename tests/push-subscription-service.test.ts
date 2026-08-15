import assert from 'node:assert/strict';
import test from 'node:test';

import { createPushSubscriptionService } from '../src/lib/server/pushSubscriptionService';
import { isExpiredPushEndpoint } from '../src/lib/server/pushDelivery';

const validSubscription = {
	endpoint: 'https://push.example/player-1',
	expirationTime: null,
	keys: { p256dh: 'browser-public-key', auth: 'browser-auth-secret' }
};

test('missing push configuration is returned as a disabled explanatory state', () => {
	const service = createPushSubscriptionService({
		configured: false,
		publicKey: '',
		save: async () => {},
		remove: async () => {},
		has: async () => false
	});

	assert.deepEqual(service.configuration(), {
		available: false,
		reason: 'Push notifications are not configured on this server.'
	});
});

test('authenticated players can subscribe and unsubscribe through the service contract', async () => {
	const calls: unknown[] = [];
	const service = createPushSubscriptionService({
		configured: true,
		publicKey: 'server-public-key',
		save: async (playerId, value) => {
			calls.push({ operation: 'save', playerId, value });
		},
		remove: async (playerId, endpoint) => {
			calls.push({ operation: 'remove', playerId, endpoint });
		},
		has: async () => true
	});

	assert.deepEqual(service.configuration(), {
		available: true,
		publicKey: 'server-public-key'
	});
	assert.deepEqual(await service.subscribe('player-1', validSubscription), {
		status: 'subscribed'
	});
	assert.deepEqual(await service.unsubscribe('player-1', validSubscription.endpoint), {
		status: 'unsubscribed'
	});
	assert.deepEqual(await service.status('player-1', validSubscription.endpoint), {
		subscribed: true
	});
	assert.deepEqual(calls, [
		{ operation: 'save', playerId: 'player-1', value: validSubscription },
		{ operation: 'remove', playerId: 'player-1', endpoint: validSubscription.endpoint }
	]);
});

test('subscription service rejects malformed browser subscription data', async () => {
	let saved = false;
	const service = createPushSubscriptionService({
		configured: true,
		publicKey: 'server-public-key',
		save: async () => {
			saved = true;
		},
		remove: async () => {},
		has: async () => false
	});

	await assert.rejects(
		() => service.subscribe('player-1', { endpoint: 'javascript:alert(1)', keys: {} }),
		/valid push subscription/i
	);
	assert.equal(saved, false);
});

test('subscription service refuses enrollment without an authenticated player', async () => {
	const service = createPushSubscriptionService({
		configured: true,
		publicKey: 'server-public-key',
		save: async () => {},
		remove: async () => {},
		has: async () => false
	});

	await assert.rejects(() => service.subscribe(null, validSubscription), /sign in/i);
});

test('push delivery recognises endpoints the provider says are expired', () => {
	assert.equal(isExpiredPushEndpoint({ statusCode: 404 }), true);
	assert.equal(isExpiredPushEndpoint({ statusCode: 410 }), true);
	assert.equal(isExpiredPushEndpoint({ statusCode: 429 }), false);
});
