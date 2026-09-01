type SigningCandidate = {
	id: string;
	trainerId: string;
	leagueId: string;
	price: number;
	healthEligible: boolean;
	ageDays: number;
	ranking: number;
	recentFinishes: number[];
	potential: number;
	retired: boolean;
};

declare const rosterMarket: {
	ROSTER_MARKET_RULES: { version: string };
	generateRosterRacerTraits(
		speciesKey: string,
		generationSeed: string
	): {
		durability: number;
		resilience: number;
		temperament: number;
		consistency: number;
		potential: number;
		longevity: number;
	};
	selectSigningCandidate(input: {
		trainer: { id: string; budget: number; rosterCapacity: number };
		league: { id: string; minRanking: number; maxRanking: number };
		rosterSize: number;
		candidates: SigningCandidate[];
		seed: string;
	}): null | {
		candidateId: string;
		factors: Record<string, number>;
		baseScore: number;
		seededTieBreak: number;
		score: number;
		inputs: {
			rosterSize: number;
			rosterCapacity: number;
			trainerBudget: number;
			league: { id: string; minRanking: number; maxRanking: number };
			candidate: SigningCandidate;
		};
		eligibleCandidateIds: string[];
		rulesVersion: string;
	};
	buildRosterPricePoint(input: {
		transition: 'signing' | 'release';
		previousPrice: number;
		occurredAt: string;
		sourceEvent: string;
		trainerId: string;
	}): {
		timestamp: string;
		previousPrice: number;
		price: number;
		change: number;
		changePercent: number;
		reason: {
			type: 'roster_change';
			transition: 'signing' | 'release';
			trainerId: string;
			appliedPercent: number;
		};
		rulesVersion: string;
		sourceEvent: string;
	};
	planFreeAgentReplenishment(input: {
		currentPoolSize: number;
		minimumPoolSize: number;
		targetPoolSize: number;
		seed: string;
		existingRacerIdentities: Array<{ speciesId: string; generationSeed: string }>;
		eligibleSpeciesIds: string[];
	}): Array<{
		speciesId: string;
		generationSeed: string;
		instanceIndex: number;
		identityHash: string;
	}>;
};

export = rosterMarket;
