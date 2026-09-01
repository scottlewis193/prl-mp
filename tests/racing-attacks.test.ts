import assert from 'node:assert/strict';
import test from 'node:test';

import {
	RACING_ATTACKS,
	RACING_DEFENCES,
	resolveRacingAttack,
	resolveRacingAttacksForField,
	type RacingAttackInput
} from '../src/lib/server/racingAttacks';

const input: RacingAttackInput = {
	attacker: {
		id: 'attacker-1',
		name: 'Gust',
		traits: { temperament: 90 },
		expand: { trainer: { tactics: 9 } }
	},
	target: {
		id: 'target-1',
		name: 'Bolt',
		traits: { temperament: 80 },
		expand: { trainer: { tactics: 8 } }
	},
	raceId: 'race-1',
	simulationSeed: 'fixed-attack-seed',
	movePolicy: { enabled: true, rulesVersion: 'racing-moves-v1' },
	attackerPosition: 2,
	targetPosition: 1,
	trackSegment: { checkpointIndex: 3, speedBias: 0.8, corneringDemand: 0.2 },
	now: 1_000,
	attackerState: { resource: 100, cooldowns: {}, activeEffects: [] },
	targetState: { resource: 100, cooldowns: {}, activeEffects: [] }
};

test('curated attacks and defences declare their complete racing rules', () => {
	assert.deepEqual(RACING_ATTACKS, [
		{
			id: 'crosswind-cut',
			name: 'Crosswind Cut',
			category: 'attack',
			target: 'racer-ahead',
			accuracy: 0.85,
			effect: 'speed-loss',
			potency: 0.18,
			minimumMultiplier: 0.75,
			durationMs: 2_500,
			cooldownMs: 7_000,
			resourceCost: 25,
			counterTags: ['stability', 'wind']
		}
	]);
	assert.deepEqual(RACING_DEFENCES, [
		{
			id: 'steady-line',
			name: 'Steady Line',
			category: 'defence',
			target: 'self',
			accuracy: 1,
			response: 'reduce',
			potency: 0.5,
			durationMs: 0,
			cooldownMs: 5_000,
			resourceCost: 20,
			counterTags: ['stability']
		}
	]);
});

test('a compatible defence deterministically reduces an attack and records the outcome', () => {
	const first = resolveRacingAttack(input);
	const repeated = resolveRacingAttack(structuredClone(input));

	assert.deepEqual(repeated, first);
	assert.equal(first.decision.selectedMoveId, 'crosswind-cut');
	assert.equal(first.decision.targetRacerId, 'target-1');
	assert.equal(first.decision.counterMoveId, 'steady-line');
	assert.equal(first.decision.outcome, 'reduced');
	assert.equal(first.attackerState.resource, 75);
	assert.equal(first.targetState.resource, 80);
	assert.equal(first.targetState.activeEffects[0]?.potency, 0.09);
	assert.deepEqual(first.targetState.activeEffects[0]?.counterTags, ['stability', 'wind']);
	assert.deepEqual(
		first.events.map((event) => event.type),
		['attack_attempted', 'defence_activated', 'attack_landed']
	);
	assert.match(
		first.events[2]?.summary ?? '',
		/Gust.*Crosswind Cut.*Bolt.*reduced by Steady Line/i
	);
});

test('an undefended attack applies only a bounded temporary racing penalty', () => {
	const result = resolveRacingAttack({
		...input,
		targetState: { resource: 19, cooldowns: {}, activeEffects: [] }
	});

	assert.equal(result.decision.outcome, 'landed');
	assert.equal(result.targetState.resource, 19);
	assert.deepEqual(result.targetState.activeEffects, [
		{
			moveId: 'crosswind-cut',
			moveName: 'Crosswind Cut',
			category: 'penalty',
			affectedCapability: 'speed',
			potency: 0.18,
			minimumMultiplier: 0.75,
			counterTags: ['stability', 'wind'],
			sourceRacerId: 'attacker-1',
			activatedAt: 1_000,
			expiresAt: 3_500
		}
	]);
	assert.equal((result.targetState as { hp?: number }).hp, undefined);
	assert.equal(result.eliminatedRacerId, undefined);
});

test('resource and cooldown rules prevent repeated attack or defence selection', () => {
	const withoutAttackResource = resolveRacingAttack({
		...input,
		attackerState: { resource: 24, cooldowns: {}, activeEffects: [] }
	});
	assert.equal(withoutAttackResource.decision.selectedMoveId, undefined);
	assert.deepEqual(withoutAttackResource.events, []);

	const counterCoolingDown = resolveRacingAttack({
		...input,
		targetState: { resource: 100, cooldowns: { 'steady-line': 2_000 }, activeEffects: [] }
	});
	assert.equal(counterCoolingDown.decision.outcome, 'landed');
	assert.equal(counterCoolingDown.decision.counterMoveId, undefined);
});

test('formats that disable moves produce no attack or defensive outcome', () => {
	const result = resolveRacingAttack({
		...input,
		movePolicy: { enabled: false, rulesVersion: 'moves-disabled-v1' }
	});

	assert.equal(result.decision.selectedMoveId, undefined);
	assert.deepEqual(result.events, []);
	assert.deepEqual(result.attackerState, input.attackerState);
	assert.deepEqual(result.targetState, input.targetState);
});

test('field resolution deterministically targets the racer immediately ahead', () => {
	const field = resolveRacingAttacksForField({
		racers: [
			{ ...input.target, currentRace: { moveState: input.targetState } },
			{ ...input.attacker, currentRace: { moveState: input.attackerState } },
			{
				id: 'racer-3',
				name: 'Drift',
				traits: { temperament: 10 },
				expand: { trainer: { tactics: 1 } },
				currentRace: { moveState: { resource: 100, cooldowns: {}, activeEffects: [] } }
			}
		],
		positions: new Map([
			['target-1', 1],
			['attacker-1', 2],
			['racer-3', 3]
		]),
		raceId: input.raceId,
		simulationSeed: input.simulationSeed,
		movePolicy: input.movePolicy,
		trackSegment: input.trackSegment,
		now: input.now
	});

	assert.equal(field.decisions.length, 1);
	assert.equal(field.decisions[0]?.selectedMoveId, 'crosswind-cut');
	assert.equal(field.decisions[0]?.targetRacerId, 'target-1');
	assert.equal(field.states['target-1']?.activeEffects[0]?.moveId, 'crosswind-cut');
	assert.deepEqual(
		resolveRacingAttacksForField({
			racers: [
				{ ...input.target, currentRace: { moveState: input.targetState } },
				{ ...input.attacker, currentRace: { moveState: input.attackerState } },
				{
					id: 'racer-3',
					name: 'Drift',
					traits: { temperament: 10 },
					expand: { trainer: { tactics: 1 } },
					currentRace: { moveState: { resource: 100, cooldowns: {}, activeEffects: [] } }
				}
			],
			positions: new Map([
				['target-1', 1],
				['attacker-1', 2],
				['racer-3', 3]
			]),
			raceId: input.raceId,
			simulationSeed: input.simulationSeed,
			movePolicy: input.movePolicy,
			trackSegment: input.trackSegment,
			now: input.now
		}),
		field
	);
});
