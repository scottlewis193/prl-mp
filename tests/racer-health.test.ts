import assert from 'node:assert/strict';
import test from 'node:test';

import {
	HEALTH_RULES,
	buildHealthPricePoint,
	evaluateHealthOnset,
	healthPerformanceMultiplier
} from '../src/lib/server/racerHealth';
import { buildHealthStory } from '../src/lib/server/healthNews';

const baseInput = {
	racerId: 'racer-bolt',
	seed: 'world-day-12',
	processedAt: '2026-09-01T12:00:00.000Z',
	speciesHp: 45,
	traits: { durability: 20, resilience: 30 },
	ageDays: 420,
	careerLoad: 32,
	activeConditionCount: 0,
	trackRisk: 0.7,
	eventRisk: 0.4
};

test('versioned seeded health rules reproduce an auditable condition decision', () => {
	const first = evaluateHealthOnset(baseInput);

	assert.deepEqual(evaluateHealthOnset(baseInput), first);
	assert.equal(first.rulesVersion, HEALTH_RULES.version);
	assert.deepEqual(first.inputs, {
		speciesHp: 45,
		durability: 20,
		resilience: 30,
		ageDays: 420,
		careerLoad: 32,
		activeConditionCount: 0,
		trackRisk: 0.7,
		eventRisk: 0.4
	});
	assert.ok(first.roll >= 0 && first.roll < 1);
	assert.ok(first.probability >= 0 && first.probability <= 1);
	assert.ok(first.condition);
	assert.match(first.condition.expectedRecoveryAt, /^2026-09-/);
	assert.ok(['injury', 'illness'].includes(first.condition.kind));
	assert.ok(['minor', 'moderate', 'severe'].includes(first.condition.severity));
	assert.ok(['performance_penalty', 'ineligible'].includes(first.condition.eligibilityEffect));
});

test('healthy durable racers can deterministically avoid a health onset', () => {
	const result = evaluateHealthOnset({
		...baseInput,
		seed: 'quiet-world-day',
		speciesHp: 120,
		traits: { durability: 100, resilience: 100 },
		ageDays: 20,
		careerLoad: 0,
		trackRisk: 0,
		eventRisk: 0
	});

	assert.equal(result.condition, null);
	assert.ok(result.roll >= result.probability);
});

test('seeded circumstances can produce an auditable eligible minor illness', () => {
	const result = evaluateHealthOnset({
		...baseInput,
		seed: 'minor-9',
		trackRisk: 0.2,
		eventRisk: 0.2
	});

	assert.deepEqual(result.condition, {
		kind: 'illness',
		severity: 'minor',
		cause: 'illness_exposure',
		onsetAt: '2026-09-01T12:00:00.000Z',
		expectedRecoveryAt: '2026-09-05T12:00:00.000Z',
		eligibilityEffect: 'performance_penalty',
		performanceMultiplier: 0.94
	});
});

test('only eligible minor conditions reduce race performance', () => {
	assert.equal(
		healthPerformanceMultiplier([
			{ eligibilityEffect: 'performance_penalty', performanceMultiplier: 0.93 }
		]),
		0.93
	);
	assert.equal(
		healthPerformanceMultiplier([{ eligibilityEffect: 'ineligible', performanceMultiplier: 0.7 }]),
		0
	);
	assert.equal(healthPerformanceMultiplier([]), 1);
});

test('health valuation records bounded onset loss and recovery gain without replacing history', () => {
	const onset = buildHealthPricePoint({
		conditionId: 'condition-1',
		transition: 'onset',
		severity: 'moderate',
		previousPrice: 12.5,
		occurredAt: '2026-09-01T12:00:00.000Z',
		sourceEvent: 'event-onset-1'
	});
	const recovery = buildHealthPricePoint({
		conditionId: 'condition-1',
		transition: 'recovery',
		severity: 'moderate',
		previousPrice: onset.price,
		occurredAt: '2026-09-08T12:00:00.000Z',
		sourceEvent: 'event-recovery-1'
	});

	assert.deepEqual(onset, {
		timestamp: '2026-09-01T12:00:00.000Z',
		previousPrice: 12.5,
		price: 11.5,
		change: -1,
		changePercent: -8,
		reason: {
			type: 'health',
			conditionId: 'condition-1',
			transition: 'onset',
			severity: 'moderate',
			appliedPercent: -8
		},
		rulesVersion: HEALTH_RULES.version,
		sourceEvent: 'event-onset-1'
	});
	assert.equal(recovery.price, 12.19);
	assert.equal(recovery.reason.appliedPercent, 6);
});

test('health news states only linked recorded facts for onset and recovery', () => {
	const facts = {
		eventId: 'event-health-1',
		occurredAt: '2026-09-01T12:00:00.000Z',
		racer: { id: 'racer-bolt', name: 'Bolt' },
		trainer: { id: 'trainer-misty', name: 'Misty' },
		league: { id: 'league-premier', name: 'Premier League' },
		condition: {
			id: 'condition-1',
			kind: 'injury',
			severity: 'moderate',
			cause: 'track_incident',
			onsetAt: '2026-09-01T12:00:00.000Z',
			expectedRecoveryAt: '2026-09-10T12:00:00.000Z',
			eligibilityEffect: 'ineligible'
		}
	} as const;
	const onset = buildHealthStory({ ...facts, transition: 'onset' });
	const recovery = buildHealthStory({
		...facts,
		eventId: 'event-health-2',
		occurredAt: '2026-09-10T12:00:00.000Z',
		transition: 'recovery'
	});

	assert.equal(onset.category, 'health_onset');
	assert.match(`${onset.headline} ${onset.summary}`, /Bolt.*moderate injury.*track incident/is);
	assert.equal(recovery.category, 'health_recovery');
	assert.match(`${recovery.headline} ${recovery.summary}`, /Bolt.*recovered.*eligible/is);
	const partialRecovery = buildHealthStory({
		...facts,
		eventId: 'event-health-3',
		occurredAt: '2026-09-10T12:00:00.000Z',
		transition: 'recovery',
		racer: { ...facts.racer, eligible: false }
	});
	assert.doesNotMatch(
		`${partialRecovery.headline} ${partialRecovery.summary}`,
		/cleared|returns|eligible to race/i
	);
	assert.match(
		`${partialRecovery.headline} ${partialRecovery.summary}`,
		/recovered.*unavailable.*another active condition/is
	);
	assert.deepEqual(onset.links, [
		{ kind: 'racer', id: 'racer-bolt', label: 'Bolt', href: '/exchange' },
		{ kind: 'trainer', id: 'trainer-misty', label: 'Misty', href: '/trainers' },
		{ kind: 'league', id: 'league-premier', label: 'Premier League', href: '/' }
	]);
});
