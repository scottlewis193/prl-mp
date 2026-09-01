const HEALTH_RULES = Object.freeze({
	version: 'racer-health-v1',
	priceFloor: 1,
	priceCeiling: 1000,
	onsetPricePercent: Object.freeze({ minor: -3, moderate: -8, severe: -10 }),
	recoveryPricePercent: Object.freeze({ minor: 2, moderate: 6, severe: 8 }),
	minorPerformanceMultiplier: 0.94
});

function hashSeed(value) {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

function createRandom(seed) {
	return function () {
		seed = (seed + 0x6d2b79f5) | 0;
		let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function bounded(value, minimum, maximum) {
	return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function round(value, places = 4) {
	const scale = 10 ** places;
	return Math.round((value + Number.EPSILON) * scale) / scale;
}

function evaluateHealthOnset(input) {
	if (!input.racerId || !input.seed || !Number.isFinite(Date.parse(input.processedAt))) {
		throw new Error('Health onset requires a racer, seed, and processing time');
	}
	const inputs = {
		speciesHp: bounded(input.speciesHp, 1, 255),
		durability: bounded(input.traits?.durability, 1, 100),
		resilience: bounded(input.traits?.resilience, 1, 100),
		ageDays: Math.max(0, Math.floor(Number(input.ageDays) || 0)),
		careerLoad: Math.max(0, Math.floor(Number(input.careerLoad) || 0)),
		activeConditionCount: Math.max(0, Math.floor(Number(input.activeConditionCount) || 0)),
		trackRisk: bounded(input.trackRisk, 0, 1),
		eventRisk: bounded(input.eventRisk, 0, 1)
	};
	const random = createRandom(
		hashSeed(`${HEALTH_RULES.version}:${input.racerId}:${input.seed}:${input.processedAt}`)
	);
	const roll = round(random(), 6);
	const vulnerability =
		((100 - inputs.durability) / 100) * 0.16 +
		((100 - inputs.resilience) / 100) * 0.08 +
		((120 - Math.min(inputs.speciesHp, 120)) / 120) * 0.05 +
		Math.min(inputs.ageDays / 3650, 1) * 0.08 +
		Math.min(inputs.careerLoad / 100, 1) * 0.12 +
		inputs.trackRisk * 0.18 +
		inputs.eventRisk * 0.12 +
		inputs.activeConditionCount * 0.04;
	const probability = round(bounded(0.001 + vulnerability * 0.1, 0.001, 0.25), 6);
	const result = { rulesVersion: HEALTH_RULES.version, inputs, roll, probability, condition: null };
	if (roll >= probability || inputs.activeConditionCount > 0) return result;

	const kindRoll = random();
	const severityRoll = random();
	const kind = kindRoll < 0.65 + inputs.trackRisk * 0.2 ? 'injury' : 'illness';
	const severeThreshold = 0.08 + inputs.trackRisk * 0.12 + (100 - inputs.resilience) / 1000;
	const moderateThreshold = severeThreshold + 0.3 + inputs.careerLoad / 500;
	const severity =
		severityRoll < severeThreshold
			? 'severe'
			: severityRoll < moderateThreshold
				? 'moderate'
				: 'minor';
	const recoveryDays = {
		minor: 3,
		moderate: 8,
		severe: 18
	}[severity];
	const resilienceAdjustment = Math.round((50 - inputs.resilience) / 20);
	const expectedRecoveryAt = new Date(
		Date.parse(input.processedAt) + Math.max(1, recoveryDays + resilienceAdjustment) * 86400000
	).toISOString();
	result.condition = {
		kind,
		severity,
		cause:
			kind === 'illness'
				? 'illness_exposure'
				: inputs.trackRisk > 0
					? 'track_incident'
					: 'training_load',
		onsetAt: new Date(input.processedAt).toISOString(),
		expectedRecoveryAt,
		eligibilityEffect: severity === 'minor' ? 'performance_penalty' : 'ineligible',
		performanceMultiplier: severity === 'minor' ? HEALTH_RULES.minorPerformanceMultiplier : 1
	};
	return result;
}

function healthPerformanceMultiplier(conditions) {
	if (!Array.isArray(conditions) || conditions.length === 0) return 1;
	if (conditions.some((condition) => condition.eligibilityEffect === 'ineligible')) return 0;
	return round(
		conditions.reduce(
			(multiplier, condition) =>
				condition.eligibilityEffect === 'performance_penalty'
					? multiplier * bounded(condition.performanceMultiplier || 1, 0, 1)
					: multiplier,
			1
		),
		4
	);
}

function buildHealthPricePoint(input) {
	if (
		!input.conditionId ||
		!input.sourceEvent ||
		!Number.isFinite(Date.parse(input.occurredAt)) ||
		!['onset', 'recovery'].includes(input.transition) ||
		!['minor', 'moderate', 'severe'].includes(input.severity)
	) {
		throw new Error('Health valuation requires a valid condition transition');
	}
	const previousPrice = Number(input.previousPrice);
	if (!Number.isFinite(previousPrice) || previousPrice <= 0) {
		throw new Error('Health valuation requires a positive current price');
	}
	const appliedPercent =
		input.transition === 'onset'
			? HEALTH_RULES.onsetPricePercent[input.severity]
			: HEALTH_RULES.recoveryPricePercent[input.severity];
	const price = round(
		bounded(
			previousPrice * (1 + appliedPercent / 100),
			HEALTH_RULES.priceFloor,
			HEALTH_RULES.priceCeiling
		),
		2
	);
	const change = round(price - previousPrice, 2);
	return {
		timestamp: new Date(input.occurredAt).toISOString(),
		previousPrice: round(previousPrice, 2),
		price,
		change,
		changePercent: round((change / previousPrice) * 100, 2),
		reason: {
			type: 'health',
			conditionId: input.conditionId,
			transition: input.transition,
			severity: input.severity,
			appliedPercent
		},
		rulesVersion: HEALTH_RULES.version,
		sourceEvent: input.sourceEvent
	};
}

module.exports = {
	HEALTH_RULES,
	evaluateHealthOnset,
	healthPerformanceMultiplier,
	buildHealthPricePoint
};
