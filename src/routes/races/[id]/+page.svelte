<script lang="ts">
	import { goto } from '$app/navigation';
	import RaceViewer from '$lib/components/RaceViewer.svelte';
	import type { Race } from '$lib/stores/race.svelte';
	import { setRaceContext } from '$lib/stores/race.svelte';
	import { setRacersContext, type Racer } from '$lib/stores/racer.svelte';

	let { data }: { data: { race: Race; racers: Racer[] } } = $props();

	setRaceContext(data.race);
	setRacersContext(data.racers);
</script>

<button onclick={() => goto('/races')} class="btn absolute top-2 right-2 z-[1000]">Exit</button>
<RaceViewer />
