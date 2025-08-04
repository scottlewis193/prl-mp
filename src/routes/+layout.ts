import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';
import type { AuthRecord } from 'pocketbase';
import type { Race, Racer, RaceTrack } from '$lib/types';
import pb from '$lib/pocketbase';

let hasRun = false;

export const load: LayoutLoad = async ({ data }) => {
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
		returnData.races = await pb.collection('races').getFullList();
		returnData.racers = await pb
			.collection('racers')
			.getFullList({ batch: 1000, expand: 'pokemon,trainer,league' });
		returnData.racetracks = await pb.collection('racetracks').getFullList();
	}

	return returnData;
};
