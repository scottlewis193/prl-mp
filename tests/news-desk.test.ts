import assert from 'node:assert/strict';
import test from 'node:test';

import { buildHealthStory } from '../src/lib/server/healthNews';
import { buildRaceResultStory } from '../src/lib/server/raceNews';
import { buildRetirementStory } from '../src/lib/server/retirementNews';
import { buildRosterStory } from '../src/lib/server/rosterNews';
import { buildSeasonStory } from '../src/lib/server/seasonNews';

const racer = { id: 'racer-bolt', name: 'Bolt' };
const trainer = { id: 'trainer-misty', name: 'Misty' };
const league = { id: 'league-premier', name: 'Premier League' };

test('living-league templates vary deterministically while retaining their recorded facts', () => {
	const builders = [
		(eventId: string) =>
			buildHealthStory({
				eventId,
				occurredAt: '2026-09-01T12:00:00.000Z',
				transition: 'onset',
				racer,
				trainer,
				league,
				condition: {
					id: 'condition-1',
					kind: 'illness',
					severity: 'moderate',
					cause: 'seasonal_virus',
					onsetAt: '2026-09-01T12:00:00.000Z',
					expectedRecoveryAt: '2026-09-08T12:00:00.000Z',
					eligibilityEffect: 'ineligible'
				}
			}),
		(eventId: string) =>
			buildRosterStory({
				eventId,
				occurredAt: '2026-09-01T12:00:00.000Z',
				transition: 'release',
				racer,
				trainer,
				league,
				price: 12.5
			}),
		(eventId: string) =>
			buildRetirementStory({
				eventId,
				occurredAt: '2026-09-01T12:00:00.000Z',
				racer,
				trainer,
				league,
				careerLoad: 240,
				reason: 'career_load'
			})
	];

	for (const build of builders) {
		const stories = Array.from({ length: 12 }, (_, index) => build(`living-league-${index}`));
		assert.ok(new Set(stories.map((story) => story.headline)).size > 1);
		assert.deepEqual(build('living-league-3'), stories[3]);
		for (const story of stories) assert.match(`${story.headline} ${story.summary}`, /Bolt/);
	}
});

test('race desk reports format, record, market, incident, and notable tactical facts together', () => {
	const story = buildRaceResultStory({
		eventId: 'grand-prix-result-1',
		occurredAt: '2026-09-01T15:00:00.000Z',
		race: { id: 'race-gp', name: 'Indigo Grand Prix', format: 'grand_prix' },
		winner: racer,
		finishers: [racer, { id: 'racer-dash', name: 'Dash' }],
		nonFinishers: [
			{
				id: 'racer-comet',
				name: 'Comet',
				reason: 'oil-slick',
				summary: 'Comet did not finish after an oil slick crash.'
			}
		],
		trainers: [trainer],
		league,
		track: { id: 'track-indigo', name: 'Indigo Circuit' },
		winnerCareer: { wins: 10, starts: 25 },
		priceMovements: [
			{
				racer,
				previousPrice: 10,
				price: 10.8,
				sourceEvent: 'grand-prix-result-1'
			},
			{
				racer: { id: 'racer-dash', name: 'Dash' },
				previousPrice: 10,
				price: 9.7,
				sourceEvent: 'grand-prix-result-1'
			},
			{
				racer: { id: 'racer-comet', name: 'Comet' },
				previousPrice: 10,
				price: 8,
				sourceEvent: 'grand-prix-result-1'
			}
		],
		notableTactics: [
			{ id: 'move-1', summary: 'Bolt used Agility to take the lead on the final lap.' }
		]
	});

	assert.equal(story.templateVersion, 'race-result-v4');
	assert.equal(story.importance, 90);
	assert.match(story.headline, /Grand Prix|Bolt|Indigo/i);
	assert.match(story.summary, /multi-class Grand Prix/i);
	assert.match(story.summary, /10 wins from 25 starts/i);
	assert.match(story.summary, /market.*Bolt.*₽10\.00.*₽10\.80/i);
	assert.match(story.summary, /Dash.*₽10\.00.*₽9\.70/i);
	assert.match(story.summary, /Comet.*₽10\.00.*₽8\.00/i);
	assert.match(story.summary, /Comet did not finish.*oil slick/i);
	assert.match(story.summary, /Bolt used Agility.*final lap/i);
});

test('race desk identifies a retired-racer Legends event without implying ranked consequences', () => {
	const story = buildRaceResultStory({
		eventId: 'legends-result-1',
		occurredAt: '2026-09-01T16:00:00.000Z',
		race: { id: 'race-legends', name: 'Indigo Legends', format: 'legends_exhibition' },
		winner: racer,
		finishers: [racer],
		trainers: [],
		league,
		track: { id: 'track-indigo', name: 'Indigo Circuit' }
	});

	assert.match(story.summary, /unranked Legends Exhibition.*retired racers/i);
	assert.equal(story.importance, 85);
});

test('season desk covers factual promotions and relegations from one source event', () => {
	const facts = {
		eventId: 'season-completed-1',
		occurredAt: '2026-09-01T18:00:00.000Z',
		season: { id: 'season-1', name: 'Season 1' },
		champions: [{ racer, league }],
		movements: [
			{
				racer: { id: 'racer-dash', name: 'Dash' },
				fromLeague: { id: 'league-academy', name: 'Academy League' },
				toLeague: league,
				direction: 'promoted' as const
			},
			{
				racer: { id: 'racer-comet', name: 'Comet' },
				fromLeague: league,
				toLeague: { id: 'league-academy', name: 'Academy League' },
				direction: 'relegated' as const
			}
		]
	};
	const story = buildSeasonStory(facts);

	assert.deepEqual(buildSeasonStory(structuredClone(facts)), story);
	assert.equal(story.category, 'season_update');
	assert.equal(story.importance, 95);
	assert.equal(story.templateVersion, 'season-story-v1');
	assert.match(`${story.headline} ${story.summary}`, /Season 1.*Bolt.*Premier League/is);
	assert.match(story.summary, /Dash.*promoted.*Academy League.*Premier League/is);
	assert.match(story.summary, /Comet.*relegated.*Premier League.*Academy League/is);
	assert.deepEqual(
		new Set(story.links.map((link) => `${link.kind}:${link.id}`)),
		new Set([
			'league:league-premier',
			'league:league-academy',
			'racer:racer-bolt',
			'racer:racer-dash',
			'racer:racer-comet'
		])
	);
});
