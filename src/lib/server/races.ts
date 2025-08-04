import { Race } from '$lib/types';
import pb from './pocketbase';
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
