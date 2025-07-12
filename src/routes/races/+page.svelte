<script lang="ts">
	import { goto } from '$app/navigation';
	import TrackRenderer from '$lib/components/TrackRenderer.svelte';
	import { subscribeToRaces, type Race } from '$lib/stores/race.svelte';
	import { onMount } from 'svelte';
	import PocketBase from 'pocketbase';
	import type { Racer } from '$lib/stores/racer.svelte';

	let { data }: { data: { races: Race[] } } = $props();
	const { races } = data;

	const _races: Race[] = $state(races);

	onMount(async () => {
		const pb = new PocketBase('http://localhost:8090');
		pb.authStore.loadFromCookie(document.cookie);
		await subscribeToRaces(_races, pb);
	});
</script>

<div id="race-card-container" class="flex h-full w-full flex-wrap gap-2 p-2">
	{#each _races as race}
		<div class="card card-sm bg-base-100 h-100 w-94 shadow-sm">
			<figure class="bg-base-200 h-55">
				<TrackRenderer racetrack={race.racetrack} />
			</figure>
			<div class="card-body">
				<h2 class="card-title">
					{race.racetrack.name}
					<div class="badge badge-secondary">{race.status}</div>
				</h2>
				<p>{race.id}</p>
				<div class="card-actions justify-end">
					<button onclick={() => goto(`/races/${race.id}`)} class="btn btn-primary">View</button>
				</div>
			</div>
		</div>
	{/each}
</div>
