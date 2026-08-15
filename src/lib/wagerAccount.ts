type WagerAccountItemBase = {
	id: string;
	raceId: string;
	raceName: string;
	market: string;
	selection: string;
	selectionName: string;
	stake: number;
	odds: number;
	potentialPayout: number;
	placedAt: string;
	status: 'open' | 'won' | 'lost' | 'refunded';
	payout: number;
	resolvedAt: string;
};

export type WagerAccountItem = WagerAccountItemBase &
	(
		| { cutoffAt: string; cutoffSnapshotStatus: 'accepted' }
		| { cutoffAt: ''; cutoffSnapshotStatus: 'unknown_legacy' }
	);

export type WagerAccount = {
	balance: number;
	ledgerBalance: number;
	reconciled: boolean;
	openWagers: WagerAccountItem[];
	historicalWagers: WagerAccountItem[];
};
