import { formatMarketPrice } from './exchangePresentation';
import { orderLeagueStandings } from './leagueStandings';
import type { RaceType } from './types';

type RaceStatus = RaceType['status'];
type LedgerEntryType =
	| 'account_opened'
	| 'buy'
	| 'sell'
	| 'wager_reserve'
	| 'wager_payout'
	| 'wager_refund';

export type DashboardLedgerEntry = {
	type: LedgerEntryType;
	balanceDelta: number;
	balanceAfter: number;
	occurredAt: string;
};

export type DashboardWagerRecord = {
	status: 'open' | 'won' | 'lost' | 'refunded';
	stake: number;
	payout: number;
};

export type DashboardHoldingRecord = {
	player: string;
	racer: string;
	quantity: number;
	costBasis: number;
};

export type DashboardRacerRecord = {
	id?: string;
	name: string;
	financials?: {
		currentSharePrice?: number;
		priceHistory?: { timestamp: string; price: number; reason?: string }[];
	};
	raceHistory?: {
		races?: { raceId: string; position: number; prizeMoney: number; date: string }[];
	};
};

export type DashboardSeasonRecord = {
	id: string;
	name: string;
	status: 'active' | 'completed';
	movementCount: number;
	endedAt?: string;
};

export type DashboardLeagueRecord = {
	id: string;
	name: string;
	minRanking: number;
	maxPlayers: number;
};

export type DashboardStandingRecord = {
	season: string;
	league: string;
	racer: string;
	points: number;
	starts: number;
	wins: number;
	podiums: number;
	bestFinish: number;
	recentForm: number[];
};

export type DashboardSeasonAwardRecord = {
	season: string;
	league: string;
	racer: string;
	type: 'league_champion';
	position: number;
	name: string;
	occurredAt: string;
};

export type DashboardLeagueMovementRecord = {
	season: string;
	racer: string;
	fromLeague: string;
	toLeague: string;
	direction: 'promoted' | 'relegated';
	fromPosition: number;
	occurredAt: string;
};

export type DashboardRaceRecord = {
	id?: string;
	name: string;
	status: RaceStatus;
	racetrack?: string;
	winner?: string;
	startTime: Date | string;
};

export type DashboardTrackRecord = { id: string; name: string };

export type DashboardHolding = {
	racerId: string;
	racerName: string;
	quantity: number;
	costBasis: number;
	currentPrice: number | null;
	marketValue: number | null;
	gain: number | null;
	gainPercent: number | null;
};

export type DashboardRace = {
	id: string;
	name: string;
	status: RaceStatus;
	trackName: string;
	startTime: Date | string;
};

export type DashboardResult = Omit<DashboardRace, 'status'> & { winnerName: string };

export type DashboardActivity = {
	racerId: string;
	racerName: string;
	description: string;
	timestamp: string;
};

export type DashboardLeagueTableRow = {
	position: number;
	racerId: string;
	racerName: string;
	points: number;
	starts: number;
	wins: number;
	podiums: number;
	bestFinish: number;
	recentForm: number[];
	movementZone: 'promotion' | 'relegation' | 'safe';
};

export type DashboardLeagueTable = {
	leagueId: string;
	leagueName: string;
	seasonName: string;
	rows: DashboardLeagueTableRow[];
};

export type DashboardPriorSeason = {
	seasonId: string;
	seasonName: string;
	endedAt: string;
	leagueTables: {
		leagueId: string;
		leagueName: string;
		rows: (Omit<DashboardLeagueTableRow, 'movementZone'> & { awardName: string | null })[];
	}[];
};

export type DashboardRacerMovement = {
	seasonName: string;
	racerId: string;
	racerName: string;
	direction: 'promoted' | 'relegated';
	fromLeagueName: string;
	toLeagueName: string;
	fromPosition: number;
	occurredAt: string;
};

export type DashboardView = {
	account: { balance: number; change: number; period: 'Last 24 hours' };
	wagering: {
		count: number;
		open: number;
		wins: number;
		losses: number;
		refunds: number;
		totalStaked: number;
		totalPayout: number;
		profit: number;
	};
	trading: { trades: number; buys: number; sells: number };
	portfolio: {
		costBasis: number;
		marketValue: number | null;
		gain: number | null;
		gainPercent: number | null;
		holdings: DashboardHolding[];
	};
	upcomingRaces: DashboardRace[];
	recentResults: DashboardResult[];
	watchedActivity: DashboardActivity[];
	leagueTables: DashboardLeagueTable[];
	priorSeasons: DashboardPriorSeason[];
	racerMovementHistory: DashboardRacerMovement[];
};

