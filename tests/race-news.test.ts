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
			price: 10.8,
			sourceEvent: 'event-race-17'
		},
		{
			racer: { id: 'racer-2', name: 'Dash' },
			previousPrice: 10,
			price: 9.5,
			sourceEvent: 'event-race-17'
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
	assert.equal(first.templateVersion, 'race-result-v4');
	assert.match(first.headline, /Bolt/);
	assert.match(first.summary, /Indigo Cup/);
	assert.match(first.summary, /Dash/);
	assert.match(first.summary, /Indigo Circuit/);
	assert.match(first.summary, /market.*Bolt.*₽10\.00.*₽10\.80/i);
	assert.match(first.summary, /Dash.*₽10\.00.*₽9\.50/i);
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

test('race-result news rejects valuation movements that are not linked to its source event', () => {
	assert.throws(
		() =>
			buildRaceResultStory({
				...facts,
				priceMovements: [
					{
						...facts.priceMovements[0],
						sourceEvent: 'different-event'
					}
				]
			}),
		/source event/i
	);
});

test('different source events select varied templates without inventing source facts', () => {
	const stories = Array.from({ length: 12 }, (_, index) =>
		buildRaceResultStory({
			...facts,
			eventId: `event-${index}`,
			priceMovements: facts.priceMovements.map((movement) => ({
				...movement,
				sourceEvent: `event-${index}`
			}))
		})
	);

	assert.ok(new Set(stories.map((story) => story.headline)).size > 1);
	for (const story of stories) {
		assert.doesNotMatch(
			`${story.headline} ${story.summary}`,
			/record|rivalry|injury|season title/i
		);
	}
});

test('exhibition result news states its unranked lower-prize format', () => {
	const story = buildRaceResultStory({
		...facts,
		race: { ...facts.race, format: 'exhibition' }
	});

	assert.match(story.summary, /unranked Exhibition Race.*reduced prizes/i);
});

test('race-result news explains incidents and supports an all-DNF outcome', () => {
	const mixed = buildRaceResultStory({
		...facts,
		nonFinishers: [
			{
				id: 'racer-3',
				name: 'Comet',
				reason: 'oil-slick',
				summary: 'Comet did not finish after an oil slick crash.'
			}
		]
	});
	assert.match(mixed.summary, /Comet did not finish.*oil slick/i);

	const allDnf = buildRaceResultStory({
		...facts,
		winner: undefined,
		finishers: [],
		nonFinishers: [
			{
				id: 'racer-1',
				name: 'Bolt',
				reason: 'mechanical-failure',
				summary: 'Bolt did not finish after a mechanical failure.'
			}
		],
		priceMovements: [
			{
				racer: { id: 'racer-1', name: 'Bolt' },
				previousPrice: 10,
				price: 8,
				sourceEvent: 'event-race-17'
			}
		]
	});
	assert.match(allDnf.headline, /no classified finisher/i);
	assert.match(allDnf.summary, /winner market was void/i);
	assert.match(allDnf.summary, /market.*Bolt.*₽10\.00.*₽8\.00/i);
});
