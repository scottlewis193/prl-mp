<script lang="ts">
	import { onMount } from 'svelte';
	import type PocketBase from 'pocketbase';
	import type { Race, Racer, RaceTrackType } from '$lib/types';
	import { subscribeToRaceDiscovery } from '$lib/raceDiscoveryUpdates';
	import RaceDiscovery from './RaceDiscovery.svelte';

	let {
		initialRaces,
		initialRacers,
		racetracks,
		client,
		liveUpdates = true
	}: {
		initialRaces: Race[];
		initialRacers: Racer[];
		racetracks: RaceTrackType[];
		client?: PocketBase;
		liveUpdates?: boolean;
	} = $props();
	let races = $state(initialRaces);
	let racers = $state(initialRacers);
	let loading = $state(false);
	let now = $state(new Date());

	onMount(() => {
		let disposed = false;
		let stop: (() => Promise<void>) | undefined;
		const timer = window.setInterval(() => (now = new Date()), 1_000);
		if (liveUpdates && client) {
			loading = true;
			void subscribeToRaceDiscovery(client, { races, racers }).then(async (unsubscribe) => {
				if (disposed) await unsubscribe();
				else stop = unsubscribe;
				loading = false;
			});
		}
		return () => {
			disposed = true;
			window.clearInterval(timer);
			void stop?.();
		};
	});
</script>

<RaceDiscovery {races} {racers} {racetracks} {loading} {now} />
