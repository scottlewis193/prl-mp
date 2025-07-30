<script lang="ts">
	import { PUBLIC_PB_URL } from '$env/static/public';
	import { getExchangePageContext } from '$lib/stores/exchange.svelte';
	import { getPBContext } from '$lib/stores/pb.svelte';
	import { getSymbol, type Racer } from '$lib/stores/racer.svelte';
	import { getUserContext } from '$lib/stores/user.svelte';
	import Chart from 'chart.js/auto';
	import { onMount } from 'svelte';

	const { racer }: { racer: Racer | undefined } = $props();
	let user = getUserContext();
	let pb = getPBContext();
	let exchangePage = getExchangePageContext();
	const pokemon = racer?.expand?.pokemon;
	const watchlist = user?.watchlist;

	let chart: Chart;
	//svelte-ignore
	let stockChart: HTMLCanvasElement;
	let chartLineColour: string;

	let windowSize: { width: number; height: number } = $state({ width: 0, height: 0 });

	function initChart() {
		if (chart) chart.destroy();
		if (!document.getElementById('stock-chart')) return;
		if (!racer) return;

		const currentValueLine = {
			id: 'currentValueLine',
			beforeDatasetsDraw(chart: Chart, args: any, pluginOptions: any) {
				const {
					ctx,
					chartArea: { top, bottom, left, right, width, height },
					scales: { x, y }
				} = chart;
				ctx.save();
				ctx.beginPath();
				ctx.moveTo(
					left,
					y.getPixelForValue(
						racer?.financials.priceHistory[racer.financials.priceHistory.length - 1].price || 0
					)
				);
				ctx.lineTo(
					right + 10,
					y.getPixelForValue(
						racer?.financials.priceHistory[racer.financials.priceHistory.length - 1].price || 0
					)
				);
				ctx.strokeStyle = chartLineColour;
				ctx.stroke();
				ctx.closePath();
				ctx.beginPath();
				ctx.roundRect(
					right + 7.5,
					y.getPixelForValue(
						racer.financials.priceHistory[racer.financials.priceHistory.length - 1].price
					) - 8,
					32,
					15,
					[5]
				);
				ctx.fillStyle = chartLineColour;
				ctx.fill();
				ctx.fillStyle = 'white';
				ctx.fillText(
					String(racer.financials.priceHistory[racer.financials.priceHistory.length - 1].price),
					right + 12,
					y.getPixelForValue(
						racer.financials.priceHistory[racer.financials.priceHistory.length - 1].price
					) + 3.5
				);
				ctx.restore();
			}
		};

		//reinitialize chart when racer changes
		chart = new Chart(stockChart, {
			plugins: [currentValueLine],
			type: 'line',

			data: {
				labels:
					racer?.financials.priceHistory.map((entry) => new Date(entry.timestamp).getDate()) || [],
				datasets: [
					{
						label: 'Price History',
						data: racer.financials.priceHistory.map((entry) => entry.price),
						borderColor: chartLineColour,
						borderWidth: 1,
						pointRadius: 0
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				layout: {
					padding: 2
				},
				plugins: {
					legend: {
						display: false
					}
				},

				scales: {
					y: {
						position: 'right',
						grid: {
							display: false
						}
					},
					x: {
						position: 'bottom',
						display: false,
						grid: {
							display: false
						}
					}
				}
			}
		});
	}

	function updateWatchlist(event: MouseEvent) {
		console.log(user);
		if (!racer?.id || !watchlist || !user) return;
		console.log('added to watchlist');
		const target = event.target as HTMLInputElement;

		const index = watchlist?.findIndex((racerId) => racerId === racer.id);
		if (index === -1) {
			watchlist.push(racer.id);
			console.log('added to watchlist');
		} else {
			watchlist.splice(index, 1);
		}
		pb.collection('users').update(user.id, { watchlist });
	}

	function getOneDayHigh(racer: Racer) {
		const financials = racer.financials;
		// filter data by today's date
		const today = new Date();
		const filteredData = financials.priceHistory.filter((data) => {
			const date = new Date(data.timestamp);
			return (
				date.getDate() === today.getDate() &&
				date.getMonth() === today.getMonth() &&
				date.getFullYear() === today.getFullYear()
			);
		});
		//work out the highest price
		let highestPrice = Math.max(...filteredData.map((data) => data.price));

		if (Math.abs(highestPrice) === Infinity) {
			highestPrice = 0;
		}

		return highestPrice;
	}

	function getOneDayLow(racer: Racer) {
		const financials = racer.financials;
		// filter data by today's date
		const today = new Date();
		const filteredData = financials.priceHistory.filter((data) => {
			const date = new Date(data.timestamp);
			return (
				date.getDate() === today.getDate() &&
				date.getMonth() === today.getMonth() &&
				date.getFullYear() === today.getFullYear()
			);
		});
		//work out the lowest price
		let lowestPrice = Math.min(...filteredData.map((data) => data.price));

		if (Math.abs(lowestPrice) === Infinity) {
			lowestPrice = 0;
		}

		return lowestPrice;
	}

	function get52WeekHigh(racer: Racer) {
		const financials = racer.financials;
		// filter data by today's date
		const today = new Date();
		const filteredData = financials.priceHistory.filter((data) => {
			const date = new Date(data.timestamp);
			return (
				date.getDate() === today.getDate() &&
				date.getMonth() === today.getMonth() &&
				date.getFullYear() === today.getFullYear()
			);
		});
		//work out the highest price
		let highestPrice = Math.max(...filteredData.map((data) => data.price));

		if (Math.abs(highestPrice) === Infinity) {
			highestPrice = 0;
		}

		return highestPrice;
	}

	function get52WeekLow(racer: Racer) {
		const financials = racer.financials;
		// filter data by today's date
		const today = new Date();
		const filteredData = financials.priceHistory.filter((data) => {
			const date = new Date(data.timestamp);
			return (
				date.getDate() === today.getDate() &&
				date.getMonth() === today.getMonth() &&
				date.getFullYear() === today.getFullYear()
			);
		});
		//work out the lowest price
		let lowestPrice = Math.min(...filteredData.map((data) => data.price));

		if (Math.abs(lowestPrice) === Infinity) {
			lowestPrice = 0;
		}

		return lowestPrice;
	}

	onMount(() => {
		chartLineColour = window
			.getComputedStyle(document.documentElement)
			.getPropertyValue('--color-primary');
		windowSize.width = window.innerWidth;
		windowSize.height = window.innerHeight;
		initChart();
		if (windowSize.width >= 1024) {
			exchangePage.showDetails = true;
		}
	});
</script>

<svelte:window
	onresize={() => {
		windowSize.width = window.innerWidth;
		windowSize.height = window.innerHeight;
		if (windowSize.width >= 1024) {
			exchangePage.showDetails = true;
		}
		if (chart) {
			chart.resize();
		}
	}}
/>

{#if exchangePage.showDetails}
	<div
		class={'card bg-base-200 z-[500] col-start-1 col-end-3 row-start-1 row-end-3 max-h-[calc(100vh-10rem)] w-full lg:col-start-2'}
	>
		{#if racer}
			{#if windowSize.width < 1024}
				<div class="flex min-h-8 w-full cursor-pointer items-center justify-end pt-4 pr-4">
					<div
						onclick={() => {
							exchangePage.showDetails = false;
						}}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="size-6"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
						</svg>
					</div>
				</div>
			{/if}
			<div
				style="mask-image:linear-gradient(black 95%, transparent)"
				class="card-body overflow-y-scroll"
			>
				<div class="flex items-center gap-6">
					<div class="flex w-full flex-col">
						<div class="text-primary text-xs">{getSymbol(racer)}</div>
						<div class="flex gap-2">
							<div class="text-lg">{racer?.name}</div>

							<div class="rating">
								<input
									type="checkbox"
									checked={user?.watchlist?.includes(racer?.id || '')}
									class="mask mask-star-2 bg-orange-400"
									onclick={(event) => updateWatchlist(event)}
								/>
							</div>
						</div>
						<div class="text-4xl">₽{racer?.financials.currentSharePrice}</div>
						<div class="text-success text-xs">+1.00 (100%)</div>
					</div>

					<img
						style="image-rendering:pixelated"
						class="size-15 rounded"
						src={PUBLIC_PB_URL +
							'/api/files/pokemon/' +
							pokemon?.id +
							'/' +
							pokemon?.leaderboardImage}
						alt={pokemon?.name}
					/>
				</div>
				{#if racer.financials.priceHistory.length > 0}
					<div class="w-full">
						<canvas bind:this={stockChart} id="stock-chart"></canvas>
					</div>
					<div class="flex w-full justify-center gap-2">
						<button class="btn btn-sm btn-soft">1d</button>
						<button class="btn btn-sm btn-soft">7d</button>
						<button class="btn btn-sm btn-soft">1m</button>
						<button class="btn btn-sm btn-soft">3m</button>
						<button class="btn btn-sm btn-soft">6m</button>
						<button class="btn btn-sm btn-soft">1y</button>
						<button class="btn btn-sm btn-soft">All</button>
					</div>
				{:else}
					<div class="flex min-h-[224px] items-center justify-center text-center">
						No data available
					</div>
				{/if}
				<div class="flex flex-col gap-2 pt-2">
					<h2 class="text-base">Your Investment</h2>
					<div class="card bg-base-100">
						<div class="card-body">
							<div class="flex w-full justify-between">
								<div class="font-bold uppercase">Value</div>
								<div class="">₽1.00</div>
							</div>
							<div class="flex w-full justify-between">
								<div class="font-bold uppercase">Return</div>
								<div class="text-success">+₽0.00</div>
							</div>
							<div class="flex w-full justify-between">
								<div class="font-bold uppercase">Shares</div>
								<div class="">1.00</div>
							</div>
							<div class="flex w-full justify-between">
								<div class="font-bold uppercase">Average Price</div>
								<div class="">₽1.00</div>
							</div>
						</div>
					</div>
				</div>
				<div class="flex flex-col gap-2">
					<h2 class="text-base">Stats</h2>
					<div class="card bg-base-100">
						<div class="card-body">
							<div class="flex w-full justify-center gap-4">
								<div class="card w-full">
									<div class="card-body bg-base-300 rounded-[var(--radius-box)]">
										<div class="text-base font-bold uppercase">1 Day</div>
										<div class="text-xs">High: ₽{getOneDayHigh(racer)}</div>
										<div class="text-xs">Low: ₽{getOneDayLow(racer)}</div>
									</div>
								</div>

								<div class="card w-full">
									<div class="card-body bg-base-300 rounded-[var(--radius-box)]">
										<div class="text-base font-bold uppercase">52 Weeks</div>
										<div class="text-xs">High: ₽{get52WeekHigh(racer)}</div>
										<div class="text-xs">Low: ₽{get52WeekLow(racer)}</div>
									</div>
								</div>
							</div>
							<div class="flex justify-between pt-4">
								<div class="text-xs font-bold uppercase">P/E Ratio</div>
								<div class="text-xs">{racer?.financials.earningsPerShare}</div>
							</div>
							<div class="flex justify-between">
								<div class="text-xs font-bold uppercase">Market Cap</div>
								<div class="text-xs">
									₽{racer?.financials.outstandingShares * racer?.financials.currentSharePrice}
								</div>
							</div>
						</div>
					</div>
				</div>
				<div class="flex flex-col gap-2">
					<h2 class="text-base">Financials</h2>
					<div class="card bg-base-100">
						<div class="card-body">WIP</div>
					</div>
				</div>

				<div class="flex flex-col gap-2">
					<h2 class="text-base">About</h2>
					<div class="card bg-base-100">
						<div class="card-body">WIP</div>
					</div>
				</div>
			</div>
			<div
				class="bg-base-200 sticky bottom-0 left-0 flex h-18 w-full items-center justify-center gap-2 pb-4"
			>
				<button class="btn btn-primary w-[50%]">Buy</button>
				<button class="btn btn-primary w-[50%]">Sell</button>
			</div>
		{:else}
			<div class="flex h-full w-full items-center justify-center">
				<p>Select a racer to view details</p>
			</div>
		{/if}
	</div>
{/if}
