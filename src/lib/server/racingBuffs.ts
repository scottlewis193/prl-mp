import type { RaceMovePolicy, RaceMoveState, RaceSignificantEvent } from '$lib/types';

export type RacingBuffDefinition = {
	id: string;
	name: string;
	category: 'buff';
	eligibility: { minimumTemperament: number; minimumTrainerTactics: number };
	affectedCapability: 'speed';
	potency: number;
	maximumMultiplier: number;
	durationMs: number;
	cooldownMs: number;
	resourceCost: number;
};

export const RACING_BUFFS: RacingBuffDefinition[] = [
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
];

type BuffRacer = {
	id?: string;
	name: string;
	traits?: { temperament?: number };
	expand?: { trainer?: { tactics?: number } };
};

export type RacingBuffInput = {
	racer: BuffRacer;
	raceId: string;
	simulationSeed: string;
	movePolicy: RaceMovePolicy;
	position: number;
	fieldSize: number;
	trackSegment: { checkpointIndex: number; speedBias: number; corneringDemand: number };
	now: number;
	state?: RaceMoveState;
};

export type RacingBuffDecisionInputs = {
	simulationSeed: string;
	racerId: string;
	trainerTactics: number;
	temperament: number;
	position: number;
	fieldSize: number;
	checkpointIndex: number;
	speedBias: number;
	corneringDemand: number;
	resource: number;
	cooldownReadyAt: number;
};

export type RacingBuffResult = {
	state: RaceMoveState;
	capabilityMultipliers: { speed: number };
	events: RaceSignificantEvent[];
	decision: { selectedMoveId?: string; inputs: RacingBuffDecisionInputs };
};

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(maximum, value));
}

function seededUnitInterval(value: string): number {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) / 0xffffffff;
}

function normalizeState(state: RaceMoveState | undefined): RaceMoveState {
	return {
		resource: clamp(Number(state?.resource ?? 100), 0, 100),
		cooldowns: { ...(state?.cooldowns ?? {}) },
		activeEffects: [...(state?.activeEffects ?? [])],
		lastDecisionKey: state?.lastDecisionKey,
		lastAttackDecisionKey: state?.lastAttackDecisionKey
	};
}

export function performTemporaryRacingBuff(input: RacingBuffInput): RacingBuffResult {
	const move = RACING_BUFFS[0];
	const state = normalizeState(input.state);
	const racerId = input.racer.id ?? 'unknown-racer';
	const trainerTactics = clamp(Number(input.racer.expand?.trainer?.tactics ?? 0), 0, 10);
	const temperament = clamp(Number(input.racer.traits?.temperament ?? 0), 0, 100);
	const cooldownReadyAt = Number(state.cooldowns[move.id] ?? 0);
	const decisionInputs: RacingBuffDecisionInputs = {
		simulationSeed: input.simulationSeed,
		racerId,
		trainerTactics,
		temperament,
		position: input.position,
		fieldSize: input.fieldSize,
		checkpointIndex: input.trackSegment.checkpointIndex,
		speedBias: input.trackSegment.speedBias,
		corneringDemand: input.trackSegment.corneringDemand,
		resource: state.resource,
		cooldownReadyAt
	};

	if (!input.movePolicy.enabled || input.movePolicy.rulesVersion !== 'racing-moves-v1') {
		return {
			state: { ...state, activeEffects: [] },
			capabilityMultipliers: { speed: 1 },
			events: [],
			decision: { inputs: decisionInputs }
		};
	}

	const events: RaceSignificantEvent[] = [];
	state.activeEffects = state.activeEffects.filter((effect) => {
		if (effect.expiresAt > input.now) return true;
		events.push({
			id: `${input.raceId}:${racerId}:${effect.moveId}:expired:${effect.activatedAt}`,
			type: 'move_expired',
			occurredAt: new Date(effect.expiresAt).toISOString(),
			racerId,
			racerName: input.racer.name,
			moveId: effect.moveId,
			moveName: effect.moveName,
			summary: `${effect.moveName} expired for ${input.racer.name}.`
		});
		return false;
	});

	const decisionKey = [
		input.simulationSeed,
		racerId,
		input.position,
		input.fieldSize,
		input.trackSegment.checkpointIndex,
		state.resource,
		cooldownReadyAt
	].join(':');
	let selectedMoveId: string | undefined;
	const hasActiveBuff = state.activeEffects.some((effect) => effect.moveId === move.id);
	const isEligible =
		temperament >= move.eligibility.minimumTemperament &&
		trainerTactics >= move.eligibility.minimumTrainerTactics;
	const hasResource = state.resource >= move.resourceCost;
	const isReady = input.now >= cooldownReadyAt;

	if (
		!hasActiveBuff &&
		isEligible &&
		hasResource &&
		isReady &&
		state.lastDecisionKey !== decisionKey
	) {
		const trailingNeed =
			input.fieldSize > 1 ? clamp((input.position - 1) / (input.fieldSize - 1), 0, 1) : 0;
		const segmentOpportunity = clamp(
			(input.trackSegment.speedBias + (1 - input.trackSegment.corneringDemand)) / 2,
			0,
			1
		);
		const seededTieBreak = seededUnitInterval(decisionKey);
		const selectionScore =
			trainerTactics / 10 / 4 +
			temperament / 100 / 5 +
			trailingNeed / 4 +
			segmentOpportunity / 10 +
			state.resource / 100 / 10 +
			seededTieBreak / 10;

		state.lastDecisionKey = decisionKey;
		if (selectionScore >= 0.55) {
			selectedMoveId = move.id;
			state.resource -= move.resourceCost;
			state.cooldowns[move.id] = input.now + move.cooldownMs;
			state.activeEffects.push({
				moveId: move.id,
				moveName: move.name,
				affectedCapability: move.affectedCapability,
				potency: move.potency,
				activatedAt: input.now,
				expiresAt: input.now + move.durationMs
			});
			events.push({
				id: `${input.raceId}:${racerId}:${move.id}:activated:${input.now}`,
				type: 'move_activated',
				occurredAt: new Date(input.now).toISOString(),
				racerId,
				racerName: input.racer.name,
				moveId: move.id,
				moveName: move.name,
				summary: `${input.racer.name} activated ${move.name} for a temporary speed boost.`
			});
		}
	}

	const speedEffects = state.activeEffects.filter(
		(effect) => effect.affectedCapability === 'speed'
	);
	const potency = speedEffects.reduce(
		(total, effect) => total + (effect.category === 'penalty' ? -effect.potency : effect.potency),
		0
	);
	const minimumMultiplier = speedEffects.reduce(
		(minimum, effect) => Math.min(minimum, effect.minimumMultiplier ?? 1),
		1
	);
	return {
		state,
		capabilityMultipliers: {
			speed: clamp(1 + potency, Math.min(1, minimumMultiplier), move.maximumMultiplier)
		},
		events,
		decision: { selectedMoveId, inputs: decisionInputs }
	};
}
