import type { Racer, RacerPricePoint } from '$lib/types';

export type ChartRange = '1d' | '7d' | '1m' | '3m' | '6m' | '1y' | 'all';

export type PricePoint = RacerPricePoint;

type NullableRange = { high: number | null; low: number | null };

function validHistory(history: PricePoint[], now: Date): PricePoint[] {
	const nowTime = now.getTime();
	return history
		.filter((point) => {
			const timestamp = new Date(point.timestamp).getTime();
			return Number.isFinite(timestamp) && timestamp <= nowTime && Number.isFinite(point.price);
		})
		.toSorted(
			(left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
		);
}

function rangeStart(range: Exclude<ChartRange, 'all'>, now: Date): Date {
	const start = new Date(now);
	const subtractMonths = (months: number) => {
		const day = start.getUTCDate();
		start.setUTCDate(1);
		start.setUTCMonth(start.getUTCMonth() - months);
		const lastDay = new Date(
			Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)
		).getUTCDate();
		start.setUTCDate(Math.min(day, lastDay));
	};
	switch (range) {
		case '1d':
			start.setUTCDate(start.getUTCDate() - 1);
			break;
		case '7d':
			start.setUTCDate(start.getUTCDate() - 7);
			break;
		case '1m':
			subtractMonths(1);
			break;
		case '3m':
			subtractMonths(3);
			break;
		case '6m':
			subtractMonths(6);
			break;
		case '1y':
			subtractMonths(12);
	}
	return start;
}

export function filterExchangeRacers(
	racers: Racer[],
	options: { query: string; watchlistOnly: boolean; watchlist: string[] }
): Racer[] {
	const query = options.query.trim().toLocaleLowerCase();
	const watched = new Set(options.watchlist);

	return racers.filter((racer) => {
		const matchesWatchlist = !options.watchlistOnly || (!!racer.id && watched.has(racer.id));
		const pokemonName = racer.expand?.pokemon?.name ?? '';
		const matchesQuery =
			query.length === 0 ||
			racer.name.toLocaleLowerCase().includes(query) ||
			pokemonName.toLocaleLowerCase().includes(query);
		return matchesWatchlist && matchesQuery;
	});
}

export function getPriceHistoryForRange(
	history: PricePoint[],
	range: ChartRange,
	now = new Date()
): PricePoint[] {
	const valid = validHistory(history, now);
	if (range === 'all' || valid.length === 0) return valid;

	const boundary = rangeStart(range, now).getTime();
	const firstInRange = valid.findIndex((point) => new Date(point.timestamp).getTime() >= boundary);
	if (firstInRange === -1) return valid.slice(-1);
	return valid.slice(Math.max(0, firstInRange - 1));
}

function minMax(points: PricePoint[]): NullableRange {
	if (points.length === 0) return { high: null, low: null };
	const prices = points.map((point) => point.price);
	return { high: Math.max(...prices), low: Math.min(...prices) };
}

export function getMarketSnapshot(history: PricePoint[], now = new Date()) {
	const valid = validHistory(history, now);
	const current = valid.at(-1);
	const dailyPoints = getPriceHistoryForRange(valid, '1d', now);
	const previousClose = dailyPoints.length > 1 ? dailyPoints[0] : undefined;
	const change = current && previousClose ? current.price - previousClose.price : null;
	const percentageChange =
		change !== null && previousClose && previousClose.price !== 0
			? (change / previousClose.price) * 100
			: null;
	const yearStart = new Date(now);
	yearStart.setUTCDate(yearStart.getUTCDate() - 52 * 7);
	const yearBoundary = yearStart.getTime();
	const yearPoints = valid.filter((point) => new Date(point.timestamp).getTime() >= yearBoundary);

	return {
		currentPrice: current?.price ?? null,
		change,
		percentageChange,
		daily: minMax(dailyPoints),
		weeks52: minMax(yearPoints)
	};
}
