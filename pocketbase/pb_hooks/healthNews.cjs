function buildHealthStory(facts) {
	if (!facts.eventId || !Number.isFinite(Date.parse(facts.occurredAt))) {
		throw new Error('Health news requires a source event and occurrence time');
	}
	if (!facts.racer?.id || !facts.racer?.name || !facts.condition?.id) {
		throw new Error('Health news requires a racer and condition');
	}
	const condition = facts.condition;
	const recovered = facts.transition === 'recovery';
	const conditionText = `${condition.severity} ${condition.kind}`;
	const headline = recovered
		? `${facts.racer.name} cleared to race after ${condition.kind}`
		: `${facts.racer.name} diagnosed with ${conditionText}`;
	const summary = recovered
		? `${facts.racer.name} recovered from the ${conditionText} recorded on ${condition.onsetAt.slice(0, 10)} and is eligible to race again.`
		: condition.eligibilityEffect === 'ineligible'
			? `${facts.racer.name} sustained a ${conditionText} caused by ${condition.cause.replaceAll('_', ' ')} and is unavailable until an expected recovery on ${condition.expectedRecoveryAt.slice(0, 10)}.`
			: `${facts.racer.name} has a ${conditionText} caused by ${condition.cause.replaceAll('_', ' ')} but remains eligible with a temporary performance effect until an expected recovery on ${condition.expectedRecoveryAt.slice(0, 10)}.`;
	const links = [{ kind: 'racer', id: facts.racer.id, label: facts.racer.name, href: '/exchange' }];
	if (facts.trainer?.id) {
		links.push({
			kind: 'trainer',
			id: facts.trainer.id,
			label: facts.trainer.name,
			href: '/trainers'
		});
	}
	if (facts.league?.id) {
		links.push({ kind: 'league', id: facts.league.id, label: facts.league.name, href: '/' });
	}
	return {
		headline,
		summary,
		category: recovered ? 'health_recovery' : 'health_onset',
		importance: recovered
			? 55
			: condition.severity === 'severe'
				? 85
				: condition.severity === 'moderate'
					? 70
					: 45,
		publishedAt: new Date(facts.occurredAt).toISOString(),
		templateVersion: 'health-story-v1',
		links
	};
}

module.exports = { buildHealthStory };
