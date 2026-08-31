<script lang="ts">
	import RaceDiscoveryPage from '$lib/components/RaceDiscoveryPage.svelte';
	import { getRacesContext } from '$lib/stores/race.svelte';
	import { getRacersContext } from '$lib/stores/racer.svelte';
	import { getRacetracksContext } from '$lib/stores/racetrack.svelte';

	const races = getRacesContext();
	const racers = getRacersContext();
	const racetracks = getRacetracksContext();
</script>

<RaceDiscoveryPage
	initialRaces={races}
	initialRacers={racers}
	{racetracks}
	liveUpdates={false}
/>
