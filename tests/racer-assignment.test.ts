import assert from 'node:assert/strict';
import test from 'node:test';

import { selectUnassignedRacers } from '../src/lib/server/racerAssignment';
import type { Racer } from '../src/lib/types';

test('selects only racers without a race assignment', () => {
	const racers = [
		{ id: 'available', race: '', status: { retired: false, injured: false } },
		{ id: 'retired', race: '', status: { retired: true, injured: false } },
		{ id: 'assigned', race: 'race-1' }
	] as Racer[];

	assert.deepEqual(
		selectUnassignedRacers(racers).map((racer) => racer.id),
		['available']
	);
});
