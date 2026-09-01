import assert from 'node:assert/strict';
import test from 'node:test';

import {
	RACING_BUFFS,
	performTemporaryRacingBuff,
	type RacingBuffInput
} from '../src/lib/server/racingBuffs';

const input: RacingBuffInput = {
	racer: {
		id: 'racer-1',
		name: 'Bolt',
		traits: { temperament: 90 },
		expand: { trainer: { tactics: 9 } }
	},
	raceId: 'race-1',
	simulationSeed: 'fixed-race-seed',
	movePolicy: { enabled: true, rulesVersion: 'racing-moves-v1' },
	position: 6,
	fieldSize: 8,
	trackSegment: { checkpointIndex: 3, speedBias: 0.8, corneringDemand: 0.2 },
	now: 1_000,
	state: { resource: 100, cooldowns: {}, activeEffects: [] }
};

test('the curated speed buff declares every balance and eligibility input', () => {
	assert.deepEqual(RACING_BUFFS, [
		{
			id: 'second-wind',
			name: 'Second Wind',
			category: 'buff',
			eligibility: { minimumTemperament: 25, minimumTrainerTactics: 2 },
			affectedCapability: 'speed',
			potency: 0.12,
			maximumMultiplier: 1.15,
			durationMs: 2_000,
			cooldownMs: 8_000,
			resourceCost: 30
		}
	]);
});

test('selection is reproducible and audits every contextual input', () => {
	const first = performTemporaryRacingBuff(input);
	const repeated = performTemporaryRacingBuff(structuredClone(input));

	assert.deepEqual(repeated, first);
	assert.equal(first.decision.selectedMoveId, 'second-wind');
	assert.deepEqual(first.decision.inputs, {
		simulationSeed: 'fixed-race-seed',
		racerId: 'racer-1',
		trainerTactics: 9,
		temperament: 90,
		position: 6,
		fieldSize: 8,
		checkpointIndex: 3,
		speedBias: 0.8,
		corneringDemand: 0.2,
		resource: 100,
		cooldownReadyAt: 0
	});
});

test('an activated buff is bounded, spends resource, and expires at the configured instant', () => {
	const activated = performTemporaryRacingBuff(input);

	assert.equal(activated.capabilityMultipliers.speed, 1.12);
	assert.equal(activated.state.resource, 70);
	assert.equal(activated.state.cooldowns['second-wind'], 9_000);
	assert.equal(activated.state.activeEffects[0]?.expiresAt, 3_000);
	assert.equal(activated.events[0]?.type, 'move_activated');
	assert.match(activated.events[0]?.summary ?? '', /Bolt activated Second Wind/);

	const expired = performTemporaryRacingBuff({ ...input, now: 3_000, state: activated.state });
	assert.equal(expired.capabilityMultipliers.speed, 1);
	assert.deepEqual(expired.state.activeEffects, []);
	assert.equal(expired.events[0]?.type, 'move_expired');
	assert.match(expired.events[0]?.summary ?? '', /Second Wind expired for Bolt/);
});

test('resource and cooldown constraints prevent selection', () => {
	const withoutResource = performTemporaryRacingBuff({
		...input,
		state: { resource: 29, cooldowns: {}, activeEffects: [] }
	});
	assert.equal(withoutResource.decision.selectedMoveId, undefined);

	const coolingDown = performTemporaryRacingBuff({
		...input,
		state: { resource: 100, cooldowns: { 'second-wind': 2_000 }, activeEffects: [] }
	});
	assert.equal(coolingDown.decision.selectedMoveId, undefined);
});

test('a format that disables moves neither selects nor applies a stale buff', () => {
	const active = performTemporaryRacingBuff(input);
	const disabled = performTemporaryRacingBuff({
		...input,
		now: 1_500,
		movePolicy: { enabled: false, rulesVersion: 'moves-disabled-v1' },
		state: active.state
	});

	assert.equal(disabled.decision.selectedMoveId, undefined);
	assert.equal(disabled.capabilityMultipliers.speed, 1);
	assert.deepEqual(disabled.state.activeEffects, []);
	assert.deepEqual(disabled.events, []);
});
