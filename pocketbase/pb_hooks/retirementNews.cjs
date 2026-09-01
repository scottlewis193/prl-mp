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
	const templates = [
		{
			headline: `${facts.racer.name} retired from racing`,
			summary: `${facts.racer.name} retired after ${facts.careerLoad} career races, with ${reason} recorded as the primary factor. Any trainer and league places are now vacant; the career record remains available.`
		},
		{
			headline: `${facts.racer.name} brings racing career to a close`,
			summary: `After ${facts.careerLoad} career races, ${facts.racer.name} retired with ${reason} recorded as the primary factor. The racer's career record remains available while former trainer and league places are vacant.`
		},
		{
			headline: `Racing farewell for ${facts.racer.name}`,
			summary: `${facts.racer.name} has retired after ${facts.careerLoad} career races because of ${reason}. The retirement leaves any trainer and league places vacant without removing the career record.`
		}
	];
	const selected =
		templates[require('./newsTemplates.cjs').stableTemplateIndex(facts.eventId, templates.length)];
	return {
		...selected,
		category: 'retirement',
		importance: 80,
		publishedAt: new Date(facts.occurredAt).toISOString(),
		templateVersion: 'retirement-story-v2',
		links
	};
}
module.exports = { buildRetirementStory };
