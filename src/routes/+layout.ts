import { getAllRaces } from '$lib/stores/race.svelte';
import { getAllRacers } from '$lib/stores/racer.svelte';
import { getAllRacetracks } from '$lib/stores/racetrack.svelte';
import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';
import type { Race } from '$lib/stores/race.svelte';
import type { Racer } from '$lib/stores/racer.svelte';
import { RaceTrack } from '$lib/stores/racetrack.svelte';
import type { AuthRecord } from 'pocketbase';

let hasRun = false;

export const load: LayoutLoad = async ({ fetch, depends, url, data }) => {
	let returnData: {
		races: Race[];
		racers: Racer[];
		racetracks: RaceTrack[];
		user: AuthRecord;
		url: string;
	} = {
		races: [],
		racers: [],
		racetracks: [],
		user: data.user,
		url: data.url
	};

	if (browser && !hasRun) {
		hasRun = true;
		returnData.races = await getAllRaces();
		returnData.racers = await getAllRacers();
		returnData.racetracks = await getAllRacetracks();
	}

	return returnData;
};
