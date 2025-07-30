<script lang="ts">
	import { PUBLIC_PB_URL } from '$env/static/public';
	import { getExchangePageContext } from '$lib/stores/exchange.svelte';
	import { getRacersContext, getSymbol, type Pokemon, type Racer } from '$lib/stores/racer.svelte';
	import { Trainer } from '$lib/stores/trainer.svelte';
	import { getUserContext } from '$lib/stores/user.svelte';
	import type { Chart } from 'chart.js';

	// const { racers }: { racers: Racer[] } = $props();

	const racers = getRacersContext();

	let searchInput: HTMLInputElement;
	let watchlistCheck: HTMLInputElement;
	let activeRacer: Racer | undefined = $state(racers.find((racer) => racer._active));
	let user = getUserContext();
	let exchangePage = getExchangePageContext();

	const watchlist = $derived(user?.watchlist);

	let filteredRacers = $derived([...racers]);
	let activeRacerSubPageVisible = $state(false); //this is used for mobile view when the user clicks on the racer card to display the racer's details over the top of the page

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
		exchangePage.activeRacer = row;
		exchangePage.showDetails = true;
	}
</script>

<!-- {#if windowSize.width >= 1024 || !activeRacerSubPageVisible} -->
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
	<div style="mask-image:linear-gradient(black 95%, transparent)" class="card-body overflow-y-auto">
		<table class="table w-full p-0">
			<tbody class="p-0">
				{#each filteredRacers as racer}
					{@const pokemon = racer.expand.pokemon as Pokemon}
					{@const trainer = racer.expand.trainer as Trainer}
					{@const shortPokemonName = pokemon.name.split('-')[0]}

					<tr
						class:bg-base-300={racer == activeRacer}
						class="hover:bg-base-300 cursor-pointer"
						onclick={() => {
							setActiveRow(racer);
							activeRacerSubPageVisible = true;
							setTimeout(() => {
								//	initChart();
							}, 10);
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
<!-- {/if} -->
