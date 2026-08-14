import assert from 'node:assert/strict';
import test from 'node:test';

import { deleteAllRecords } from '../src/lib/server/recordDeletion';

test('bulk deletion surfaces a record failure instead of reporting success', async () => {
	const deletedIds: string[] = [];
	const collection = {
		getFullList: async () => [{ id: 'first' }, { id: 'second' }],
		delete: async (id: string) => {
			deletedIds.push(id);
			if (id === 'second') throw new Error('delete failed');
		}
	};

	await assert.rejects(() => deleteAllRecords(collection), /delete failed/);
	assert.deepEqual(deletedIds, ['first', 'second']);
});
