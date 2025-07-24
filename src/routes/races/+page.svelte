<script lang="ts">
	import { goto } from '$app/navigation';
	import { getRacesContext, setCurrentRaceContext, type Race } from '$lib/stores/race.svelte';
	import RaceViewer from '$lib/components/RaceViewer.svelte';
	import { getRacersContext, setCurrentRacersContext, type Racer } from '$lib/stores/racer.svelte';
	import { onMount } from 'svelte';
	import { getUserContext } from '$lib/stores/user.svelte';

	const races = getRacesContext();
	const racers = getRacersContext();
	const user = getUserContext();

	let currentRace: Race | undefined = $state(undefined);
	let currentRacers: Racer[] | undefined = $state(undefined);
</script>

{#if user?.options.raceViewer.isViewing && currentRace && currentRacers}
	<button
		onclick={() => {
			if (!user) return;
			user.options.raceViewer.isViewing = false;
			currentRace = undefined;
			currentRacers = undefined;
		}}
		class="btn btn-primary absolute top-2 right-2 z-[1000]">Exit</button
	>
	<RaceViewer race={currentRace} racers={currentRacers} />
{:else}
	<div class="flex h-full w-full justify-center">
		<div
			id="race-card-container"
			class="flex h-full w-[120rem] flex-wrap gap-4 overflow-y-scroll p-4"
		>
			{#each races as race}
				{@const raceRacers = racers.filter((racer) => racer.race === race.id)}
				<div class="card card-sm bg-base-200 h-100 w-94 shadow-sm">
					<figure class="bg-base-100 h-55">
						<RaceViewer isPreview={true} {race} racers={raceRacers} />
					</figure>
					<div class="card-body">
						<h2 class="card-title">
							{race.racetrack.name}
							<div class="badge badge-secondary">{race.status}</div>
						</h2>
						<p>{race.id}</p>
						<div class="card-actions justify-end">
							<button
								onclick={() => {
									if (!user) return;
									user.options.raceViewer.isViewing = true;
									currentRace = race;
									currentRacers = raceRacers;
								}}
								class="btn btn-primary">View</button
							>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
