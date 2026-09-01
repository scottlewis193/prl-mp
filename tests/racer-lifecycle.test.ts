import assert from 'node:assert/strict';
import test from 'node:test';

import {
	RACER_TRAIT_RULES_VERSION,
	createRacerLifecycle,
	generateRacerTraits
} from '../src/lib/server/racerLifecycle';

test('the same species, seed, and rules version reproduce the same bounded individual traits', () => {
	const input = {
		speciesKey: '25',
		generationSeed: 'racer-bolt-2026',
		rulesVersion: RACER_TRAIT_RULES_VERSION
	};
	const first = generateRacerTraits(input);

	assert.deepEqual(generateRacerTraits(input), first);
	assert.deepEqual(Object.keys(first).sort(), [
		'consistency',
		'durability',
		'longevity',
		'potential',
		'resilience',
		'temperament'
	]);
	for (const value of Object.values(first)) {
		assert.equal(Number.isInteger(value), true);
		assert.ok(value >= 1 && value <= 100);
	}
});

test('racers of one species can receive different traits from different generation seeds', () => {
	const first = generateRacerTraits({
		speciesKey: '25',
		generationSeed: 'racer-bolt-2026',
		rulesVersion: RACER_TRAIT_RULES_VERSION
	});
	const second = generateRacerTraits({
		speciesKey: '25',
		generationSeed: 'racer-spark-2026',
		rulesVersion: RACER_TRAIT_RULES_VERSION
	});

	assert.notDeepEqual(second, first);
});

test('new racer lifecycle data records its reproducibility and career inputs', () => {
	const input = {
		speciesKey: '25',
		generationSeed: 'racer-bolt-2026',
		careerStartedAt: '2026-09-01T15:30:00.000Z'
	};

	assert.deepEqual(createRacerLifecycle(input), createRacerLifecycle(input));
	assert.deepEqual(createRacerLifecycle(input), {
		traits: {
			durability: 72,
			resilience: 11,
			temperament: 52,
			consistency: 58,
			potential: 58,
			longevity: 64
		},
		generationSeed: input.generationSeed,
		traitRulesVersion: RACER_TRAIT_RULES_VERSION,
		careerStartedAt: input.careerStartedAt,
		careerLoad: 0,
		health: { eligible: true, performanceMultiplier: 1, activeConditionIds: [] }
	});
});
