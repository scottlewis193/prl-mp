import { getAllRacers } from '$lib/stores/racer.svelte';

export const load = async ({ locals }) => {
	return { racers: await getAllRacers(), user: locals.user };
};
