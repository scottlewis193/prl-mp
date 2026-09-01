const RACE_VALUATION_RULES = Object.freeze({
	version: 'race-valuation-v1',
	priceFloor: 1,
	priceCeiling: 1000,
	maximumEventPercent: 10,
	performancePercent: 8,
	recentFormWindow: 5
});

function roundMoney(value) {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

function recentFinishPercent(position) {
	if (position === 1) return 4;
	if (position === 2) return 2;
	if (position === 3) return 1;
	return -2;
}

function buildRacePricePoint(input) {
	const position = Number(input.position);
	const fieldSize = Number(input.fieldSize);
	const isDnf = input.outcome === 'dnf';
	const previousPrice = Number(input.previousPrice);
	if (!input.raceId || !input.sourceEvent || !Number.isFinite(Date.parse(input.occurredAt))) {
		throw new Error('Race valuation requires a race, source event, and occurrence time');
	}
	if (
		(!isDnf && !Number.isInteger(position)) ||
		!Number.isInteger(fieldSize) ||
		(!isDnf && (position < 1 || position > fieldSize)) ||
		fieldSize < 1 ||
		(isDnf && !input.incidentReason)
	) {
		throw new Error('Race valuation requires a valid finishing position and field size');
	}
	if (!Number.isFinite(previousPrice) || previousPrice <= 0) {
		throw new Error('Race valuation requires a positive current price');
	}

	const performancePercent = isDnf
		? -RACE_VALUATION_RULES.maximumEventPercent
		: fieldSize === 1
			? RACE_VALUATION_RULES.performancePercent
			: RACE_VALUATION_RULES.performancePercent * (1 - (2 * (position - 1)) / (fieldSize - 1));
	const recentFinishes = (Array.isArray(input.recentFinishes) ? input.recentFinishes : [])
		.filter((finish) => Number.isInteger(finish) && finish > 0)
		.slice(-RACE_VALUATION_RULES.recentFormWindow);
	const recentFormPercent = isDnf
		? 0
		: recentFinishes.length
			? recentFinishes.reduce((total, finish) => total + recentFinishPercent(finish), 0) /
				recentFinishes.length
			: 0;
	const uncappedPercent = performancePercent + recentFormPercent;
	const boundedPercent = Math.max(
		-RACE_VALUATION_RULES.maximumEventPercent,
		Math.min(RACE_VALUATION_RULES.maximumEventPercent, uncappedPercent)
	);
	const price = roundMoney(
		Math.max(
			RACE_VALUATION_RULES.priceFloor,
			Math.min(RACE_VALUATION_RULES.priceCeiling, previousPrice * (1 + boundedPercent / 100))
		)
	);
	const change = roundMoney(price - previousPrice);
	const changePercent = roundMoney((change / previousPrice) * 100);

	return {
		timestamp: input.occurredAt,
		previousPrice: roundMoney(previousPrice),
		price,
		change,
		changePercent,
		reason: {
			type: 'race_result',
			raceId: input.raceId,
			...(isDnf ? { outcome: 'dnf', incidentReason: input.incidentReason } : { position }),
			fieldSize,
			performancePercent: roundMoney(performancePercent),
			recentFormPercent: roundMoney(recentFormPercent),
			uncappedPercent: roundMoney(uncappedPercent),
			appliedPercent: roundMoney(boundedPercent)
		},
		rulesVersion: RACE_VALUATION_RULES.version,
		sourceEvent: input.sourceEvent
	};
}

module.exports = { buildRacePricePoint, RACE_VALUATION_RULES };
