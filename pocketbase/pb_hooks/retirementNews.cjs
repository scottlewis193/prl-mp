function buildRetirementStory(facts) {
	if (!facts.eventId || !Number.isFinite(Date.parse(facts.occurredAt)) || !facts.racer?.id) {
		throw new Error('Retirement news requires a source event, time, and racer');
	}
	const reason = facts.reason.replaceAll('_', ' ');
	const links = [{ kind: 'racer', id: facts.racer.id, label: facts.racer.name, href: '/exchange' }];
	if (facts.trainer?.id)
		links.push({
			kind: 'trainer',
			id: facts.trainer.id,
			label: facts.trainer.name,
			href: '/trainers'
		});
	if (facts.league?.id)
		links.push({ kind: 'league', id: facts.league.id, label: facts.league.name, href: '/' });
	return {
		headline: `${facts.racer.name} retired from racing`,
		summary: `${facts.racer.name} retired after ${facts.careerLoad} career races, with ${reason} recorded as the primary factor. Any trainer and league places are now vacant; the career record remains available.`,
		category: 'retirement',
		importance: 80,
		publishedAt: new Date(facts.occurredAt).toISOString(),
		templateVersion: 'retirement-story-v1',
		links
	};
}
module.exports = { buildRetirementStory };
