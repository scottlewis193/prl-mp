<script lang="ts">
	import RaceDiscoveryPage from '$lib/components/RaceDiscoveryPage.svelte';
	import pb from '$lib/pocketbase';

	let { data } = $props();
</script>

<RaceDiscoveryPage
	initialRaces={data.races}
	initialRacers={data.racers}
	racetracks={data.racetracks}
	client={pb}
/>
