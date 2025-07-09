<script>
	import RaceViewer from '$lib/components/RaceViewer.svelte';
	import Testing from '$lib/components/Testing.svelte';
	import { setRaceContext } from '$lib/stores/race.svelte';
	import { setRacersContext } from '$lib/stores/racer.svelte';

	setRaceContext();
	setRacersContext();
</script>

<RaceViewer />
