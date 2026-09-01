import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRaceResultStory } from '../src/lib/server/raceNews';

const facts = {
	eventId: 'event-race-17',
	occurredAt: '2026-09-01T14:05:00.000Z',
	race: { id: 'race-1', name: 'Indigo Cup' },
	winner: { id: 'racer-1', name: 'Bolt' },
	finishers: [
		{ id: 'racer-1', name: 'Bolt' },
		{ id: 'racer-2', name: 'Dash' }
	],
	trainers: [{ id: 'trainer-1', name: 'Misty' }],
	league: { id: 'league-1', name: 'Premier League' },
	track: { id: 'track-1', name: 'Indigo Circuit' },
	priceMovements: [
		{
			racer: { id: 'racer-1', name: 'Bolt' },
			previousPrice: 10,
			price: 10.8
		}
	]
};

test('race-result news is deterministic, factual, and links every available entity view', () => {
	const first = buildRaceResultStory(facts);
	const repeated = buildRaceResultStory(structuredClone(facts));

	assert.deepEqual(repeated, first);
	assert.equal(first.category, 'race_result');
	assert.equal(first.importance, 70);
	assert.equal(first.publishedAt, facts.occurredAt);
	assert.equal(first.templateVersion, 'race-result-v2');
	assert.match(first.headline, /Bolt/);
	assert.match(first.summary, /Indigo Cup/);
	assert.match(first.summary, /Dash/);
	assert.match(first.summary, /Indigo Circuit/);
	assert.match(first.summary, /market.*Bolt.*₽10\.00.*₽10\.80/i);
	assert.deepEqual(first.links, [
		{ kind: 'race', id: 'race-1', label: 'Indigo Cup', href: '/races/race-1' },
		{ kind: 'racer', id: 'racer-1', label: 'Bolt', href: '/exchange' },
		{ kind: 'racer', id: 'racer-2', label: 'Dash', href: '/exchange' },
		{ kind: 'trainer', id: 'trainer-1', label: 'Misty', href: '/trainers' },
		{ kind: 'league', id: 'league-1', label: 'Premier League', href: '/' },
		{ kind: 'track', id: 'track-1', label: 'Indigo Circuit', href: '/races' }
	]);
	const rendered = `${first.headline} ${first.summary}`;
	for (const allowedFact of ['Bolt', 'Dash', 'Indigo Cup', 'Premier League', 'Indigo Circuit']) {
		assert.match(rendered, new RegExp(allowedFact));
	}
});

test('different source events select varied templates without inventing source facts', () => {
	const stories = Array.from({ length: 12 }, (_, index) =>
		buildRaceResultStory({ ...facts, eventId: `event-${index}` })
	);

	assert.ok(new Set(stories.map((story) => story.headline)).size > 1);
	for (const story of stories) {
		assert.doesNotMatch(
			`${story.headline} ${story.summary}`,
			/record|rivalry|injury|season title/i
		);
	}
});
