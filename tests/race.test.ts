import assert from 'node:assert/strict';
import test from 'node:test';

import { Race } from '../src/lib/types';

test('new races have a name accepted by the PocketBase schema', () => {
	assert.notEqual(new Race().name.trim(), '');
});

test('new races leave ID generation to PocketBase', () => {
	assert.equal(new Race().id, undefined);
});
