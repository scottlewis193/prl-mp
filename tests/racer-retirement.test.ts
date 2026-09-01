import assert from 'node:assert/strict';
import test from 'node:test';

import { RETIREMENT_RULES, evaluateRacerRetirement } from '../src/lib/server/racerRetirement';
import { buildRetirementStory } from '../src/lib/server/retirementNews';

const veteran = {
	racerId: 'racer-bolt',
	seed: 'world-retirement-2026-09-01',
	processedAt: '2026-09-01T12:00:00.000Z',
	ageDays: 4_000,
	longevity: 20,
	careerLoad: 280,
	healthEligible: false,
	activeConditionCount: 2
};

test('versioned seeded retirement rules reproduce one auditable decision', () => {
	const first = evaluateRacerRetirement(veteran);
	assert.deepEqual(evaluateRacerRetirement(veteran), first);
	assert.equal(first.rulesVersion, RETIREMENT_RULES.version);
	assert.deepEqual(first.inputs, {
		ageDays: 4_000,
		longevity: 20,
		careerLoad: 280,
		healthEligible: false,
		activeConditionCount: 2
	});
	assert.ok(first.roll >= 0 && first.roll < 1);
	assert.ok(first.probability >= 0 && first.probability <= 1);
	assert.equal(first.retire, true);
	assert.ok(['age', 'career_load', 'health'].includes(first.reason));
});

test('young healthy racers remain active even under an unlucky seed', () => {
	const result = evaluateRacerRetirement({
		...veteran,
		seed: 'another-day',
		ageDays: 30,
		longevity: 1,
		careerLoad: 0,
		healthEligible: true,
		activeConditionCount: 0
	});
	assert.equal(result.retire, false);
	assert.equal(result.probability, 0);
});

test('retirement news states only recorded career and vacancy facts', () => {
	const story = buildRetirementStory({
		eventId: 'event-retirement-1',
		occurredAt: veteran.processedAt,
		racer: { id: veteran.racerId, name: 'Bolt' },
		trainer: { id: 'trainer-misty', name: 'Misty' },
		league: { id: 'league-premier', name: 'Premier League' },
		careerLoad: veteran.careerLoad,
		reason: 'health'
	});
	assert.equal(story.category, 'retirement');
	assert.match(`${story.headline} ${story.summary}`, /Bolt.*retired.*280.*health/is);
	assert.deepEqual(story.links, [
		{ kind: 'racer', id: 'racer-bolt', label: 'Bolt', href: '/exchange' },
		{ kind: 'trainer', id: 'trainer-misty', label: 'Misty', href: '/trainers' },
		{ kind: 'league', id: 'league-premier', label: 'Premier League', href: '/' }
	]);
});
