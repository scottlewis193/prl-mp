type RaceHistory = {
	wins: number;
	totalRaces: number;
	averageFinishPosition: number;
	races: { raceId: string; position: number; prizeMoney: number; date: string }[];
};

type SettlementParticipant = {
	id: string;
	finished: boolean;
	finishedAt: string;
	stats: Record<string, unknown> & { ranking: number };
	raceHistory: RaceHistory;
	financials: Record<string, unknown> & { totalEarnings: number };
	totalShares: number;
};

type AwardedPrize = { racerId: string; position: number; amount: number };

type SettlementPlan = {
	race: {
		id: string;
		status: 'settled';
		winner: string;
		endTime: string;
		finishingOrder: string[];
		awardedPrizes: AwardedPrize[];
	};
	racers: Array<{
		id: string;
		race: '';
		stats: SettlementParticipant['stats'];
		raceHistory: RaceHistory;
		financials: SettlementParticipant['financials'] & {
			earningsPerShare: number;
			lastPayoutAt: string;
		};
	}>;
};

declare const settlementRules: {
	orderRaceFinishers<T extends { id: string; finishedAt: string }>(participants: T[]): T[];
	buildRaceSettlement(input: {
		raceId: string;
		participants: SettlementParticipant[];
		prizeCurve: number[];
	}): SettlementPlan;
};

export = settlementRules;
