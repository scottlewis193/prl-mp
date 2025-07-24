<script lang="ts">
	import { getRacersContext, Pokemon, Racer } from '$lib/stores/racer.svelte';
	import { onMount } from 'svelte';
	import PocketBase from 'pocketbase';
	import { PUBLIC_PB_URL } from '$env/static/public';
	import { Trainer } from '$lib/stores/trainer.svelte';
	import Chart from 'chart.js/auto';
	import { getUserContext } from '$lib/stores/user.svelte';
	import { fade } from 'svelte/transition';

	const racers = getRacersContext();

	const user = getUserContext();
	let pb: PocketBase;

	let activeRacer: Racer = $state(racers[0]);
	const activePokemon: Pokemon | undefined = $derived(activeRacer?.expand?.pokemon);
	const activeTrainer: Trainer | undefined = $derived(activeRacer?.expand?.trainer);
	const watchlist = $derived(user?.watchlist);
	let chart: Chart;
	//svelte-ignore
	let stockChart: HTMLCanvasElement;
	let searchInput: HTMLInputElement;
	let watchlistCheck: HTMLInputElement;
	let chartLineColour: string;
	let filteredRacers = $state([...racers]);
	let activeRacerSubPageVisible = $state(false); //this is used for mobile view when the user clicks on the racer card to display the racer's details over the top of the page
	let windowSize: { width: number; height: number } = $state({ width: 0, height: 0 });

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

	function filterSearch() {
		const searchQuery = searchInput.value.toLowerCase();
		filteredRacers = racers.filter((racer) => {
			const pokemon = racer.expand.pokemon as Pokemon;
			return (
				(racer.name.toLowerCase().includes(searchQuery) ||
					pokemon.name.toLowerCase().includes(searchQuery)) &&
				(watchlistCheck.checked ? watchlist?.includes(racer.id || '0') : true)
			);
		});
	}

	function resetSearch() {
		searchInput.value = '';
		watchlistCheck.checked = false;
		filterSearch();
	}

	function setActiveRow(row: Racer) {
		activeRacer = row;
	}

	function getSymbol(racer: Racer) {
		const pokemon = racer.expand.pokemon as Pokemon;
		const symbolChar1 = racer.name.charAt(0).toUpperCase();
		const symbolChar2 = racer.name
			.charAt(
				Math.ceil(
					(racer.name.length - (racer.name.charAt((racer.name.length - 1) / 2) == '-' ? 0 : 1)) / 2
				)
			)
			.toUpperCase();
		const symbolChar3 = pokemon.name.charAt(0).toUpperCase();
		const symbolChar4 = pokemon.name.charAt((pokemon.name.length - 1) / 2).toUpperCase();
		const symbol = symbolChar1 + symbolChar2 + symbolChar3 + symbolChar4;

		return symbol;
	}

	function updateWatchlist(event: MouseEvent) {
		if (!activeRacer?.id || !watchlist || !user) return;
		const target = event.target as HTMLInputElement;
		target.checked;
		const index = watchlist?.findIndex((racerId) => racerId === activeRacer.id);
		if (index === -1) {
			watchlist.push(activeRacer.id);
		} else {
			watchlist.splice(index, 1);
		}
		pb.collection('users').update(user.id, { watchlist });
	}

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
					activeRacer.financials.priceHistory[activeRacer.financials.priceHistory.length - 1].price
				)
			);
			ctx.lineTo(
				right + 10,
				y.getPixelForValue(
					activeRacer.financials.priceHistory[activeRacer.financials.priceHistory.length - 1].price
				)
			);
			ctx.strokeStyle = chartLineColour;
			ctx.stroke();
			ctx.closePath();
			ctx.beginPath();
			ctx.roundRect(
				right + 7.5,
				y.getPixelForValue(
					activeRacer.financials.priceHistory[activeRacer.financials.priceHistory.length - 1].price
				) - 8,
				32,
				15,
				[5]
			);
			ctx.fillStyle = chartLineColour;
			ctx.fill();
			ctx.fillStyle = 'white';
			ctx.fillText(
				String(
					activeRacer.financials.priceHistory[activeRacer.financials.priceHistory.length - 1].price
				),
				right + 12,
				y.getPixelForValue(
					activeRacer.financials.priceHistory[activeRacer.financials.priceHistory.length - 1].price
				) + 3.5
			);
			ctx.restore();
		}
	};

	onMount(() => {
		pb = new PocketBase(PUBLIC_PB_URL);
		pb.authStore.loadFromCookie(document.cookie);
		stockChart = document.getElementById('stock-chart') as HTMLCanvasElement;
		chartLineColour = window
			.getComputedStyle(document.documentElement)
			.getPropertyValue('--color-primary');
		windowSize.width = window.innerWidth;
		windowSize.height = window.innerHeight;
	});

	$effect(() => {
		if (!stockChart) return;
		if (chart) chart.destroy();
		//reinitialize chart when activeRacer changes
		if (activeRacer.financials.priceHistory.length == 0) return;
		if (!activeRacerSubPageVisible && windowSize.width < 1024) return;
		chart = new Chart(stockChart, {
			plugins: [currentValueLine],
			type: 'line',

			data: {
				labels: activeRacer.financials.priceHistory.map((entry) =>
					new Date(entry.timestamp).getDate()
				),
				datasets: [
					{
						label: 'Price History',
						data: activeRacer.financials.priceHistory.map((entry) => entry.price),
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
	});
</script>

<svelte:window
	onresize={() => {
		windowSize.width = window.innerWidth;
		windowSize.height = window.innerHeight;
	}}
/>
<div class="flex w-full justify-center">
	<div
		class="grid w-full max-w-[120rem] grid-flow-col grid-cols-2 grid-rows-[7rem_calc(100vh-19rem)] gap-4 p-4"
	>
		{#if windowSize.width >= 1024 || !activeRacerSubPageVisible}
			<div class="card bg-base-200 col-start-1 col-end-3 row-start-1 w-full lg:col-end-2">
				<div class="card-body">
					<div class="flex gap-4">
						<input
							bind:this={searchInput}
							class="input input-sm w-full"
							type="text"
							placeholder="Search..."
							onkeydown={filterSearch}
						/>
						<button onclick={resetSearch} class="btn btn-sm btn-soft">Reset</button>
					</div>
					<div class="">
						<input
							bind:this={watchlistCheck}
							class="btn btn-sm btn-soft"
							type="checkbox"
							name="filter"
							aria-label="Watchlist"
							onchange={filterSearch}
						/>
					</div>
				</div>
			</div>
			<div class="card bg-base-200 col-start-1 col-end-3 row-start-2 lg:col-end-2">
				<div
					style="mask-image:linear-gradient(black 95%, transparent)"
					class="card-body overflow-y-auto"
				>
					<table class="table w-full p-0">
						<tbody class="p-0">
							{#each filteredRacers as racer}
								{@const pokemon = racer.expand.pokemon as Pokemon}
								{@const trainer = racer.expand.trainer as Trainer}
								{@const shortPokemonName = pokemon.name.split('-')[0]}

								<tr
									class:bg-base-300={racer == activeRacer && windowSize.width >= 1024}
									class="hover:bg-base-300 cursor-pointer"
									onclick={() => {
										setActiveRow(racer);
										activeRacerSubPageVisible = true;
									}}
								>
									<td class="min-w-10 px-2 py-2">
										<img
											class="size-6 rounded"
											src={PUBLIC_PB_URL +
												'/api/files/pokemon/' +
												pokemon.id +
												'/' +
												pokemon.leaderboardImage}
											alt={pokemon.name}
										/>
									</td>
									<td class="px-2 py-2"
										><div class="">{racer.name}</div>
										<div class="text-primary text-xs">{getSymbol(racer)}</div></td
									>
									<!-- <td></td> -->
									<td class="px-2 py-2"
										>{shortPokemonName.charAt(0).toUpperCase() + shortPokemonName.slice(1)}</td
									>
									<!-- <td>{trainer.name}</td> -->
									<td class="px-2 py-2">
										<div class="text-end">₽{racer.financials.currentSharePrice}</div>
										<div
											class="text-end text-xs"
											class:text-success={racer.financials.currentSharePrice >= 0}
											class:text-error={racer.financials.currentSharePrice < 0}
											class:text-neutral={racer.financials.currentSharePrice === 0}
										>
											{(racer.financials.currentSharePrice >= 0 ? '+' : '') +
												racer.financials.currentSharePrice} (100%)
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
		<!-- (activeRacerSubPageVisible ? 'visible opacity-100' : 'invisible opacity-0') -->
		{#if activeRacerSubPageVisible || windowSize.width >= 1024}
			<div
				transition:fade={{ duration: 300 }}
				class={'card bg-base-200 z-[500] col-start-1 col-end-3 row-start-1 row-end-3 max-h-[calc(100vh-10rem)] w-full lg:col-start-2'}
			>
				{#if windowSize.width < 1024}
					<div class="flex min-h-8 w-full cursor-pointer items-center justify-end pt-4 pr-4">
						<div
							onclick={() => {
								activeRacerSubPageVisible = false;
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
							<div class="text-primary text-xs">{getSymbol(activeRacer)}</div>
							<div class="flex gap-2">
								<div class="text-lg">{activeRacer?.name}</div>

								<div class="rating">
									<input
										type="checkbox"
										checked={user?.watchlist.includes(activeRacer?.id || '')}
										class="mask mask-star-2 bg-orange-400"
										onclick={(event) => updateWatchlist(event)}
									/>
								</div>
							</div>
							<div class="text-4xl">₽{activeRacer?.financials.currentSharePrice}</div>
							<div class="text-success text-xs">+1.00 (100%)</div>
						</div>

						<img
							style="image-rendering:pixelated"
							class="size-15 rounded"
							src={PUBLIC_PB_URL +
								'/api/files/pokemon/' +
								activePokemon?.id +
								'/' +
								activePokemon?.leaderboardImage}
							alt={activePokemon?.name}
						/>
					</div>
					{#if activeRacer.financials.priceHistory.length > 0}
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
											<div class="text-xs">High: ₽{getOneDayHigh(activeRacer)}</div>
											<div class="text-xs">Low: ₽{getOneDayLow(activeRacer)}</div>
										</div>
									</div>

									<div class="card w-full">
										<div class="card-body bg-base-300 rounded-[var(--radius-box)]">
											<div class="text-base font-bold uppercase">52 Weeks</div>
											<div class="text-xs">High: ₽{get52WeekHigh(activeRacer)}</div>
											<div class="text-xs">Low: ₽{get52WeekLow(activeRacer)}</div>
										</div>
									</div>
								</div>
								<div class="flex justify-between pt-4">
									<div class="text-xs font-bold uppercase">P/E Ratio</div>
									<div class="text-xs">{activeRacer?.financials.earningsPerShare}</div>
								</div>
								<div class="flex justify-between">
									<div class="text-xs font-bold uppercase">Market Cap</div>
									<div class="text-xs">
										₽{activeRacer?.financials.outstandingShares *
											activeRacer?.financials.currentSharePrice}
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
					<button class="btn btn-primary btn-wide">Buy</button>
					<button class="btn btn-primary btn-wide">Sell</button>
				</div>
			</div>
		{/if}
	</div>
</div>