type DashboardInput = {
	balance: number;
	ledger: DashboardLedgerEntry[];
	wagers: DashboardWagerRecord[];
	holdings: DashboardHoldingRecord[];
	racers: DashboardRacerRecord[];
	races: DashboardRaceRecord[];
	racetracks: DashboardTrackRecord[];
	watchlist: string[];
	seasons?: DashboardSeasonRecord[];
	leagues?: DashboardLeagueRecord[];
	standings?: DashboardStandingRecord[];
	seasonAwards?: DashboardSeasonAwardRecord[];
	leagueMovements?: DashboardLeagueMovementRecord[];
	now?: Date;
};

function timestampOrZero(value: Date | string): number {
	const timestamp = new Date(value).getTime();
	return Number.isFinite(timestamp) ? timestamp : 0;
}

function ordinal(position: number): string {
	const mod100 = position % 100;
	if (mod100 >= 11 && mod100 <= 13) return `${position}th`;
	return `${position}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[position % 10] ?? 'th'}`;
}

function accountSummary(balance: number, ledger: DashboardLedgerEntry[], now: Date) {
	const ledgerBalance = ledger.reduce((total, entry) => total + Number(entry.balanceDelta), 0);
	const currentBalance = ledger.length > 0 ? roundMoney(ledgerBalance) : Number(balance);
	const dayAgo = now.getTime() - 24 * 60 * 60 * 1_000;
	const change = ledger.reduce(
		(total, entry) =>
			timestampOrZero(entry.occurredAt) >= dayAgo &&
			timestampOrZero(entry.occurredAt) <= now.getTime()
				? total + Number(entry.balanceDelta)
				: total,
		0
	);
	return {
		balance: Number.isFinite(currentBalance) ? currentBalance : 0,
		change,
		period: 'Last 24 hours' as const
	};
}

function roundMoney(value: number): number {
	return Math.round(value * 100) / 100;
}

function wageringSummary(wagers: DashboardWagerRecord[]): DashboardView['wagering'] {
	let open = 0;
	let wins = 0;
	let losses = 0;
	let refunds = 0;
	let totalStaked = 0;
	let totalPayout = 0;
	let profit = 0;
	for (const wager of wagers) {
		totalStaked += Number(wager.stake);
		totalPayout += Number(wager.payout);
		if (wager.status === 'open') open += 1;
		else {
			profit += Number(wager.payout) - Number(wager.stake);
			if (wager.status === 'won') wins += 1;
			else if (wager.status === 'lost') losses += 1;
			else refunds += 1;
		}
	}
	return {
		count: wagers.length,
		open,
		wins,
		losses,
		refunds,
		totalStaked: roundMoney(totalStaked),
		totalPayout: roundMoney(totalPayout),
		profit: roundMoney(profit)
	};
}

function tradingSummary(ledger: DashboardLedgerEntry[]): DashboardView['trading'] {
	const buys = ledger.filter((entry) => entry.type === 'buy').length;
	const sells = ledger.filter((entry) => entry.type === 'sell').length;
	return { trades: buys + sells, buys, sells };
}

function portfolioSummary(
	holdingRecords: DashboardHoldingRecord[],
	racersById: Map<string, DashboardRacerRecord>
): DashboardView['portfolio'] {
	const holdings = holdingRecords.map((holding): DashboardHolding => {
		const racer = racersById.get(holding.racer);
		const rawPrice = racer?.financials?.currentSharePrice;
		const currentPrice = Number.isFinite(rawPrice) ? Number(rawPrice) : null;
		const marketValue = currentPrice === null ? null : holding.quantity * currentPrice;
		const gain = marketValue === null ? null : marketValue - holding.costBasis;
		return {
			racerId: holding.racer,
			racerName: racer?.name ?? 'Unknown racer',
			quantity: holding.quantity,
			costBasis: holding.costBasis,
			currentPrice,
			marketValue,
			gain,
			gainPercent: gain === null || holding.costBasis <= 0 ? null : (gain / holding.costBasis) * 100
		};
	});
	const valuedHoldings = holdings.filter(
		(holding): holding is DashboardHolding & { marketValue: number; gain: number } =>
			holding.marketValue !== null && holding.gain !== null
	);
	const costBasis = holdings.reduce((total, holding) => total + holding.costBasis, 0);
	const hasEveryMarketPrice = valuedHoldings.length === holdings.length;
	const marketValue = hasEveryMarketPrice
		? valuedHoldings.reduce((total, holding) => total + holding.marketValue, 0)
		: null;
	const gain = marketValue === null ? null : marketValue - costBasis;
	return {
		costBasis,
		marketValue,
		gain,
		gainPercent: gain !== null && costBasis > 0 ? (gain / costBasis) * 100 : null,
		holdings
	};
}

