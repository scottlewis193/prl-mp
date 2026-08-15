export type WinnerMarket = {
	type: 'winner';
	name: string;
	cutoff: string;
	selections: { racerId: string; odds: number }[];
};

declare const wagerRules: {
	buildWinnerMarket(
		participants: { racerId: string; ranking: number }[],
		cutoff: string
	): WinnerMarket;
	quoteWager(input: { market: WinnerMarket; selection: string; stake: number; now: string }): {
		market: 'winner';
		selection: string;
		stake: number;
		odds: number;
		potentialPayout: number;
		cutoffAt: string;
	};
	roundMoney(amount: number): number;
};

export = wagerRules;
