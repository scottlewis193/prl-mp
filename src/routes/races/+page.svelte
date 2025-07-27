<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		getRacesContext,
		setCurrentRaceContext,
		subscribeToRaces,
		type Race
	} from '$lib/stores/race.svelte';
	import RaceViewer from '$lib/components/RaceViewer.svelte';
	import {
		getRacersContext,
		setCurrentRacersContext,
		subscribeToRacers,
		type Racer
	} from '$lib/stores/racer.svelte';
	import { onMount } from 'svelte';
	import { getUserContext } from '$lib/stores/user.svelte';
	import { getRacetracksContext, type RaceTrack } from '$lib/stores/racetrack.svelte';
	import { getPBContext } from '$lib/stores/pb.svelte';

	const { data } = $props();

	const { races, racers, racetracks, user } = $derived(data);

	let pb = getPBContext();
	let currentRace: Race | undefined = $state(undefined);
	let currentRacers: Racer[] | undefined = $state(undefined);
	let currentRacetrack: RaceTrack | undefined = $state(undefined);

	onMount(async () => {
		subscribeToRaces(races, pb);
		subscribeToRacers(racers, pb);
	});
</script>

{#if user?.options?.raceViewer?.isViewing && currentRace && currentRacers && currentRacetrack}
	<button
		onclick={() => {
			if (!user) return;
			user.options.raceViewer.isViewing = false;
			currentRace = undefined;
			currentRacers = undefined;
			currentRacetrack = undefined;
		}}
		class="btn btn-primary absolute top-2 right-2 z-[1000]">Exit</button
	>
	<RaceViewer race={currentRace} racers={currentRacers} racetrack={currentRacetrack} />
{:else}
	<div class="flex max-h-[calc(100vh-8rem)] w-full">
		<div
			id="race-card-container"
			class="flex w-[120rem] flex-wrap justify-center gap-4 overflow-y-auto p-4"
		>
			{#each races as race}
				{@const raceRacers = racers.filter((racer) => racer.race === race.id)}
				{@const raceTrack = racetracks.find((track) => track.id === race.racetrack)}

				<div class="card card-sm bg-base-200 h-100 w-94 shadow-sm">
					<figure class="bg-base-100 h-55">
						<RaceViewer isPreview={true} {race} racers={raceRacers} racetrack={raceTrack} />
					</figure>
					<div class="card-body">
						<h2 class="card-title">
							{raceTrack?.name}
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
									currentRacetrack = raceTrack;
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