function raceSummaries(
	races: DashboardRaceRecord[],
	tracksById: Map<string, string>,
	racersById: Map<string, DashboardRacerRecord>
): Pick<DashboardView, 'upcomingRaces' | 'recentResults'> {
	const raceView = (race: DashboardRaceRecord): DashboardRace => ({
		id: race.id ?? '',
		name: race.name,
		status: race.status,
		trackName: tracksById.get(race.racetrack ?? '') ?? 'Unknown track',
		startTime: race.startTime
	});
	const upcomingRaces = races
		.filter((race) => race.status === 'pending' || race.status === 'countdown')
		.toSorted((left, right) => timestampOrZero(left.startTime) - timestampOrZero(right.startTime))
		.slice(0, 3)
		.map(raceView);
	const recentResults = races
		.filter((race) => race.status === 'finished' || race.status === 'settled')
		.toSorted((left, right) => timestampOrZero(right.startTime) - timestampOrZero(left.startTime))
		.slice(0, 3)
		.map((race) => ({
			...raceView(race),
			winnerName: racersById.get(race.winner ?? '')?.name ?? 'Result pending'
		}))
		.map(({ status: _status, ...result }) => result);
	return { upcomingRaces, recentResults };
}

function watchedActivitySummary(
	racers: DashboardRacerRecord[],
	watchlist: string[],
	racesById: Map<string, DashboardRaceRecord>
): DashboardActivity[] {
	const watched = new Set(watchlist);
	return racers
		.filter((racer) => !!racer.id && watched.has(racer.id))
		.flatMap((racer): DashboardActivity[] => {
			const racerId = racer.id ?? '';
			const priceActivity = (racer.financials?.priceHistory ?? []).flatMap((point) =>
				timestampOrZero(point.timestamp) > 0
					? [
							{
								racerId,
								racerName: racer.name,
								description: `Price moved to ${formatMarketPrice(point.price)}${point.reason ? ` · ${point.reason}` : ''}`,
								timestamp: point.timestamp
							}
						]
					: []
			);
			const resultActivity = (racer.raceHistory?.races ?? []).flatMap((result) => {
				const race = racesById.get(result.raceId);
				return timestampOrZero(result.date) > 0
					? [
							{
								racerId,
								racerName: racer.name,
								description: `Finished ${ordinal(result.position)} in ${race?.name ?? 'a race'}`,
								timestamp: result.date
							}
						]
					: [];
			});
			return [...priceActivity, ...resultActivity];
		})
		.toSorted((left, right) => timestampOrZero(right.timestamp) - timestampOrZero(left.timestamp))
		.slice(0, 5);
}

function orderedStandingsForLeague(
	standings: DashboardStandingRecord[],
	seasonId: string,
	leagueId: string
) {
	return orderLeagueStandings(
		standings
			.filter((standing) => standing.season === seasonId && standing.league === leagueId)
			.map((standing) => ({
				racerId: standing.racer,
				points: Number(standing.points) || 0,
				starts: Number(standing.starts) || 0,
				wins: Number(standing.wins) || 0,
				podiums: Number(standing.podiums) || 0,
				bestFinish: Number(standing.bestFinish) || 0,
				recentForm: Array.isArray(standing.recentForm) ? standing.recentForm.map(Number) : []
			}))
	);
}

function leagueTableSummaries(
	seasons: DashboardSeasonRecord[],
	leagues: DashboardLeagueRecord[],
	standings: DashboardStandingRecord[],
	racersById: Map<string, DashboardRacerRecord>
): DashboardLeagueTable[] {
	const season = seasons.find((candidate) => candidate.status === 'active');
	if (!season) return [];
	const orderedLeagues = [...leagues].sort(
		(left, right) => left.minRanking - right.minRanking || left.id.localeCompare(right.id)
	);
	const movementCount = Math.max(0, Math.floor(Number(season.movementCount) || 0));

	return orderedLeagues.map((league, leagueIndex) => {
		const orderedRows = orderedStandingsForLeague(standings, season.id, league.id);
		return {
			leagueId: league.id,
			leagueName: league.name,
			seasonName: season.name,
			rows: orderedRows.map((standing, index) => {
				const position = index + 1;
				const promotion = leagueIndex > 0 && position <= movementCount;
				const relegation =
					leagueIndex < orderedLeagues.length - 1 && position > orderedRows.length - movementCount;
				return {
					position,
					racerId: standing.racerId,
					racerName: racersById.get(standing.racerId)?.name ?? 'Unknown racer',
					points: standing.points,
					starts: standing.starts,
					wins: standing.wins,
					podiums: standing.podiums,
					bestFinish: standing.bestFinish,
					recentForm: standing.recentForm,
					movementZone: promotion ? 'promotion' : relegation ? 'relegation' : 'safe'
				};
			})
		};
	});
}

