import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_POCKETBASE_URL, resolvePocketBaseUrl } from '../src/lib/pocketbase-url.js';

test('uses an absolute local PocketBase URL when PUBLIC_PB_URL is missing', () => {
	assert.equal(resolvePocketBaseUrl(), DEFAULT_POCKETBASE_URL);
	assert.equal(new URL(resolvePocketBaseUrl()).origin, DEFAULT_POCKETBASE_URL);
});

test('accepts a configured absolute PocketBase URL', () => {
	assert.equal(resolvePocketBaseUrl('https://pb.example.com'), 'https://pb.example.com');
});

test('rejects a relative PocketBase URL during startup', () => {
	assert.throws(() => resolvePocketBaseUrl('/api'), /must be an absolute HTTP\(S\) URL/);
});
