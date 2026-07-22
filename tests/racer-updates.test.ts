import assert from 'node:assert/strict';
import test from 'node:test';

import { applyRacerUpdate } from '../src/lib/racerUpdates';
import type { Racer } from '../src/lib/types';

test('updates the supplied racer list when a racer is assigned to a race', () => {
	const racers = [
		{ id: 'racer-1', race: '', positioning: { x: 0, y: 0, targetTrackOffset: 0 } }
	] as Racer[];
	const update = {
		id: 'racer-1',
		race: 'race-1',
		positioning: { x: 10, y: 20, targetTrackOffset: 0 }
	} as Racer;

	applyRacerUpdate(racers, update, 123);

	assert.equal(racers[0].race, 'race-1');
	assert.equal(racers[0].positioning.x, 10);
	assert.equal(racers[0]._interpStartTime, 123);
});

test('continues interpolation from the racer’s current displayed position', () => {
	const racers = [
		{
			id: 'racer-1',
			positioning: { x: 10, y: 0, targetTrackOffset: 0 },
			_lastTargetX: 0,
			_lastTargetY: 0,
			_targetX: 10,
			_targetY: 0,
			_displayX: 6,
			_displayY: 0
		}
	] as Racer[];
	const update = {
		id: 'racer-1',
		positioning: { x: 20, y: 0, targetTrackOffset: 0 }
	} as Racer;

	applyRacerUpdate(racers, update, 123);

	assert.equal(racers[0]._lastTargetX, 6);
	assert.equal(racers[0]._targetX, 20);
});
