import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createIncidentInputs,
	createRacerSuitabilityInputs,
	getTrackCharacteristics
} from '../src/lib/trackCharacteristics';
import { DEFAULT_RACE_FORMAT, normalizeRaceFormat } from '../src/lib/raceFormat';
import type { RaceTrackType, Racer } from '../src/lib/types';

const track: RaceTrackType = {
	id: 'coastal-loop',
	name: 'Coastal Loop',
	checkpoints: [],
	data: {},
	tileset: '',
	length: 1_600,
	totalLength: 1_600,
	width: 48,
	maxSize: { x: 640, y: 480 },
	surface: 'sand',
	hazards: [{ type: 'crosswind', severity: 0.6, checkpointIndex: 2 }],
	corneringDemand: 0.7,
	speedBias: -0.25,
	risk: 0.4,
	compatibleFormats: ['circuit']
};

const racer = {
	stats: { hp: 80, attack: 60, defense: 70, speed: 90 },
	expand: { pokemon: { speed: 100 } }
} as Racer;

test('exposes the complete normalized racing-characteristics contract', () => {
	assert.deepEqual(getTrackCharacteristics(track), {
		length: 1_600,
		width: 48,
		surface: 'sand',
		hazards: [{ type: 'crosswind', severity: 0.6, checkpointIndex: 2 }],
		corneringDemand: 0.7,
		speedBias: -0.25,
		risk: 0.4,
		compatibleFormats: ['circuit']
	});
});

test('racer suitability and incident inputs receive characteristics through generic interfaces', () => {
	assert.deepEqual(createRacerSuitabilityInputs(racer, track), {
		racerSpeed: 190,
		racerHandling: 65,
		track: getTrackCharacteristics(track)
	});
	assert.deepEqual(createIncidentInputs(racer, track), {
		racerResilience: 75,
		trackRisk: 0.4,
		corneringDemand: 0.7,
		hazards: [{ type: 'crosswind', severity: 0.6, checkpointIndex: 2 }]
	});
});

test('legacy tracks retain neutral characteristics while totalLength is migrated', () => {
	const legacy = {
		...track,
		length: undefined,
		totalLength: 900,
		surface: undefined,
		hazards: undefined,
		corneringDemand: undefined,
		speedBias: undefined,
		risk: undefined,
		compatibleFormats: undefined
	} as unknown as RaceTrackType;

	assert.deepEqual(getTrackCharacteristics(legacy), {
		length: 900,
		width: 48,
		surface: 'asphalt',
		hazards: [],
		corneringDemand: 0,
		speedBias: 0,
		risk: 0,
		compatibleFormats: ['circuit']
	});
});

test('TypeScript runtime owns one normalized default race format', () => {
	assert.equal(DEFAULT_RACE_FORMAT, 'circuit');
	assert.equal(normalizeRaceFormat(undefined), DEFAULT_RACE_FORMAT);
	assert.equal(normalizeRaceFormat('  circuit  '), DEFAULT_RACE_FORMAT);
});
