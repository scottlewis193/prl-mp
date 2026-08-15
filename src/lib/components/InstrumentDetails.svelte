<script lang="ts">
	import { PUBLIC_PB_URL } from '$env/static/public';
	import ExchangeReadout from '$lib/components/ExchangeReadout.svelte';
	import ExchangeTradeForm from '$lib/components/ExchangeTradeForm.svelte';
	import type { TradeOrder } from '$lib/exchangeTrade';
	import { executeAndRefreshTrade } from '$lib/exchangeTradeClient';
	import { getMarketSnapshot, getPriceHistoryForRange, type ChartRange } from '$lib/exchangeMarket';
	import { formatMarketMovement, formatMarketPrice } from '$lib/exchangePresentation';
	import { getExchangePageContext } from '$lib/stores/exchange.svelte';
	import { getPBContext } from '$lib/stores/pb.svelte';
	import { getSymbol } from '$lib/stores/racer.svelte';
	import { getUserContext, syncUserContext } from '$lib/stores/user.svelte';
	import type { Racer } from '$lib/types';
	import { mutateWatchlist } from '$lib/watchlistMutation';
	import Chart from 'chart.js/auto';
	import { onMount } from 'svelte';

	const { racer }: { racer: Racer | undefined } = $props();
	const user = getUserContext();
	const pb = getPBContext();
	const exchangePage = getExchangePageContext();
	const pokemon = $derived(racer?.expand?.pokemon);
	const history = $derived(racer?.financials?.priceHistory ?? []);
	const snapshot = $derived(getMarketSnapshot(history));
	const tradeUnitPrice = $derived(Number(racer?.financials?.currentSharePrice));
	let selectedRange = $state<ChartRange>('1d');
	const chartPoints = $derived(getPriceHistoryForRange(history, selectedRange));
	const watchlist = $derived(user?.watchlist ?? []);
	const holding = $derived(exchangePage.holdings.find((entry) => entry.racer === racer?.id));
	let isUpdatingWatchlist = $state(false);
	let watchlistError = $state('');
	let chart: Chart | undefined;
	let stockChart: HTMLCanvasElement | undefined = $state();
	let chartLineColour = '#22c55e';
	let mounted = $state(false);
	let windowWidth = $state(0);
	function initChart() {
		chart?.destroy();
		chart = undefined;
		if (!stockChart || chartPoints.length === 0) return;

		chart = new Chart(stockChart, {
			type: 'line',
			data: {
				labels: chartPoints.map((point) => new Date(point.timestamp).toLocaleDateString()),
				datasets: [
					{
						label: 'Price History',
						data: chartPoints.map((point) => point.price),
						borderColor: chartLineColour,
						borderWidth: 2,
						pointRadius: chartPoints.length === 1 ? 3 : 0
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				plugins: { legend: { display: false } },
				scales: {
					y: { position: 'right', grid: { display: false } },
					x: { display: false, grid: { display: false } }
				}
			}
		});
	}

	async function updateWatchlist() {
		if (!racer?.id || !user?.id || isUpdatingWatchlist) return;
		isUpdatingWatchlist = true;
		watchlistError = '';
		try {
			await mutateWatchlist({
				current: watchlist,
				racerId: racer.id,
				apply: (next) => {
					user.watchlist = [...next];
				},
				persist: async (next) => {
					const updatedUser = await pb.collection('users').update(user.id, { watchlist: next });
					pb.authStore.save(pb.authStore.token, updatedUser);
					syncUserContext(user, updatedUser);
					return Array.isArray(updatedUser.watchlist) ? [...updatedUser.watchlist] : next;
				}
			});
		} catch (error) {
			watchlistError = error instanceof Error ? error.message : 'Could not update the watchlist.';
		} finally {
			isUpdatingWatchlist = false;
		}
	}

	async function submitTrade(order: TradeOrder) {
		if (!racer?.id || !user?.id) throw new Error('Sign in to trade shares.');
		const result = await executeAndRefreshTrade(pb, racer.id, order);
		const holdingIndex = exchangePage.holdings.findIndex((entry) => entry.racer === racer.id);
		if (holdingIndex >= 0) exchangePage.holdings[holdingIndex] = result.holding;
		else exchangePage.holdings.push(result.holding);
		racer.financials.outstandingShares = result.availableSupply;
		syncUserContext(user, result.user);
	}

	$effect(() => {
		chartPoints;
		selectedRange;
		if (mounted) initChart();
	});

	onMount(() => {
		mounted = true;
		windowWidth = window.innerWidth;
		chartLineColour =
			window
				.getComputedStyle(document.documentElement)
				.getPropertyValue('--color-primary')
				.trim() || chartLineColour;
		if (windowWidth >= 1024) exchangePage.showDetails = true;
		initChart();
		return () => chart?.destroy();
	});
</script>

<svelte:window
	onresize={() => {
		windowWidth = window.innerWidth;
		if (windowWidth >= 1024) exchangePage.showDetails = true;
		chart?.resize();
	}}
/>

{#if exchangePage.showDetails}
	<div
		class="card bg-base-200 z-[500] col-start-1 col-end-3 row-start-1 row-end-3 max-h-[calc(100vh-10rem)] w-full lg:col-start-2"
	>
		{#if racer}
			{#if windowWidth < 1024}
				<div class="flex min-h-8 w-full items-center justify-end pt-4 pr-4">
					<button
						class="btn btn-circle btn-ghost btn-sm"
						type="button"
						aria-label="Close racer details"
						onclick={() => (exchangePage.showDetails = false)}
					>
						<span aria-hidden="true">×</span>
					</button>
				</div>
			{/if}
			<div
				style="mask-image:linear-gradient(black 95%, transparent)"
				class="card-body overflow-y-scroll"
			>
				<div class="flex items-center gap-6">
					<div class="flex w-full flex-col">
						<div class="text-primary text-xs">{getSymbol(racer)}</div>
						<div class="flex items-center gap-2">
							<div class="text-lg">{racer.name || 'Unknown racer'}</div>
							<button
								type="button"
								disabled={isUpdatingWatchlist}
								class="btn btn-circle btn-ghost btn-sm text-orange-400"
								aria-label={watchlist.includes(racer.id || '')
									? 'Remove from watchlist'
									: 'Add to watchlist'}
								aria-pressed={watchlist.includes(racer.id || '')}
								onclick={updateWatchlist}
							>
								<span aria-hidden="true">{watchlist.includes(racer.id || '') ? '★' : '☆'}</span>
							</button>
						</div>
						<div class="text-4xl">{formatMarketPrice(snapshot.currentPrice)}</div>
						<div
							class="text-xs"
							class:text-success={(snapshot.change ?? 0) > 0}
							class:text-error={(snapshot.change ?? 0) < 0}
						>
							{formatMarketMovement(snapshot.change, snapshot.percentageChange)}
						</div>
						{#if watchlistError}
							<p class="text-error text-sm" role="alert">
								Watchlist update failed: {watchlistError}
							</p>
						{/if}
					</div>

					{#if pokemon?.id && pokemon.leaderboardImage}
						<img
							style="image-rendering:pixelated"
							class="size-15 rounded"
							src={`${PUBLIC_PB_URL}/api/files/pokemon/${pokemon.id}/${pokemon.leaderboardImage}`}
							alt={pokemon.name}
						/>
					{/if}
				</div>

				{#if history.length > 0}
					<div class="w-full"><canvas bind:this={stockChart} id="stock-chart"></canvas></div>
				{:else}
					<div class="flex min-h-[224px] items-center justify-center text-center">
						No price history available.
					</div>
				{/if}

				<ExchangeReadout
					{racer}
					{snapshot}
					{holding}
					hasPriceHistory={history.length > 0}
					bind:selectedRange
				/>

				{#if user?.id}
					<ExchangeTradeForm
						unitPrice={tradeUnitPrice}
						balance={Number(user.balance ?? 0)}
						availableSupply={Number(racer.financials?.outstandingShares ?? 0)}
						ownedQuantity={holding?.quantity ?? 0}
						{submitTrade}
					/>
				{/if}
			</div>
		{:else}
			<div class="flex h-full w-full items-center justify-center">
				<p>Select a racer to view details</p>
			</div>
		{/if}
	</div>
{/if}
