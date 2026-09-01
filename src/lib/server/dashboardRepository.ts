import type PocketBase from 'pocketbase';
import { aggregateDashboard } from '$lib/dashboard';
import type {
	DashboardHoldingRecord,
	DashboardLeagueRecord,
	DashboardLedgerEntry,
	DashboardNewsItem,
	DashboardRacerRecord,
	DashboardRaceRecord,
	DashboardLeagueMovementRecord,
	DashboardSeasonRecord,
	DashboardSeasonAwardRecord,
	DashboardStandingRecord,
	DashboardTrackRecord,
	DashboardWagerRecord
} from '$lib/dashboard';

type DashboardUser = {
	id: string;
	balance?: unknown;
	watchlist?: unknown;
};

export async function loadDashboard(
	pb: PocketBase,
	user: DashboardUser,
	options: { newsPage?: number; newsCategory?: string | null } = {}
) {
	const newsPage = Math.max(1, Math.trunc(options.newsPage ?? 1));
	const newsCategory = options.newsCategory === 'race_result' ? options.newsCategory : null;
	const [
		ledger,
		wagers,
		holdings,
		racers,
		races,
		racetracks,
		seasons,
		leagues,
		standings,
		seasonAwards,
		leagueMovements,
		news
	] = await Promise.all([
		pb.collection('accountLedger').getFullList({
			sort: '-occurredAt',
			fields: 'type,balanceDelta,balanceAfter,occurredAt'
		}),
		pb.collection('wagers').getFullList({
			sort: '-placedAt',
			fields: 'status,stake,payout'
		}),
		pb.collection('holdings').getFullList({
			fields: 'player,racer,quantity,costBasis'
		}),
		pb.collection('racers').getFullList({
			batch: 1_000,
			fields: 'id,name,financials,raceHistory'
		}),
		pb.collection('races').getFullList({
			sort: '-startTime',
			fields: 'id,name,status,racetrack,winner,startTime'
		}),
		pb.collection('racetracks').getFullList({ fields: 'id,name' }),
		pb.collection('seasons').getFullList({
			sort: '-endedAt,id',
			fields: 'id,name,status,movementCount,endedAt'
		}),
		pb.collection('leagues').getFullList({
			sort: 'minRanking,id',
			fields: 'id,name,minRanking,maxPlayers'
		}),
		pb.collection('leagueStandings').getFullList({
			batch: 1_000,
			fields: 'season,league,racer,points,starts,wins,podiums,bestFinish,recentForm'
		}),
		pb.collection('seasonAwards').getFullList({
			sort: '-occurredAt,league',
			fields: 'season,league,racer,type,position,name,occurredAt'
		}),
		pb.collection('leagueMovements').getFullList({
			sort: '-occurredAt,racer',
			fields: 'season,racer,fromLeague,toLeague,direction,fromPosition,occurredAt'
		}),
		pb.collection('news').getList(newsPage, 5, {
			sort: '-importance,-publishedAt,-id',
			filter: newsCategory ? `category = "${newsCategory}"` : '',
			fields: 'id,headline,summary,category,importance,publishedAt,links'
		})
	]);

	return aggregateDashboard({
		balance: Number(user.balance ?? 0),
		watchlist: Array.isArray(user.watchlist) ? user.watchlist.map(String) : [],
		ledger: ledger as unknown as DashboardLedgerEntry[],
		wagers: wagers as unknown as DashboardWagerRecord[],
		holdings: holdings as unknown as DashboardHoldingRecord[],
		racers: racers as unknown as DashboardRacerRecord[],
		races: races as unknown as DashboardRaceRecord[],
		racetracks: racetracks as unknown as DashboardTrackRecord[],
		seasons: seasons as unknown as DashboardSeasonRecord[],
		leagues: leagues as unknown as DashboardLeagueRecord[],
		standings: standings as unknown as DashboardStandingRecord[],
		seasonAwards: seasonAwards as unknown as DashboardSeasonAwardRecord[],
		leagueMovements: leagueMovements as unknown as DashboardLeagueMovementRecord[],
		news: {
			items: news.items as unknown as DashboardNewsItem[],
			page: news.page,
			totalPages: Math.max(1, news.totalPages),
			category: newsCategory
		}
	});
}
