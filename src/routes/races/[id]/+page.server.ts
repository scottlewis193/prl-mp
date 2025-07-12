import { getRace } from '$lib/stores/race.svelte';
import { getRacers } from '$lib/stores/racer.svelte.js';

export const load = async ({ params }) => {
	const race = await getRace(params.id);
	const racers = await getRacers(params.id);
	return { race, racers };
};
