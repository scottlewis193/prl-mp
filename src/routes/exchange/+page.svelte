<script lang="ts">
	import { Pokemon, Racer, subscribeToRacers } from '$lib/stores/racer.svelte';
	import { onMount } from 'svelte';
	import PocketBase from 'pocketbase';
	import Chart from 'chart.js/auto';

	import InstrumentDetails from '$lib/components/InstrumentDetails.svelte';
	import RacerList from '$lib/components/RacerList.svelte';
	import { getPBContext } from '$lib/stores/pb.svelte.js';
	import { setExchangePageContext } from '$lib/stores/exchange.svelte.js';
	import { setUserContext } from '$lib/stores/user.svelte.js';
	const { data } = $props();
	let pb = getPBContext();
	let exchangePage = setExchangePageContext();
	let user = setUserContext(data.user);

	onMount(async () => {
		await subscribeToRacers(data.racers, pb);
	});
</script>

{#await data.racers}
	Loading...
{:then racers}
	<div class="flex w-full justify-center">
		<div
			class="grid w-full max-w-[120rem] grid-flow-col grid-cols-2 grid-rows-[7rem_calc(100vh-19rem)] gap-4 p-4"
		>
			<RacerList {racers} />
			{#key exchangePage.activeRacer}
				<InstrumentDetails racer={exchangePage.activeRacer} />
			{/key}
		</div>
	</div>
{/await}
