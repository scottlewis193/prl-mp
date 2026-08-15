<script lang="ts">
	import { onMount } from 'svelte';
	import RaceDetail from '$lib/components/RaceDetail.svelte';
	import RaceViewer from '$lib/components/RaceViewer.svelte';
	import pb from '$lib/pocketbase';
	import { subscribeToRaceDiscovery } from '$lib/raceDiscoveryUpdates';
	import { setCurrentRaceContext } from '$lib/stores/race.svelte';
	import { setCurrentRacersContext } from '$lib/stores/racer.svelte';
	import { setCurrentRacetrackContext } from '$lib/stores/racetrack.svelte';

	let { data } = $props();
	let race = $state(data.race);
	let races = $state([race]);
	let racers = $state(data.racers);
	let deleted = $state(false);
	let now = $state(new Date());

	setCurrentRaceContext(race);
	setCurrentRacersContext(racers);
	setCurrentRacetrackContext(data.racetrack);

	onMount(() => {
		let disposed = false;
		let stop: (() => Promise<void>) | undefined;
		const timer = window.setInterval(() => (now = new Date()), 1_000);
		void subscribeToRaceDiscovery(pb, {
			races,
			racers,
			onRaceDeleted: (id) => {
				if (id === race.id) deleted = true;
			}
		}).then(async (unsubscribe) => {
			if (disposed) await unsubscribe();
			else stop = unsubscribe;
		});
		return () => {
			disposed = true;
			window.clearInterval(timer);
			void stop?.();
		};
	});
</script>

{#if deleted}
	<main class="mx-auto flex min-h-full max-w-xl items-center p-6">
		<div class="alert alert-warning flex-col items-start">
			<h1 class="text-xl font-bold">Race not found</h1>
			<p>This race was deleted while you were viewing it.</p>
			<a class="btn btn-primary btn-sm" href="/races">Back to races</a>
		</div>
	</main>
{:else if race.status === 'running'}
	<a class="btn btn-primary absolute top-2 right-2 z-[1000]" href="/races">Exit</a>
	<RaceViewer />
{:else}
	<RaceDetail {race} {racers} racetrack={data.racetrack} {now} />
{/if}
