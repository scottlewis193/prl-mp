import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateRacer } from '../src/lib/server/simulateRacer';
import type { Race, Racer, RaceTrack } from '../src/lib/types';

const racetrack: RaceTrack = {
	id: 'track-1',
	name: 'Test Track',
	checkpoints: [
		{ index: 0, x: 0, y: 0 },
		{ index: 1, x: 100, y: 0 }
	],
	data: {},
	tileset: '',
	totalLength: 200,
	width: 64,
	maxSize: { x: 100, y: 100 }
};

const race: Race = {
	id: 'race-1',
	name: 'Test Race',
	status: 'running',
	racetrack: racetrack.id,
	winner: '',
	startTime: new Date(0),
	endTime: new Date(0),
	totalLaps: 1
};

const racer = {
	pokemon: 'pokemon-1',
	expand: { pokemon: { speed: 10 } },
	stats: { speed: 0 },
	currentRace: {
		checkpointIndex: 0,
		distanceFromCheckpoint: 0,
		lapsCompleted: 0,
		lastUpdatedAt: new Date(0).toISOString(),
		finished: false,
		lapTimes: {}
	},
	positioning: { trackOffset: 0, targetTrackOffset: 0 }
} as Racer;

test('simulates a racer using the race track referenced by the race', () => {
	const result = simulateRacer(racer, racetrack, 1_000, race.totalLaps);

	assert.deepEqual(result, {
		checkpointIndex: 0,
		distanceFromCheckpoint: 10,
		lapsCompleted: 0,
		lastUpdatedAt: new Date(1_000).toISOString(),
		finished: false,
		x: 10,
		y: 0
	});
});

test('initialises a racer with no race timestamp before calculating movement', () => {
	const racerWithoutTimestamp = structuredClone(racer);
	racerWithoutTimestamp.currentRace.lastUpdatedAt = '';

	const initialState = simulateRacer(racerWithoutTimestamp, racetrack, 1_000, race.totalLaps);
	assert.equal(initialState.x, 0);
	assert.equal(initialState.y, 0);
	assert.equal(initialState.distanceFromCheckpoint, 0);

	Object.assign(racerWithoutTimestamp.currentRace, initialState);
	const movingState = simulateRacer(racerWithoutTimestamp, racetrack, 1_500, race.totalLaps);
	assert.equal(movingState.x, 5);
	assert.equal(movingState.y, 0);
});

test('caps elapsed movement when resuming a racer after a service restart', () => {
	const staleRacer = structuredClone(racer);
	staleRacer.currentRace.lastUpdatedAt = new Date(0).toISOString();

	const resumedState = simulateRacer(staleRacer, racetrack, 60_000, race.totalLaps);

	assert.equal(resumedState.distanceFromCheckpoint, 10);
	assert.equal(resumedState.x, 10);
	assert.equal(resumedState.lastUpdatedAt, new Date(60_000).toISOString());
});
