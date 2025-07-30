import { getAllRaces } from '$lib/stores/race.svelte';
import { getAllRacers } from '$lib/stores/racer.svelte';
import { getAllRacetracks } from '$lib/stores/racetrack.svelte';

export const load = async ({ locals, url }) => {
	return { user: locals.user, url: url.pathname };
};
