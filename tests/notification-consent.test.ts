import assert from 'node:assert/strict';
import test from 'node:test';

import {
	getPushNotificationState,
	subscribeToPush,
	unsubscribeFromPush,
	type PushClientDependencies
} from '../src/lib/subscribe';

function subscription(endpoint: string, expirationTime: number | null = null) {
	let unsubscribed = false;
	return {
		endpoint,
		expirationTime,
		toJSON: () => ({ endpoint, keys: { p256dh: 'public-key', auth: 'auth-secret' } }),
		unsubscribe: async () => {
			unsubscribed = true;
			return true;
		},
		get unsubscribed() {
			return unsubscribed;
		}
	};
}

function client(overrides: Partial<PushClientDependencies> = {}) {
	const requests: Array<{ input: string; init?: RequestInit }> = [];
	let permissionRequests = 0;
	const createdSubscription = subscription('https://push.example/new');
	const dependencies: PushClientDependencies = {
		publicKey: 'AQID',
		now: () => 1_000,
		notifications: {
			permission: 'default',
			requestPermission: async () => {
				permissionRequests++;
				return 'granted';
			}
		},
		pushManager: {
			getSubscription: async () => null,
			subscribe: async () => createdSubscription as never
		},
		request: async (input, init) => {
			requests.push({ input, init });
			return init?.method === 'GET'
				? Response.json({ subscribed: true })
				: new Response(null, { status: 200 });
		},
		...overrides
	};

	return {
		dependencies,
		requests,
		createdSubscription,
		permissionRequests: () => permissionRequests
	};
}

test('notification state is explanatory and does not prompt when push is not configured', async () => {
	const browser = client({ publicKey: '' });

	assert.deepEqual(await getPushNotificationState(browser.dependencies), {
		status: 'unavailable',
		message: 'Push notifications are not configured on this server.'
	});
	assert.equal(browser.permissionRequests(), 0);
	assert.equal(browser.requests.length, 0);
});

test('notification permission is requested only by explicit subscription', async () => {
	const browser = client();

	assert.deepEqual(await getPushNotificationState(browser.dependencies), { status: 'inactive' });
	assert.equal(browser.permissionRequests(), 0);

	assert.deepEqual(await subscribeToPush(browser.dependencies), { status: 'active' });
	assert.equal(browser.permissionRequests(), 1);
	assert.equal(browser.requests[0]?.input, '/api/subscribe');
});

test('expired browser subscriptions are replaced when the player subscribes again', async () => {
	const expired = subscription('https://push.example/expired', 999);
	const browser = client({
		pushManager: {
			getSubscription: async () => expired as never,
			subscribe: async () => browser.createdSubscription as never
		}
	});

	assert.deepEqual(await getPushNotificationState(browser.dependencies), { status: 'expired' });
	assert.deepEqual(await subscribeToPush(browser.dependencies), { status: 'active' });
	assert.equal(expired.unsubscribed, true);
	assert.equal(browser.requests[0]?.init?.method, 'DELETE');
	assert.match(String(browser.requests[0]?.init?.body), /push\.example\/expired/);
	assert.equal(browser.requests[1]?.init?.method, 'POST');
	assert.match(String(browser.requests[1]?.init?.body), /push\.example\/new/);
});

test('a subscription removed by the push service is offered for recovery', async () => {
	const invalidated = subscription('https://push.example/gone');
	const replacement = subscription('https://push.example/replacement');
	const requests: Array<{ input: string; init?: RequestInit }> = [];
	const browser = client({
		notifications: { permission: 'granted', requestPermission: async () => 'granted' },
		pushManager: {
			getSubscription: async () => invalidated as never,
			subscribe: async () => replacement as never
		},
		request: async (input, init) => {
			requests.push({ input, init });
			return init?.method === 'GET'
				? Response.json({ subscribed: false })
				: new Response(null, { status: 200 });
		}
	});

	assert.deepEqual(await getPushNotificationState(browser.dependencies), { status: 'expired' });
	assert.deepEqual(await subscribeToPush(browser.dependencies), { status: 'active' });
	assert.equal(invalidated.unsubscribed, true);
	assert.match(String(requests.at(-1)?.init?.body), /push\.example\/replacement/);
});

test('players can unsubscribe an active browser subscription', async () => {
	const active = subscription('https://push.example/active');
	const browser = client({
		notifications: { permission: 'granted', requestPermission: async () => 'granted' },
		pushManager: {
			getSubscription: async () => active as never,
			subscribe: async () => active as never
		}
	});

	assert.deepEqual(await unsubscribeFromPush(browser.dependencies), { status: 'inactive' });
	assert.equal(active.unsubscribed, true);
	assert.equal(browser.requests[0]?.input, '/api/subscribe');
	assert.equal(browser.requests[0]?.init?.method, 'DELETE');
});
