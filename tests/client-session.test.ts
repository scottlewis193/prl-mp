import assert from 'node:assert/strict';
import test from 'node:test';

import { finishClientLogout } from '../src/lib/clientSession';

test('client logout clears browser authentication before applying the login redirect', async () => {
	const calls: string[] = [];
	const result = { type: 'redirect', location: '/login' };

	await finishClientLogout({ clear: () => calls.push('clear') }, result, async (receivedResult) => {
		assert.equal(receivedResult, result);
		calls.push('redirect');
	});

	assert.deepEqual(calls, ['clear', 'redirect']);
});
