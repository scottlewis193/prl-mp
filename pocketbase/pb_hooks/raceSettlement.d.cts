type RaceHistory = {
	wins: number;
	totalRaces: number;
	averageFinishPosition: number;
	races: {
		raceId: string;
		position?: number;
		outcome?: 'finished' | 'dnf';
		reason?: string;
		prizeMoney: number;
		date: string;
	}[];
};

type SettlementParticipant = {
	id: string;
	finished: boolean;
	outcome?: 'finished' | 'dnf';
	finishedAt: string;
	incident?: {
		eventId: string;
		cause: string;
		summary: string;
		occurredAt: string;
	};
	stats: Record<string, unknown> & { ranking: number };
	raceHistory: RaceHistory;
	financials: Record<string, unknown> & { totalEarnings: number };
	totalShares: number;
};

type AwardedPrize = { racerId: string; position: number; classPosition?: number; amount: number };
type RaceClassEntry = { racerId: string; classId: string; className: string };
type RaceClassResult = RaceClassEntry & { overallPosition: number; classPosition: number };

type SettlementPlan = {
	race: {
		id: string;
		status: 'settled';
		winner: string;
		endTime: string;
		finishingOrder: string[];
		nonFinishers?: Array<{
			racerId: string;
			reason: string;
			summary?: string;
			occurredAt: string;
		}>;
		classResults?: RaceClassResult[];
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
	resolveWinnerMarketOutcome(input: { winnerId: string; finishingOrder: string[] }): {
		outcome: 'settled' | 'void';
		winnerId: string;
	};
	buildRaceSettlement(input: {
		raceId: string;
		participants: SettlementParticipant[];
		prizeCurve: number[];
		classEntries?: RaceClassEntry[];
	}): SettlementPlan;
};

export = settlementRules;
