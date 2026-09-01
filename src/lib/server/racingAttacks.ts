import type { RaceMovePolicy, RaceMoveState, RaceSignificantEvent } from '$lib/types';

export type RacingAttackDefinition = {
	id: string;
	name: string;
	category: 'attack';
	target: 'racer-ahead';
	accuracy: number;
	effect: 'speed-loss';
	potency: number;
	minimumMultiplier: number;
	durationMs: number;
	cooldownMs: number;
	resourceCost: number;
	counterTags: string[];
};

export type RacingDefenceDefinition = {
	id: string;
	name: string;
	category: 'defence';
	target: 'self';
	accuracy: number;
	response: 'reduce';
	potency: number;
	durationMs: number;
	cooldownMs: number;
	resourceCost: number;
	counterTags: string[];
};

export const RACING_ATTACKS: RacingAttackDefinition[] = [
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
];

export const RACING_DEFENCES: RacingDefenceDefinition[] = [
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
];

type MoveRacer = {
	id?: string;
	name: string;
	traits?: { temperament?: number };
	expand?: { trainer?: { tactics?: number } };
};

type FieldMoveRacer = MoveRacer & {
	currentRace: {
		checkpointIndex?: number;
		moveState?: RaceMoveState;
	};
};

export type RacingAttackInput = {
	attacker: MoveRacer;
	target: MoveRacer;
	raceId: string;
	simulationSeed: string;
	movePolicy: RaceMovePolicy;
	attackerPosition: number;
	targetPosition: number;
	trackSegment: { checkpointIndex: number; speedBias: number; corneringDemand: number };
	now: number;
	attackerState?: RaceMoveState;
	targetState?: RaceMoveState;
};

type RacingAttackOutcome = 'landed' | 'missed' | 'reduced';

export type RacingAttackResult = {
	attackerState: RaceMoveState;
	targetState: RaceMoveState;
	events: RaceSignificantEvent[];
	decision: {
		selectedMoveId?: string;
		targetRacerId?: string;
		counterMoveId?: string;
		accuracyRoll?: number;
		outcome?: RacingAttackOutcome;
	};
	eliminatedRacerId?: never;
};

export type RacingAttackFieldInput = {
	racers: FieldMoveRacer[];
	positions: ReadonlyMap<string, number>;
	raceId: string;
	simulationSeed: string;
	movePolicy: RaceMovePolicy;
	trackSegment: { checkpointIndex: number; speedBias: number; corneringDemand: number };
	now: number;
};

export type RacingAttackFieldResult = {
	states: Record<string, RaceMoveState>;
	events: RaceSignificantEvent[];
	decisions: RacingAttackResult['decision'][];
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
		activeEffects: (state?.activeEffects ?? []).map((effect) => ({ ...effect })),
		...(state?.lastDecisionKey ? { lastDecisionKey: state.lastDecisionKey } : {}),
		...(state?.lastAttackDecisionKey ? { lastAttackDecisionKey: state.lastAttackDecisionKey } : {})
	};
}

function eligible(racer: MoveRacer): boolean {
	const temperament = clamp(Number(racer.traits?.temperament ?? 0), 0, 100);
	const trainerTactics = clamp(Number(racer.expand?.trainer?.tactics ?? 0), 0, 10);
	return temperament >= 25 && trainerTactics >= 2;
}

function event(
	input: RacingAttackInput,
	type: RaceSignificantEvent['type'],
	move: { id: string; name: string },
	summary: string
): RaceSignificantEvent {
	return {
		id: `${input.raceId}:${input.attacker.id ?? 'unknown-attacker'}:${input.target.id ?? 'unknown-target'}:${move.id}:${type}:${input.now}`,
		type,
		occurredAt: new Date(input.now).toISOString(),
		racerId: input.attacker.id ?? 'unknown-attacker',
		racerName: input.attacker.name,
		targetRacerId: input.target.id ?? 'unknown-target',
		targetRacerName: input.target.name,
		moveId: move.id,
		moveName: move.name,
		summary
	};
}

