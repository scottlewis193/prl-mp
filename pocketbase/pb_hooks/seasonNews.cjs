function uniqueLinks(links) {
	const unique = new Map();
	for (const link of links) unique.set(`${link.kind}:${link.id}`, link);
	return [...unique.values()];
}

function buildSeasonStory(facts) {
	if (!facts.eventId || !Number.isFinite(Date.parse(facts.occurredAt))) {
		throw new Error('Season news requires a source event and occurrence time');
	}
	if (!facts.season?.id || !facts.season?.name) {
		throw new Error('Season news requires a named season');
	}
	if (!Array.isArray(facts.champions) || !Array.isArray(facts.movements)) {
		throw new Error('Season news requires champions and league movements');
	}
	const championText = facts.champions.length
		? facts.champions.map(({ racer, league }) => `${racer.name} won ${league.name}`).join('; ')
		: 'No league champions were recorded';
	const movementDetails = facts.movements.map(
		({ racer, fromLeague, toLeague, direction }) =>
			`${racer.name} was ${direction} from ${fromLeague.name} to ${toLeague.name}`
	);
	const promotedCount = facts.movements.filter(
		(movement) => movement.direction === 'promoted'
	).length;
	const relegatedCount = facts.movements.length - promotedCount;
	const movementText = facts.movements.length
		? facts.movements.length <= 12
			? movementDetails.join('; ')
			: `${promotedCount} racers were promoted and ${relegatedCount} were relegated, including ${movementDetails.slice(0, 6).join('; ')}`
		: 'No racers changed league';
	const templates = [
		{
			headline: `${facts.season.name} concludes with league places decided`,
			summary: `${facts.season.name} is complete. Champions: ${championText}. League movement: ${movementText}.`
		},
		{
			headline: `Champions and movers confirmed after ${facts.season.name}`,
			summary: `The final classification for ${facts.season.name} is official. ${championText}. At the league boundary, ${movementText}.`
		},
		{
			headline: `${facts.season.name} honours champions and reshapes leagues`,
			summary: `${facts.season.name} ended with ${championText}. Promotion and relegation decisions followed: ${movementText}.`
		}
	];
	const selected =
		templates[require('./newsTemplates.cjs').stableTemplateIndex(facts.eventId, templates.length)];
	const links = uniqueLinks([
		...facts.champions.flatMap(({ racer, league }) => [
			{ kind: 'racer', id: racer.id, label: racer.name, href: '/exchange' },
			{ kind: 'league', id: league.id, label: league.name, href: '/' }
		]),
		...facts.movements.flatMap(({ racer, fromLeague, toLeague }) => [
			{ kind: 'racer', id: racer.id, label: racer.name, href: '/exchange' },
			{ kind: 'league', id: fromLeague.id, label: fromLeague.name, href: '/' },
			{ kind: 'league', id: toLeague.id, label: toLeague.name, href: '/' }
		])
	]);
	return {
		...selected,
		category: 'season_update',
		importance: 95,
		publishedAt: new Date(facts.occurredAt).toISOString(),
		templateVersion: 'season-story-v1',
		links
	};
}

module.exports = { buildSeasonStory };
