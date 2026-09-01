function buildRosterStory(facts) {
	if (!facts.eventId || !Number.isFinite(Date.parse(facts.occurredAt))) {
		throw new Error('Roster news requires a source event and occurrence time');
	}
	if (!facts.racer?.id || !facts.racer?.name || !facts.trainer?.id || !facts.trainer?.name) {
		throw new Error('Roster news requires a racer and trainer');
	}
	const signing = facts.transition === 'signing';
	if (!signing && facts.transition !== 'release') {
		throw new Error('Roster news requires a signing or release transition');
	}
	const links = [
		{ kind: 'racer', id: facts.racer.id, label: facts.racer.name, href: '/exchange' },
		{ kind: 'trainer', id: facts.trainer.id, label: facts.trainer.name, href: '/trainers' }
	];
	if (facts.league?.id) {
		links.push({ kind: 'league', id: facts.league.id, label: facts.league.name, href: '/' });
	}
	const headlines = signing
		? [
				`${facts.racer.name} joins ${facts.trainer.name}`,
				`${facts.trainer.name} adds ${facts.racer.name} to the stable`,
				`${facts.trainer.name} signs ${facts.racer.name}`
			]
		: [
				`${facts.racer.name} enters free agency`,
				`${facts.trainer.name} parts company with ${facts.racer.name}`,
				`${facts.trainer.name} releases ${facts.racer.name}`
			];
	const summaries = signing
		? [
				`${facts.racer.name} is the newest member of ${facts.trainer.name}'s roster after a ₽${Number(facts.price).toFixed(2)} signing for ${facts.league?.name || 'league competition'}.`,
				`${facts.trainer.name} completed the ₽${Number(facts.price).toFixed(2)} signing of ${facts.racer.name} for ${facts.league?.name || 'league competition'}.`,
				`${facts.racer.name} joined ${facts.trainer.name}'s roster for ₽${Number(facts.price).toFixed(2)} and will compete in ${facts.league?.name || 'league competition'}.`
			]
		: [
				`${facts.racer.name} was released by ${facts.trainer.name} and entered the free-agent pool at a market value of ₽${Number(facts.price).toFixed(2)}.`,
				`${facts.trainer.name} released ${facts.racer.name}, who is now a free agent valued at ₽${Number(facts.price).toFixed(2)}.`,
				`${facts.racer.name} left ${facts.trainer.name}'s roster and entered free agency with a market value of ₽${Number(facts.price).toFixed(2)}.`
			];
	const templateIndex = require('./newsTemplates.cjs').stableTemplateIndex(
		facts.eventId,
		headlines.length
	);
	return {
		headline: headlines[templateIndex],
		summary: summaries[templateIndex],
		category: facts.transition,
		importance: signing ? 60 : 50,
		publishedAt: new Date(facts.occurredAt).toISOString(),
		templateVersion: 'roster-story-v2',
		links
	};
}

module.exports = { buildRosterStory };
