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
	if (!Array.isArray(facts.finishers)) throw new Error('Race news requires a finishing order');
	const nonFinishers = Array.isArray(facts.nonFinishers) ? facts.nonFinishers : [];
	if (facts.finishers.length === 0 && nonFinishers.length === 0) {
		throw new Error('Race news requires a classified result');
	}
	if (facts.finishers.length > 0 && (!facts.winner?.id || !facts.winner?.name)) {
		throw new Error('Race news requires a named winner');
	}
	if (!facts.league?.id || !facts.league?.name)
		throw new Error('Race news requires a named league');
	if (!facts.track?.id || !facts.track?.name) throw new Error('Race news requires a named track');

	if (facts.finishers.length === 0) {
		const incidentText = nonFinishers
			.map((racer) => racer.summary)
			.filter(Boolean)
			.join(' ');
		return {
			headline: `${facts.race.name} ends with no classified finisher`,
			summary:
				`${facts.race.name} at ${facts.track.name} ended after every racer failed to finish. ${incidentText} The winner market was void.`
					.replace(/\s+/g, ' ')
					.trim(),
			category: 'race_result',
			importance: 85,
			publishedAt: facts.occurredAt,
			templateVersion: 'race-result-v2',
			links: [
				{
					kind: 'race',
					id: facts.race.id,
					label: facts.race.name,
					href: `/races/${facts.race.id}`
				},
				...nonFinishers.map((racer) => ({
					kind: 'racer',
					id: racer.id,
					label: racer.name,
					href: '/exchange'
				})),
				{ kind: 'league', id: facts.league.id, label: facts.league.name, href: '/' },
				{ kind: 'track', id: facts.track.id, label: facts.track.name, href: '/races' }
			]
		};
	}

	const runnerUp = facts.finishers[1];
	const fieldText = runnerUp
		? `${runnerUp.name} finished second`
		: `${facts.winner.name} led the field`;
	const leagueText = ` in the ${facts.league.name}`;
	const formatText =
		facts.race.format === 'exhibition'
			? ' This unranked Exhibition Race awarded reduced prizes.'
			: facts.race.format === 'legends_exhibition'
				? ' This unranked Legends Exhibition brought retired racers back for a special event.'
				: facts.race.format === 'grand_prix'
					? ' This multi-class Grand Prix scored each racer within their league class.'
					: '';
	const winnerMovement = (facts.priceMovements || []).find(
		(movement) => movement.racer?.id === facts.winner.id
	);
	const marketText = winnerMovement
		? ` The market repriced the field after the result, moving ${facts.winner.name} from ₽${winnerMovement.previousPrice.toFixed(2)} to ₽${winnerMovement.price.toFixed(2)}.`
		: '';
	const incidentText = nonFinishers.length
		? ` ${nonFinishers.map((racer) => racer.summary || `${racer.name} did not finish (${racer.reason}).`).join(' ')}`
		: '';
	const templates = [
		{
			headline: `${facts.winner.name} wins ${facts.race.name}`,
			summary: `${facts.winner.name} took victory in ${facts.race.name} at ${facts.track.name}${leagueText}; ${fieldText}.${incidentText}${formatText}${marketText}`
		},
		{
			headline: `${facts.race.name} belongs to ${facts.winner.name}`,
			summary: `At ${facts.track.name}, ${facts.winner.name} won ${facts.race.name}${leagueText}; ${fieldText}.${incidentText}${formatText}${marketText}`
		},
		{
			headline: `${facts.winner.name} takes the chequered flag`,
			summary: `${facts.race.name} ended with ${facts.winner.name} first at ${facts.track.name}${leagueText}; ${fieldText}.${incidentText}${formatText}${marketText}`
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
		...nonFinishers.map((racer) => ({
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
		templateVersion: 'race-result-v2',
		links
	};
}

module.exports = { buildRaceResultStory, stableTemplateIndex };
