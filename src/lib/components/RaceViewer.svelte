<script lang="ts">
	import { getCurrentRaceContext } from '$lib/stores/race.svelte';
	import { getCurrentRacersContext } from '$lib/stores/racer.svelte';
	import LeaderBoard from './LeaderBoard.svelte';
	import { setCameraContext } from '$lib/stores/camera.svelte';
	import PixiTrackRenderer from './PixiTrackRenderer.svelte';
	import { getCurrentRacetrackContext } from '$lib/stores/racetrack.svelte';
	import type { Camera } from '$lib/types';

	const _race = getCurrentRaceContext();
	const _racers = getCurrentRacersContext();
	const _racetrack = getCurrentRacetrackContext();

	const camera: Camera = setCameraContext();
</script>

{#if _race}
	<div class="h-full w-full">
		<LeaderBoard />

		<PixiTrackRenderer />

		<div
			id="camera-controls"
			class="absolute bottom-0 left-0 z-100 flex h-[64px] w-full items-center justify-center gap-3 p-4 text-white"
		>
			<button class="btn btn-primary" onclick={() => (camera.mode = 'free')}>Free Camera</button>
		</div>
	</div>
{/if}
