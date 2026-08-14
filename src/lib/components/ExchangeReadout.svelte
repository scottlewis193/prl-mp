<script lang="ts">
	import type { ChartRange } from '$lib/exchangeMarket';
	import { formatMarketNumber, formatMarketPrice } from '$lib/exchangePresentation';
	import type { Racer } from '$lib/types';

	type Snapshot = {
		currentPrice: number | null;
		daily: { high: number | null; low: number | null };
		weeks52: { high: number | null; low: number | null };
	};

	let {
		racer,
		snapshot,
		holding,
		hasPriceHistory,
		selectedRange = $bindable('1d')
	}: {
		racer: Racer;
		snapshot: Snapshot;
		holding?: { playerId: string; sharesOwned: number };
		hasPriceHistory: boolean;
		selectedRange?: ChartRange;
	} = $props();

	const ranges: { value: ChartRange; label: string }[] = [
		{ value: '1d', label: '1d' },
		{ value: '7d', label: '7d' },
		{ value: '1m', label: '1m' },
		{ value: '3m', label: '3m' },
		{ value: '6m', label: '6m' },
		{ value: '1y', label: '1y' },
		{ value: 'all', label: 'All' }
	];
	const peRatio = $derived(
		racer.financials?.earningsPerShare && snapshot.currentPrice !== null
			? snapshot.currentPrice / racer.financials.earningsPerShare
			: null
	);

	function formatDate(value: string | undefined) {
		if (!value) return 'N/A';
		const date = new Date(value);
		return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : 'N/A';
	}
</script>

{#if hasPriceHistory}
	<div class="flex w-full flex-wrap justify-center gap-2" aria-label="Chart time range">
		{#each ranges as range}
			<button
				type="button"
				class="btn btn-sm"
				class:btn-primary={selectedRange === range.value}
				class:btn-soft={selectedRange !== range.value}
				aria-pressed={selectedRange === range.value}
				onclick={() => (selectedRange = range.value)}>{range.label}</button
			>
		{/each}
	</div>
{/if}

<section class="flex flex-col gap-2 pt-2">
	<h2 class="text-base">Your Investment</h2>
	<div class="card bg-base-100">
		<div class="card-body">
			{#if holding && holding.sharesOwned > 0}
				<div class="flex justify-between">
					<strong>Value</strong><span
						>{formatMarketPrice(
							snapshot.currentPrice === null ? null : holding.sharesOwned * snapshot.currentPrice
						)}</span
					>
				</div>
				<div class="flex justify-between">
					<strong>Shares</strong><span>{formatMarketNumber(holding.sharesOwned)}</span>
				</div>
				<p class="text-base-content/70 text-xs">
					Return and average price are unavailable because cost-basis data is not recorded.
				</p>
			{:else}
				<p class="text-base-content/70">No holdings data available.</p>
			{/if}
		</div>
	</div>
</section>

<section class="flex flex-col gap-2">
	<h2 class="text-base">Stats</h2>
	<div class="card bg-base-100">
		<div class="card-body">
			<div class="flex w-full gap-4">
				<div class="bg-base-300 w-full rounded-[var(--radius-box)] p-4">
					<div class="font-bold uppercase">1 Day</div>
					<div class="text-xs">High: {formatMarketPrice(snapshot.daily.high)}</div>
					<div class="text-xs">Low: {formatMarketPrice(snapshot.daily.low)}</div>
				</div>
				<div class="bg-base-300 w-full rounded-[var(--radius-box)] p-4">
					<div class="font-bold uppercase">52 Weeks</div>
					<div class="text-xs">High: {formatMarketPrice(snapshot.weeks52.high)}</div>
					<div class="text-xs">Low: {formatMarketPrice(snapshot.weeks52.low)}</div>
				</div>
			</div>
			<div class="flex justify-between pt-4">
				<strong>P/E Ratio</strong><span>{formatMarketNumber(peRatio)}</span>
			</div>
			<div class="flex justify-between">
				<strong>Market Cap</strong><span
					>{formatMarketPrice(
						snapshot.currentPrice === null || racer.financials?.outstandingShares === undefined
							? null
							: racer.financials.outstandingShares * snapshot.currentPrice
					)}</span
				>
			</div>
		</div>
	</div>
</section>

<section class="flex flex-col gap-2">
	<h2 class="text-base">Financials</h2>
	<div class="card bg-base-100">
		<div class="card-body gap-2">
			<div class="flex justify-between">
				<strong>Total earnings</strong><span
					>{formatMarketPrice(racer.financials?.totalEarnings)}</span
				>
			</div>
			<div class="flex justify-between">
				<strong>Earnings per share</strong><span
					>{formatMarketPrice(racer.financials?.earningsPerShare)}</span
				>
			</div>
			<div class="flex justify-between">
				<strong>Issued shares</strong><span
					>{formatMarketNumber(racer.financials?.issuedShares, 0)}</span
				>
			</div>
			<div class="flex justify-between">
				<strong>Outstanding shares</strong><span
					>{formatMarketNumber(racer.financials?.outstandingShares, 0)}</span
				>
			</div>
			<div class="flex justify-between">
				<strong>Last payout</strong><span>{formatDate(racer.financials?.lastPayoutAt)}</span>
			</div>
		</div>
	</div>
</section>

<section class="flex flex-col gap-2">
	<h2 class="text-base">About</h2>
	<div class="card bg-base-100">
		<div class="card-body gap-2">
			<div class="flex justify-between">
				<strong>Pokémon</strong><span>{racer.expand?.pokemon?.name ?? 'Unknown'}</span>
			</div>
			<div class="flex justify-between">
				<strong>Trainer</strong><span>{racer.expand?.trainer?.name ?? 'Unknown'}</span>
			</div>
			<div class="flex justify-between">
				<strong>Level</strong><span>{formatMarketNumber(racer.stats?.level, 0)}</span>
			</div>
			<div class="flex justify-between">
				<strong>Ranking</strong><span>{formatMarketNumber(racer.stats?.ranking, 0)}</span>
			</div>
			<div class="flex justify-between">
				<strong>Speed</strong><span>{formatMarketNumber(racer.stats?.speed, 0)}</span>
			</div>
			<div class="flex justify-between">
				<strong>Race record</strong><span
					>{formatMarketNumber(racer.raceHistory?.wins, 0)} wins / {formatMarketNumber(
						racer.raceHistory?.totalRaces,
						0
					)} races</span
				>
			</div>
			<div class="flex justify-between">
				<strong>Status</strong><span
					>{!racer.status
						? 'Unknown'
						: racer.status.retired
							? 'Retired'
							: racer.status.injured
								? 'Injured'
								: 'Active'}</span
				>
			</div>
		</div>
	</div>
</section>
