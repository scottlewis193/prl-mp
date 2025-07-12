import { getAllRaces, getRace } from '$lib/stores/race.svelte';

export const load = async ({ params }) => {
	//here we will get all the races
	const races = await getAllRaces();

	return {
		races
	};
};