function priorSeasonSummaries(
	seasons: DashboardSeasonRecord[],
	leagues: DashboardLeagueRecord[],
	standings: DashboardStandingRecord[],
	seasonAwards: DashboardSeasonAwardRecord[],
	racersById: Map<string, DashboardRacerRecord>
): DashboardPriorSeason[] {
	const orderedLeagues = [...leagues].sort(
		(left, right) => left.minRanking - right.minRanking || left.id.localeCompare(right.id)
	);
	return seasons
		.filter((season) => season.status === 'completed')
		.toSorted(
			(left, right) =>
				timestampOrZero(right.endedAt ?? '') - timestampOrZero(left.endedAt ?? '') ||
				right.id.localeCompare(left.id)
		)
		.map((season) => ({
			seasonId: season.id,
			seasonName: season.name,
			endedAt: season.endedAt ?? '',
			leagueTables: orderedLeagues.map((league) => ({
				leagueId: league.id,
				leagueName: league.name,
				rows: orderedStandingsForLeague(standings, season.id, league.id).map((standing, index) => ({
					position: index + 1,
					racerId: standing.racerId,
					racerName: racersById.get(standing.racerId)?.name ?? 'Unknown racer',
					points: standing.points,
					starts: standing.starts,
					wins: standing.wins,
					podiums: standing.podiums,
					bestFinish: standing.bestFinish,
					recentForm: standing.recentForm,
					awardName:
						seasonAwards.find(
							(award) =>
								award.season === season.id &&
								award.league === league.id &&
								award.racer === standing.racerId
						)?.name ?? null
				}))
			}))
		}));
}

function racerMovementSummaries(
	movements: DashboardLeagueMovementRecord[],
	seasons: DashboardSeasonRecord[],
	leagues: DashboardLeagueRecord[],
	racersById: Map<string, DashboardRacerRecord>
): DashboardRacerMovement[] {
	const seasonsById = new Map(seasons.map((season) => [season.id, season]));
	const leaguesById = new Map(leagues.map((league) => [league.id, league]));
	return movements
		.toSorted(
			(left, right) =>
				timestampOrZero(right.occurredAt) - timestampOrZero(left.occurredAt) ||
				left.racer.localeCompare(right.racer)
		)
		.map((movement) => ({
			seasonName: seasonsById.get(movement.season)?.name ?? 'Unknown season',
			racerId: movement.racer,
			racerName: racersById.get(movement.racer)?.name ?? 'Unknown racer',
			direction: movement.direction,
			fromLeagueName: leaguesById.get(movement.fromLeague)?.name ?? 'Unknown league',
			toLeagueName: leaguesById.get(movement.toLeague)?.name ?? 'Unknown league',
			fromPosition: Number(movement.fromPosition) || 0,
			occurredAt: movement.occurredAt
		}));
}

export function aggregateDashboard(input: DashboardInput): DashboardView {
	const racersById = new Map(
		input.racers.flatMap((racer) => (racer.id ? [[racer.id, racer] as const] : []))
	);
	const racesById = new Map(
		input.races.flatMap((race) => (race.id ? [[race.id, race] as const] : []))
	);
	const races = raceSummaries(
		input.races,
		new Map(input.racetracks.map((track) => [track.id, track.name])),
		racersById
	);

	return {
		account: accountSummary(input.balance, input.ledger, input.now ?? new Date()),
		wagering: wageringSummary(input.wagers),
		trading: tradingSummary(input.ledger),
		portfolio: portfolioSummary(input.holdings, racersById),
		...races,
		watchedActivity: watchedActivitySummary(input.racers, input.watchlist, racesById),
		leagueTables: leagueTableSummaries(
			input.seasons ?? [],
			input.leagues ?? [],
			input.standings ?? [],
			racersById
		),
		priorSeasons: priorSeasonSummaries(
			input.seasons ?? [],
			input.leagues ?? [],
			input.standings ?? [],
			input.seasonAwards ?? [],
			racersById
		),
		racerMovementHistory: racerMovementSummaries(
			input.leagueMovements ?? [],
			input.seasons ?? [],
			input.leagues ?? [],
			racersById
		)
	};
}
