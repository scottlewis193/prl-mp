import { getAllRaces } from '$lib/stores/race.svelte';
import { getAllRacers } from '$lib/stores/racer.svelte';
import { getAllRacetracks } from '$lib/stores/racetrack.svelte';

export const load = async ({ locals, url }) => {
	//here we will get all the races
	const races = await getAllRaces();
	const racers = await getAllRacers();
	const racetracks = await getAllRacetracks();

	return { user: locals.user, url: url.pathname, races, racers, racetracks };
};
