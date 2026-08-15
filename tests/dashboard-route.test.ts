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
				{ balanceDelta: -10, balanceAfter: 250, occurredAt: new Date().toISOString() }
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
			racetracks: []
		}) as never,
		{ id: 'player-1', balance: 250, watchlist: ['racer-1'] }
	);

	assert.deepEqual(result.account, {
		balance: 250,
		change: -10,
		period: 'Last 24 hours'
	});
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
