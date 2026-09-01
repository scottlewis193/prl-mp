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
	return {
		headline: signing
			? `${facts.trainer.name} signs ${facts.racer.name}`
			: `${facts.trainer.name} releases ${facts.racer.name}`,
		summary: signing
			? `${facts.racer.name} joined ${facts.trainer.name}'s roster for ₽${Number(facts.price).toFixed(2)} and will compete in ${facts.league?.name || 'league competition'}.`
			: `${facts.racer.name} was released by ${facts.trainer.name} and entered the free-agent pool at a market value of ₽${Number(facts.price).toFixed(2)}.`,
		category: facts.transition,
		importance: signing ? 60 : 50,
		publishedAt: new Date(facts.occurredAt).toISOString(),
		templateVersion: 'roster-story-v1',
		links
	};
}

module.exports = { buildRosterStory };
