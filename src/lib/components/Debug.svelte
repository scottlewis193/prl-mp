<script lang="ts">
	import { getCameraContext } from '$lib/stores/camera.svelte';
	import { getRaceContext } from '$lib/stores/race.svelte';
	import { getRacersContext } from '$lib/stores/racer.svelte';

	const race = getRaceContext();
	const camera = getCameraContext();
	const racers = getRacersContext();
</script>

<div>{camera.isPanning}</div>
<div>{camera.x}</div>
<div>{camera.y}</div>
<div>{camera.zoom}</div>
<div>{racers[0]}</div>
