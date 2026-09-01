function buildHealthStory(facts) {
	if (!facts.eventId || !Number.isFinite(Date.parse(facts.occurredAt))) {
		throw new Error('Health news requires a source event and occurrence time');
	}
	if (!facts.racer?.id || !facts.racer?.name || !facts.condition?.id) {
		throw new Error('Health news requires a racer and condition');
	}
	const condition = facts.condition;
	const recovered = facts.transition === 'recovery';
	const eligibleAfterRecovery = facts.racer.eligible !== false;
	const conditionText = `${condition.severity} ${condition.kind}`;
	const summaryFact = recovered
		? eligibleAfterRecovery
			? `${facts.racer.name} recovered from the ${conditionText} recorded on ${condition.onsetAt.slice(0, 10)} and is eligible to race again.`
			: `${facts.racer.name} recovered from the ${conditionText} recorded on ${condition.onsetAt.slice(0, 10)}, but remains unavailable because another active condition still affects eligibility.`
		: condition.eligibilityEffect === 'ineligible'
			? `${facts.racer.name} sustained a ${conditionText} caused by ${condition.cause.replaceAll('_', ' ')} and is unavailable until an expected recovery on ${condition.expectedRecoveryAt.slice(0, 10)}.`
			: `${facts.racer.name} has a ${conditionText} caused by ${condition.cause.replaceAll('_', ' ')} but remains eligible with a temporary performance effect until an expected recovery on ${condition.expectedRecoveryAt.slice(0, 10)}.`;
	const headlines = recovered
		? eligibleAfterRecovery
			? [
					`${facts.racer.name} cleared to race after ${condition.kind}`,
					`${facts.racer.name} completes ${condition.kind} recovery`,
					`${facts.racer.name} returns after ${condition.kind}`
				]
			: [
					`${facts.racer.name} recovers from ${condition.kind}`,
					`${facts.racer.name} completes ${condition.kind} recovery`,
					`${facts.racer.name} recovery confirmed`
				]
		: [
				`${facts.racer.name} diagnosed with ${conditionText}`,
				`${condition.kind} sidelines ${facts.racer.name}`,
				`${facts.racer.name} faces ${conditionText} setback`
			];
	const summaryPrefixes = recovered
		? [
				'Medical staff confirmed the recovery. ',
				'The latest health update confirms: ',
				'The racer health desk reports: '
			]
		: [
				'The medical report confirms: ',
				'The racer health desk reports: ',
				'The recorded diagnosis shows: '
			];
	const templateIndex = require('./newsTemplates.cjs').stableTemplateIndex(
		facts.eventId,
		headlines.length
	);
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
		headline: headlines[templateIndex],
		summary: `${summaryPrefixes[templateIndex]}${summaryFact}`,
		category: recovered ? 'health_recovery' : 'health_onset',
		importance: recovered
			? 55
			: condition.severity === 'severe'
				? 85
				: condition.severity === 'moderate'
					? 70
					: 45,
		publishedAt: new Date(facts.occurredAt).toISOString(),
		templateVersion: 'health-story-v2',
		links
	};
}

module.exports = { buildHealthStory };
