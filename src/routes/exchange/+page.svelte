<script lang="ts">
	import { getRacersContext, Pokemon, Racer } from '$lib/stores/racer.svelte';
	import { onMount } from 'svelte';
	import PocketBase from 'pocketbase';
	import { PUBLIC_PB_URL } from '$env/static/public';
	import { Trainer } from '$lib/stores/trainer.svelte';
	import Chart from 'chart.js/auto';

	const racers = getRacersContext();

	onMount(() => {
		let pb: PocketBase = new PocketBase(PUBLIC_PB_URL);
		pb.authStore.loadFromCookie(document.cookie);
		stockChart = document.getElementById('stock-chart') as HTMLCanvasElement;
	});

	let activeRacer: Racer = $state(racers[0]);
	const activePokemon: Pokemon | undefined = $derived(activeRacer.expand.pokemon);
	const activeTrainer: Trainer | undefined = $derived(activeRacer.expand.trainer);
	let chart: Chart;
	let stockChart: HTMLCanvasElement;

	function filterSearch(event: Event) {
		const searchQuery = (event.target as HTMLInputElement).value.toLowerCase();
		const filteredRacers = racers.filter((racer) => {
			const pokemon = racer.expand.pokemon as Pokemon;
			return (
				racer.name.toLowerCase().includes(searchQuery) ||
				pokemon.name.toLowerCase().includes(searchQuery)
			);
		});
		// Update the racers array with the filtered results
		// racers.set(filteredRacers);
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
			ctx.moveTo(left, y.getPixelForValue(1.0));
			ctx.lineTo(right, y.getPixelForValue(1.0));
			ctx.strokeStyle = 'red';
			ctx.stroke();
			ctx.closePath();
			ctx.restore();
		}
	};

	$effect(() => {
		if (!stockChart) return;
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
						data: activeRacer.financials.priceHistory.map((entry) => entry.price)
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
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

<div class="flex flex-col gap-6 p-6">
	<div class="card bg-base-200">
		<div class="card-body">
			<input class="input" type="text" placeholder="Search..." onchange={filterSearch} />
		</div>
	</div>
	<div class="flex gap-6">
		<div class="card bg-base-200 max-h-[calc(100vh-18rem)] overflow-visible p-6">
			<div class="card-body overflow-y-auto p-0">
				<table class="table w-full">
					<thead class="bg-base-200 sticky top-0 z-10">
						<tr>
							<th>Image</th>
							<th>Symbol</th>
							<th>Name</th>
							<th>Pokemon</th>
							<th>Trainer</th>
							<th>Price</th>
						</tr>
					</thead>
					<tbody>
						{#each racers as racer}
							{@const pokemon = racer.expand.pokemon as Pokemon}
							{@const trainer = racer.expand.trainer as Trainer}

							<tr onclick={() => setActiveRow(racer)}>
								<td>
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
								<td>{getSymbol(racer)}</td>
								<td>{racer.name}</td>
								<td>{pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)}</td>
								<td>{trainer.name}</td>
								<td>₽{racer.financials.currentSharePrice}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="card bg-base-200 w-full">
			<div class="card-body">
				<div class="flex items-center gap-6">
					<div class="flex w-full flex-col">
						<div class="text-primary text-xs">{getSymbol(activeRacer)}</div>
						<div class="text-lg">{activeRacer?.name}</div>
						<div class="text-4xl">₽{activeRacer?.financials.currentSharePrice}</div>
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
				<div class="w-full"><canvas bind:this={stockChart} id="stock-chart"></canvas></div>
			</div>
		</div>
	</div>
</div>
