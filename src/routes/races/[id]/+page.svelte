<script lang="ts">
	import { goto } from '$app/navigation';
	import RaceViewer from '$lib/components/RaceViewer.svelte';
	import { getRacesContext, setCurrentRaceContext } from '$lib/stores/race.svelte';
	import { getRacersContext, setCurrentRacersContext } from '$lib/stores/racer.svelte';
	import { getRacetracksContext, setCurrentRacetrackContext } from '$lib/stores/racetrack.svelte';

	const { data } = $props();
	const id = data.id;

	let races = getRacesContext();
	let racers = getRacersContext();
	let racetracks = getRacetracksContext();
	let currentRace = setCurrentRaceContext(races.find((race) => race.id == id));
	setCurrentRacersContext(racers.filter((racer) => racer.race == id));
	setCurrentRacetrackContext(racetracks.find((track) => track.id == currentRace?.racetrack));
</script>

<button
	onclick={() => {
		goto('/races');
	}}
	class="btn btn-primary absolute top-2 right-2 z-[1000]">Exit</button
>

<RaceViewer />
