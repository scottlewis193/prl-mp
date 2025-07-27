import PocketBase from 'pocketbase';
import pb from '../pocketbase';

// import { defaultRaceTrack, type RaceTrack } from '../racetrack';
import { getContext, setContext } from 'svelte';

export type RaceType = {
	id?: string;
	name: string;
	status: 'pending' | 'countdown' | 'running' | 'finished' | 'cancelled' | 'settled';
	racetrack: string;
	winner: string;
	startTime: Date;
	endTime: Date;
	totalLaps: number;
};

export class Race implements RaceType {
	id: string = '0';
	name: string = '';
	status: 'pending' | 'countdown' | 'running' | 'finished' | 'cancelled' | 'settled' = 'pending';
	racetrack: string = '175hl67e5pvjjib';
	winner: string = '';
	startTime: Date = new Date();
	totalLaps: number = 99;
	endTime: Date = new Date();
}

const raceKey = Symbol('race');
const racesKey = Symbol('races');

export function setCurrentRaceContext(race: Race) {
	const _race = $state(new Race());

	return setContext<Race>(raceKey, _race);
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

export async function createRace() {
	const newRace = new Race();
	const race = (await pb.collection('races').create(newRace)) as Race;
	return race;
}

export async function getRace(id: string) {
	const race = (await pb.collection('races').getOne(id)) as Race;
	return race;
}

export async function getFirstRace() {
	const race = (await pb.collection('races').getFirstListItem('')) as Race;
	return race;
}

export async function getRunningRaces() {
	return (await pb.collection('races').getFullList({
		filter: 'status = "running"'
	})) as Race[];
}

export async function getAllRaces() {
	return (await pb.collection('races').getFullList()) as Race[];
}

export async function deleteAllRaces() {
	const races = await pb.collection('races').getFullList();
	for (let race of races) {
		try {
			await pb.collection('races').delete(race.id);
		} catch (error) {
			console.log('nothing to delete');
		}
	}
}

export async function updateRace(id: string, updates: Partial<Race>) {
	try {
		await pb.collection('races').update(id, updates);
	} catch (error) {
		console.log('error updating race:', id);
	}
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
