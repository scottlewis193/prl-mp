import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldFinishRace } from '../src/lib/server/raceCompletion';

test('does not finish a race with no racers', () => {
	assert.equal(shouldFinishRace([]), false);
});
