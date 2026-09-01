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
	length: 200,
	totalLength: 200,
	width: 64,
	maxSize: { x: 100, y: 100 },
	surface: 'asphalt',
	hazards: [],
	corneringDemand: 0,
	speedBias: 0,
	risk: 0,
	compatibleFormats: ['circuit']
};

const race: Race = {
	id: 'race-1',
	name: 'Test Race',
	status: 'running',
	racetrack: racetrack.id,
	winner: '',
	finishingOrder: [],
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
		y: 0,
		trackContext: {
			trackId: 'track-1',
			suitability: {
				racerSpeed: 10,
				racerHandling: 0,
				track: {
					length: 200,
					width: 64,
					surface: 'asphalt',
					hazards: [],
					corneringDemand: 0,
					speedBias: 0,
					risk: 0,
					compatibleFormats: ['circuit']
				}
			},
			incident: {
				racerResilience: 0,
				trackRisk: 0,
				corneringDemand: 0,
				hazards: []
			},
			speedMultiplier: 1
		}
	});
});

test('applies the selected track speed bias through the generic suitability input', () => {
	const speedTrack = {
		...racetrack,
		speedBias: 1,
		risk: 0.4,
		corneringDemand: 0.7,
		hazards: [{ type: 'crosswind', severity: 0.6, checkpointIndex: 1 }]
	};
	const result = simulateRacer(racer, speedTrack, 1_000, race.totalLaps);

	assert.equal(result.distanceFromCheckpoint, 8.75);
	assert.equal(result.x, 8.75);
	assert.deepEqual(result.trackContext.incident, {
		racerResilience: 0,
		trackRisk: 0.4,
		corneringDemand: 0.7,
		hazards: [{ type: 'crosswind', severity: 0.6, checkpointIndex: 1 }]
	});
	assert.equal(result.trackContext.speedMultiplier, 0.875);
});

test('applies an eligible minor health condition as its configured performance effect', () => {
	const recoveringRacer = structuredClone(racer) as Racer;
	recoveringRacer.health = {
		eligible: true,
		performanceMultiplier: 0.94,
		activeConditionIds: ['condition-minor']
	};

	const result = simulateRacer(recoveringRacer, racetrack, 1_000, race.totalLaps);

	assert.ok(Math.abs(result.distanceFromCheckpoint - 9.4) < Number.EPSILON * 10);
	assert.ok(Math.abs(result.x - 9.4) < Number.EPSILON * 10);
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

test('records the crossing instant within a simulation tick', () => {
	const nearFinish = structuredClone(racer);
	nearFinish.currentRace.distanceFromCheckpoint = 95;

	const result = simulateRacer(nearFinish, racetrack, 1_000, race.totalLaps);

	assert.equal(result.finished, true);
	assert.equal(result.finishedAt, new Date(500).toISOString());
});

test('applies and expires a deterministic temporary buff through the race simulation seam', () => {
	const tacticalRacer = structuredClone(racer) as Racer;
	tacticalRacer.name = 'Bolt';
	tacticalRacer.id = 'racer-1';
	tacticalRacer.traits = { temperament: 100 } as Racer['traits'];
	tacticalRacer.expand.trainer = { tactics: 10 } as Racer['expand']['trainer'];

	const activated = simulateRacer(tacticalRacer, racetrack, 1_000, race.totalLaps, {
		raceId: 'race-1',
		simulationSeed: 'simulation-1',
		movePolicy: { enabled: true, rulesVersion: 'racing-moves-v1' },
		position: 8,
		fieldSize: 8
	});
	assert.ok(Math.abs(activated.distanceFromCheckpoint - 11.2) < Number.EPSILON * 10);
	assert.ok(activated.moveState);
	assert.ok(activated.significantEvents);
	assert.equal(activated.moveState.resource, 70);
	assert.equal(activated.significantEvents[0]?.type, 'move_activated');

	Object.assign(tacticalRacer.currentRace, activated);
	const expired = simulateRacer(tacticalRacer, racetrack, 3_000, race.totalLaps, {
		raceId: 'race-1',
		simulationSeed: 'simulation-1',
		movePolicy: { enabled: true, rulesVersion: 'racing-moves-v1' },
		position: 8,
		fieldSize: 8
	});
	assert.ok(Math.abs(expired.distanceFromCheckpoint - 21.2) < Number.EPSILON * 20);
	assert.ok(expired.significantEvents);
	assert.deepEqual(
		expired.significantEvents.map((event) => event.type),
		['move_activated', 'move_expired']
	);
});

test('applies and expires an incoming racing attack without reducing HP or eliminating the racer', () => {
	const targetedRacer = structuredClone(racer) as Racer;
	targetedRacer.id = 'target-1';
	targetedRacer.name = 'Bolt';
	targetedRacer.stats.hp = 42;
	targetedRacer.currentRace.moveState = {
		resource: 19,
		cooldowns: {},
		activeEffects: [
			{
				moveId: 'crosswind-cut',
				moveName: 'Crosswind Cut',
				category: 'penalty',
				affectedCapability: 'speed',
				potency: 0.18,
				minimumMultiplier: 0.75,
				counterTags: ['stability', 'wind'],
				sourceRacerId: 'attacker-1',
				activatedAt: 500,
				expiresAt: 2_500
			}
		]
	};

	const impaired = simulateRacer(targetedRacer, racetrack, 1_000, race.totalLaps, {
		raceId: 'race-1',
		simulationSeed: 'fixed-attack-seed',
		movePolicy: { enabled: true, rulesVersion: 'racing-moves-v1' },
		position: 1,
		fieldSize: 2
	});
	assert.ok(Math.abs(impaired.distanceFromCheckpoint - 8.2) < Number.EPSILON * 10);
	assert.equal(targetedRacer.stats.hp, 42);
	assert.equal(impaired.finished, false);

	Object.assign(targetedRacer.currentRace, impaired);
	const recovered = simulateRacer(targetedRacer, racetrack, 2_500, race.totalLaps, {
		raceId: 'race-1',
		simulationSeed: 'fixed-attack-seed',
		movePolicy: { enabled: true, rulesVersion: 'racing-moves-v1' },
		position: 1,
		fieldSize: 2
	});
	assert.ok(Math.abs(recovered.distanceFromCheckpoint - 18.2) < Number.EPSILON * 20);
	assert.equal(recovered.moveState?.activeEffects.length, 0);
	assert.equal(recovered.significantEvents?.at(-1)?.type, 'move_expired');
	assert.match(
		recovered.significantEvents?.at(-1)?.summary ?? '',
		/Crosswind Cut expired for Bolt/
	);
});
