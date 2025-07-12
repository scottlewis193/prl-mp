import pb from '../pocketbase';
import PocketBase from 'pocketbase';

import { v4 as uuid } from 'uuid';
import { defaultRaceTrack, type RaceTrack } from '../racetrack';
import { getContext, setContext } from 'svelte';

export interface Race {
	id?: string;
	name: string;
	status: 'pending' | 'countdown' | 'running' | 'finished' | 'cancelled' | 'settled';
	racetrack: RaceTrack;
	winner: string;
	startTime: string;
	endTime: string;
	totalLaps: number;
}

export const defaultRace: Race = {
	name: `Race ${uuid().slice(0, 5)}`,
	status: 'pending',
	startTime: new Date(Date.now()).toISOString(),
	totalLaps: 3,
	racetrack: defaultRaceTrack,
	winner: '',
	endTime: ''
};

const raceKey = Symbol('race');

export function setRaceContext(race: Race | undefined = undefined) {
	let _race = $state(defaultRace);
	if (race) _race = race;

	return setContext<Race>(raceKey, _race);
}

export function getRaceContext(): Race {
	return getContext<Race>(raceKey);
}

export async function createRace() {
	const newRace = defaultRace;
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
