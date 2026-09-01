type RacePricePoint = {
	timestamp: string;
	previousPrice: number;
	price: number;
	change: number;
	changePercent: number;
	reason: {
		type: 'race_result';
		raceId: string;
		position: number;
		fieldSize: number;
		performancePercent: number;
		recentFormPercent: number;
		uncappedPercent: number;
		appliedPercent: number;
	};
	rulesVersion: 'race-valuation-v1';
	sourceEvent: string;
};

declare const racerValuation: {
	RACE_VALUATION_RULES: {
		version: 'race-valuation-v1';
		priceFloor: number;
		priceCeiling: number;
		maximumEventPercent: number;
		performancePercent: number;
		recentFormWindow: number;
	};
	buildRacePricePoint(input: {
		raceId: string;
		position: number;
		fieldSize: number;
		previousPrice: number;
		recentFinishes: number[];
		occurredAt: string;
		sourceEvent: string;
	}): RacePricePoint;
};

export = racerValuation;