export function resolveRacingAttack(input: RacingAttackInput): RacingAttackResult {
	const attack = RACING_ATTACKS[0];
	const defence = RACING_DEFENCES[0];
	const attackerState = normalizeState(input.attackerState);
	const targetState = normalizeState(input.targetState);
	const decision: RacingAttackResult['decision'] = {};

	if (!input.movePolicy.enabled || input.movePolicy.rulesVersion !== 'racing-moves-v1') {
		return { attackerState, targetState, events: [], decision };
	}

	const attackerId = input.attacker.id ?? 'unknown-attacker';
	const targetId = input.target.id ?? 'unknown-target';
	const attackReadyAt = Number(attackerState.cooldowns[attack.id] ?? 0);
	const decisionKey = [
		input.simulationSeed,
		attackerId,
		targetId,
		input.attackerPosition,
		input.targetPosition,
		input.trackSegment.checkpointIndex,
		attackerState.resource,
		attackReadyAt
	].join(':');
	const canTarget = input.attackerPosition === input.targetPosition + 1;
	if (
		!canTarget ||
		!eligible(input.attacker) ||
		attackerState.resource < attack.resourceCost ||
		input.now < attackReadyAt ||
		attackerState.lastAttackDecisionKey === decisionKey
	) {
		return { attackerState, targetState, events: [], decision };
	}

	attackerState.lastAttackDecisionKey = decisionKey;
	attackerState.resource -= attack.resourceCost;
	attackerState.cooldowns[attack.id] = input.now + attack.cooldownMs;
	decision.selectedMoveId = attack.id;
	decision.targetRacerId = targetId;
	decision.accuracyRoll = seededUnitInterval(`${decisionKey}:accuracy`);
	const events = [
		event(
			input,
			'attack_attempted',
			attack,
			`${input.attacker.name} attempted ${attack.name} against ${input.target.name}.`
		)
	];

	if (decision.accuracyRoll > attack.accuracy) {
		decision.outcome = 'missed';
		events.push(
			event(
				input,
				'attack_missed',
				attack,
				`${input.attacker.name}'s ${attack.name} missed ${input.target.name}.`
			)
		);
		return { attackerState, targetState, events, decision };
	}

	const compatibleCounter = defence.counterTags.some((tag) => attack.counterTags.includes(tag));
	const defenceReadyAt = Number(targetState.cooldowns[defence.id] ?? 0);
	const canDefend =
		compatibleCounter &&
		eligible(input.target) &&
		targetState.resource >= defence.resourceCost &&
		input.now >= defenceReadyAt;
	let potency = attack.potency;
	if (canDefend) {
		targetState.resource -= defence.resourceCost;
		targetState.cooldowns[defence.id] = input.now + defence.cooldownMs;
		decision.counterMoveId = defence.id;
		decision.outcome = 'reduced';
		potency *= 1 - defence.potency;
		events.push(
			event(
				input,
				'defence_activated',
				defence,
				`${input.target.name} activated ${defence.name} against ${attack.name}.`
			)
		);
	} else {
		decision.outcome = 'landed';
	}

	targetState.activeEffects.push({
		moveId: attack.id,
		moveName: attack.name,
		category: 'penalty',
		affectedCapability: 'speed',
		potency,
		minimumMultiplier: attack.minimumMultiplier,
		counterTags: [...attack.counterTags],
		sourceRacerId: attackerId,
		activatedAt: input.now,
		expiresAt: input.now + attack.durationMs
	});
	const response = canDefend ? `; the effect was reduced by ${defence.name}` : '';
	events.push(
		event(
			input,
			'attack_landed',
			attack,
			`${input.attacker.name}'s ${attack.name} slowed ${input.target.name}${response}.`
		)
	);
	return { attackerState, targetState, events, decision };
}

export function resolveRacingAttacksForField(
	input: RacingAttackFieldInput
): RacingAttackFieldResult {
	const racersByPosition = new Map<number, FieldMoveRacer>();
	const states: Record<string, RaceMoveState> = {};
	for (const racer of input.racers) {
		if (!racer.id) continue;
		const position = input.positions.get(racer.id);
		if (position !== undefined) racersByPosition.set(position, racer);
		states[racer.id] = normalizeState(racer.currentRace.moveState);
	}

	const events: RaceSignificantEvent[] = [];
	const decisions: RacingAttackResult['decision'][] = [];
	for (const [attackerPosition, attacker] of [...racersByPosition.entries()].sort(
		([left], [right]) => left - right
	)) {
		if (attackerPosition <= 1 || !attacker.id) continue;
		const targetPosition = attackerPosition - 1;
		const target = racersByPosition.get(targetPosition);
		if (!target?.id) continue;
		const resolved = resolveRacingAttack({
			attacker,
			target,
			raceId: input.raceId,
			simulationSeed: input.simulationSeed,
			movePolicy: input.movePolicy,
			attackerPosition,
			targetPosition,
			trackSegment: {
				...input.trackSegment,
				checkpointIndex: attacker.currentRace.checkpointIndex ?? input.trackSegment.checkpointIndex
			},
			now: input.now,
			attackerState: states[attacker.id],
			targetState: states[target.id]
		});
		states[attacker.id] = resolved.attackerState;
		states[target.id] = resolved.targetState;
		if (resolved.decision.selectedMoveId) decisions.push(resolved.decision);
		events.push(...resolved.events);
	}

	return { states, events, decisions };
}
