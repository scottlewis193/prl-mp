<script lang="ts">
	import { getRacesContext } from '$lib/stores/race.svelte';
	import { getRacetracksContext } from '$lib/stores/racetrack.svelte';
	import { goto } from '$app/navigation';

	let races = getRacesContext();
	let racetracks = getRacetracksContext();

	let filteredRaces = $derived(races.filter((race) => race.status !== 'finished'));
</script>

<div class="flex max-h-[calc(100vh-8rem)] w-full">
	<div
		id="race-card-container"
		class="flex w-[120rem] flex-wrap justify-center gap-4 overflow-y-auto p-4"
	>
		{#each filteredRaces as race}
			{@const raceTrack = racetracks.find((track) => track.id == race.racetrack)}

			<div class="card card-sm bg-base-200 h-100 w-94 shadow-sm">
				<figure class="bg-base-100 h-55">
					<!-- <RaceViewer isPreview={true} {race} racers={raceRacers} racetrack={raceTrack} /> -->
				</figure>
				<div class="card-body">
					<h2 class="card-title">
						{raceTrack?.name}
						<div class="badge badge-secondary">{race.status}</div>
					</h2>
					<p>{race.name}</p>
					<p>{race.id}</p>

					<div class="card-actions justify-end">
						<button
							onclick={() => {
								goto(`/races/${race.id}`);
							}}
							class="btn btn-primary">View</button
						>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
