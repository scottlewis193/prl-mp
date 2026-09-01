const RETIREMENT_RULES = Object.freeze({
	version: 'racer-retirement-v1',
	minimumCareerDays: 365,
	maximumProbability: 0.95
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

function round(value, places = 6) {
	const scale = 10 ** places;
	return Math.round((value + Number.EPSILON) * scale) / scale;
}

function evaluateRacerRetirement(input) {
	if (!input.racerId || !input.seed || !Number.isFinite(Date.parse(input.processedAt))) {
		throw new Error('Retirement evaluation requires a racer, seed, and processing time');
	}
	const inputs = {
		ageDays: Math.max(0, Math.floor(Number(input.ageDays) || 0)),
		longevity: bounded(input.longevity, 1, 100),
		careerLoad: Math.max(0, Math.floor(Number(input.careerLoad) || 0)),
		healthEligible: input.healthEligible !== false,
		activeConditionCount: Math.max(0, Math.floor(Number(input.activeConditionCount) || 0))
	};
	const roll = round(
		createRandom(
			hashSeed(`${RETIREMENT_RULES.version}:${input.racerId}:${input.seed}:${input.processedAt}`)
		)()
	);
	const careerThreshold = RETIREMENT_RULES.minimumCareerDays + inputs.longevity * 18;
	const agePressure = bounded((inputs.ageDays - careerThreshold) / 1825, 0, 1) * 0.6;
	const loadPressure = bounded((inputs.careerLoad - 40) / 260, 0, 1) * 0.25;
	const healthPressure = inputs.healthEligible ? 0 : 0.08;
	const conditionPressure = bounded(inputs.activeConditionCount / 3, 0, 1) * 0.07;
	const probability =
		inputs.ageDays < RETIREMENT_RULES.minimumCareerDays
			? 0
			: round(
					bounded(
						agePressure + loadPressure + healthPressure + conditionPressure,
						0,
						RETIREMENT_RULES.maximumProbability
					)
				);
	const pressures = [
		{ reason: 'age', value: agePressure },
		{ reason: 'career_load', value: loadPressure },
		{ reason: 'health', value: healthPressure + conditionPressure }
	].sort((left, right) => right.value - left.value);
	return {
		rulesVersion: RETIREMENT_RULES.version,
		inputs,
		roll,
		probability,
		retire: probability > 0 && roll < probability,
		reason: pressures[0].reason
	};
}

module.exports = { RETIREMENT_RULES, evaluateRacerRetirement };
