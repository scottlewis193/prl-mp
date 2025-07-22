<script lang="ts">
	import { getCurrentRaceContext, type Race, setCurrentRaceContext } from '$lib/stores/race.svelte';
	import {
		getCurrentRacersContext,
		setCurrentRacersContext,
		unsubscribeFromRacers,
		type Racer
	} from '$lib/stores/racer.svelte';
	import { onMount } from 'svelte';
	import LeaderBoard from './LeaderBoard.svelte';
	import { setCameraContext, type Camera } from '$lib/stores/camera.svelte';
	import PocketBase from 'pocketbase';
	import PixiTrackRenderer from './PixiTrackRenderer.svelte';
	import { goto } from '$app/navigation';

	const {
		race = undefined,
		racers = undefined,
		isPreview = false
	}: { race?: Race; racers?: Racer[]; isPreview?: boolean } = $props();

	if (race && racers) {
		setCurrentRaceContext(race);
		setCurrentRacersContext(racers);
	}

	const _race = getCurrentRaceContext();
	const _racers = getCurrentRacersContext();

	const camera: Camera = setCameraContext();
</script>

{#if _race?.startTime !== '' && _race}
	{#if !isPreview}
		<LeaderBoard />
	{/if}
	<PixiTrackRenderer tilesetUrl={'/pokemon_tileset.png'} {isPreview} />
	{#if !isPreview}
		<div
			id="camera-controls"
			class="absolute bottom-0 left-0 z-100 flex h-[64px] w-full items-center justify-center gap-3 p-4 text-white"
		>
			<button class="btn btn-primary" onclick={() => (camera.mode = 'free')}>Free Camera</button>
		</div>
	{/if}
{/if}
