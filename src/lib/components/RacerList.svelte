<script lang="ts">
	import { PUBLIC_PB_URL } from '$env/static/public';
	import ExchangeFilters from '$lib/components/ExchangeFilters.svelte';
	import { filterExchangeRacers, getMarketSnapshot } from '$lib/exchangeMarket';
	import { formatMarketMovement, formatMarketPrice } from '$lib/exchangePresentation';
	import { getExchangePageContext } from '$lib/stores/exchange.svelte';
	import { getRacersContext, getSymbol } from '$lib/stores/racer.svelte';
	import { getUserContext } from '$lib/stores/user.svelte';

	const racers = getRacersContext();
	const user = getUserContext();
	const exchangePage = getExchangePageContext();
	let query = $state('');
	let watchlistOnly = $state(false);
	const watchlist = $derived(user?.watchlist ?? []);
	const filteredRacers = $derived(
		filterExchangeRacers(racers, { query, watchlistOnly, watchlist })
	);

	function setActiveRow(racer: (typeof racers)[number]) {
		exchangePage.activeRacer = racer;
		exchangePage.showDetails = true;
	}
</script>

<div class="card bg-base-200 col-start-1 col-end-3 row-start-1 w-full lg:col-end-2">
	<div class="card-body">
		<ExchangeFilters bind:query bind:watchlistOnly />
	</div>
</div>

<div class="card bg-base-200 col-start-1 col-end-3 row-start-2 lg:col-end-2">
	<div style="mask-image:linear-gradient(black 95%, transparent)" class="card-body overflow-y-auto">
		{#if filteredRacers.length > 0}
			<table class="table w-full p-0">
				<tbody class="p-0">
					{#each filteredRacers as racer (racer.id)}
						{@const pokemon = racer.expand?.pokemon}
						{@const snapshot = getMarketSnapshot(racer.financials?.priceHistory ?? [])}
						{@const shortPokemonName = pokemon?.name?.split('-')[0] ?? 'Unknown Pokémon'}

						<tr
							class:bg-base-300={racer === exchangePage.activeRacer}
							class="hover:bg-base-300 cursor-pointer"
							onclick={() => setActiveRow(racer)}
						>
							<td class="min-w-10 px-2 py-2">
								{#if pokemon?.id && pokemon.leaderboardImage}
									<img
										class="size-6 rounded"
										src={`${PUBLIC_PB_URL}/api/files/pokemon/${pokemon.id}/${pokemon.leaderboardImage}`}
										alt={pokemon.name}
									/>
								{:else}
									<span class="text-base-content/60" aria-hidden="true">—</span>
								{/if}
							</td>
							<td class="px-2 py-2">
								<div>{racer.name || 'Unknown racer'}</div>
								<div class="text-primary text-xs">{getSymbol(racer)}</div>
							</td>
							<td class="px-2 py-2">
								{shortPokemonName.charAt(0).toUpperCase() + shortPokemonName.slice(1)}
							</td>
							<td class="px-2 py-2">
								<div class="text-end">{formatMarketPrice(snapshot.currentPrice)}</div>
								<div
									class="text-end text-xs"
									class:text-success={(snapshot.change ?? 0) > 0}
									class:text-error={(snapshot.change ?? 0) < 0}
									class:text-neutral={snapshot.change === null || snapshot.change === 0}
								>
									{formatMarketMovement(snapshot.change, snapshot.percentageChange)}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="text-base-content/70 py-8 text-center">No racers match these filters.</p>
		{/if}
	</div>
</div>
