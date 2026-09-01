function stableTemplateIndex(value, templateCount) {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) % templateCount;
}

function buildRaceResultStory(facts) {
	if (!facts.eventId || !facts.occurredAt) throw new Error('Race news requires a source event');
	if (!facts.race?.id || !facts.race?.name) throw new Error('Race news requires a named race');
	if (!facts.winner?.id || !facts.winner?.name)
		throw new Error('Race news requires a named winner');
	if (!Array.isArray(facts.finishers) || facts.finishers.length === 0) {
		throw new Error('Race news requires a finishing order');
	}
	if (!facts.league?.id || !facts.league?.name)
		throw new Error('Race news requires a named league');
	if (!facts.track?.id || !facts.track?.name) throw new Error('Race news requires a named track');

	const runnerUp = facts.finishers[1];
	const fieldText = runnerUp
		? `${runnerUp.name} finished second`
		: `${facts.winner.name} led the field`;
	const leagueText = ` in the ${facts.league.name}`;
	const templates = [
		{
			headline: `${facts.winner.name} wins ${facts.race.name}`,
			summary: `${facts.winner.name} took victory at ${facts.track.name}${leagueText}; ${fieldText}.`
		},
		{
			headline: `${facts.race.name} belongs to ${facts.winner.name}`,
			summary: `At ${facts.track.name}, ${facts.winner.name} won ${facts.race.name}${leagueText}; ${fieldText}.`
		},
		{
			headline: `${facts.winner.name} takes the chequered flag`,
			summary: `${facts.race.name} ended with ${facts.winner.name} first at ${facts.track.name}${leagueText}; ${fieldText}.`
		}
	];
	const selected = templates[stableTemplateIndex(facts.eventId, templates.length)];
	const links = [
		{ kind: 'race', id: facts.race.id, label: facts.race.name, href: `/races/${facts.race.id}` },
		...facts.finishers.map((racer) => ({
			kind: 'racer',
			id: racer.id,
			label: racer.name,
			href: '/exchange'
		})),
		...(facts.trainers || []).map((trainer) => ({
			kind: 'trainer',
			id: trainer.id,
			label: trainer.name,
			href: '/trainers'
		})),
		{ kind: 'league', id: facts.league.id, label: facts.league.name, href: '/' },
		{ kind: 'track', id: facts.track.id, label: facts.track.name, href: '/races' }
	];

	return {
		...selected,
		category: 'race_result',
		importance: 70,
		publishedAt: facts.occurredAt,
		templateVersion: 'race-result-v1',
		links
	};
}

module.exports = { buildRaceResultStory, stableTemplateIndex };
