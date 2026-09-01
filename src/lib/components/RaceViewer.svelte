<script lang="ts">
	import { getCurrentRaceContext } from '$lib/stores/race.svelte';
	import { getCurrentRacersContext } from '$lib/stores/racer.svelte';
	import LeaderBoard from './LeaderBoard.svelte';
	import { setCameraContext } from '$lib/stores/camera.svelte';
	import PixiTrackRenderer from './PixiTrackRenderer.svelte';
	import { getCurrentRacetrackContext } from '$lib/stores/racetrack.svelte';
	import type { Camera } from '$lib/types';
	import { getUserContext } from '$lib/stores/user.svelte';
	import { getLeadingRacer } from '$lib/raceProgress';
	import { raceFormatLabel } from '$lib/raceDiscovery';
	import { collectRaceSignificantEvents } from '$lib/raceMoveEvents';

	const _race = getCurrentRaceContext();
	const _racers = getCurrentRacersContext();
	const _racetrack = getCurrentRacetrackContext();

	const camera: Camera = setCameraContext();
	const user = getUserContext();
	const significantEvents = $derived(collectRaceSignificantEvents(_racers));

	$effect(() => {
		if (user?.options?.raceViewer?.cameraMode !== 'follow') return;
		const leader = getLeadingRacer(_racers, _racetrack);
		if (!leader?.id) return;
		camera.mode = 'follow';
		camera.targetRacerId = leader.id;
	});
</script>

{#if _race}
	<div class="h-full w-full">
		<div class="badge badge-primary absolute top-2 left-2 z-[1000]">
			{raceFormatLabel(_race.raceFormat)}
		</div>
		<LeaderBoard />
		{#if significantEvents.length > 0}
			<section
				class="rounded-box bg-base-100/90 absolute top-12 right-2 z-[1000] max-h-40 w-80 overflow-y-auto p-3 shadow"
				aria-label="Live race highlights"
			>
				<h2 class="mb-2 font-semibold">Live race highlights</h2>
				<ul class="space-y-2 text-sm">
					{#each significantEvents.slice(-4).reverse() as event (event.id)}
						<li>{event.summary}</li>
					{/each}
				</ul>
			</section>
		{/if}

		<PixiTrackRenderer />

		<div
			id="camera-controls"
			class="absolute bottom-0 left-0 z-100 flex h-[64px] w-full items-center justify-center gap-3 p-4 text-white"
		>
			<button class="btn btn-primary" onclick={() => (camera.mode = 'free')}>Free Camera</button>
		</div>
	</div>
{/if}
