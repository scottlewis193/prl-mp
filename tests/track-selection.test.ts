import assert from 'node:assert/strict';
import test from 'node:test';

import trackSelection from '../pocketbase/pb_hooks/trackSelection.cjs';

test('scheduler rotates across every compatible track without track-specific rules', () => {
	const tracks = [
		{ id: 'track-b', compatibleFormats: ['circuit'] },
		{ id: 'track-a', compatibleFormats: ['circuit'] },
		{ id: 'track-c', compatibleFormats: ['sprint'] }
	];

	assert.equal(trackSelection.selectCompatibleTrack(tracks, 'circuit', 0).id, 'track-a');
	assert.equal(trackSelection.selectCompatibleTrack(tracks, 'circuit', 1).id, 'track-b');
	assert.equal(trackSelection.selectCompatibleTrack(tracks, 'circuit', 2).id, 'track-a');
});

test('scheduler treats migrated legacy tracks as circuit-compatible', () => {
	assert.equal(trackSelection.normalizeRaceFormat(undefined), trackSelection.DEFAULT_RACE_FORMAT);
	assert.equal(trackSelection.normalizeRaceFormat('  circuit  '), 'circuit');
	assert.equal(
		trackSelection.selectCompatibleTrack([{ id: 'legacy-track' }], 'circuit', 12).id,
		'legacy-track'
	);
	assert.throws(
		() => trackSelection.selectCompatibleTrack([{ id: 'legacy-track' }], 'sprint', 0),
		/no racetrack supports/i
	);
});

test('a fixed scheduling seed produces a reproducible compatible rotation without repeats', () => {
	const tracks = [
		{ id: 'track-c', compatibleFormats: ['circuit'] },
		{ id: 'track-a', compatibleFormats: ['circuit'] },
		{ id: 'track-sprint', compatibleFormats: ['sprint'] },
		{ id: 'track-b', compatibleFormats: ['circuit'] }
	];
	const rotate = (seed: string) =>
		Array.from(
			{ length: 7 },
			(_, index) => trackSelection.selectCompatibleTrack(tracks, 'circuit', index, seed).id
		);

	assert.deepEqual(rotate('A'), [
		'track-c',
		'track-a',
		'track-b',
		'track-c',
		'track-a',
		'track-b',
		'track-c'
	]);
	assert.deepEqual(rotate('A'), rotate('A'));
	assert.notDeepEqual(rotate('A'), rotate('B'));
	assert.equal(rotate('A').includes('track-sprint'), false);
	assert.equal(
		rotate('A').some((track, index, rotation) => track === rotation[index - 1]),
		false
	);
});
