import assert from 'node:assert/strict';
import test from 'node:test';

import { configureRequestPocketBase } from '../src/lib/server/requestPocketBase';

test('request-scoped PocketBase clients allow overlapping layout and page queries', () => {
	const settings: boolean[] = [];
	const client = {
		autoCancellation(enabled: boolean) {
			settings.push(enabled);
		}
	};

	assert.equal(configureRequestPocketBase(client), client);
	assert.deepEqual(settings, [false]);
});
