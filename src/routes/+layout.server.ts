import { getAllRaces } from '$lib/stores/race.svelte';
import { getAllRacers } from '$lib/stores/racer.svelte';

export const load = async ({ locals, url }) => {
	//here we will get all the races
	const races = await getAllRaces();
	const racers = await getAllRacers();
	console.log(racers[0]);
	return { user: locals.user, url: url.pathname, races, racers };
};
