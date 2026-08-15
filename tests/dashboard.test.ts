import assert from 'node:assert/strict';
import test from 'node:test';

import { aggregateDashboard } from '../src/lib/dashboard';

test('dashboard aggregation calculates account, holdings, races and watched activity from live records', () => {
	const dashboard = aggregateDashboard({
		balance: 9_970,
		ledger: [
			{
				balanceDelta: 10_000,
				balanceAfter: 10_000,
				occurredAt: '2026-08-13T12:00:00Z'
			},
			{ balanceDelta: -50, balanceAfter: 9_950, occurredAt: '2026-08-15T09:00:00Z' },
			{ balanceDelta: 20, balanceAfter: 9_970, occurredAt: '2026-08-15T11:00:00Z' }
		],
		holdings: [
			{ player: 'player-1', racer: 'racer-1', quantity: 10, costBasis: 100 },
			{ player: 'player-1', racer: 'racer-2', quantity: 2, costBasis: 50 }
		],
		racers: [
			{
				id: 'racer-1',
				name: 'Bolt',
				financials: {
					currentSharePrice: 12,
					priceHistory: [{ timestamp: '2026-08-15T11:30:00Z', price: 12, reason: 'Race win' }]
				},
				raceHistory: { races: [] }
			},
			{
				id: 'racer-2',
				name: 'Dash',
				financials: { currentSharePrice: 20, priceHistory: [] },
				raceHistory: {
					races: [
						{
							raceId: 'race-recent',
							position: 2,
							prizeMoney: 25,
							date: '2026-08-15T11:45:00Z'
						}
					]
				}
			}
		],
		races: [
			{
				id: 'race-upcoming',
				name: 'Johto Sprint',
				status: 'pending',
				racetrack: 'track-1',
				startTime: '2026-08-15T13:00:00Z'
			},
			{
				id: 'race-recent',
				name: 'Indigo Cup',
				status: 'settled',
				racetrack: 'track-2',
				winner: 'racer-1',
				startTime: '2026-08-15T10:00:00Z'
			}
		],
		racetracks: [
			{ id: 'track-1', name: 'Johto Circuit' },
			{ id: 'track-2', name: 'Indigo Circuit' }
		],
		watchlist: ['racer-1', 'racer-2'],
		now: new Date('2026-08-15T12:00:00Z')
	});

	assert.deepEqual(dashboard.account, {
		balance: 9_970,
		change: -30,
		period: 'Last 24 hours'
	});
	assert.deepEqual(dashboard.portfolio, {
		costBasis: 150,
		marketValue: 160,
		gain: 10,
		gainPercent: 6.666666666666667,
		holdings: [
			{
				racerId: 'racer-1',
				racerName: 'Bolt',
				quantity: 10,
				costBasis: 100,
				currentPrice: 12,
				marketValue: 120,
				gain: 20,
				gainPercent: 20
			},
			{
				racerId: 'racer-2',
				racerName: 'Dash',
				quantity: 2,
				costBasis: 50,
				currentPrice: 20,
				marketValue: 40,
				gain: -10,
				gainPercent: -20
			}
		]
	});
	assert.deepEqual(dashboard.upcomingRaces, [
		{
			id: 'race-upcoming',
			name: 'Johto Sprint',
			status: 'pending',
			trackName: 'Johto Circuit',
			startTime: '2026-08-15T13:00:00Z'
		}
	]);
	assert.deepEqual(dashboard.recentResults, [
		{
			id: 'race-recent',
			name: 'Indigo Cup',
			trackName: 'Indigo Circuit',
			winnerName: 'Bolt',
			startTime: '2026-08-15T10:00:00Z'
		}
	]);
	assert.deepEqual(
		dashboard.watchedActivity.map(({ racerName, description, timestamp }) => ({
			racerName,
			description,
			timestamp
		})),
		[
			{
				racerName: 'Dash',
				description: 'Finished 2nd in Indigo Cup',
				timestamp: '2026-08-15T11:45:00Z'
			},
			{
				racerName: 'Bolt',
				description: 'Price moved to ₽12 · Race win',
				timestamp: '2026-08-15T11:30:00Z'
			}
		]
	);
});

test('portfolio totals preserve all invested cost and do not claim a complete return without every price', () => {
	const dashboard = aggregateDashboard({
		balance: 100,
		ledger: [],
		holdings: [
			{ player: 'player-1', racer: 'priced', quantity: 2, costBasis: 30 },
			{ player: 'player-1', racer: 'unpriced', quantity: 4, costBasis: 70 }
		],
		racers: [
			{ id: 'priced', name: 'Bolt', financials: { currentSharePrice: 20 } },
			{ id: 'unpriced', name: 'Dash', financials: {} }
		],
		races: [],
		racetracks: [],
		watchlist: []
	});

	assert.equal(dashboard.portfolio.costBasis, 100);
	assert.equal(dashboard.portfolio.marketValue, null);
	assert.equal(dashboard.portfolio.gain, null);
	assert.equal(dashboard.portfolio.gainPercent, null);
});
