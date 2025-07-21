<script lang="ts">
	import { getRacersContext, Pokemon } from '$lib/stores/racer.svelte';
	import { onMount } from 'svelte';
	import PocketBase from 'pocketbase';
	import { PUBLIC_PB_URL } from '$env/static/public';

	let activeRow;

	const racers = getRacersContext();

	onMount(() => {
		let pb: PocketBase = new PocketBase(PUBLIC_PB_URL);
		pb.authStore.loadFromCookie(document.cookie);
		console.log(racers[0]);
	});
</script>

<div id="exchange-container" class="flex w-full flex-wrap gap-6 p-6">
	<div class="card bg-base-200">
		<table class="table">
			<!-- <thead><tr><th>Id</th><th>Pokemon</th><th>Price</th><th>Change</th></tr></thead> -->
			<tbody>
				{#each racers as racer}
					{@const pokemon = racer.expand.pokemon as Pokemon}
					<tr
						><td
							><img
								class="size-6 rounded"
								src={PUBLIC_PB_URL +
									'/api/files/pokemon/' +
									pokemon.id +
									'/' +
									pokemon.leaderboardImage}
							/>
						</td><td>{racer.name}</td><td>₽{racer.financials.currentSharePrice}</td><td></td></tr
					>
				{/each}
			</tbody>
		</table>
	</div>
</div>
