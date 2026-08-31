import assert from 'node:assert/strict';
import test from 'node:test';

import { BaseAuthStore } from 'pocketbase';
import { createBrowserPocketBase } from '../src/lib/pocketbaseClient';

test('the browser PocketBase client keeps authentication in the synchronized cookie, not local storage', () => {
	const client = createBrowserPocketBase('http://127.0.0.1:8090');
	assert.ok(client.authStore instanceof BaseAuthStore);
	assert.equal(client.authStore.constructor, BaseAuthStore);
});
