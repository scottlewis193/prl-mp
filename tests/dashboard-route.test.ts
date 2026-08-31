import assert from 'node:assert/strict';
import test from 'node:test';

import { loadDashboard } from '../src/lib/server/dashboardRepository';

function dashboardClient(records: Record<string, unknown>) {
	return {
		collection(name: string) {
			return {
				getFullList: async () => {
					const value = records[name];
					if (value instanceof Error) throw value;
					return value ?? [];
				}
			};
		}
	};
}

test('authenticated dashboard repository aggregates the player account and live records', async () => {
	const result = await loadDashboard(
		dashboardClient({
			accountLedger: [
				{
					type: 'account_opened',
					balanceDelta: 260,
					balanceAfter: 260,
					occurredAt: '2026-08-14T12:00:00Z'
				},
				{
					type: 'buy',
					balanceDelta: -10,
					balanceAfter: 250,
					occurredAt: new Date().toISOString()
				}
			],
			wagers: [
				{ status: 'won', stake: 10, payout: 25 },
				{ status: 'lost', stake: 5, payout: 0 }
			],
			holdings: [{ player: 'player-1', racer: 'racer-1', quantity: 5, costBasis: 40 }],
			racers: [
				{
					id: 'racer-1',
					name: 'Bolt',
					financials: { currentSharePrice: 10, priceHistory: [] },
					raceHistory: { races: [] }
				}
			],
			races: [],
			racetracks: [],
			seasons: [{ id: 'season-1', name: 'Season 1', status: 'active', movementCount: 1 }],
			leagues: [{ id: 'league-1', name: 'Starter League', minRanking: 1, maxPlayers: 1 }],
			leagueStandings: [
				{
					season: 'season-1',
					league: 'league-1',
					racer: 'racer-1',
					points: 25,
					starts: 1,
					wins: 1,
					podiums: 1,
					bestFinish: 1,
					recentForm: [1]
				}
			]
		}) as never,
		{ id: 'player-1', balance: 250, watchlist: ['racer-1'] }
	);

	assert.deepEqual(result.account, {
		balance: 250,
		change: -10,
		period: 'Last 24 hours'
	});
	assert.deepEqual(result.wagering, {
		count: 2,
		open: 0,
		wins: 1,
		losses: 1,
		refunds: 0,
		totalStaked: 15,
		totalPayout: 25,
		profit: 10
	});
	assert.deepEqual(result.trading, { trades: 1, buys: 1, sells: 0 });
	assert.deepEqual(result.portfolio.holdings, [
		{
			racerId: 'racer-1',
			racerName: 'Bolt',
			quantity: 5,
			costBasis: 40,
			currentPrice: 10,
			marketValue: 50,
			gain: 10,
			gainPercent: 25
		}
	]);
	assert.deepEqual(result.leagueTables, [
		{
			leagueId: 'league-1',
			leagueName: 'Starter League',
			seasonName: 'Season 1',
			rows: [
				{
					position: 1,
					racerId: 'racer-1',
					racerName: 'Bolt',
					points: 25,
					starts: 1,
					wins: 1,
					podiums: 1,
					bestFinish: 1,
					recentForm: [1],
					movementZone: 'safe'
				}
			]
		}
	]);
});

test('dashboard repository exposes backend failures to the server loader', async () => {
	await assert.rejects(
		() =>
			loadDashboard(dashboardClient({ holdings: new Error('backend unavailable') }) as never, {
				id: 'player-1',
				balance: 250,
				watchlist: []
			}),
		/backend unavailable/i
	);
});

test('dashboard repository loads completed seasons, awards, and league movements', async () => {
	const result = await loadDashboard(
		dashboardClient({
			accountLedger: [],
			wagers: [],
			holdings: [],
			racers: [{ id: 'racer-1', name: 'Bolt' }],
			races: [],
			racetracks: [],
			seasons: [
				{
					id: 'season-1',
					name: 'Season 1',
					status: 'completed',
					movementCount: 1,
					endedAt: '2026-08-31T12:00:00Z'
				}
			],
			leagues: [{ id: 'league-1', name: 'Premier League', minRanking: 1, maxPlayers: 1 }],
			leagueStandings: [
				{
					season: 'season-1',
					league: 'league-1',
					racer: 'racer-1',
					points: 25,
					starts: 1,
					wins: 1,
					podiums: 1,
					bestFinish: 1,
					recentForm: [1]
				}
			],
			seasonAwards: [
				{
					season: 'season-1',
					league: 'league-1',
					racer: 'racer-1',
					type: 'league_champion',
					position: 1,
					name: 'Season 1 Premier League champion',
					occurredAt: '2026-08-31T12:00:00Z'
				}
			],
			leagueMovements: [
				{
					season: 'season-1',
					racer: 'racer-1',
					fromLeague: 'league-1',
					toLeague: 'league-1',
					direction: 'promoted',
					fromPosition: 1,
					occurredAt: '2026-08-31T12:00:00Z'
				}
			]
		}) as never,
		{ id: 'player-1', balance: 0, watchlist: [] }
	);

	assert.equal(
		result.priorSeasons[0]?.leagueTables[0]?.rows[0]?.awardName,
		'Season 1 Premier League champion'
	);
	assert.equal(result.racerMovementHistory[0]?.racerName, 'Bolt');
});
