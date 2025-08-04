import PocketBase from 'pocketbase';

// import { defaultRaceTrack, type RaceTrack } from '../racetrack';
import { getContext, setContext } from 'svelte';
import type { Race } from '$lib/types';

const raceKey = Symbol('race');
const racesKey = Symbol('races');

export function setCurrentRaceContext(race: Race | undefined = undefined) {
	const _race = $state(race);

	return setContext<Race | undefined>(raceKey, _race);
}

export function getCurrentRaceContext(): Race {
	return getContext<Race>(raceKey);
}

export function setRacesContext(races: Race[]) {
	const _races: Race[] = $state(races);
	return setContext<Race[]>(racesKey, _races);
}

export function getRacesContext(): Race[] {
	return getContext<Race[]>(racesKey);
}

export async function subscribeToRaces(racesAry: Race[], pb: PocketBase) {
	await pb.collection('races').unsubscribe();
	await pb.collection('races').subscribe('*', async function (e) {
		const raceRecord = e.record as unknown as Race;
		switch (e.action) {
			case 'create':
				racesAry.push(raceRecord);
				break;
			case 'update':
				const index = racesAry.findIndex((r) => r.id === raceRecord.id);
				if (index !== -1) {
					racesAry[index] = raceRecord;
				} else {
					racesAry.push(raceRecord);
				}
				break;
			case 'delete':
				racesAry.splice(
					racesAry.findIndex((r) => r.id === raceRecord.id),
					1
				);
				break;
		}
	});
}

export async function unsubscribeFromRaces(pb: PocketBase) {
	if (!pb) return;
	await pb.collection('races').unsubscribe();
}
