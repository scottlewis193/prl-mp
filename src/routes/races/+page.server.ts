import { getAllRaces } from '$lib/stores/race.svelte';
import { getAllRacers } from '$lib/stores/racer.svelte';
import { getAllRacetracks } from '$lib/stores/racetrack.svelte';

export const load = async ({ locals }) => {
	return {
		races: await getAllRaces(),
		racers: await getAllRacers(),
		racetracks: await getAllRacetracks(),
		user: locals.user
	};
};
