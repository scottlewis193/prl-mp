import assert from 'node:assert/strict';
import test from 'node:test';

import {
	filterExchangeRacers,
	getMarketSnapshot,
	getPriceHistoryForRange
} from '../src/lib/exchangeMarket';
import type { Racer } from '../src/lib/types';

const now = new Date('2026-08-14T12:00:00.000Z');

function racer(id: string, name: string, pokemon: string): Racer {
	return { id, name, expand: { pokemon: { name: pokemon } } } as Racer;
}

test('racer discovery filters the latest list by racer or pokemon name and watchlist', () => {
	const racers = [racer('1', 'Bolt', 'Pikachu'), racer('2', 'Torrent', 'Squirtle')];

	assert.deepEqual(
		filterExchangeRacers(racers, { query: 'squirt', watchlistOnly: false, watchlist: [] }).map(
			(racer) => racer.id
		),
		['2']
	);
	assert.deepEqual(
		filterExchangeRacers(racers, { query: '', watchlistOnly: true, watchlist: ['1'] }).map(
			(racer) => racer.id
		),
		['1']
	);
});

test('selected chart range includes the last price before the boundary for continuity', () => {
	const history = [
		{ timestamp: '2026-08-01T12:00:00.000Z', price: 8 },
		{ timestamp: '2026-08-07T11:00:00.000Z', price: 9 },
		{ timestamp: '2026-08-10T12:00:00.000Z', price: 11 },
		{ timestamp: '2026-08-14T12:00:00.000Z', price: 12 }
	];

	assert.deepEqual(
		getPriceHistoryForRange(history, '7d', now).map((point) => point.price),
		[9, 11, 12]
	);
});

test('calendar-month ranges include the full clamped boundary day', () => {
	const monthEnd = new Date('2025-03-31T12:00:00.000Z');
	const history = [
		{ timestamp: '2025-02-27T12:00:00.000Z', price: 7 },
		{ timestamp: '2025-02-28T12:00:00.000Z', price: 8 },
		{ timestamp: '2025-03-31T12:00:00.000Z', price: 9 }
	];

	assert.deepEqual(
		getPriceHistoryForRange(history, '1m', monthEnd).map((point) => point.price),
		[7, 8, 9]
	);
});

test('racer discovery tolerates incomplete realtime records', () => {
	const incomplete = { id: '3', name: 'Mystery', expand: {} } as Racer;
	assert.deepEqual(
		filterExchangeRacers([incomplete], {
			query: 'mystery',
			watchlistOnly: false,
			watchlist: []
		}),
		[incomplete]
	);

	const latestRacers = [racer('1', 'Bolt', 'Pikachu')];
	latestRacers.push(racer('2', 'Torrent', 'Squirtle'));
	assert.deepEqual(
		filterExchangeRacers(latestRacers, {
			query: 'torrent',
			watchlistOnly: false,
			watchlist: []
		}).map((entry) => entry.id),
		['2']
	);
});

test('market snapshot derives price movement and daily and 52-week ranges from history', () => {
	const history = [
		{ timestamp: '2025-07-01T12:00:00.000Z', price: 2 },
		{ timestamp: '2025-10-01T12:00:00.000Z', price: 6 },
		{ timestamp: '2026-08-13T10:00:00.000Z', price: 8 },
		{ timestamp: '2026-08-14T08:00:00.000Z', price: 12 },
		{ timestamp: '2026-08-14T12:00:00.000Z', price: 10 }
	];

	assert.deepEqual(getMarketSnapshot(history, now), {
		currentPrice: 10,
		change: 2,
		percentageChange: 25,
		daily: { high: 12, low: 8 },
		weeks52: { high: 12, low: 6 }
	});
});

test('market snapshot handles missing and malformed history without fake zero statistics', () => {
	assert.deepEqual(getMarketSnapshot([], now), {
		currentPrice: null,
		change: null,
		percentageChange: null,
		daily: { high: null, low: null },
		weeks52: { high: null, low: null }
	});

	assert.equal(
		getMarketSnapshot([{ timestamp: 'not-a-date', price: Number.NaN }], now).currentPrice,
		null
	);
});

test('52-week statistics exclude prices older than exactly 52 weeks', () => {
	const history = [
		{ timestamp: '2025-08-14T12:00:00.000Z', price: 1 },
		{ timestamp: '2025-08-15T12:00:00.000Z', price: 4 },
		{ timestamp: '2026-08-14T12:00:00.000Z', price: 10 }
	];

	assert.deepEqual(getMarketSnapshot(history, now).weeks52, { high: 10, low: 4 });
});
